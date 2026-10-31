import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly client: WebClient;
  private readonly signingSecret: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const botToken = this.configService.get<string>('SLACK_BOT_TOKEN');
    const signingSecret = this.configService.get<string>('SLACK_SIGNING_SECRET');

    if (!signingSecret) {
      this.logger.warn('SLACK_SIGNING_SECRET is not set');
    }
    this.signingSecret = signingSecret || '';
    
    // Initialize with default bot token if available
    this.client = new WebClient(botToken);
  }

  getWebClient(token?: string): WebClient {
    if (token) {
      return new WebClient(token);
    }
    return this.client;
  }

  verifySignature(req: any): boolean {
    // If no signing secret is configured, skip verification (but log a warning)
    if (!this.signingSecret) {
      this.logger.warn('Slack signature verification skipped: SLACK_SIGNING_SECRET not configured');
      return true; // Allow request through in development/test environments
    }

    const signature = req.headers['x-slack-signature'] as string;
    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const body = req.rawBody; // NestJS specific: needs raw body preservation

    if (!signature || !timestamp) {
      this.logger.warn('Missing x-slack-signature or x-slack-request-timestamp headers');
      return false;
    }

    // Prevent replay attacks (reject requests older than 5 minutes)
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
    if (parseInt(timestamp) < fiveMinutesAgo) {
      this.logger.warn('Slack request timestamp too old (possible replay attack)');
      return false;
    }

    if (!body && !req.body) {
      this.logger.warn('No request body available for signature verification');
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha256', this.signingSecret);
      const data = `v0:${timestamp}:${body || JSON.stringify(req.body)}`; 
      hmac.update(data);
      const calculatedSignature = `v0=${hmac.digest('hex')}`;

      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature), 
        Buffer.from(calculatedSignature)
      );

      if (!isValid) {
        this.logger.warn('Slack signature verification failed');
      }

      return isValid;
    } catch (error: any) {
      this.logger.error(`Slack signature verification error: ${error.message}`);
      return false;
    }
  }

  async postMessage(channel: string, text: string, token?: string) {
    const client = this.getWebClient(token);
    try {
      const result = await client.chat.postMessage({
        channel,
        text,
      });
      
      if (!result.ok) {
        this.logger.error(`Slack API returned error: ${result.error}`);
        throw new Error(result.error || 'Failed to post message to Slack');
      }
      
      return result;
    } catch (error: any) {
      // Log the error with full details
      this.logger.error(`Error posting to Slack: ${error.message}`, {
        channel,
        error: error.data || error.message,
        stack: error.stack,
      });
      
      // Re-throw with proper error code mapping
      const errorCode = error.data?.error || error.message || 'SLACK_API_ERROR';
      const errorMessage = error.data?.error || error.message || 'Failed to post message to Slack';
      
      // Map Slack API errors to actionable error codes
      if (errorCode === 'not_in_channel') {
        const customError: any = new Error('Invite @Sakobot to this channel and try again');
        customError.code = 'NOT_IN_CHANNEL';
        throw customError;
      }
      if (errorCode === 'channel_not_found') {
        const customError: any = new Error('Channel not found or not accessible');
        customError.code = 'CHANNEL_NOT_FOUND';
        throw customError;
      }
      if (errorCode === 'is_archived') {
        const customError: any = new Error('Channel is archived. Please select an active channel');
        customError.code = 'IS_ARCHIVED';
        throw customError;
      }
      if (errorCode === 'missing_scope') {
        const customError: any = new Error('Slack permissions out of date. Please reconnect Slack');
        customError.code = 'MISSING_SCOPE';
        throw customError;
      }
      if (['invalid_auth', 'token_revoked', 'account_inactive', 'not_authed'].includes(errorCode)) {
        const customError: any = new Error('Slack connection expired. Please reconnect');
        customError.code = 'TOKEN_REVOKED';
        throw customError;
      }
      
      // Generic error
      const customError: any = new Error(errorMessage);
      customError.code = 'SLACK_API_ERROR';
      throw customError;
    }
  }

  sanitizeChannelName(name: string): string {
    const safe = name
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return safe || `sako-${Math.random().toString(36).slice(2, 8)}`;
  }

  async ensurePrivateChannel(params: {
    token: string;
    channelName: string;
    botUserId?: string | null;
  }): Promise<{ channelId: string; channelName: string } | null> {
    const client = this.getWebClient(params.token);
    const safeName = this.sanitizeChannelName(params.channelName);

    try {
      const created = await client.conversations.create({
        name: safeName,
        is_private: true,
      });

      const channelId = (created.channel as any)?.id;
      if (!channelId) return null;

      // Invite bot if provided (often auto-joined when creating)
      if (params.botUserId) {
        try {
          await client.conversations.invite({
            channel: channelId,
            users: params.botUserId,
          });
        } catch (inviteErr: any) {
          // Slack often says already in channel; ignore
          this.logger.debug(`Bot invite result: ${inviteErr?.message || inviteErr}`);
        }
      }

      return { channelId, channelName: safeName };
    } catch (error: any) {
      this.logger.error(`Failed to create Slack channel ${safeName}: ${error.message}`, error.stack);
      return null;
    }
  }

  // ========================================
  // NOTIFICATION METHODS
  // ========================================

  /**
   * Notify workspace that a Composer draft is ready
   */
  async notifyComposerDraftReady(
    workspaceId: string,
    draftId: string,
    draftTitle: string,
  ): Promise<boolean> {
    const integration = await this.getWorkspaceIntegration(workspaceId);
    if (!integration) return false;

    if (!integration.defaultChannelId) {
      this.logger.warn(`Slack connected but no defaultChannelId configured for workspace ${workspaceId}`);
      return false;
    }

    const composerUrl = this.configService.get<string>('COMPOSER_URL') || 'https://composer.trysako.com';
    const message = `:sparkles: *Composer Draft Ready!*\n\n` +
      `Your AI design draft "${draftTitle}" is ready for review.\n\n` +
      `<${composerUrl}/#/editor/${draftId}|View in Composer>`;

    await this.postMessage(
      integration.defaultChannelId,
      message,
      integration.botAccessToken,
    );

    this.logger.log(`Notified workspace ${workspaceId} about draft ${draftId}`);
    return true;
  }

  /**
   * Notify workspace that a task's SLA is at risk
   */
  async notifySlaAtRisk(
    workspaceId: string,
    taskId: string,
    taskTitle: string,
    hoursRemaining: number,
  ): Promise<boolean> {
    const integration = await this.getWorkspaceIntegration(workspaceId);
    if (!integration) return false;

    if (!integration.defaultChannelId) {
      this.logger.warn(`Slack connected but no defaultChannelId configured for workspace ${workspaceId}`);
      return false;
    }

    const clientUrl = this.configService.get<string>('CLIENT_URL') || 'https://app.trysako.com';
    const urgency = hoursRemaining <= 4 ? ':rotating_light:' : ':warning:';
    const message = `${urgency} *SLA Alert*\n\n` +
      `Task "${taskTitle}" has only *${hoursRemaining} hours* remaining.\n\n` +
      `<${clientUrl}/#/tasks/${taskId}|View Task>`;

    await this.postMessage(
      integration.defaultChannelId,
      message,
      integration.botAccessToken,
    );

    this.logger.log(`Sent SLA alert for task ${taskId} (${hoursRemaining}h remaining)`);
    return true;
  }

  /**
   * Notify workspace when a task status changes
   */
  async notifyTaskStatusChanged(
    workspaceId: string,
    taskId: string,
    taskTitle: string,
    oldStatus: string,
    newStatus: string,
  ): Promise<boolean> {
    const integration = await this.getWorkspaceIntegration(workspaceId);
    if (!integration) return false;

    if (!integration.defaultChannelId) {
      this.logger.warn(`Slack connected but no defaultChannelId configured for workspace ${workspaceId}`);
      return false;
    }

    const clientUrl = this.configService.get<string>('CLIENT_URL') || 'https://app.trysako.com';
    const emoji = this.getStatusEmoji(newStatus);
    const message = `${emoji} *Task Update*\n\n` +
      `"${taskTitle}" moved from *${oldStatus}* to *${newStatus}*.\n\n` +
      `<${clientUrl}/#/tasks/${taskId}|View Task>`;

    await this.postMessage(
      integration.defaultChannelId,
      message,
      integration.botAccessToken,
    );

    this.logger.log(`Notified status change for task ${taskId}: ${oldStatus} -> ${newStatus}`);
    return true;
  }

  /**
   * List available Slack channels for a workspace
   */
  async listChannels(token: string, limit: number = 100): Promise<{
    channels: Array<{ id: string; name: string; isPrivate: boolean; isMember?: boolean; isArchived?: boolean }>;
    nextCursor?: string;
    hasMore: boolean;
  }> {
    const client = this.getWebClient(token);

    try {
      const result = await client.conversations.list({
        types: 'public_channel,private_channel',
        limit: Math.min(limit, 200), // Slack caps at 200
        exclude_archived: true,
      });

      const channels = (result.channels || []).map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        isPrivate: ch.is_private,
        isMember: ch.is_member,
        isArchived: ch.is_archived,
      }));

      return {
        channels,
        nextCursor: result.response_metadata?.next_cursor,
        hasMore: !!result.response_metadata?.next_cursor,
      };
    } catch (err: any) {
      this.logger.error(`Failed to list Slack channels: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get information about a specific Slack channel
   */
  async getChannelInfo(token: string, channelId: string): Promise<{
    id: string;
    name: string;
    isPrivate: boolean;
    isArchived: boolean;
  }> {
    const client = this.getWebClient(token);

    try {
      const result = await client.conversations.info({
        channel: channelId,
      });

      const channel = result.channel as any;
      return {
        id: channel.id,
        name: channel.name,
        isPrivate: channel.is_private,
        isArchived: channel.is_archived,
      };
    } catch (err: any) {
      // Map common Slack errors to standardized codes
      if (err.message?.includes('not_in_channel')) {
        const error = new Error('Bot is not a member of this channel');
        (error as any).code = 'NOT_IN_CHANNEL';
        throw error;
      }
      if (err.message?.includes('channel_not_found')) {
        const error = new Error('Channel not found or not accessible');
        (error as any).code = 'CHANNEL_NOT_FOUND';
        throw error;
      }
      if (err.message?.includes('missing_scope')) {
        const error = new Error('Slack permissions out of date. Please reconnect Slack (this will ask for updated permissions).');
        (error as any).code = 'MISSING_SCOPE';
        throw error;
      }
      if (err.message?.includes('invalid_auth') || err.message?.includes('token_revoked') || err.message?.includes('account_inactive')) {
        const error = new Error('Slack connection expired. Please reconnect.');
        (error as any).code = 'TOKEN_REVOKED';
        throw error;
      }

      this.logger.error(`Failed to get Slack channel info for ${channelId}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get workspace's Slack integration if connected
   */
  private async getWorkspaceIntegration(workspaceId: string) {
    return this.prisma.slackIntegration.findFirst({
      where: {
        workspaceId,
        connectStatus: 'CONNECTED',
      },
    });
  }

  /**
   * Get emoji for task status
   */
  private getStatusEmoji(status: string): string {
    switch (status.toUpperCase()) {
      case 'QUEUED': return ':inbox_tray:';
      case 'IN_PROGRESS': return ':hammer_and_wrench:';
      case 'IN_REVIEW': return ':eyes:';
      case 'COMPLETED': return ':white_check_mark:';
      case 'PAUSED': return ':pause_button:';
      default: return ':memo:';
    }
  }
}
