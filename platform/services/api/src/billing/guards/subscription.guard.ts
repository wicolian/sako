import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { BYPASS_SUBSCRIPTION_KEY } from '../decorators/bypass-subscription.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
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

        const bypass = this.reflector.getAllAndOverride<boolean>(BYPASS_SUBSCRIPTION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (bypass) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const workspaceId = request.headers['x-workspace-id'] || request.user?.workspaceId;

        if (!workspaceId) {
            // If no workspace context, maybe it's a user-level endpoint or onboarding
            return true;
        }

        const subscription = await this.prisma.subscription.findUnique({
            where: { workspaceId },
            select: { status: true },
        });

        if (!subscription) {
            // No subscription row at all – treat as no active subscription
            throw new ForbiddenException({
                statusCode: 403,
                message: 'No active subscription found. Please subscribe to a plan.',
                code: 'NO_ACTIVE_SUBSCRIPTION',
            });
        }

        const method: string = (request.method || 'GET').toUpperCase();

        // Always allow read-only methods (GET/HEAD/OPTIONS) as long as a subscription exists.
        // Write operations are further constrained by service-level checks (e.g., TaskService, BrandService).
        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
            return true;
        }

        // For mutating requests, require an "active enough" subscription
        if (
            subscription.status === SubscriptionStatus.ACTIVE ||
            subscription.status === SubscriptionStatus.CANCEL_AT_PERIOD_END
        ) {
            return true;
        }

        // Block writes for PAUSED, PAST_DUE, CANCELED, etc.
        throw new ForbiddenException({
            statusCode: 403,
            message: 'Subscription is not active. Please update your payment method.',
            code: 'NO_ACTIVE_SUBSCRIPTION',
        });
    }
}
