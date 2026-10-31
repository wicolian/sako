import {
    BadRequestException,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import * as Sentry from '@sentry/nestjs';
import { BYPASS_WORKSPACE_MEMBER_KEY } from '../decorators/bypass-workspace-member.decorator';

/**
 * Workspace-scoped authorization guard.
 * Expects x-workspace-id only for workspace-specific routes; non-scoped routes should mark bypass.
 */

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
    private readonly logger = new Logger(WorkspaceMemberGuard.name);

    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const bypass = this.reflector.getAllAndOverride<boolean>(BYPASS_WORKSPACE_MEMBER_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (bypass) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        const headerWorkspaceId = request.headers['x-workspace-id'];
        const workspaceId = Array.isArray(headerWorkspaceId) ? headerWorkspaceId[0] : headerWorkspaceId;

        this.logger.log(`WorkspaceMemberGuard run user=${user?.id || 'unknown'} workspaceId=${workspaceId || 'missing'}`);

        if (!user) {
            throw new UnauthorizedException('No authenticated user found');
        }

        if (user.isSuperAdmin === true) {
            this.logger.log(`WorkspaceMemberGuard super admin bypass for user=${user.id}`);
            return true;
        }

        if (!workspaceId) {
            throw new BadRequestException('Missing x-workspace-id header');
        }

        try {
            const workspace = await this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: { id: true },
            });

            if (!workspace) {
                throw new NotFoundException('Workspace not found for x-workspace-id');
            }

            const member = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId: user.id,
                    },
                },
            });

            this.logger.log(`WorkspaceMemberGuard membershipFound=${!!member} user=${user.id} workspaceId=${workspaceId}`);

            if (!member) {
                throw new ForbiddenException('User is not a member of this workspace');
            }

            return true;
        } catch (err) {
            if (
                err instanceof BadRequestException ||
                err instanceof NotFoundException ||
                err instanceof ForbiddenException ||
                err instanceof UnauthorizedException
            ) {
                throw err;
            }

            this.logger.error('WorkspaceMemberGuard unexpected error', err instanceof Error ? err.stack : err);
            Sentry.captureException(err);
            throw new InternalServerErrorException('Workspace membership check failed');
        }
    }
}
