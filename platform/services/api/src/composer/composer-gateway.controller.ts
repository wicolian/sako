import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader, ApiParam } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { OptionalWorkspaceId } from '../common/decorators/workspace.decorator';
import { 
  hasStudioAccess, 
  PlanCode, 
  getPlanDisplayName,
  hasProFeatures,
  hasMotion,
  hasStrategy,
  hasUnlimitedComposerCredits,
  getDefaultAiCreditLimit,
  loadPlanConfig,
} from '../billing/plan.config';
import { ComposerService } from './composer.service';
import { TaskStatus, TaskCategory, ComposerSource, AiDraftType, AiDraftStatus } from '@prisma/client';
import {
  ComposerCapabilitiesResponseDto,
  ComposerCreditsDto,
  DayCreditsDto,
  ComposerBrandItemDto,
  CreateComposerTaskFromDraftDto,
  CreateComposerTaskFromDraftResponseDto,
  CreateComposerCheckoutSessionDto,
  CreateComposerCheckoutSessionResponseDto,
  ComposerGatewayErrorDto,
  ComposerSsoTokenResponseDto,
} from './dto/composer-gateway.dto';
import { HmacAuthGuard } from '../common/guards/hmac-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { 
  normalizePlanCode,
  getPriceIdForPlan,
  BillingInterval,
} from '../billing/plan.config';
import { getStripeClient } from '../common/stripe/stripe-client';

/**
 * Composer Gateway Controller
 * 
 * Provides endpoints for an external Composer app (in a separate repo) to:
 * 1. Discover workspace context and plan capabilities
 * 2. List brands for brand selection
 * 3. Send Composer drafts to Sako Studio ("Send to Sako")
 * 
 * Authentication: Clerk JWT (same as client/studio apps)
 * Workspace: Resolved from user membership or x-workspace-id header
 */
@ApiTags('Composer Gateway')
@ApiBearerAuth()
@Controller('composer')
export class ComposerGatewayController {
  private readonly logger = new Logger(ComposerGatewayController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly composerService: ComposerService,
    private readonly configService: ConfigService,
  ) {}

  // ========================================
  // GET /composer/capabilities
  // ========================================

  @Get('capabilities')
  @BypassWorkspaceMember() // Allow without x-workspace-id; we resolve from user membership
  @BypassSubscription() // Allow even if subscription is in bad state; we return info about it
  @ApiOperation({
    summary: 'Get Composer capabilities for the current user',
    description: `
      Returns comprehensive capability information for the external Composer app.
      
      **Authentication:** Requires valid Clerk JWT token.
      
      **Workspace Resolution:**
      - If x-workspace-id header is provided, uses that workspace (if user is a member)
      - Otherwise, resolves the user's default workspace from membership
      
      **Response includes:**
      - plan_code: Current plan (COMPOSER_FREE, COMPOSER_PRO, CORE, OPS, ENTERPRISE)
      - plan_display_name: Human-readable plan name
      - composer_credits: Credit type (METERED/UNLIMITED), limit, used, resets_at
      - has_studio_access: Whether "Send to Sako" is available
      - can_send_to_studio: Same as has_studio_access
      - max_parallel_studio_tasks: 0 for Composer-only, 1/2/3 for Studio plans
      - can_copy_to_figma: Pro-tier feature (Pro and Studio plans)
      - can_publish_domain: Pro-tier feature (Pro and Studio plans)
      - has_motion: Whether motion/video is included (Studio plans only)
      - has_strategy: Enterprise only
      - seats: Team seats included
      - day_credits: (Studio plans only) Available, used, rollover
      
      **Error Codes:**
      - NO_WORKSPACE: User has no workspace membership
    `,
  })
  @ApiHeader({
    name: 'x-workspace-id',
    required: false,
    description: 'Optional workspace ID. If not provided, uses user\'s default workspace.',
  })
  @ApiResponse({ status: 200, description: 'Capabilities retrieved successfully', type: ComposerCapabilitiesResponseDto })
  @ApiResponse({ status: 400, description: 'No workspace found', type: ComposerGatewayErrorDto })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async getCapabilities(
    @CurrentUser() user: AuthUser,
    @OptionalWorkspaceId() headerWorkspaceId?: string | null,
  ): Promise<ComposerCapabilitiesResponseDto> {
    this.logger.log(`[GET /composer/capabilities] User: ${user.email} (id: ${user.id})`);

    // 1. Resolve workspace
    const workspaceId = await this.resolveWorkspaceForUser(user.id, headerWorkspaceId);

    // 2. Get workspace with subscription
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });

    if (!workspace) {
      throw new BadRequestException({
        error: 'NO_WORKSPACE',
        message: 'Workspace not found.',
      });
    }

    // 3. Determine plan and core capabilities
    const planCode = (workspace.subscription?.planCode || 'COMPOSER_FREE') as PlanCode;
    const planConfig = loadPlanConfig(this.configService);
    const plan = planConfig[planCode];
    const studioAccess = hasStudioAccess(planCode);
    const isUnlimited = hasUnlimitedComposerCredits(planCode);

    // 4. Get AI credits and compute composer_credits object
    const now = new Date();
    const aiCredit = await this.prisma.aICredit.findFirst({
      where: { workspaceId, periodEnd: { gte: now } },
      orderBy: { periodEnd: 'asc' },
    });

    const composerCredits: ComposerCreditsDto = {
      type: isUnlimited ? 'UNLIMITED' : 'METERED',
      used: aiCredit?.usedCredits ?? 0,
      resets_at: aiCredit?.periodEnd?.toISOString() ?? this.getNextMonthStart().toISOString(),
    };

    // Add limit only for metered plans
    if (!isUnlimited) {
      composerCredits.limit = getDefaultAiCreditLimit(planCode) ?? plan.aiCreditsMonthly;
    }

    // 5. Get day credits for Studio plans
    let dayCredits: DayCreditsDto | undefined;
    if (studioAccess) {
      const dayCredit = await this.prisma.dayCredit.findFirst({
        where: { workspaceId, periodEnd: { gte: now } },
        orderBy: { periodEnd: 'asc' },
      });
      
      if (dayCredit) {
        dayCredits = {
          available: dayCredit.totalCredits - dayCredit.usedCredits,
          used: dayCredit.usedCredits,
          rollover_months: 3, // Standard rollover policy
        };
      }
    }

    // 6. Get max parallel tasks from subscription or plan default
    const maxParallelStudioTasks = studioAccess 
      ? (workspace.subscription?.activeTaskLimit ?? plan.activeTaskLimit)
      : 0;

    this.logger.log(`[GET /composer/capabilities] Resolved workspace: ${workspaceId}, plan: ${planCode}`);

    return {
      // Plan identification
      plan_code: planCode,
      plan_display_name: getPlanDisplayName(planCode),

      // Composer credits
      composer_credits: composerCredits,

      // Studio access
      has_studio_access: studioAccess,
      can_send_to_studio: studioAccess,
      max_parallel_studio_tasks: maxParallelStudioTasks,

      // Pro-tier features (Figma export, publish to domain)
      can_copy_to_figma: hasProFeatures(planCode),
      can_publish_domain: hasProFeatures(planCode),

      // Studio-specific features
      has_motion: hasMotion(planCode),
      has_strategy: hasStrategy(planCode),
      seats: plan.seats,
      day_credits: dayCredits,

      // Internal / backward compat
      workspace_id: workspaceId,
    };
  }

  /**
   * Get the start of next month (for default resets_at when no credit record exists)
   */
  private getNextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  // ========================================
  // POST /composer/create-checkout-session
  // ========================================

  @Post('create-checkout-session')
  @HttpCode(HttpStatus.CREATED)
  @BypassWorkspaceMember()
  @BypassSubscription()
  @ApiOperation({
    summary: 'Create Stripe checkout session for plan upgrade',
    description: `
      Creates a Stripe checkout session for upgrading to a paid plan.
      This is the recommended way for Composer to initiate plan upgrades.
      
      **Authentication:** Requires valid Clerk JWT token.
      
      **Supported Plans:**
      - COMPOSER_PRO: $20/mo - 100 AI credits, Figma export, publish to domain
      - CORE: $2,500/mo - Unlimited AI credits, Studio access (1 parallel task)
      - OPS: $4,500/mo - Unlimited AI credits, Studio access (2 parallel tasks)
      - ENTERPRISE: $8,500/mo - Unlimited AI credits, Studio access (3+ parallel tasks)
      
      **Note:** Composer will create workspace automatically if user doesn't have one.
    `,
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Checkout session created', 
    type: CreateComposerCheckoutSessionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid plan or Stripe not configured', type: ComposerGatewayErrorDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createCheckoutSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateComposerCheckoutSessionDto,
  ): Promise<CreateComposerCheckoutSessionResponseDto> {
    this.logger.log(`[POST /composer/create-checkout-session] User: ${user.email}, plan: ${dto.plan_code}`);

    // Validate Stripe is configured
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new BadRequestException({
        error: 'STRIPE_NOT_CONFIGURED',
        message: 'Stripe is not configured. Please contact support.',
      });
    }

    // Validate and normalize plan code
    const normalizedPlanCode = normalizePlanCode(dto.plan_code);
    if (!normalizedPlanCode || normalizedPlanCode === 'COMPOSER_FREE') {
      throw new BadRequestException({
        error: 'INVALID_PLAN',
        message: 'Invalid plan code. Must be COMPOSER_PRO, CORE, OPS, or ENTERPRISE.',
      });
    }

    // Map billing interval
    const billingInterval = dto.billing_interval === 'YEARLY' 
      ? BillingInterval.YEARLY 
      : BillingInterval.MONTHLY;

    // Get price ID
    const priceId = getPriceIdForPlan(normalizedPlanCode, billingInterval, this.configService);
    if (!priceId) {
      throw new BadRequestException({
        error: 'PLAN_NOT_AVAILABLE',
        message: `${normalizedPlanCode} plan is not available yet. Please contact support.`,
      });
    }

    // Get Stripe client
    const stripe = getStripeClient();

    // Get or create Stripe customer
    let customerId: string;
    const customers = await stripe.customers.search({
      query: `email:'${user.email}'`,
      limit: 1,
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
    }

    // Try to find user's workspace
    let workspaceId: string | undefined;
    const dbUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: user.id },
          { clerkUserId: user.id },
        ],
      },
      include: {
        memberships: {
          include: { workspace: true },
          take: 1,
        },
      },
    });

    if (dbUser?.memberships?.[0]?.workspace) {
      workspaceId = dbUser.memberships[0].workspace.id;
    }

    // Build success and cancel URLs
    const composerUrl = this.configService.get<string>('COMPOSER_URL') || 'https://composer.trysako.com';
    const successUrl = `${composerUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${composerUrl}/checkout/cancel`;

    // Build metadata
    const planKey = `${normalizedPlanCode}_${billingInterval}`;
    const metadata: Record<string, string> = {
      planCode: normalizedPlanCode,
      billingInterval,
      planKey,
      userId: user.id,
      email: user.email,
      isComposerCheckout: 'true',
    };

    if (workspaceId) {
      metadata.workspaceId = workspaceId;
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: { metadata },
    });

    if (!session.url) {
      throw new BadRequestException({
        error: 'CHECKOUT_FAILED',
        message: 'Failed to create checkout session. Please try again.',
      });
    }

    this.logger.log(`[POST /composer/create-checkout-session] Created session ${session.id} for user ${user.id}`);

    return {
      session_id: session.id,
      checkout_url: session.url,
    };
  }

  // ========================================
  // GET /composer/brands
  // ========================================

  @Get('brands')
  @BypassWorkspaceMember() // We do our own membership check with resolution
  @ApiOperation({
    summary: 'List brands for Composer',
    description: `
      Returns all brands for the user's workspace, for populating brand dropdowns in Composer.
      
      **Authentication:** Requires valid Clerk JWT token.
      
      **Workspace Resolution:**
      - If x-workspace-id header is provided, uses that workspace (if user is a member)
      - Otherwise, resolves the user's default workspace from membership
      
      **Response:** Array of brand objects with:
      - id, name
      - colors, typography (JSON objects)
      - logoUrl, primaryColor, secondaryColor, accentColor
      - brandVoice, toneTags
      
      Returns empty array if workspace has no brands.
    `,
  })
  @ApiHeader({
    name: 'x-workspace-id',
    required: false,
    description: 'Optional workspace ID. If not provided, uses user\'s default workspace.',
  })
  @ApiResponse({ status: 200, description: 'Brands retrieved successfully', type: [ComposerBrandItemDto] })
  @ApiResponse({ status: 400, description: 'No workspace found', type: ComposerGatewayErrorDto })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async getBrands(
    @CurrentUser() user: AuthUser,
    @OptionalWorkspaceId() headerWorkspaceId?: string | null,
  ): Promise<ComposerBrandItemDto[]> {
    this.logger.log(`[GET /composer/brands] User: ${user.email} (id: ${user.id})`);

    // 1. Resolve workspace
    const workspaceId = await this.resolveWorkspaceForUser(user.id, headerWorkspaceId);

    // 2. Fetch brands
    const brands = await this.prisma.brand.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });

    this.logger.log(`[GET /composer/brands] Found ${brands.length} brands for workspace ${workspaceId}`);

    // 3. Map to response format
    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      colors: brand.colorsJson || undefined,
      typography: brand.typographyJson || undefined,
      logoUrl: brand.logoUrl,
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      accentColor: brand.accentColor,
      brandVoice: brand.voiceGuidelines,
      toneTags: brand.toneTags || [],
    }));
  }

  // ========================================
  // POST /composer/tasks/from-draft
  // ========================================

  @Post('tasks/from-draft')
  @HttpCode(HttpStatus.CREATED)
  @BypassWorkspaceMember() // We do our own membership check with resolution
  @ApiOperation({
    summary: 'Create a Studio task from a Composer draft (Send to Sako)',
    description: `
      Creates a new task in Sako Studio from a Composer-generated design.
      This is the "Send to Sako" functionality.
      
      **Authentication:** Requires valid Clerk JWT token.
      
      **Workspace Resolution:**
      - If x-workspace-id header is provided, uses that workspace (if user is a member)
      - Otherwise, resolves the user's default workspace from membership
      
      **Requirements:**
      - Workspace must have a Studio plan (Core, Ops, Enterprise)
      - If brandId is provided, it must belong to the same workspace
      
      **Behavior:**
      - Creates an AiDraft record with the HTML and design JSON
      - Creates a Task linked to the draft
      - Task status: IN_PROGRESS if slots available, otherwise QUEUED
      
      **Error Codes:**
      - NO_WORKSPACE: User has no workspace membership
      - NO_STUDIO_ACCESS: Plan does not include Studio (Composer Free/Pro)
      - BRAND_NOT_FOUND: Provided brandId doesn't exist in workspace
    `,
  })
  @ApiHeader({
    name: 'x-workspace-id',
    required: false,
    description: 'Optional workspace ID. If not provided, uses user\'s default workspace.',
  })
  @ApiResponse({ status: 201, description: 'Task created successfully', type: CreateComposerTaskFromDraftResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request', type: ComposerGatewayErrorDto })
  @ApiResponse({ status: 403, description: 'Plan does not include Studio access', type: ComposerGatewayErrorDto })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async createTaskFromDraft(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateComposerTaskFromDraftDto,
    @OptionalWorkspaceId() headerWorkspaceId?: string | null,
  ): Promise<CreateComposerTaskFromDraftResponseDto> {
    this.logger.log(`[POST /composer/tasks/from-draft] User: ${user.email}, title: ${dto.title}`);

    // 1. Resolve workspace
    const workspaceId = await this.resolveWorkspaceForUser(user.id, headerWorkspaceId);

    // 2. Get workspace with subscription
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true, plan: true },
    });

    if (!workspace) {
      throw new BadRequestException({
        error: 'NO_WORKSPACE',
        message: 'Workspace not found.',
      });
    }

    // 3. Validate Studio access
    const planCode = (workspace.subscription?.planCode || 'COMPOSER_FREE') as PlanCode;
    if (!hasStudioAccess(planCode)) {
      throw new ForbiddenException({
        error: 'NO_STUDIO_ACCESS',
        message: 'Send to Sako is only available on Core, Ops, or Enterprise plans.',
      });
    }

    // 4. Validate and resolve brand
    // For creating AiDraft, brandId is required - use provided or get first brand
    let resolvedBrandId = dto.brandId;
    if (dto.brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: dto.brandId, workspaceId },
      });
      if (!brand) {
        throw new BadRequestException({
          error: 'BRAND_NOT_FOUND',
          message: 'The specified brand does not exist in this workspace.',
        });
      }
    } else {
      // Get workspace's first brand as default
      const firstBrand = await this.prisma.brand.findFirst({
        where: { workspaceId },
        orderBy: { name: 'asc' },
      });
      if (firstBrand) {
        resolvedBrandId = firstBrand.id;
      }
    }

    // 5. Check active task limit
    const activeTaskLimit = workspace.subscription?.activeTaskLimit ?? workspace.plan?.activeTaskLimit ?? 1;
    const activeTaskCount = await this.prisma.task.count({
      where: {
        workspaceId,
        status: TaskStatus.IN_PROGRESS,
      },
    });
    const initialStatus = activeTaskCount < activeTaskLimit ? TaskStatus.IN_PROGRESS : TaskStatus.QUEUED;

    // 6. Determine asset type
    const assetType = this.mapAssetType(dto.assetType);

    // 7. Create AiDraft and Task in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Build task description
      const taskDescription = dto.notes
        ? `Design from Composer.\n\n${dto.notes}`
        : 'Design generated in Composer. Please review and produce final production assets.';

      // Create Task first (AiDraft requires brandId which may not be set)
      const task = await tx.task.create({
        data: {
          workspaceId,
          brandId: resolvedBrandId,
          title: dto.title,
          description: taskDescription,
          category: TaskCategory.DESIGN,
          status: initialStatus,
          source: ComposerSource.COMPOSER_STANDALONE,
          createdById: user.id,
          aiDraftRequested: true,
          aiDraftStatus: AiDraftStatus.READY,
          inProgressAt: initialStatus === TaskStatus.IN_PROGRESS ? new Date() : null,
        },
      });

      // Create AiDraft record if we have a brand
      let aiDraftId: string | null = null;
      if (resolvedBrandId) {
        const aiDraft = await tx.aiDraft.create({
          data: {
            workspaceId,
            taskId: task.id,
            brandId: resolvedBrandId,
            type: assetType,
            status: AiDraftStatus.READY, // Already generated in Composer
            html: dto.html,
            designJson: dto.designJson || undefined,
            variantLabel: dto.title,
            primaryHeadline: dto.title,
          },
        });
        aiDraftId = aiDraft.id;

        // Link draft to task
        await tx.task.update({
          where: { id: task.id },
          data: { aiDraftSelectedId: aiDraft.id },
        });
      }

      return { task, aiDraftId };
    });

    this.logger.log(
      `[POST /composer/tasks/from-draft] Created task ${result.task.id}${result.aiDraftId ? ` and draft ${result.aiDraftId}` : ''} for workspace ${workspaceId}`,
    );

    return {
      taskId: result.task.id,
      aiDraftId: result.aiDraftId || result.task.id, // Fallback to task ID if no draft
      workspaceId,
      redirectUrl: `/tasks/${result.task.id}`,
    };
  }

  // ========================================
  // GET /composer/sso-token
  // ========================================

  @Get('sso-token')
  @BypassWorkspaceMember() // We resolve workspace from user membership
  @BypassSubscription() // Allow even without active subscription
  @ApiOperation({
    summary: 'Generate SSO token for Composer',
    description: `
      Generates an HMAC-signed SSO token for redirecting users to Composer.
      
      **Authentication:** Requires valid Clerk JWT token.
      
      **Workspace Resolution:**
      - If x-workspace-id header is provided, uses that workspace (if user is a member)
      - Otherwise, resolves the user's default workspace from membership
      
      **Token Format:**
      - base64(payload).hmac_signature
      - Payload: { userId, email, workspaceId, exp }
      - Expiry: 5 minutes
      
      **Response:**
      - token: The HMAC-signed SSO token
      - redirect_url: Full URL to Composer with token as query param
    `,
  })
  @ApiHeader({
    name: 'x-workspace-id',
    required: false,
    description: 'Optional workspace ID. If not provided, uses user\'s default workspace.',
  })
  @ApiResponse({ status: 200, description: 'SSO token generated successfully', type: ComposerSsoTokenResponseDto })
  @ApiResponse({ status: 400, description: 'No workspace found', type: ComposerGatewayErrorDto })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async getSsoToken(
    @CurrentUser() user: AuthUser,
    @OptionalWorkspaceId() headerWorkspaceId?: string | null,
  ): Promise<ComposerSsoTokenResponseDto> {
    this.logger.log(`[GET /composer/sso-token] User: ${user.email} (id: ${user.id})`);

    // 1. Resolve workspace
    const workspaceId = await this.resolveWorkspaceForUser(user.id, headerWorkspaceId);

    // 2. Get HMAC secret
    const hmacSecret = this.configService.get<string>('COMPOSER_HMAC_SECRET');
    if (!hmacSecret) {
      throw new BadRequestException({
        error: 'SSO_NOT_CONFIGURED',
        message: 'Composer SSO is not configured. Contact support.',
      });
    }

    // 3. Build token payload (5-minute expiry)
    const payload = {
      userId: user.id,
      email: user.email,
      workspaceId,
      exp: Date.now() + 5 * 60 * 1000,
    };

    // 4. Create HMAC signature
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const signature = crypto
      .createHmac('sha256', hmacSecret)
      .update(payloadB64)
      .digest('hex');

    const token = `${payloadB64}.${signature}`;

    // 5. Build redirect URL
    const composerUrl = this.configService.get<string>('COMPOSER_URL') || 'https://composer.trysako.com';
    const redirectUrl = `${composerUrl}?sso_token=${encodeURIComponent(token)}`;

    this.logger.log(`[GET /composer/sso-token] Generated token for workspace ${workspaceId}`);

    return {
      token,
      redirect_url: redirectUrl,
    };
  }

  // ========================================
  // GET /composer/internal/brands/:workspaceId (HMAC Auth)
  // ========================================

  @Get('internal/brands/:workspaceId')
  @Public() // Bypass Clerk auth — uses HMAC instead
  @UseGuards(HmacAuthGuard)
  @ApiOperation({
    summary: 'Get brands for a workspace (internal HMAC-authenticated)',
    description: `
      Internal endpoint for Composer backend to fetch brands.
      
      **Authentication:** HMAC signature (not Clerk JWT)
      - X-Composer-Signature: HMAC-SHA256 of { workspaceId, timestamp }
      - X-Composer-Timestamp: Unix timestamp (ms)
      
      **Rate Limit:** 100 requests/minute per workspace
      
      **Response:** Array of brand objects (same as GET /composer/brands)
    `,
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace ID to fetch brands for' })
  @ApiHeader({ name: 'X-Composer-Signature', description: 'HMAC-SHA256 signature', required: true })
  @ApiHeader({ name: 'X-Composer-Timestamp', description: 'Unix timestamp (ms)', required: true })
  @ApiResponse({ status: 200, description: 'Brands retrieved successfully', type: [ComposerBrandItemDto] })
  @ApiResponse({ status: 401, description: 'Invalid signature or expired request', type: ComposerGatewayErrorDto })
  @ApiResponse({ status: 404, description: 'Workspace not found', type: ComposerGatewayErrorDto })
  async getInternalBrands(
    @Param('workspaceId') workspaceId: string,
  ): Promise<ComposerBrandItemDto[]> {
    this.logger.log(`[GET /composer/internal/brands/:workspaceId] Workspace: ${workspaceId}`);

    // Verify workspace exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException({
        error: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace not found.',
      });
    }

    // Fetch brands
    const brands = await this.prisma.brand.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });

    this.logger.log(`[GET /composer/internal/brands/:workspaceId] Found ${brands.length} brands`);

    // Map to response format (same as public endpoint)
    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      colors: brand.colorsJson || undefined,
      typography: brand.typographyJson || undefined,
      logoUrl: brand.logoUrl,
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      accentColor: brand.accentColor,
      brandVoice: brand.voiceGuidelines,
      toneTags: brand.toneTags || [],
    }));
  }

  // ========================================
  // Private Helpers
  // ========================================

  /**
   * Resolve workspace ID for a user.
   * Uses header if provided, otherwise finds user's default workspace from membership.
   */
  private async resolveWorkspaceForUser(
    userId: string,
    headerWorkspaceId?: string | null,
  ): Promise<string> {
    // If header provided, verify membership
    if (headerWorkspaceId) {
      const membership = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: headerWorkspaceId,
            userId,
          },
        },
      });

      if (membership) {
        return headerWorkspaceId;
      }
      // If not a member of requested workspace, fall through to default
      this.logger.warn(
        `[resolveWorkspaceForUser] User ${userId} is not a member of requested workspace ${headerWorkspaceId}, falling back to default`,
      );
    }

    // Find user's default workspace
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId },
      orderBy: [
        { role: 'asc' }, // OWNER first
        { createdAt: 'desc' }, // Most recent
      ],
    });

    if (!membership) {
      throw new BadRequestException({
        error: 'NO_WORKSPACE',
        message: 'No active workspace found for this user.',
      });
    }

    return membership.workspaceId;
  }

  /**
   * Map asset type string to AiDraftType enum
   */
  private mapAssetType(assetType?: string): AiDraftType {
    if (!assetType) {
      return AiDraftType.LANDING_PAGE;
    }

    const upper = assetType.toUpperCase();
    switch (upper) {
      case 'LANDING_PAGE':
      case 'LANDINGPAGE':
        return AiDraftType.LANDING_PAGE;
      case 'AD_CREATIVE':
      case 'ADCREATIVE':
      case 'AD':
      case 'SOCIAL':
        return AiDraftType.AD_CREATIVE;
      case 'BANNER':
        return AiDraftType.BANNER;
      default:
        return AiDraftType.LANDING_PAGE;
    }
  }
}

