import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiresAdmin = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiresAdmin) {
      return true;
    }

    const request = context.switchToHttp().getRequest<any>();
    const user = request?.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check if user has ADMIN role or is super admin
    if (user.role !== 'ADMIN' && user.isSuperAdmin !== true) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
