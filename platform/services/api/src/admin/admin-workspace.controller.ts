import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { AnalyticsService } from '../common/analytics/analytics.service';
import { getPlanVariantByKey } from '../billing/plan.config';
import { PlanCode, SubscriptionStatus, WorkspaceRole } from '@prisma/client';
import { IsString, IsEmail, IsEnum, IsOptional, IsInt, Min, IsObject } from 'class-validator';

/**
 * Validates Stripe price ID format
 * Must start with 'price_' to be valid
 */
function isValidStripePriceId(priceId: string | undefined): boolean {
  if (!priceId) return true; // Optional field
  return priceId.startsWith('price_') && priceId.length > 6;
}

class CreateEnterpriseWorkspaceDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsEmail()
  ownerEmail: string;

  @IsEnum(PlanCode)
  basePlanCode: PlanCode;

  @IsInt()
  @Min(1)
  @IsOptional()
  customActiveTaskLimit?: number;

  @IsInt()
  @Min(3600)
  @IsOptional()
  customTatSeconds?: number;

  @IsString()
  @IsOptional()
  customStripePriceId?: string;

  @IsObject()
  @IsOptional()
  customMetadata?: Record<string, any>;
}

class UpdatePlanOverrideDto {
  @IsEnum(PlanCode)
  @IsOptional()
  basePlanCode?: PlanCode;

  @IsInt()
  @Min(1)
  @IsOptional()
  customActiveTaskLimit?: number;

  @IsInt()
  @Min(3600)
  @IsOptional()
  customTatSeconds?: number;

  @IsString()
  @IsOptional()
  customStripePriceId?: string;

  @IsObject()
  @IsOptional()
  customMetadata?: Record<string, any>;
}

@ApiTags('Admin - Workspaces')
@ApiBearerAuth()
@Controller('admin/workspaces')
@BypassWorkspaceMember() // Admin endpoints don't require workspace membership
@BypassSubscription() // Admin endpoints bypass subscription checks
export class AdminWorkspaceController {
  private readonly logger = new Logger(AdminWorkspaceController.name);

  constructor(
    private prisma: PrismaService,
    private analytics: AnalyticsService,
    private configService: ConfigService,
  ) {}

  @Post()
  @AdminOnly()
  @ApiOperation({ summary: 'Create an enterprise client workspace with plan overrides' })
  async createEnterpriseWorkspace(@Body() dto: CreateEnterpriseWorkspaceDto) {
    this.logger.log(`Creating enterprise workspace: ${dto.name} for ${dto.ownerEmail}`);

    // Validate Stripe price ID format if provided
    if (dto.customStripePriceId && !isValidStripePriceId(dto.customStripePriceId)) {
      throw new HttpException(
        'Invalid Stripe price ID format. Must start with "price_"',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Find or create the owner user
    let owner = await this.prisma.user.findUnique({
      where: { email: dto.ownerEmail },
    });

    if (!owner) {
      // Create a placeholder user - they'll need to sign up via Clerk later
      owner = await this.prisma.user.create({
        data: {
          email: dto.ownerEmail,
          name: dto.ownerEmail.split('@')[0],
          role: 'CLIENT',
        },
      });
      this.logger.log(`Created placeholder user for ${dto.ownerEmail}`);
    }

    // Generate unique slug
    const baseSlug = dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'enterprise';
    let slug = baseSlug;
    let counter = 1;
    while (await this.prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Find the plan from DB and config
    const plan = await this.prisma.plan.findUnique({
      where: { code: dto.basePlanCode },
    });

    if (!plan) {
      throw new HttpException(`Plan ${dto.basePlanCode} not found`, HttpStatus.BAD_REQUEST);
    }

    // Get plan variant from config for credits and TAT
    const planVariant = getPlanVariantByKey(`${dto.basePlanCode}_MONTHLY`, this.configService);
    if (!planVariant) {
      throw new HttpException(`Plan config ${dto.basePlanCode} not found`, HttpStatus.BAD_REQUEST);
    }

    // Create workspace with subscription and plan override in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          slug,
          timezone: 'UTC',
          planId: plan.id,
        },
      });

      // Create subscription (enterprise = managed externally, no Stripe)
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1); // 1 year billing period

      await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          planCode: dto.basePlanCode,
          status: SubscriptionStatus.ACTIVE,
          activeTaskLimit: dto.customActiveTaskLimit || plan.activeTaskLimit,
          slaSeconds: dto.customTatSeconds || planVariant.tatSeconds,
          billingPeriodStart: now,
          billingPeriodEnd: periodEnd,
          // No stripeSubscriptionId for enterprise/manual clients
        },
      });

      // Create plan override if any custom values provided
      if (dto.customActiveTaskLimit || dto.customTatSeconds || dto.customStripePriceId || dto.customMetadata) {
        await tx.workspacePlanOverride.create({
          data: {
            workspaceId: workspace.id,
            basePlanCode: dto.basePlanCode,
            customActiveTaskLimit: dto.customActiveTaskLimit,
            customTatSeconds: dto.customTatSeconds,
            customStripePriceId: dto.customStripePriceId,
            customMetadata: dto.customMetadata,
          },
        });
      }

      // Add owner as workspace member
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: owner.id,
          role: WorkspaceRole.OWNER,
        },
      });

      // Provision credits
      await tx.dayCredit.create({
        data: {
          workspaceId: workspace.id,
          totalCredits: planVariant.dayCreditsPerCycle,
          usedCredits: 0,
          periodStart: now,
          periodEnd: periodEnd,
        },
      });

      await tx.aICredit.create({
        data: {
          workspaceId: workspace.id,
          totalCredits: planVariant.aiCreditsPerCycle,
          usedCredits: 0,
          periodStart: now,
          periodEnd: periodEnd,
        },
      });

      return workspace;
    });

    // Track analytics
    this.analytics.trackWorkspaceEvent(result.id, 'EnterpriseWorkspaceCreated', {
      ownerEmail: dto.ownerEmail,
      basePlanCode: dto.basePlanCode,
      hasCustomOverrides: !!(dto.customActiveTaskLimit || dto.customTatSeconds),
    });

    this.logger.log(`Created enterprise workspace ${result.id} (${result.slug}) for ${dto.ownerEmail}`);

    return {
      id: result.id,
      name: result.name,
      slug: result.slug,
      ownerId: owner.id,
      ownerEmail: owner.email,
      basePlanCode: dto.basePlanCode,
      isEnterprise: true, // No Stripe subscription - managed externally
      hasCustomOverrides: !!(dto.customActiveTaskLimit || dto.customTatSeconds || dto.customStripePriceId),
    };
  }

  @Get(':workspaceId/override')
  @AdminOnly()
  @ApiOperation({ summary: 'Get plan override for a workspace' })
  async getPlanOverride(@Param('workspaceId') workspaceId: string) {
    const override = await this.prisma.workspacePlanOverride.findUnique({
      where: { workspaceId },
      include: {
        workspace: {
          include: {
            subscription: true,
          },
        },
      },
    });

    if (!override) {
      // Return empty override info
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: { subscription: true, plan: true },
      });

      if (!workspace) {
        throw new HttpException('Workspace not found', HttpStatus.NOT_FOUND);
      }

      return {
        workspaceId,
        hasOverride: false,
        effectivePlanCode: workspace.subscription?.planCode || workspace.plan?.code,
        effectiveActiveTaskLimit: workspace.subscription?.activeTaskLimit,
        effectiveSlaSeconds: workspace.subscription?.slaSeconds,
      };
    }

    return {
      hasOverride: true,
      ...override,
      effectiveActiveTaskLimit: override.customActiveTaskLimit || override.workspace.subscription?.activeTaskLimit,
      effectiveSlaSeconds: override.customTatSeconds || override.workspace.subscription?.slaSeconds,
    };
  }

  @Patch(':workspaceId/override')
  @AdminOnly()
  @ApiOperation({ summary: 'Update or create plan override for a workspace' })
  async updatePlanOverride(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdatePlanOverrideDto,
  ) {
    // Validate Stripe price ID format if provided
    if (dto.customStripePriceId && !isValidStripePriceId(dto.customStripePriceId)) {
      throw new HttpException(
        'Invalid Stripe price ID format. Must start with "price_"',
        HttpStatus.BAD_REQUEST,
      );
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true, plan: true },
    });

    if (!workspace) {
      throw new HttpException('Workspace not found', HttpStatus.NOT_FOUND);
    }

    const basePlanCode = dto.basePlanCode || workspace.subscription?.planCode || workspace.plan?.code;

    if (!basePlanCode) {
      throw new HttpException('Cannot determine base plan code', HttpStatus.BAD_REQUEST);
    }

    const override = await this.prisma.workspacePlanOverride.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        basePlanCode: basePlanCode as PlanCode,
        customActiveTaskLimit: dto.customActiveTaskLimit,
        customTatSeconds: dto.customTatSeconds,
        customStripePriceId: dto.customStripePriceId,
        customMetadata: dto.customMetadata,
      },
      update: {
        basePlanCode: dto.basePlanCode || undefined,
        customActiveTaskLimit: dto.customActiveTaskLimit,
        customTatSeconds: dto.customTatSeconds,
        customStripePriceId: dto.customStripePriceId,
        customMetadata: dto.customMetadata,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Updated plan override for workspace ${workspaceId}`);

    return override;
  }
}

