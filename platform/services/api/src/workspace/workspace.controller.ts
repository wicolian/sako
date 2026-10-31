import { Controller, Get, Post, Patch, Body, Delete, Param, UseGuards, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspaceId, OptionalWorkspaceId } from '../common/decorators/workspace.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/clerk.config';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';

@ApiTags('Workspace')
@ApiBearerAuth('bearer')
@ApiSecurity('workspace-header')
@Controller('workspace')
export class WorkspaceController {
  private readonly logger = new Logger(WorkspaceController.name);

  constructor(
    private workspaceService: WorkspaceService,
    private prisma: PrismaService,
  ) { }

  /**
   * DEBUG ONLY - Remove after fixing
   * Shows all workspace memberships for the current user
   */
  @Get('debug/my-memberships')
  @UseGuards(ClerkAuthGuard)
  @BypassSubscription()
  @BypassWorkspaceMember()
  @ApiOperation({
    summary: 'Debug: Show my workspace memberships',
    description: 'DEV ONLY - Shows all workspaceMember records for the authenticated user',
  })
  async getMyMemberships(@CurrentUser() user: AuthUser) {
    this.logger.log(`[DEBUG] Fetching memberships for user: ${JSON.stringify(user)}`);

    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: true,
        user: true,
      },
    });

    this.logger.log(`[DEBUG] Found ${memberships.length} memberships`);

    return {
      authUser: user,
      memberships: memberships.map(m => ({
        membershipId: m.id,
        userId: m.userId,
        workspaceId: m.workspaceId,
        role: m.role,
        workspaceName: m.workspace.name,
        workspaceSlug: m.workspace.slug,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * GET /api/v1/workspace/list
   * Returns all workspaces the user belongs to
   */
  @Get('list')
  @UseGuards(ClerkAuthGuard)
  @BypassSubscription()
  @BypassWorkspaceMember()
  @ApiOperation({ summary: 'List my workspaces' })
  async listMyWorkspaces(@CurrentUser() user: AuthUser) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { createdAt: 'desc' },
    });
    return memberships.map(m => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    }));
  }

  /**
   * GET /api/v1/workspace/me
   * Returns the user's default workspace by resolving from workspace memberships
   * Used during onboarding after successful Stripe checkout
   * Returns 404 with code "NO_WORKSPACE" if user has no workspace yet
   * Includes self-healing: attempts to bootstrap workspace from CheckoutAttempt if webhook missed
   */
  @Get('me')
  @UseGuards(ClerkAuthGuard)
  @BypassSubscription()
  @BypassWorkspaceMember()
  @ApiOperation({
    summary: 'Get my workspace',
    description: 'Returns the authenticated user\'s workspace. Returns 404 with NO_WORKSPACE code if workspace not found.',
  })
  async getMyWorkspace(
    @CurrentUser() user: AuthUser,
    @OptionalWorkspaceId() headerWorkspaceId?: string | null,
  ) {
    this.logger.log(`[/workspace/me] Authenticated user: ${user.email} (id: ${user.id}, clerkId: ${user.clerkUserId})`);

    // If header is present, try to find that specific membership
    let membership;

    if (headerWorkspaceId) {
      this.logger.log(`[/workspace/me] Requested workspace via header: ${headerWorkspaceId}`);
      membership = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: headerWorkspaceId,
            userId: user.id,
          },
        },
        include: {
          workspace: {
            include: {
              subscription: true,
              plan: true,
            },
          },
        },
      });

      if (!membership) {
        this.logger.warn(`[/workspace/me] User ${user.id} is not a member of requested workspace ${headerWorkspaceId}`);
        // Fallback to default logic below instead of throwing immediately? 
        // Or throw 403? Let's fall back to default to avoid getting stuck.
      }
    }

    if (!membership) {
      // Find the user's default workspace membership
      membership = await this.prisma.workspaceMember.findFirst({
        where: { userId: user.id },
        include: {
          workspace: {
            include: {
              subscription: true,
              plan: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' }, // OWNER comes first
          { createdAt: 'desc' }, // Most recent if multiple
        ],
      });
    }

    this.logger.log(`[/workspace/me] Membership query result: ${membership ? `found workspace ${membership.workspaceId}` : 'NO MEMBERSHIP FOUND'}`);

    if (!membership || !membership.workspace) {
      this.logger.warn(`[/workspace/me] No workspace found for user ${user.email} (${user.id})`);

      // Last-chance self-heal: try to bootstrap workspace from latest CheckoutAttempt
      try {
        const bootstrapResult = await this.workspaceService.bootstrapWorkspaceForUser(user.id);
        if (bootstrapResult?.workspaceId) {
          this.logger.log(
            `[/workspace/me] Bootstrap succeeded for user ${user.id}, workspace=${bootstrapResult.workspaceId}`,
          );
          return this.workspaceService.getWorkspaceDetails(bootstrapResult.workspaceId);
        }
      } catch (bootstrapErr: any) {
        this.logger.error(
          `[/workspace/me] Bootstrap failed for user ${user.id}: ${bootstrapErr?.message}`,
        );
      }

      // Return structured error - frontend will trigger recovery flow
      throw new NotFoundException({
        statusCode: 404,
        message: 'No workspace found for user',
        code: 'NO_WORKSPACE',
        errorCode: 'NO_WORKSPACE',
      });
    }

    this.logger.log(`[/workspace/me] Returning workspace details for ${membership.workspaceId}`);
    // Return full workspace details
    return this.workspaceService.getWorkspaceDetails(membership.workspaceId);
  }

  @Get('details')
  @ApiSecurity('workspace-header')
  @ApiOperation({
    summary: 'Get workspace details (legacy)',
    description: 'Returns workspace info, plan, subscription, derived limits, task counts, and credit summaries',
  })
  async getWorkspace(@WorkspaceId() workspaceId: string) {
    return this.workspaceService.getWorkspaceDetails(workspaceId);
  }

  @Patch('me')
  @UseGuards(ClerkAuthGuard)
  @ApiOperation({
    summary: 'Update workspace settings',
    description: 'Updates workspace name and/or timezone. Requires OWNER role.',
  })
  async updateMyWorkspace(
    @CurrentUser() user: AuthUser,
    @WorkspaceId() workspaceId: string,
    @Body() body: { name?: string; timezone?: string },
  ) {
    // Validate at least one field is provided
    if (!body.name && !body.timezone) {
      throw new BadRequestException('At least one field (name or timezone) must be provided');
    }

    // Verify user is owner of this workspace
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (membership.role !== 'OWNER') {
      throw new ForbiddenException('Only workspace owners can update settings');
    }

    // Build update data
    const updateData: any = {};
    if (body.name) {
      // Basic validation
      if (body.name.trim().length < 2) {
        throw new BadRequestException('Workspace name must be at least 2 characters');
      }
      if (body.name.trim().length > 100) {
        throw new BadRequestException('Workspace name must be less than 100 characters');
      }
      updateData.name = body.name.trim();
    }
    if (body.timezone) {
      // Basic timezone validation - could be more strict
      if (!body.timezone.includes('/')) {
        throw new BadRequestException('Invalid timezone format');
      }
      updateData.timezone = body.timezone;
    }

    // Update workspace
    const updatedWorkspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
      include: {
        subscription: true,
        plan: true,
      },
    });

    this.logger.log(`[PATCH /workspace/me] User ${user.email} updated workspace ${workspaceId}: ${JSON.stringify(updateData)}`);

    // Return full workspace details
    return this.workspaceService.getWorkspaceDetails(workspaceId);
  }

  @Get('brands/options')
  @ApiOperation({
    summary: 'Get brand options for workspace',
    description: 'Returns simplified brand list for dropdowns (id, name, toneTags, primaryColor)',
  })
  async getBrandOptions(@WorkspaceId() workspaceId: string) {
    const brands = await this.prisma.brand.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        toneTags: true,
        colorsJson: true,
      },
      orderBy: { name: 'asc' },
    });

    return brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      toneTags: brand.toneTags,
      primaryColor: brand.colorsJson
        ? (brand.colorsJson as any)?.primary || null
        : null,
    }));
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get workspace metrics',
    description: 'Returns basic SLA and quality metrics for the dashboard',
  })
  async getMetrics(@WorkspaceId() workspaceId: string) {
    return this.workspaceService.getMetrics(workspaceId);
  }

  @Get('members')
  @ApiOperation({
    summary: 'Get workspace members',
    description: 'Returns all members of the workspace with their roles',
  })
  async getMembers(@WorkspaceId() workspaceId: string) {
    return this.workspaceService.getMembers(workspaceId);
  }

  @Post('members/invite')
  @ApiOperation({
    summary: 'Invite member',
    description: 'Adds a member to the workspace if seat limits allow and sends invitation email',
  })
  async inviteMember(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { email: string; role?: string },
  ) {
    return this.workspaceService.inviteMember(workspaceId, body.email, body.role, user.id);
  }

  @Delete('members/:memberId')
  @ApiOperation({
    summary: 'Remove member',
    description: 'Removes a member from the workspace (except OWNER)',
  })
  async removeMember(
    @WorkspaceId() workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.workspaceService.removeMember(workspaceId, memberId);
  }

  @Post('members/:memberId/role')
  @ApiOperation({
    summary: 'Update member role',
    description: 'Updates a member role (OWNER/SUBMITTER/MEMBER/VIEWER). Only owners can do this.',
  })
  async updateMemberRole(
    @WorkspaceId() workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() body: { role: string },
  ) {
    return this.workspaceService.updateMemberRole(workspaceId, memberId, body.role);
  }

  @Get('credits/history')
  @ApiOperation({
    summary: 'Get day credit history',
    description: 'Returns day credit burn history with rollover information',
  })
  async getCreditHistory(@WorkspaceId() workspaceId: string) {
    return this.workspaceService.getCreditHistory(workspaceId);
  }

  @Get('credits/forecast')
  @ApiOperation({
    summary: 'Forecast remaining day credits',
    description: 'Projects when credits will run out based on current burn rate',
  })
  async getCreditForecast(@WorkspaceId() workspaceId: string) {
    return this.workspaceService.getCreditForecast(workspaceId);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dashboard data (aggregate)',
    description: 'Returns all dashboard data in a single call: workspace details, tasks, metrics, credit forecast, and drafts. Optimized for performance.',
  })
  async getDashboardData(@WorkspaceId() workspaceId: string) {
    return this.workspaceService.getDashboardData(workspaceId);
  }
}
