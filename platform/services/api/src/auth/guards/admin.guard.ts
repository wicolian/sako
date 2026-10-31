import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthUser, ClerkConfig } from '../clerk.config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
    private readonly logger = new Logger(AdminGuard.name);
    private readonly clerkConfig: ClerkConfig;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.clerkConfig = new ClerkConfig(configService);
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        let user: AuthUser = request.user;

        if (!user) {
            throw new UnauthorizedException('User not authenticated');
        }

        // Fetch latest user record to ensure we have role + super admin flag
        const dbUser = await this.prisma.user.findUnique({
            where: { id: user.id },
        });

        if (!dbUser) {
            throw new UnauthorizedException('User not found');
        }

        const email = dbUser.email || user.email || '';

        // Allow super admins regardless of role
        if (dbUser.isSuperAdmin) {
            request.user = { ...user, isSuperAdmin: true, role: dbUser.role as AuthUser['role'] };
            return true;
        }

        // Check if user has studio email domain
        if (!this.clerkConfig.isStudioEmail(email)) {
            throw new ForbiddenException(
                'Not authorized for SAKO Studio',
            );
        }

        // Bootstrap first admin if no admins exist
        if (dbUser.role !== 'ADMIN') {
            const adminCount = await this.prisma.user.count({
                where: { role: 'ADMIN' },
            });

            if (adminCount === 0) {
                const updated = await this.prisma.user.update({
                    where: { id: user.id },
                    data: { role: 'ADMIN', isSuperAdmin: true },
                });
                user = {
                    ...user,
                    role: 'ADMIN',
                    isSuperAdmin: updated.isSuperAdmin,
                };
                request.user = user;
                this.logger.log(`Bootstrapped first admin: ${email}`);
            }
        }

        // Check if user role is ADMIN (not PENDING_ADMIN)
        if ((request.user?.role || dbUser.role) !== 'ADMIN') {
            throw new ForbiddenException({
                message: 'Your studio access is pending approval. Contact an existing admin.',
                code: 'PENDING_ADMIN',
            });
        }

        request.user = {
            ...user,
            role: 'ADMIN',
            isSuperAdmin: user.isSuperAdmin || dbUser.isSuperAdmin,
        };

        return true;
    }
}
