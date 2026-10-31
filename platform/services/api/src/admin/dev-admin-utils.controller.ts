import { Controller, Get, Post, ForbiddenException, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { WorkspaceMemberGuard } from '../common/guards/workspace-member.guard';
import { Request } from 'express';

@ApiTags('Admin Utils')
@Controller('admin-utils')
export class DevAdminUtilsController {
  constructor(private readonly prisma: PrismaService) { }

  private isEnabled() {
    return process.env.ENABLE_DEV_ADMIN === 'true';
  }

  @Post('promote-me')
  @UseGuards(ClerkAuthGuard)
  @BypassSubscription()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'DEV ONLY: Promote current user to ADMIN + isSuperAdmin',
    description: 'Guarded by ENABLE_DEV_ADMIN=true. Sets your role to ADMIN and toggles isSuperAdmin.',
  })
  async promoteMe(@CurrentUser() user: AuthUser) {
    if (!this.isEnabled()) {
      throw new ForbiddenException('Dev admin endpoints are disabled');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN', isSuperAdmin: true },
    });

    return {
      success: true,
      message: 'User promoted to ADMIN + isSuperAdmin',
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        isSuperAdmin: updated.isSuperAdmin,
      },
    };
  }

  // curl -H "Authorization: Bearer <token>" http://localhost:3001/api/v1/admin-utils/me-summary
  @Get('me-summary')
  @UseGuards(ClerkAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'DEV ONLY: Return current user info and their workspaces',
    description: 'Requires ENABLE_DEV_ADMIN=true. Provides user id, email, role, isSuperAdmin and list of workspaces (id, name, slug).',
  })
  async meSummary(@CurrentUser() user: AuthUser) {
    if (!this.isEnabled()) {
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

  // GET /api/v1/admin-utils/debug-brands-auth
  @Get('debug-brands-auth')
  @UseGuards(ClerkAuthGuard, WorkspaceMemberGuard)
  @BypassSubscription()
  @ApiBearerAuth()
  @ApiSecurity('workspace-header')
  @ApiOperation({
    summary: 'DEV ONLY: Debug brands auth',
    description: 'Checks Clerk auth and workspace membership for brands flows.',
  })
  getDebugBrandsAuth(@Req() req: Request) {
    if (!this.isEnabled()) {
      throw new ForbiddenException('Dev admin endpoints are disabled');
    }

    const user = (req as any).user;
    const workspaceId = req.headers['x-workspace-id'];

    return {
      message: 'Brands auth OK',
      user,
      workspaceId,
    };
  }
}
