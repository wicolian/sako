import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  Req,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response, Request } from 'express';
import { SlackService } from './slack.service';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';
import { WorkspaceId } from '../common/decorators/workspace.decorator';
import { WebClient } from '@slack/web-api';
import { ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';

type SlackOAuthEnvMap = Record<
  'SLACK_CLIENT_ID' | 'SLACK_CLIENT_SECRET' | 'SLACK_OAUTH_REDIRECT_URL',
  string
>;

@ApiTags('Integrations')
@Controller('integrations/slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(
    private slackService: SlackService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) { }

  @Get('oauth/start')
  async startOAuth(@WorkspaceId() workspaceId: string) {
    if (!workspaceId) {
      throw new BadRequestException('Workspace context is required to install Slack');
    }

    this.logger.log(
      `Slack config at /oauth/start: clientId=${this.configService.get<string>(
        'SLACK_CLIENT_ID',
      )}, redirectUrl=${this.configService.get<string>('SLACK_OAUTH_REDIRECT_URL')}`,
    );

    const env = this.readSlackOAuthEnv();
    const missing = this.findMissingSlackEnv(env);

    if (missing.length) {
      const message = this.buildMissingSlackEnvMessage(missing);
      this.logger.error(`[Slack OAuth Start] ${message}`);
      throw new BadRequestException(message);
    }

    const scope = 'chat:write,channels:read,groups:read,team:read';
    const state = this.signState(workspaceId);
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope,
      redirect_uri: env.SLACK_OAUTH_REDIRECT_URL,
      state,
    });

    return { url: `https://slack.com/oauth/v2/authorize?${params.toString()}` };
  }

  @Public()
  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(
        this.buildFrontendIntegrationsRedirect({
          slack: 'error',
          reason: error,
        }),
      );
    }

    if (!code || !state) {
      return res.redirect(
        this.buildFrontendIntegrationsRedirect({
          slack: 'error',
          reason: 'missing_params',
        }),
      );
    }

    const parsedState = this.verifyState(state);
    if (!parsedState) {
      return res.redirect(
        this.buildFrontendIntegrationsRedirect({
          slack: 'error',
          reason: 'invalid_state',
        }),
      );
    }

    const env = this.readSlackOAuthEnv();
    const missing = this.findMissingSlackEnv(env);

    if (missing.length) {
      const message = this.buildMissingSlackEnvMessage(missing);
      this.logger.error(`[Slack OAuth Callback] ${message}`);
      return res.redirect(
        this.buildFrontendIntegrationsRedirect({
          slack: 'error',
          reason: 'server_configuration',
        }),
      );
    }

    // State represents the workspaceId so we know where to store the integration
    const workspaceId = parsedState.workspaceId;

    const client = new WebClient();

    try {
      const result = await client.oauth.v2.access({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: env.SLACK_OAUTH_REDIRECT_URL,
      });

      if (!result.ok) {
        this.logger.error(`Slack OAuth error: ${result.error}`);
        return res.redirect(
          this.buildFrontendIntegrationsRedirect({
            slack: 'error',
            reason: result.error || 'unknown_error',
          }),
        );
      }

      const teamId = result.team?.id;
      const teamName = result.team?.name;
      const botToken = result.access_token; // bot token
      const botUserId = (result as any).bot_user_id as string | undefined;

      if (!teamId || !botToken) {
        return res.redirect(
          this.buildFrontendIntegrationsRedirect({
            slack: 'error',
            reason: 'invalid_response',
          }),
        );
      }

      // Validate workspace exists
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        return res.redirect(
          this.buildFrontendIntegrationsRedirect({
            slack: 'error',
            reason: 'invalid_workspace',
          }),
        );
      }

      // Enforce unique slackTeamId mapping
      const existing = await this.prisma.slackIntegration.findUnique({
        where: { slackTeamId: teamId },
      });

      if (existing && existing.workspaceId !== workspaceId) {
        return res.redirect(
          this.buildFrontendIntegrationsRedirect({
            slack: 'error',
            reason: 'workspace_conflict',
          }),
        );
      }

      // Save Integration
      const integration = await this.prisma.slackIntegration.upsert({
        where: { slackTeamId: teamId },
        update: {
          workspaceId,
          slackTeamName: teamName || existing?.slackTeamName || null,
          slackBotUserId: botUserId || existing?.slackBotUserId || null,
          slackEnterpriseId: result.enterprise?.id || existing?.slackEnterpriseId || null,
          botAccessToken: botToken,
          // PRESERVE existing channel config on reconnect
          defaultChannelId: existing?.defaultChannelId ?? null,
          defaultChannelName: existing?.defaultChannelName ?? null,
          connectStatus: 'CONNECTED',
          installedByUserId: parsedState.userId || existing?.installedByUserId || null,
        },
        create: {
          workspaceId,
          slackTeamId: teamId,
          slackTeamName: teamName || null,
          slackEnterpriseId: result.enterprise?.id || null,
          slackBotUserId: botUserId || null,
          botAccessToken: botToken,
          // NO channel selected on first install
          defaultChannelId: null,
          defaultChannelName: null,
          connectStatus: 'CONNECTED',
          installedByUserId: parsedState.userId || null,
        },
      });

      return res.redirect(
        this.buildFrontendIntegrationsRedirect({
          slack: 'connected',
        }),
      );
    } catch (err) {
      this.logger.error(
        `Slack OAuth Exception: ${err instanceof Error ? err.message : 'Unknown error'}`,
        err instanceof Error ? err.stack : undefined,
      );
      return res.redirect(
        this.buildFrontendIntegrationsRedirect({
          slack: 'error',
          reason: 'server_error',
        }),
      );
    }
  }

  @Get('status')
  async getStatus(@WorkspaceId() workspaceId: string) {
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { workspaceId },
      select: {
        connectStatus: true,
        slackTeamName: true,
        defaultChannelId: true,
        defaultChannelName: true,
      },
    });

    if (!integration) {
      return { connected: false };
    }

    return {
      connected: true,
      connectStatus: integration.connectStatus,
      teamName: integration.slackTeamName,
      defaultChannelId: integration.defaultChannelId,
      defaultChannelName: integration.defaultChannelName,
    };
  }

  @Get('channels')
  async getChannels(
    @WorkspaceId() workspaceId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { workspaceId },
      select: { botAccessToken: true },
    });

    if (!integration?.botAccessToken) {
      throw new BadRequestException('Slack integration not connected');
    }

    const limitNum = limit ? Math.min(parseInt(limit, 10), 200) : 100;
    return this.slackService.listChannels(integration.botAccessToken, limitNum);
  }

  @Post('default-channel')
  async setDefaultChannel(
    @WorkspaceId() workspaceId: string,
    @Body() body: { channelId: string },
  ) {
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { workspaceId },
      select: { id: true, botAccessToken: true },
    });

    if (!integration?.botAccessToken) {
      throw new BadRequestException('Slack integration not connected');
    }

    // Validate channel access
    const channelInfo = await this.slackService.getChannelInfo(
      integration.botAccessToken,
      body.channelId,
    );

    // Update integration with validated channel
    await this.prisma.slackIntegration.update({
      where: { id: integration.id },
      data: {
        defaultChannelId: channelInfo.id,
        defaultChannelName: channelInfo.name,
        connectStatus: 'CONNECTED',
      },
    });

    return {
      success: true,
      channelId: channelInfo.id,
      channelName: channelInfo.name,
    };
  }

  @Post('test')
  async sendTestMessage(@WorkspaceId() workspaceId: string) {
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { workspaceId },
      select: { botAccessToken: true, defaultChannelId: true },
    });

    if (!integration?.botAccessToken) {
      throw new BadRequestException({
        code: 'SLACK_NOT_CONNECTED',
        message: 'Slack integration not connected',
      });
    }

    if (!integration.defaultChannelId) {
      throw new BadRequestException({
        code: 'NO_CHANNEL_CONFIGURED',
        message: 'No default channel configured',
      });
    }

    try {
      await this.slackService.postMessage(
        integration.defaultChannelId,
        '✅ Sako notifications are now active in this channel.',
        integration.botAccessToken,
      );

      return { success: true };
    } catch (error: any) {
      this.logger.error(`Slack test message failed: ${error.message}`, error.stack);
      throw new BadRequestException({
        code: error.code || 'SLACK_API_ERROR',
        message: error.message || 'Failed to send test message to Slack',
      });
    }
  }

  @Post('admin/test')
  async sendAdminTestMessage(@WorkspaceId() workspaceId: string) {
    const webhookUrl = this.configService.get<string>('ADMIN_SLACK_WEBHOOK_URL');
    const botToken = this.configService.get<string>('ADMIN_SLACK_BOT_TOKEN');
    const channelId = this.configService.get<string>('ADMIN_SLACK_CHANNEL_ID');

    if (!webhookUrl && (!botToken || !channelId)) {
      throw new BadRequestException({
        code: 'ADMIN_SLACK_NOT_CONFIGURED',
        message: 'Admin Slack not configured. Set ADMIN_SLACK_WEBHOOK_URL or ADMIN_SLACK_BOT_TOKEN + ADMIN_SLACK_CHANNEL_ID',
      });
    }

    try {
      if (webhookUrl) {
        // Use webhook approach
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: '🧪 Admin Slack integration test from Sako API' }),
        });

        if (!response.ok) {
          throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
        }
      } else if (botToken && channelId) {
        // Use bot token approach
        await this.slackService.postMessage(channelId, '🧪 Admin Slack integration test from Sako API', botToken);
      }

      return { success: true, message: 'Admin test notification sent to internal Slack' };
    } catch (error: any) {
      this.logger.error(`Admin Slack test failed: ${error.message}`, error.stack);
      throw new BadRequestException({
        code: error.code || 'ADMIN_SLACK_ERROR',
        message: error.message || 'Failed to send admin test notification',
      });
    }
  }

  @Public()
  @Post('commands')
  @HttpCode(200)
  async handleCommand(
    @Req() req: Request & { rawBody?: Buffer }, // Need raw body for signature
    @Body() body: any,
  ) {
    // Verify Signature
    // Note: For this to work, we need raw body. 
    const isValid = this.slackService.verifySignature(req);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Slack signature');
    }

    // For V1, assuming internal trusted network or trusting hidden implementation for now 
    // to avoid getting stuck on raw body middleware logic which affects global main.ts.
    // We will try verification, but catch if it fails due to missing rawBody.

    /*
      Parsing body (application/x-www-form-urlencoded)
      NestJS parses this automatically into 'body' object.
    */

    const { team_id, user_id, channel_id, text, command } = body;

    if (command !== '/sako') {
      return { text: 'Unknown command' };
    }

    // Find Integration
    const integration = await this.prisma.slackIntegration.findUnique({
      where: { slackTeamId: team_id },
    });

    if (!integration) {
      return { text: 'This Slack workspace is not connected to any Sako workspace.' };
    }

    // Update default channel if not set (heuristic: use the channel where command was issued)
    if (!integration.defaultChannelId) {
      await this.prisma.slackIntegration.update({
        where: { id: integration.id },
        data: { defaultChannelId: channel_id, defaultChannelName: null },
      });
    }

    // Parse command
    // /sako create <description>
    const parts = (text || '').trim().split(' ');
    const subCommand = parts[0];

    if (subCommand === 'create') {
      const rawDescription = parts.slice(1).join(' ');
      if (!rawDescription) {
        return { text: 'Please provide a task description: /sako create <text>' };
      }

      const title = rawDescription.length > 80
        ? rawDescription.substring(0, 77) + '...'
        : rawDescription;
      const description = rawDescription;

      // Determine Created By
      // Try to find a user with same email? Slack doesn't give email in command payload usually, 
      // only user_id. We would need to look up user info.
      // For V1, prompt says: "The workspace owner or a system user".

      // Find workspace owner
      const ownerMember = await this.prisma.workspaceMember.findFirst({
        where: {
          workspaceId: integration.workspaceId,
          role: 'OWNER'
        },
        include: { user: true }
      });

      const createdById = ownerMember?.userId;

      // Create Task
      const task = await this.prisma.task.create({
        data: {
          workspaceId: integration.workspaceId,
          title,
          description,
          status: 'QUEUED',
          createdById: createdById,
          category: 'DESIGN', // Default or infer? Prompt says "reasonable default status". Category is required.
          // We pick DESIGN as default.
          slackChannelId: channel_id,
        },
      });

      // Respond to Slack
      // Prompt: "Created Sako task: <title>" + Link
      // Need frontend URL. ConfigService?
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const taskUrl = `${frontendUrl}/studio/tasks/${task.id}`; // Assuming URL structure

      return {
        response_type: 'ephemeral',
        text: `Created Sako task: *${task.title}*\n<${taskUrl}|Open in Sako>`,
      };
    }

    // /sako status - Show workspace task summary
    if (subCommand === 'status') {
      const [activeTasks, queuedTasks] = await Promise.all([
        this.prisma.task.findMany({
          where: { workspaceId: integration.workspaceId, status: 'IN_PROGRESS' },
          take: 10,
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.task.findMany({
          where: { workspaceId: integration.workspaceId, status: 'QUEUED' },
          take: 5,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      
      let statusText = `:bar_chart: *Sako Workspace Status*\n\n`;
      
      statusText += `*Active Tasks (${activeTasks.length}):*\n`;
      if (activeTasks.length > 0) {
        activeTasks.forEach(task => {
          statusText += `• <${frontendUrl}/studio/tasks/${task.id}|${task.title}>\n`;
        });
      } else {
        statusText += `_No tasks currently in progress._\n`;
      }
      
      statusText += `\n*Queued Tasks (${queuedTasks.length}):*\n`;
      if (queuedTasks.length > 0) {
        queuedTasks.forEach(task => {
          statusText += `• ${task.title}\n`;
        });
      } else {
        statusText += `_No tasks in the queue._\n`;
      }

      statusText += `\n<${frontendUrl}|View Dashboard>`;

      return {
        response_type: 'ephemeral',
        text: statusText,
      };
    }

    // /sako compose - Get link to Composer
    if (subCommand === 'compose') {
      const composerUrl = this.configService.get<string>('COMPOSER_URL') || 'https://composer.trysako.com';
      return {
        response_type: 'ephemeral',
        text: `:sparkles: *Ready to design with AI?*\n\n` +
          `Create instant design drafts with Sako Composer.\n\n` +
          `<${composerUrl}|:art: Launch Composer>`,
      };
    }

    // /sako help - Show available commands
    if (subCommand === 'help') {
      return {
        response_type: 'ephemeral',
        text: `:wave: *Sako Bot Commands*\n\n` +
          `\`/sako create <description>\` - Create a new design task\n` +
          `\`/sako status\` - View your active and queued tasks\n` +
          `\`/sako compose\` - Get a link to Sako Composer\n` +
          `\`/sako help\` - Show this help message\n\n` +
          `Need more help? Visit <https://docs.trysako.com|Sako Docs>`,
      };
    }

    return { text: `Unknown subcommand: \`${subCommand}\`. Try \`/sako help\`` };
  }

  @Public()
  @Post('events')
  @HttpCode(200)
  async handleEvents(@Req() req: Request, @Body() body: any) {
    // Verify signature
    const isValid = this.slackService.verifySignature(req);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Slack signature');
    }

    // Handle URL verification challenge
    if (body.type === 'url_verification') {
      return { challenge: body.challenge };
    }

    // Handle other events (event_callback)
    if (body.type === 'event_callback') {
      const event = body.event;
      this.logger.log(`Received Slack event: ${event?.type}`);

      // Route to specific event handlers
      await this.handleSlackEvent(event, body.team_id);
    }

    return { ok: true };
  }

  /**
   * Route Slack events to appropriate handlers
   */
  private async handleSlackEvent(event: any, teamId: string): Promise<void> {
    if (!event?.type) return;

    try {
      switch (event.type) {
        case 'app_home_opened':
          await this.handleAppHomeOpened(event, teamId);
          break;

        case 'message':
          // Handle direct messages to the bot
          if (event.channel_type === 'im' && !event.bot_id) {
            await this.handleDirectMessage(event, teamId);
          }
          break;

        case 'app_mention':
          await this.handleAppMention(event, teamId);
          break;

        default:
          this.logger.debug(`Unhandled Slack event type: ${event.type}`);
      }
    } catch (error: any) {
      this.logger.error(`Error handling Slack event ${event.type}: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle when a user opens the App Home tab
   */
  private async handleAppHomeOpened(event: any, teamId: string): Promise<void> {
    const userId = event.user;
    this.logger.log(`User ${userId} opened App Home for team ${teamId}`);
    
    // Find workspace integration
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { slackTeamId: teamId },
    });

    if (!integration) return;

    // Post a welcome message to App Home (would require updating home tab view)
    // For now, just log
    this.logger.debug(`App Home opened for workspace ${integration.workspaceId}`);
  }

  /**
   * Handle direct messages to the bot
   */
  private async handleDirectMessage(event: any, teamId: string): Promise<void> {
    const { user, text, channel } = event;
    this.logger.log(`DM from ${user}: ${text}`);

    // Find workspace integration
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { slackTeamId: teamId },
    });

    if (!integration) return;

    // Simple response for DMs
    const helpText = 
      `:wave: Hi! I'm the Sako bot. Here's what I can do:\n\n` +
      `• Use \`/sako create <brief>\` to create a new task\n` +
      `• Use \`/sako status\` to see your active tasks\n` +
      `• Use \`/sako compose\` to get a link to Composer\n\n` +
      `Visit <https://app.trysako.com|Sako Dashboard> to manage your workspace.`;

    await this.slackService.postMessage(channel, helpText, integration.botAccessToken);
  }

  /**
   * Handle @mentions of the bot in channels
   */
  private async handleAppMention(event: any, teamId: string): Promise<void> {
    const { user, text, channel } = event;
    this.logger.log(`Mentioned in ${channel} by ${user}: ${text}`);

    // Find workspace integration
    const integration = await this.prisma.slackIntegration.findFirst({
      where: { slackTeamId: teamId },
    });

    if (!integration) return;

    // Acknowledge the mention
    const response = `:eyes: Got it! Use \`/sako help\` for available commands, ` +
      `or \`/sako create <brief>\` to create a new task.`;

    await this.slackService.postMessage(channel, response, integration.botAccessToken);
  }

  private readSlackOAuthEnv(): SlackOAuthEnvMap {
    return {
      SLACK_CLIENT_ID: (this.configService.get<string>('SLACK_CLIENT_ID') || '').trim(),
      SLACK_CLIENT_SECRET: (this.configService.get<string>('SLACK_CLIENT_SECRET') || '').trim(),
      SLACK_OAUTH_REDIRECT_URL:
        (this.configService.get<string>('SLACK_OAUTH_REDIRECT_URL') || '').trim(),
    };
  }

  private findMissingSlackEnv(env: SlackOAuthEnvMap): string[] {
    return Object.entries(env)
      .filter(([, value]) => !value)
      .map(([key]) => key);
  }

  private buildMissingSlackEnvMessage(missing: string[]) {
    return `Slack integration not configured: missing ${missing.join(', ')}`;
  }

  private buildFrontendIntegrationsRedirect(params: Record<string, string>) {
    const baseUrl =
      (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(
        /\/$/,
        '',
      );
    const search = new URLSearchParams(params);
    return `${baseUrl}/settings/integrations?${search.toString()}`;
  }

  private getStateSecret() {
    return (
      this.configService.get<string>('SLACK_SIGNING_SECRET') ||
      this.configService.get<string>('SLACK_CLIENT_SECRET') ||
      'state-secret'
    );
  }

  private signState(workspaceId: string, userId?: string | null) {
    const payload = {
      workspaceId,
      userId: userId || null,
      ts: Date.now(),
    };
    const raw = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', this.getStateSecret()).update(raw).digest('hex');
    return Buffer.from(JSON.stringify({ ...payload, sig })).toString('base64');
  }

  private verifyState(state: string): { workspaceId: string; userId?: string | null } | null {
    try {
      const decoded = Buffer.from(state, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      const { workspaceId, userId, ts, sig } = parsed;
      if (!workspaceId || !ts || !sig) return null;
      const raw = JSON.stringify({ workspaceId, userId, ts });
      const expected = crypto.createHmac('sha256', this.getStateSecret()).update(raw).digest('hex');
      const ageMs = Date.now() - ts;
      if (expected !== sig) return null;
      if (ageMs > 1000 * 60 * 15) return null; // 15 minutes validity
      return { workspaceId, userId };
    } catch {
      return null;
    }
  }
}
