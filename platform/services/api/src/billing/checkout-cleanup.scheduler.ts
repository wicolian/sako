import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SlackService } from '../slack/slack.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CheckoutCleanupScheduler {
    private readonly logger = new Logger(CheckoutCleanupScheduler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly slackService: SlackService,
        private readonly configService: ConfigService,
    ) { }

    @Cron('0 0 * * *') // Daily at midnight
    async handleAbandonedCheckouts() {
        this.logger.log('Running abandoned checkout cleanup...');

        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

        const abandoned = await this.prisma.checkoutAttempt.findMany({
            where: {
                status: 'PENDING',
                createdAt: {
                    lt: cutoff
                }
            }
        });

        this.logger.log(`Found ${abandoned.length} abandoned checkouts`);

        for (const attempt of abandoned) {
            await this.prisma.checkoutAttempt.update({
                where: { id: attempt.id },
                data: { status: 'ABANDONED' }
            });

            // Notify Slack
            const channel = this.configService.get('SLACK_INTERNAL_CHANNEL_ID');
            if (channel) {
                await this.slackService.postMessage(channel, `💸 Abandoned Checkout Detected:\nEmail: ${attempt.email || 'Unknown'}\nPlan: ${attempt.planKey}\nDate: ${attempt.createdAt.toISOString()}`);
            }
        }
    }
}
