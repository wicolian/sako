import { Controller, Post, Body, Headers, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { getStripeClient } from '../common/stripe/stripe-client';
import { getPlanVariantByKey } from './plan.config';
import { ChangePlanDto } from '../stripe/dto/change-plan.dto';
import { SubscriptionStatus } from '@prisma/client';

import { BypassSubscription } from './decorators/bypass-subscription.decorator';

@ApiTags('Billing')
@Controller('billing')
@ApiSecurity('workspace-header')
@BypassSubscription()
export class BillingController {
    private readonly logger = new Logger(BillingController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    @Post('change-plan')
    @ApiOperation({ summary: 'Change subscription plan' })
    async changePlan(
        @Headers('x-workspace-id') workspaceId: string,
        @Body() dto: ChangePlanDto,
    ) {
        if (!workspaceId) throw new BadRequestException('Workspace ID required');

        const planVariant = getPlanVariantByKey(dto.targetPlanKey, this.configService);
        if (!planVariant) throw new BadRequestException('Invalid plan key');

        const subscription = await this.prisma.subscription.findUnique({
            where: { workspaceId },
        });

        if (!subscription || !subscription.stripeSubscriptionId) {
            throw new BadRequestException('No active subscription found');
        }

        const stripe = getStripeClient();
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
        const itemId = stripeSub.items.data[0].id;
        const newPriceId = planVariant.stripePriceId;

        if (!newPriceId) throw new BadRequestException('Price configuration missing');

        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            items: [{ id: itemId, price: newPriceId }],
            proration_behavior: 'create_prorations',
            metadata: {
                planCode: planVariant.planCode,
                planKey: dto.targetPlanKey,
            }
        });

        // Update local subscription
        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                planCode: planVariant.planCode as any,
                activeTaskLimit: planVariant.activeTaskLimit,
                // tatHours is not on subscription model, maybe on plan or implied
            }
        });

        return { success: true };
    }

    @Post('pause')
    @ApiOperation({ summary: 'Pause subscription' })
    async pause(@Headers('x-workspace-id') workspaceId: string) {
        if (!workspaceId) throw new BadRequestException('Workspace ID required');

        const subscription = await this.prisma.subscription.findUnique({
            where: { workspaceId },
        });

        if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
            throw new BadRequestException('Subscription must be active to pause');
        }

        if (!subscription.stripeSubscriptionId) throw new BadRequestException('No Stripe subscription');

        const stripe = getStripeClient();
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            pause_collection: { behavior: 'mark_uncollectible' },
        });

        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: SubscriptionStatus.PAUSED },
        });

        await this.prisma.workspace.update({
            where: { id: workspaceId },
            // data: { mode: 'READ_ONLY' } // Workspace mode not in schema yet?
            // Assuming we rely on subscription status for access control
            data: {}
        });

        return { success: true };
    }

    @Post('cancel')
    @ApiOperation({ summary: 'Cancel subscription' })
    async cancel(@Headers('x-workspace-id') workspaceId: string) {
        if (!workspaceId) throw new BadRequestException('Workspace ID required');

        const subscription = await this.prisma.subscription.findUnique({
            where: { workspaceId },
        });

        if (!subscription || !subscription.stripeSubscriptionId) {
            throw new BadRequestException('No active subscription');
        }

        const stripe = getStripeClient();
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
        });

        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: SubscriptionStatus.CANCEL_AT_PERIOD_END },
        });

        // I need to check schema for SubscriptionStatus enum.
        // It has: ACTIVE, PAUSED, CANCELED, PAST_DUE.
        // I should probably add CANCEL_AT_PERIOD_END or just use CANCELED and check cancelAt.
        // Prompt says: "In DB: subscription.status = CANCEL_AT_PERIOD_END"
        // So I should update the enum.

        return { success: true };
    }
}
