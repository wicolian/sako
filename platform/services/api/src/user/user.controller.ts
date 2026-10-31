import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';
import { PrismaService } from '../prisma/prisma.service';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';

interface WorkspaceMembership {
    id: string;
    name: string;
    slug: string;
    role: string;
}

interface MeResponse {
    id: string;
    email: string;
    name: string | null;
    role: 'CLIENT' | 'PENDING_ADMIN' | 'ADMIN';
    isSuperAdmin: boolean;
    workspaces: WorkspaceMembership[];
}

@ApiTags('User')
@Controller('users')
export class UserController {
    constructor(private readonly prisma: PrismaService) { }

    @BypassSubscription()
    @BypassWorkspaceMember()
    @UseGuards(ClerkAuthGuard)
    @Get('me')
    @ApiOperation({ summary: 'Get current user profile' })
    @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
    async getMe(@CurrentUser() user: AuthUser): Promise<MeResponse> {
        // Fetch user with workspace memberships
        const userWithMemberships = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
                memberships: {
                    include: {
                        workspace: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                            },
                        },
                    },
                },
            },
        });

        if (!userWithMemberships) {
            throw new Error('User not found');
        }

        const workspaces: WorkspaceMembership[] = userWithMemberships.memberships.map(
            (membership) => ({
                id: membership.workspace.id,
                name: membership.workspace.name,
                slug: membership.workspace.slug,
                role: membership.role,
            }),
        );

        return {
            id: userWithMemberships.id,
            email: userWithMemberships.email,
            name: userWithMemberships.name,
            role: userWithMemberships.role as 'CLIENT' | 'PENDING_ADMIN' | 'ADMIN',
            isSuperAdmin: userWithMemberships.isSuperAdmin,
            workspaces,
        };
    }
}
