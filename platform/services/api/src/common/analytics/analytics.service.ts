import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// PostHog types - we'll use dynamic import to handle missing package gracefully
interface PostHogClient {
    capture: (event: { distinctId: string; event: string; properties?: Record<string, any> }) => void;
    identify: (params: { distinctId: string; properties?: Record<string, any> }) => void;
    shutdown: () => Promise<void>;
}

@Injectable()
export class AnalyticsService implements OnModuleDestroy {
    private readonly logger = new Logger(AnalyticsService.name);
    private client: PostHogClient | null = null;
    private readonly enabled: boolean;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('POSTHOG_API_KEY');
        const host = this.configService.get<string>('POSTHOG_HOST') || 'https://app.posthog.com';

        this.enabled = !!(apiKey && apiKey.trim());

        if (this.enabled) {
            this.initializePostHog(apiKey!, host);
        } else {
            this.logger.warn('POSTHOG_API_KEY not configured - analytics disabled (no-op mode)');
        }
    }

    private async initializePostHog(apiKey: string, host: string) {
        try {
            // Dynamic import to handle case where posthog-node isn't installed
            // @ts-ignore - posthog-node is optional
            const { PostHog } = await import('posthog-node');
            this.client = new PostHog(apiKey, { host });
            this.logger.log(`✓ PostHog analytics enabled (host: ${host})`);
        } catch (err) {
            this.logger.warn('PostHog package not installed - analytics disabled. Run: npm install posthog-node');
            this.client = null;
        }
    }

    async onModuleDestroy() {
        if (this.client) {
            try {
                await this.client.shutdown();
                this.logger.log('PostHog client shut down');
            } catch (err) {
                this.logger.error('Error shutting down PostHog client', err);
            }
        }
    }

    /**
     * Track an event for a specific user
     */
    trackUserEvent(
        userId: string,
        event: string,
        properties?: Record<string, any>,
    ): void {
        if (!this.client) {
            this.logger.debug(`[NO-OP] trackUserEvent: ${event} for user ${userId}`);
            return;
        }

        try {
            this.client.capture({
                distinctId: userId,
                event,
                properties: {
                    ...properties,
                    source: 'api',
                    timestamp: new Date().toISOString(),
                },
            });
            this.logger.debug(`Tracked event: ${event} for user ${userId}`);
        } catch (err) {
            this.logger.error(`Failed to track event ${event}`, err);
        }
    }

    /**
     * Track an event scoped to a workspace
     */
    trackWorkspaceEvent(
        workspaceId: string,
        event: string,
        properties?: Record<string, any>,
    ): void {
        if (!this.client) {
            this.logger.debug(`[NO-OP] trackWorkspaceEvent: ${event} for workspace ${workspaceId}`);
            return;
        }

        try {
            // Use workspace ID as distinct ID for workspace-level events
            this.client.capture({
                distinctId: `workspace:${workspaceId}`,
                event,
                properties: {
                    ...properties,
                    workspaceId,
                    source: 'api',
                    timestamp: new Date().toISOString(),
                },
            });
            this.logger.debug(`Tracked workspace event: ${event} for workspace ${workspaceId}`);
        } catch (err) {
            this.logger.error(`Failed to track workspace event ${event}`, err);
        }
    }

    /**
     * Track an event with both user and workspace context
     */
    trackEvent(
        userId: string,
        workspaceId: string | null,
        event: string,
        properties?: Record<string, any>,
    ): void {
        if (!this.client) {
            this.logger.debug(`[NO-OP] trackEvent: ${event}`);
            return;
        }

        try {
            this.client.capture({
                distinctId: userId,
                event,
                properties: {
                    ...properties,
                    workspaceId,
                    source: 'api',
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (err) {
            this.logger.error(`Failed to track event ${event}`, err);
        }
    }

    /**
     * Identify a user with properties for future events
     */
    identifyUser(
        userId: string,
        properties?: Record<string, any>,
    ): void {
        if (!this.client) {
            this.logger.debug(`[NO-OP] identifyUser: ${userId}`);
            return;
        }

        try {
            this.client.identify({
                distinctId: userId,
                properties,
            });
        } catch (err) {
            this.logger.error(`Failed to identify user ${userId}`, err);
        }
    }

    /**
     * Check if analytics is enabled
     */
    isEnabled(): boolean {
        return this.enabled && this.client !== null;
    }

    // ============================
    // Convenience tracking methods
    // ============================

    // User lifecycle events
    trackUserSignup(userId: string, email: string, source?: string): void {
        this.trackUserEvent(userId, 'UserSignup', { email, source });
    }

    trackUserLogin(userId: string, method: string = 'clerk'): void {
        this.trackUserEvent(userId, 'UserLogin', { method });
    }

    // Workspace events
    trackWorkspaceCreated(userId: string, workspaceId: string, workspaceName: string): void {
        this.trackEvent(userId, workspaceId, 'WorkspaceCreated', { workspaceName });
    }

    trackMemberInvited(workspaceId: string, inviterUserId: string, inviteeEmail: string, role: string): void {
        this.trackWorkspaceEvent(workspaceId, 'MemberInvited', { inviterUserId, inviteeEmail, role });
    }

    // Subscription events
    trackSubscriptionCreated(userId: string, workspaceId: string, planCode: string, interval: string): void {
        this.trackEvent(userId, workspaceId, 'SubscriptionCreated', { planCode, interval });
    }

    trackSubscriptionUpdated(workspaceId: string, fromPlan: string, toPlan: string): void {
        this.trackWorkspaceEvent(workspaceId, 'SubscriptionUpdated', { fromPlan, toPlan });
    }

    trackSubscriptionPaused(workspaceId: string, reason?: string): void {
        this.trackWorkspaceEvent(workspaceId, 'SubscriptionPaused', { reason });
    }

    trackSubscriptionResumed(workspaceId: string): void {
        this.trackWorkspaceEvent(workspaceId, 'SubscriptionResumed', {});
    }

    trackSubscriptionCanceled(workspaceId: string, reason?: string): void {
        this.trackWorkspaceEvent(workspaceId, 'SubscriptionCanceled', { reason });
    }

    trackPaymentSucceeded(workspaceId: string, amount: number, currency: string): void {
        this.trackWorkspaceEvent(workspaceId, 'PaymentSucceeded', { amount, currency });
    }

    trackPaymentFailed(workspaceId: string, amount: number, currency: string, errorCode?: string): void {
        this.trackWorkspaceEvent(workspaceId, 'PaymentFailed', { amount, currency, errorCode });
    }

    // Task events
    trackTaskCreated(userId: string, workspaceId: string, taskId: string, category: string, useAI: boolean): void {
        this.trackEvent(userId, workspaceId, 'TaskCreated', { taskId, category, useAI });
    }

    trackTaskStatusChanged(workspaceId: string, taskId: string, fromStatus: string, toStatus: string, actorRole: string): void {
        this.trackWorkspaceEvent(workspaceId, 'TaskStatusChanged', { taskId, fromStatus, toStatus, actorRole });
    }

    trackTaskCompleted(workspaceId: string, taskId: string, category: string, revisions: number, durationHours?: number): void {
        this.trackWorkspaceEvent(workspaceId, 'TaskCompleted', { taskId, category, revisions, durationHours });
    }

    trackRevisionRequested(workspaceId: string, taskId: string, revisionNumber: number): void {
        this.trackWorkspaceEvent(workspaceId, 'RevisionRequested', { taskId, revisionNumber });
    }

    // Brand events
    trackBrandCreated(workspaceId: string, brandId: string): void {
        this.trackWorkspaceEvent(workspaceId, 'BrandCreated', { brandId });
    }

    trackBrandUpdated(workspaceId: string, brandId: string, fieldsUpdated: string[]): void {
        this.trackWorkspaceEvent(workspaceId, 'BrandUpdated', { brandId, fieldsUpdated });
    }

    // Composer gateway events
    trackComposerCapabilitiesFetched(userId: string, workspaceId: string, planCode: string): void {
        this.trackEvent(userId, workspaceId, 'ComposerCapabilitiesFetched', { planCode });
    }

    trackSendToSako(userId: string, workspaceId: string, taskId: string): void {
        this.trackEvent(userId, workspaceId, 'SendToSako', { taskId });
    }

    // Search and navigation
    trackSearch(userId: string, workspaceId: string | null, query: string, resultCount: number): void {
        this.trackEvent(userId, workspaceId, 'SearchUsed', { query, resultCount });
    }

    // Review board events
    trackReviewBoardOpened(userId: string, workspaceId: string, taskId: string): void {
        this.trackEvent(userId, workspaceId, 'ReviewBoardOpened', { taskId });
    }

    trackAnnotationCreated(userId: string, workspaceId: string, taskId: string, assetType: string): void {
        this.trackEvent(userId, workspaceId, 'AnnotationCreated', { taskId, assetType });
    }

    // File events
    trackFileUploaded(workspaceId: string, taskId: string, fileType: string, fileSize: number): void {
        this.trackWorkspaceEvent(workspaceId, 'FileUploaded', { taskId, fileType, fileSize });
    }

    trackFileDownloaded(userId: string, workspaceId: string, taskId: string, fileType: string): void {
        this.trackEvent(userId, workspaceId, 'FileDownloaded', { taskId, fileType });
    }

    // Slack events
    trackSlackConnected(workspaceId: string): void {
        this.trackWorkspaceEvent(workspaceId, 'SlackConnected', {});
    }

    trackSlackDisconnected(workspaceId: string): void {
        this.trackWorkspaceEvent(workspaceId, 'SlackDisconnected', {});
    }
}

