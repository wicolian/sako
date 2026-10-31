import { Controller, Post, Body, Param, UseGuards, Get, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';
import { Public } from '../common/decorators/public.decorator';
import { DayCreditBurnService } from '../credits/day-credit-burn.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';

@ApiTags('Admin Utils')
@Controller('admin')
export class AdminUtilsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dayCreditBurnService: DayCreditBurnService
  ) { }

  @Post('credits/burn')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Trigger day credit burn (manual)',
    description: 'Manually runs the day credit burn process for all active subscriptions.',
  })
  async triggerBurn() {
    return await this.dayCreditBurnService.burnForAllActiveSubscriptions();
  }

  /**
   * GET /api/v1/admin/pending-admins
   * Returns all users with PENDING_ADMIN role (internal domain signups awaiting approval)
   */
  @Get('pending-admins')
  @UseGuards(ClerkAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List pending admin approvals',
    description: 'Returns all users with PENDING_ADMIN role who signed up from internal domains and are awaiting approval.',
  })
  async getPendingAdmins() {
    const pendingAdmins = await this.prisma.user.findMany({
      where: {
        role: 'PENDING_ADMIN',
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return pendingAdmins;
  }

  /**
   * POST /api/v1/admin/approve-admin/:userId
   * Promotes a PENDING_ADMIN to ADMIN role
   */
  @Post('approve-admin/:userId')
  @UseGuards(ClerkAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Approve pending admin',
    description: 'Promotes a user from PENDING_ADMIN to ADMIN role, granting them studio access.',
  })
  async approveAdmin(@Param('userId') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { error: 'User not found' };
    }

    if (user.role !== 'PENDING_ADMIN') {
      return { error: 'User is not pending approval' };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'ADMIN' },
    });

    return {
      success: true,
      message: `User ${user.email} approved as admin`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'ADMIN',
      },
    };
  }

  /**
   * POST /api/v1/admin/reject-admin/:userId
   * Rejects a pending admin by setting their role to CLIENT
   */
  @Post('reject-admin/:userId')
  @UseGuards(ClerkAuthGuard, SuperAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reject pending admin',
    description: 'Rejects a pending admin approval by downgrading them to CLIENT role.',
  })
  async rejectAdmin(@Param('userId') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { error: 'User not found' };
    }

    if (user.role !== 'PENDING_ADMIN') {
      return { error: 'User is not pending approval' };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: 'CLIENT' },
    });

    return {
      success: true,
      message: `User ${user.email} rejected - set to CLIENT role`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'CLIENT',
      },
    };
  }


  // DEV ONLY: Return current user and their workspaces
  @Get('me-summary')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'DEV ONLY: Return current user and workspaces',
    description: 'Returns authenticated user info and list of workspaces they belong to. Enabled only when ENABLE_DEV_ADMIN=true.',
  })
  async meSummary(@CurrentUser() user: AuthUser) {
    if (process.env.ENABLE_DEV_ADMIN !== 'true') {
      throw new ForbiddenException('Dev admin endpoints are disabled');
    }
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId: user.id },
      select: { workspace: { select: { id: true, name: true, slug: true } } },
    });
    const workspaces = memberships.map(m => m.workspace);
    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
      },
      workspaces,
    };
  }
}
