import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    InternalServerErrorException,
    Logger,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ClerkConfig, AuthUser } from './clerk.config';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
    private readonly logger = new Logger(ClerkAuthGuard.name);
    private readonly clerkConfig: ClerkConfig;
    private readonly clerk: ReturnType<typeof createClerkClient>;

    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.clerkConfig = new ClerkConfig(configService);
        this.clerk = createClerkClient({ secretKey: this.clerkConfig.secretKey });
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check if route is public
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers['authorization'];

        if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('No authorization token provided');
        }

        const token = authHeader.substring(7).trim();

        try {
            let verifiedToken;
            try {
                verifiedToken = await this.clerk.verifyToken(token);
            } catch (err) {
                this.logger.warn(`Token verification failed: ${err instanceof Error ? err.message : err}`);
                throw new UnauthorizedException('Invalid or expired token');
            }

            if (!verifiedToken || !verifiedToken.sub) {
                throw new UnauthorizedException('Invalid or expired token');
            }

            // Get Clerk userId from the verified token
            const clerkUserId = verifiedToken.sub;

            // Fetch user info from Clerk to get email and name
            const clerkUser = await this.clerk.users.getUser(clerkUserId);

            if (!clerkUser || !clerkUser.emailAddresses || clerkUser.emailAddresses.length === 0) {
                throw new UnauthorizedException('User email not found');
            }

            const primaryEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
            const email = (primaryEmail?.emailAddress || clerkUser.emailAddresses[0].emailAddress).toLowerCase();

            const name = clerkUser.firstName && clerkUser.lastName
                ? `${clerkUser.firstName} ${clerkUser.lastName}`.trim()
                : clerkUser.firstName || clerkUser.lastName || undefined;

            // Find or create user in our database
            let user = await this.prisma.user.findUnique({
                where: { clerkUserId },
            });

            const isStudioUser = this.clerkConfig.isStudioEmail(email);
            const hasSuperAdmin = isStudioUser
                ? await this.prisma.user.count({
                    where: { isSuperAdmin: true },
                }) > 0
                : true;

            if (!user) {
                // Try to find by email (for existing users before Clerk migration)
                user = await this.prisma.user.findUnique({
                    where: { email },
                });

                if (user) {
                    // Link existing user to Clerk
                    user = await this.prisma.user.update({
                        where: { id: user.id },
                        data: { clerkUserId },
                    });
                    this.logger.log(`Linked existing user ${email} to Clerk ID ${clerkUserId}`);
                }
            }

            if (!user) {
                // Create new user
                let role: 'CLIENT' | 'PENDING_ADMIN' | 'ADMIN' = 'CLIENT';
                let isSuperAdmin = false;

                // Check if studio email (trysako.com, sako.design, sako.agency)
                if (isStudioUser) {
                    if (!hasSuperAdmin) {
                        role = 'ADMIN';
                        isSuperAdmin = true;
                        this.logger.log(`Bootstrapping first studio admin: ${email} (ADMIN + isSuperAdmin)`);
                    } else {
                        role = 'PENDING_ADMIN';
                        this.logger.log(`New studio user detected: ${email} - setting role to PENDING_ADMIN`);
                    }
                }

                user = await this.prisma.user.create({
                    data: {
                        clerkUserId,
                        email,
                        name,
                        role,
                        isSuperAdmin,
                    },
                });

                this.logger.log(`Created new user: ${email} with role: ${role}`);
            } else {
                // If we found an existing user, ensure first studio admin is bootstrapped
                if (isStudioUser && !hasSuperAdmin && !user.isSuperAdmin) {
                    user = await this.prisma.user.update({
                        where: { id: user.id },
                        data: { role: 'ADMIN', isSuperAdmin: true },
                    });
                    this.logger.log(`Bootstrapped existing studio user as first admin: ${email}`);
                } else if (user.isSuperAdmin && user.role !== 'ADMIN') {
                    user = await this.prisma.user.update({
                        where: { id: user.id },
                        data: { role: 'ADMIN' },
                    });
                    this.logger.log(`Synced super admin role for ${email} -> ADMIN`);
                }

                if (!user.name && name) {
                    // Update name if not set
                    user = await this.prisma.user.update({
                        where: { id: user.id },
                        data: { name },
                    });
                }
            }

            // Attach user to request
            const authUser: AuthUser = {
                id: user.id,
                clerkUserId: user.clerkUserId!,
                email: user.email,
                name: user.name || undefined,
                role: user.role as 'CLIENT' | 'PENDING_ADMIN' | 'ADMIN',
                isSuperAdmin: user.isSuperAdmin,
            };

            request.user = authUser;

            // Enrich Sentry with user context for better error tracking
            Sentry.setUser({
                id: user.id,
                email: user.email,
                username: user.name || undefined,
            });

            // Add user role and admin status to Sentry context
            Sentry.setContext('user_info', {
                role: user.role,
                isSuperAdmin: user.isSuperAdmin,
            });

            // If workspace ID is present in headers, add workspace context
            const workspaceId = request.headers['x-workspace-id'];
            if (workspaceId && typeof workspaceId === 'string') {
                Sentry.setContext('workspace', {
                    id: workspaceId,
                });
            }

            return true;
        } catch (error) {
            if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
                throw error;
            }

            this.logger.error(
                `ClerkAuthGuard unexpected error: ${error instanceof Error ? error.message : error}`,
                error instanceof Error ? error.stack : undefined,
            );
            Sentry.captureException(error);

            // This is the spot that previously returned "Authentication failed due to a server error"
            throw new InternalServerErrorException('Internal auth error');
        }
    }
}
