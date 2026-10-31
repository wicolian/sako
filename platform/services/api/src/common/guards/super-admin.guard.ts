import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ClerkConfig } from '../../auth/clerk.config';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  private readonly clerkConfig: ClerkConfig;

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.clerkConfig = new ClerkConfig(configService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Fetch full user from DB to get isSuperAdmin status
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      throw new ForbiddenException('User not found');
    }

    // Allow if explicitly super admin
    if (dbUser.isSuperAdmin) {
      return true;
    }

    // Allow admins (studio) without domain gating for now
    if (dbUser.role === 'ADMIN') {
      return true;
    }

    // Allow if ADMIN role and internal domain
    const email = dbUser.email || user.email || '';
    const isInternal = this.clerkConfig.isStudioEmail(email);

    if (!isInternal) {
      throw new ForbiddenException('Not authorized for SAKO Studio');
    }

    if (dbUser.role === 'PENDING_ADMIN') {
      throw new ForbiddenException({
        message: 'Your studio access is pending approval. Contact an existing admin.',
        code: 'PENDING_ADMIN',
      });
    }

    throw new ForbiddenException('Requires admin privileges for SAKO Studio');
  }
}
