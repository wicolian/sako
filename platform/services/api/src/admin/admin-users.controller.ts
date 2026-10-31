import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpException,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { AnalyticsService } from '../common/analytics/analytics.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';
import { UserRole, WorkspaceRole } from '@prisma/client';
import { getStripeClient } from '../common/stripe/stripe-client';

@ApiTags('Admin - Users')
@ApiBearerAuth()
@Controller('admin/users')
@BypassWorkspaceMember()
@BypassSubscription()
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(
    private prisma: PrismaService,
    private analytics: AnalyticsService,
  ) {}

  @Get()
  @AdminOnly()
  @ApiOperation({ summary: 'List all users with their roles' })
  @ApiQuery({ name: 'role', required: false, enum: ['CLIENT', 'PENDING_ADMIN', 'ADMIN'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listUsers(
    @Query('role') role?: UserRole,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) || 0 : 0;

    const where = role ? { role } : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isSuperAdmin: true,
          createdAt: true,
          memberships: {
            select: {
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parsedLimit,
        skip: parsedOffset,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    };
  }

  @Get('pending-admins')
  @AdminOnly()
  @ApiOperation({ summary: 'List users with PENDING_ADMIN role awaiting approval' })
  async listPendingAdmins() {
    const pendingAdmins = await this.prisma.user.findMany({
      where: { role: UserRole.PENDING_ADMIN },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { pendingAdmins };
  }

  @Post(':userId/promote')
  @AdminOnly()
  @ApiOperation({ summary: 'Promote a user to ADMIN role' })
  async promoteUser(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // Only super admins can promote to admin
    if (!currentUser.isSuperAdmin) {
      throw new HttpException('Only super admins can promote users to admin', HttpStatus.FORBIDDEN);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (user.role === UserRole.ADMIN) {
      throw new HttpException('User is already an admin', HttpStatus.BAD_REQUEST);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.ADMIN },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    this.analytics.trackUserEvent(userId, 'AdminPromoted', {
      promotedBy: currentUser.id,
      previousRole: user.role,
    });

    this.logger.log(`User ${userId} promoted to ADMIN by ${currentUser.email}`);

    return updatedUser;
  }

  @Post(':userId/demote')
  @AdminOnly()
  @ApiOperation({ summary: 'Demote an admin user to CLIENT role' })
  async demoteUser(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // Only super admins can demote admins
    if (!currentUser.isSuperAdmin) {
      throw new HttpException('Only super admins can demote admins', HttpStatus.FORBIDDEN);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (user.isSuperAdmin) {
      throw new HttpException('Cannot demote a super admin', HttpStatus.FORBIDDEN);
    }

    if (user.role === UserRole.CLIENT) {
      throw new HttpException('User is already a client', HttpStatus.BAD_REQUEST);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.CLIENT },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    this.analytics.trackUserEvent(userId, 'AdminDemoted', {
      demotedBy: currentUser.id,
      previousRole: user.role,
    });

    this.logger.log(`User ${userId} demoted to CLIENT by ${currentUser.email}`);

    return updatedUser;
  }

  @Post(':userId/reject-pending')
  @AdminOnly()
  @ApiOperation({ summary: 'Reject a pending admin request (demote to CLIENT)' })
  async rejectPendingAdmin(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    if (user.role !== UserRole.PENDING_ADMIN) {
      throw new HttpException('User is not a pending admin', HttpStatus.BAD_REQUEST);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.CLIENT },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    this.analytics.trackUserEvent(userId, 'PendingAdminRejected', {
      rejectedBy: currentUser.id,
    });

    this.logger.log(`Pending admin ${userId} rejected by ${currentUser.email}`);

    return updatedUser;
  }

  @Delete(':userId/cleanup-for-testing')
  @AdminOnly()
  @ApiOperation({
    summary: 'DEV ONLY: Delete user and their data for testing',
    description:
      'Cancels Stripe subscriptions, deletes workspaces (cascades to tasks, brands, etc.), and removes user from DB. Keeps Clerk account intact so email can be reused. Requires ENABLE_DEV_ADMIN=true.',
  })
  async cleanupUserForTesting(
    @Param('userId') userId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    // Safety check: only allow in dev mode
    if (process.env.ENABLE_DEV_ADMIN !== 'true') {
      throw new HttpException(
        'Dev admin endpoints are disabled. Set ENABLE_DEV_ADMIN=true to enable.',
        HttpStatus.FORBIDDEN,
      );
    }

    // Only super admins can delete users
    if (!currentUser.isSuperAdmin) {
      throw new HttpException(
        'Only super admins can delete users for testing',
        HttpStatus.FORBIDDEN,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            workspace: {
              include: {
                subscription: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    // Prevent deleting super admins
    if (user.isSuperAdmin) {
      throw new HttpException('Cannot delete a super admin', HttpStatus.FORBIDDEN);
    }

    const summary = {
      userId: user.id,
      email: user.email,
      stripeSubscriptionsCancelled: [] as string[],
      workspacesDeleted: [] as string[],
      membershipsRemoved: 0,
      userDeleted: false,
      errors: [] as string[],
    };

    // Find workspaces where user is OWNER (we'll delete these)
    const ownedWorkspaces = user.memberships.filter(
      (m) => m.role === WorkspaceRole.OWNER,
    );

    // Cancel Stripe subscriptions and delete owned workspaces
    const stripe = getStripeClient();
    for (const membership of ownedWorkspaces) {
      const workspace = membership.workspace;
      const subscription = workspace.subscription;

      // Cancel Stripe subscription if exists
      if (subscription?.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId, {
            prorate: true,
          });
          summary.stripeSubscriptionsCancelled.push(subscription.stripeSubscriptionId);
          this.logger.log(
            `Cancelled Stripe subscription ${subscription.stripeSubscriptionId} for workspace ${workspace.id}`,
          );
        } catch (err: any) {
          const errorMsg = `Failed to cancel Stripe subscription ${subscription.stripeSubscriptionId}: ${err.message}`;
          summary.errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      // Delete workspace (cascades to subscription, tasks, brands, members, etc.)
      try {
        await this.prisma.workspace.delete({
          where: { id: workspace.id },
        });
        summary.workspacesDeleted.push(workspace.id);
        this.logger.log(`Deleted workspace ${workspace.id} (${workspace.name})`);
      } catch (err: any) {
        const errorMsg = `Failed to delete workspace ${workspace.id}: ${err.message}`;
        summary.errors.push(errorMsg);
        this.logger.error(errorMsg);
      }
    }

    // Remove memberships where user is not owner (just remove the membership, not the workspace)
    const nonOwnedMemberships = user.memberships.filter(
      (m) => m.role !== WorkspaceRole.OWNER,
    );
    for (const membership of nonOwnedMemberships) {
      try {
        await this.prisma.workspaceMember.delete({
          where: { id: membership.id },
        });
        summary.membershipsRemoved++;
      } catch (err: any) {
        const errorMsg = `Failed to remove membership ${membership.id}: ${err.message}`;
        summary.errors.push(errorMsg);
        this.logger.error(errorMsg);
      }
    }

    // Delete the user record from DB (Clerk account remains intact)
    try {
      await this.prisma.user.delete({
        where: { id: userId },
      });
      summary.userDeleted = true;
      this.logger.log(`Deleted user ${userId} (${user.email}) from database`);
    } catch (err: any) {
      const errorMsg = `Failed to delete user ${userId}: ${err.message}`;
      summary.errors.push(errorMsg);
      this.logger.error(errorMsg);
    }

    this.analytics.trackUserEvent(currentUser.id, 'TestUserCleaned', {
      cleanedUserId: userId,
      cleanedEmail: user.email,
      workspacesDeleted: summary.workspacesDeleted.length,
      subscriptionsCancelled: summary.stripeSubscriptionsCancelled.length,
    });

    this.logger.log(
      `Test user cleanup completed by ${currentUser.email}: ${JSON.stringify(summary)}`,
    );

    return {
      success: summary.errors.length === 0,
      message: summary.errors.length === 0
        ? `Successfully cleaned up user ${user.email}. Clerk account preserved - email can be reused.`
        : `Cleanup completed with ${summary.errors.length} error(s)`,
      summary,
    };
  }
}

