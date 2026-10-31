import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SlackService } from '../../slack/slack.service';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import {
  wrapInBaseTemplate,
  ctaButton,
  accentBox,
  paragraph,
  mutedText,
  heading as baseHeading,
  BRAND_TEXT,
  BRAND_TEXT_MUTED,
  BRAND_GREEN,
} from '../../marketing/templates/base';

// Legacy constant - no longer used but kept for compatibility
const SAKO_ICON_URL = '';

// Keep this TS enum in sync with prisma.schema NotificationEventType
export enum NotificationEventType {
  // Task events
  TASK_CREATED = 'TASK_CREATED',
  TASK_IN_PROGRESS = 'TASK_IN_PROGRESS',
  TASK_IN_REVIEW = 'TASK_IN_REVIEW',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_COMMENT = 'TASK_COMMENT',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  SLA_WARNING = 'SLA_WARNING',
  SLA_MISSED = 'SLA_MISSED',
  // Review events
  REVIEW_REVISION_UPLOADED = 'REVIEW_REVISION_UPLOADED',
  REVIEW_COMMENT_ADDED = 'REVIEW_COMMENT_ADDED',
  // Billing events
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  SUBSCRIPTION_PAUSED = 'SUBSCRIPTION_PAUSED',
  SUBSCRIPTION_RESUMED = 'SUBSCRIPTION_RESUMED',
  SUBSCRIPTION_CANCELED = 'SUBSCRIPTION_CANCELED',
  // Team events
  WORKSPACE_INVITE = 'WORKSPACE_INVITE',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
}

export interface NotificationPayload {
  userId: string;
  workspaceId?: string;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, any>;
  channels?: {
    inApp?: boolean;
    email?: boolean;
    slack?: boolean;
  };
  /** If set, preferences will be checked for this event type */
  eventType?: NotificationEventType;
  /** If true, uses studio URLs instead of client URLs in emails */
  isAdminNotification?: boolean;
}

export interface NotificationPreferenceDto {
  eventType: NotificationEventType;
  emailEnabled: boolean;
  slackEnabled: boolean;
  inAppEnabled: boolean;
}

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private resendEnabled = false;
  private resendClient: any = null;
  private resendInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(
    private prisma: PrismaService,
    private slackService: SlackService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {
    this.initPromise = this.initializeResend();
  }

  private async initializeResend(): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured - email notifications disabled');
      this.resendInitialized = true;
      return;
    }

    try {
      // @ts-ignore - resend is optional
      const { Resend } = await import('resend');
      this.resendClient = new Resend(apiKey);
      this.resendEnabled = true;
      this.logger.log('✓ Resend email notifications enabled');
    } catch (err) {
      this.logger.warn('Resend package not installed - email notifications disabled. Run: npm install resend');
    }
    this.resendInitialized = true;
  }

  /** Ensure Resend is initialized before sending */
  private async ensureResendInitialized(): Promise<void> {
    if (!this.resendInitialized && this.initPromise) {
      await this.initPromise;
    }
  }

  // ========================================
  // NOTIFICATION PREFERENCES
  // ========================================

  /**
   * Check if a notification should be sent to a specific channel
   * Defaults to true (enabled) if no preference record exists
   */
  private async shouldNotify(
    userId: string,
    eventType: NotificationEventType | undefined,
    channel: 'email' | 'slack' | 'inApp',
  ): Promise<boolean> {
    // If no event type specified, default to enabled (legacy behavior)
    if (!eventType) return true;

    // Cast prisma as any so we don't depend on generated client having notificationPreference typed
    const prisma: any = this.prisma;

    // If this Prisma client doesn't know about notificationPreference yet (older build),
    // default to enabled and avoid runtime errors.
    if (!prisma.notificationPreference || typeof prisma.notificationPreference.findUnique !== 'function') {
      return true;
    }

    try {
      const preference = await prisma.notificationPreference.findUnique({
        where: { userId_eventType: { userId, eventType } },
      });

      // If no preference record exists, default to enabled
      if (!preference) return true;

      switch (channel) {
        case 'email':
          return preference.emailEnabled;
        case 'slack':
          return preference.slackEnabled;
        case 'inApp':
          return preference.inAppEnabled;
        default:
          return true;
      }
    } catch (err) {
      this.logger.error(`Error checking notification preferences: ${err}`);
      return true; // Default to enabled on error
    }
  }

  /**
   * Get all notification preferences for a user
   * Returns preferences for all event types, creating defaults where needed
   */
  async getPreferences(userId: string): Promise<NotificationPreferenceDto[]> {
    const allEventTypes = Object.values(NotificationEventType);

    // Cast prisma to any so we don't depend on regenerated Prisma client types
    const prisma: any = this.prisma;

    // If this Prisma client doesn't know about notificationPreference yet (older build),
    // just return defaults (all channels enabled) for all event types.
    if (!prisma.notificationPreference || typeof prisma.notificationPreference.findMany !== 'function') {
      return allEventTypes.map((eventType) => ({
        eventType,
        emailEnabled: true,
        slackEnabled: true,
        inAppEnabled: true,
      }));
    }

    const existingPrefs = await prisma.notificationPreference.findMany({
      where: { userId },
    });

    const prefsMap = new Map(existingPrefs.map(p => [p.eventType, p]));

    return allEventTypes.map((eventType) => {
      const existing: any = prefsMap.get(eventType) || {};
      return {
        eventType,
        emailEnabled: existing?.emailEnabled ?? true,
        slackEnabled: existing?.slackEnabled ?? true,
        inAppEnabled: existing?.inAppEnabled ?? true,
      };
    });
  }

  /**
   * Update notification preferences for a user
   */
  async updatePreferences(
    userId: string,
    preferences: NotificationPreferenceDto[],
  ): Promise<NotificationPreferenceDto[]> {
    const prisma: any = this.prisma;

    // If notificationPreference is missing on this Prisma client (older build),
    // accept the request but no-op persistence, then return the provided values.
    if (!prisma.notificationPreference || typeof prisma.notificationPreference.upsert !== 'function') {
      return preferences;
    }

    // Upsert each preference
    await Promise.all(
      preferences.map((pref) =>
        prisma.notificationPreference.upsert({
          where: { userId_eventType: { userId, eventType: pref.eventType } },
          create: {
            userId,
            eventType: pref.eventType,
            emailEnabled: pref.emailEnabled,
            slackEnabled: pref.slackEnabled,
            inAppEnabled: pref.inAppEnabled,
          },
          update: {
            emailEnabled: pref.emailEnabled,
            slackEnabled: pref.slackEnabled,
            inAppEnabled: pref.inAppEnabled,
          },
        }),
      ),
    );

    return this.getPreferences(userId);
  }

  /**
   * Main notification method - fans out to all configured channels
   * Respects user notification preferences when eventType is provided
   * Sends notifications in parallel for better performance
   */
  async notify(notification: NotificationPayload): Promise<void> {
    const channels = notification.channels || { inApp: true };
    const { userId, eventType } = notification;

    // Build list of notification promises to run in parallel
    const tasks: Promise<void>[] = [];

    // Check in-app preference and queue
    if (channels.inApp !== false) {
      tasks.push(
        this.shouldNotify(userId, eventType, 'inApp').then(async (shouldSend) => {
          if (shouldSend) await this.createInAppNotification(notification);
        })
      );
    }

    // Check email preference and queue
    if (channels.email && this.resendEnabled) {
      tasks.push(
        this.shouldNotify(userId, eventType, 'email').then(async (shouldSend) => {
          if (shouldSend) await this.sendEmailNotification(notification);
        })
      );
    }

    // Check Slack preference and queue
    if (channels.slack && notification.workspaceId) {
      tasks.push(
        this.shouldNotify(userId, eventType, 'slack').then(async (shouldSend) => {
          if (shouldSend) await this.sendSlackNotification(notification);
        })
      );
    }

    // Run all notifications in parallel - failures are logged but don't block others
    await Promise.allSettled(tasks);
  }

  /**
   * Create in-app notification (stored in DB)
   */
  private async createInAppNotification(notification: NotificationPayload): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: notification.userId,
          workspaceId: notification.workspaceId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          payload: notification.payload,
          read: false,
        },
      });
      this.logger.debug(`Created in-app notification for user ${notification.userId}: ${notification.type}`);
    } catch (err) {
      this.logger.error(`Failed to create in-app notification: ${err}`);
    }
  }

  /**
   * Send email notification via Resend
   */
  private async sendEmailNotification(notification: NotificationPayload): Promise<void> {
    try {
      // Get user email
      const user = await this.prisma.user.findUnique({
        where: { id: notification.userId },
        select: { email: true, name: true },
      });

      if (!user?.email) {
        this.logger.warn(`No email found for user ${notification.userId}`);
        return;
      }

      // Get workspace name for context if available
      let workspaceName: string | undefined;
      if (notification.workspaceId) {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: notification.workspaceId },
          select: { name: true },
        });
        workspaceName = workspace?.name;
      }

      const template = this.getEmailTemplate(notification);

      // Wrap the template body in the full email structure
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.trysako.com';
      const companyAddress = this.configService.get<string>('MARKETING_COMPANY_ADDRESS') || 'SAKO';
      
      const fullHtml = wrapInBaseTemplate({
        subject: template.subject,
        preheader: template.textBody || notification.message,
        bodyHtml: template.htmlBody,
        unsubscribeUrl: `${frontendUrl}/settings?tab=notifications`,
        companyAddress,
      });

      // Use MailService for branded emails (transactional emails use SAKO icon)
      const emailSent = await this.mailService.sendMail(user.email, template.subject, fullHtml);

      if (emailSent) {
        this.logger.debug(`Sent branded email notification to ${user.email}: ${notification.type}`);
      } else {
        this.logger.error(`Failed to send branded email notification to ${user.email}: ${notification.type}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send email notification: ${err}`);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(notification: NotificationPayload): Promise<void> {
    const workspaceId = notification.workspaceId;
    if (!workspaceId) return;

    try {
      const integration = await this.prisma.slackIntegration.findFirst({
        where: { workspaceId },
        select: { botAccessToken: true, defaultChannelId: true },
      });

      if (!integration?.botAccessToken) {
        this.logger.debug(`Slack not connected for workspace ${workspaceId}`);
        return;
      }

      if (!integration.defaultChannelId) {
        this.logger.warn(`Slack connected but no defaultChannelId configured for workspace ${workspaceId}`);
        return;
      }

      await this.slackService.postMessage(
        integration.defaultChannelId,
        notification.message,
        integration.botAccessToken,
      );

      this.logger.debug(`Sent Slack notification to ${integration.defaultChannelId} for workspace ${workspaceId}: ${notification.type}`);
    } catch (err) {
      this.logger.error(`Failed to send Slack notification: ${err}`);
    }
  }


  /**
   * Get email template for notification type
   */
  private getEmailTemplate(notification: NotificationPayload): EmailTemplate {
    const clientUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.trysako.com';
    const studioUrl = this.configService.get<string>('STUDIO_URL') || 'https://studio.trysako.com';
    const baseUrl = notification.isAdminNotification ? studioUrl : clientUrl;
    const taskId = notification.payload?.taskId;
    const taskUrl = taskId ? `${baseUrl}/tasks/${taskId}` : baseUrl;
    const workspaceName = notification.payload?.workspaceName || 'your workspace';
    const isAdmin = notification.isAdminNotification;

    // Use dark mode branded helpers from base template
    const heading = (text: string) => baseHeading(text);
    const muted = (text: string) => mutedText(text);

    switch (notification.type) {
      case 'TASK_CREATED':
        if (isAdmin) {
          return {
            subject: `New task received: ${notification.title}`,
            htmlBody: `
              ${heading('New task received!')}
              ${paragraph(`A new task <strong>${notification.title}</strong> has been submitted and is waiting in the queue.`)}
              ${paragraph('Review the task details and start working on it.')}
              ${ctaButton('View in Studio →', taskUrl)}
            `,
            textBody: `New task received: "${notification.title}". Review and start working.\n\nView: ${taskUrl}`,
          };
        }
        return {
          subject: `Task submitted: ${notification.title}`,
          htmlBody: `
            ${heading('Task submitted!')}
            ${paragraph(`Your task <strong>${notification.title}</strong> has been submitted and added to the queue.`)}
            ${paragraph(`Our team will start working on it soon. You'll be notified when work begins.`)}
            ${ctaButton('View Task →', taskUrl)}
          `,
          textBody: `Task submitted: "${notification.title}". We'll start working on it soon.\n\nView: ${taskUrl}`,
        };

      case 'TASK_STATUS_UPDATED':

      case 'WELCOME':
        return {
          subject: 'Welcome to Sako!',
          htmlBody: `
            ${heading('Welcome to Sako! 🎉')}
            ${paragraph(`You've successfully joined <strong>${workspaceName}</strong>. Your design operations journey starts now.`)}
            ${paragraph(`Submit your first task and experience a 48-hour turnaround on production-ready design and motion assets.`)}
            ${ctaButton('Create Your First Task →', `${baseUrl}/tasks/new`)}
          `,
          textBody: `Welcome to Sako!\n\nYou've successfully joined ${workspaceName}. Submit your first task and experience a 48-hour turnaround.\n\nCreate task: ${baseUrl}/tasks/new`,
        };

      case 'PAYMENT_FAILED':
        return {
          subject: 'Action Required: Payment Failed',
          htmlBody: `
            ${heading('Payment failed')}
            ${paragraph(`We were unable to process the payment for <strong>${workspaceName}</strong>.`)}
            ${paragraph('Please update your payment method to avoid service interruption. Your active tasks will continue, but new submissions will be paused until payment is resolved.')}
            ${ctaButton('Update Payment Method →', `${baseUrl}/settings?tab=billing`)}
          `,
          textBody: `Payment Failed\n\nWe were unable to process payment for ${workspaceName}. Please update your payment method.\n\nUpdate: ${baseUrl}/settings?tab=billing`,
        };

      case 'TASK_IN_PROGRESS':
        return {
          subject: `Work started: ${notification.title}`,
          htmlBody: `
            ${heading("We're on it!")}
            ${paragraph(`Work has started on <strong>${notification.title}</strong>. Our team is now actively working on your task.`)}
            ${accentBox(`
              <p style="margin: 0; color: ${BRAND_TEXT};">
                <strong>Expected turnaround:</strong> 48 hours.<br>
                <span style="color: ${BRAND_TEXT_MUTED};">We'll notify you when it's ready for review.</span>
              </p>
            `)}
            ${ctaButton('View Task →', taskUrl)}
          `,
          textBody: `Work started on "${notification.title}". Expected turnaround: 48 hours.\n\nView: ${taskUrl}`,
        };

      case 'TASK_IN_REVIEW':
        return {
          subject: `Ready for review: ${notification.title}`,
          htmlBody: `
            ${heading('Your task is ready for review')}
            ${paragraph(`<strong>${notification.title}</strong> is complete and waiting for your feedback.`)}
            ${muted('Review the deliverables and either approve to complete the task, or request revisions if changes are needed.')}
            ${ctaButton('Review Deliverables →', taskUrl)}
          `,
          textBody: `Task ready for review: ${notification.title}\n\n${notification.message}\n\nReview: ${taskUrl}`,
        };

      case 'TASK_COMPLETED':
        return {
          subject: `Completed: ${notification.title}`,
          htmlBody: `
            ${heading('Task completed!')}
            ${paragraph(`Great news! <strong>${notification.title}</strong> has been marked as completed.`)}
            ${muted('All deliverables are ready for download. Thanks for using Sako!')}
            ${ctaButton('View & Download →', taskUrl)}
          `,
          textBody: `Task completed: ${notification.title}\n\n${notification.message}\n\nView: ${taskUrl}`,
        };

      case 'REVISION_REQUESTED':
        const feedback = notification.payload?.feedback;
        return {
          subject: `Changes requested: ${notification.title}`,
          htmlBody: `
            ${heading('Changes requested')}
            ${paragraph(`The client has requested changes on <strong>${notification.title}</strong>.`)}
            ${feedback ? accentBox(`
              <p style="margin: 0; color: ${BRAND_TEXT}; font-size: 14px;"><strong>Feedback:</strong></p>
              <p style="margin: 8px 0 0 0; color: ${BRAND_TEXT_MUTED};">${feedback}</p>
            `) : ''}
            ${ctaButton('View Feedback →', taskUrl)}
          `,
          textBody: `Changes requested: ${notification.title}\n\n${notification.message}\n\nView: ${taskUrl}`,
        };

      case 'SUBSCRIPTION_CANCELED':
        return {
          subject: 'Subscription Canceled',
          htmlBody: `
            ${heading('Subscription canceled')}
            ${paragraph(`Your subscription for <strong>${workspaceName}</strong> has been canceled. You can still access your existing tasks until the period ends.`)}
            ${accentBox(`
              <p style="margin: 0; color: ${BRAND_TEXT};">
                <strong>Access continues until period end:</strong><br>
                <span style="color: ${BRAND_TEXT_MUTED};">Complete any in-progress tasks and download your deliverables before then.</span>
              </p>
            `)}
            ${ctaButton('View Subscription →', `${baseUrl}/settings?tab=billing`)}
          `,
          textBody: `Subscription canceled for ${workspaceName}. You can still access your existing tasks until the period ends.\n\nView: ${baseUrl}/settings?tab=billing`,
        };

      case 'SUBSCRIPTION_PAUSED':
        return {
          subject: 'Subscription Paused',
          htmlBody: `
            ${heading('Subscription paused')}
            ${paragraph(`Your subscription for <strong>${workspaceName}</strong> has been paused.`)}
            ${paragraph(`Your unused day credits will roll over for up to 3 months (monthly) or 6 months (annual). Resume anytime to continue.`)}
            ${ctaButton('Resume Subscription →', `${baseUrl}/settings?tab=billing`)}
          `,
          textBody: `Subscription paused for ${workspaceName}. Your credits will roll over. Resume anytime.\n\nManage: ${baseUrl}/settings?tab=billing`,
        };

      case 'SUBSCRIPTION_RESUMED':
        return {
          subject: 'Subscription Resumed',
          htmlBody: `
            ${heading('Welcome back! 🎉')}
            ${paragraph(`Your subscription for <strong>${workspaceName}</strong> has been resumed.`)}
            ${paragraph('You can now submit new tasks and your design team is ready to help.')}
            ${ctaButton('Start New Task →', `${baseUrl}/tasks/new`)}
          `,
          textBody: `Subscription resumed for ${workspaceName}. You can now submit new tasks.\n\nStart: ${baseUrl}/tasks/new`,
        };

      case 'SLA_CREDIT_ISSUED':
        const taskTitle = notification.payload?.taskTitle || notification.title;
        return {
          subject: `Extra Day Added: ${taskTitle}`,
          htmlBody: `
            ${heading("We've added an extra day")}
            ${paragraph(`Your task <strong>"${taskTitle}"</strong> was completed just after our 48-hour deadline.`)}
            ${accentBox(`
              <p style="margin: 0; color: ${BRAND_GREEN}; font-size: 14px;"><strong>✓ 1 additional day added to your account</strong></p>
              <p style="margin: 8px 0 0 0; color: ${BRAND_TEXT_MUTED}; font-size: 13px;">This extends your current billing period by one day.</p>
            `)}
            ${muted("We apologize for the delay and appreciate your understanding. If you need anything else, we're here to help.")}
            ${ctaButton('View Task →', taskUrl)}
          `,
          textBody: `Your task "${taskTitle}" was completed after our SLA. We've added 1 extra day to your account.\n\nView: ${taskUrl}`,
        };

      default:
        return {
          subject: notification.title,
          htmlBody: `
            ${heading(notification.title)}
            ${paragraph(notification.message)}
            ${ctaButton('Open Sako →', baseUrl)}
          `,
          textBody: `${notification.title}\n\n${notification.message}\n\n${baseUrl}`,
        };
    }
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(userId: string, options: { limit?: number; unreadOnly?: boolean } = {}) {
    const { limit = 20, unreadOnly = false } = options;

    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, read: false },
    });

    return { notifications, unreadCount };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  // ========================================
  // HELPER: GET WORKSPACE OWNERS FOR FAN-OUT
  // ========================================

  /**
   * Get all workspace owner user IDs for fan-out notifications
   * Returns unique user IDs excluding the originalUserId to avoid duplicates
   */
  private async getWorkspaceOwnerIds(workspaceId: string, excludeUserId?: string): Promise<string[]> {
    try {
      const members = await this.prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          role: 'OWNER',
        },
        select: { userId: true },
      });
      return members
        .map((m) => m.userId)
        .filter((id) => id !== excludeUserId);
    } catch (err) {
      this.logger.error(`Error fetching workspace owners: ${err}`);
      return [];
    }
  }

  /**
   * Get all studio admin user IDs for fan-out notifications
   * Returns all users with role ADMIN, excluding specified user
   */
  private async getStudioAdminIds(excludeUserId?: string): Promise<string[]> {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      return admins
        .map((a) => a.id)
        .filter((id) => id !== excludeUserId);
    } catch (err) {
      this.logger.error(`Error fetching studio admins: ${err}`);
      return [];
    }
  }

  // Convenience methods for common notification types

  async notifyTaskCreated(userId: string, workspaceId: string, taskId: string, taskTitle: string): Promise<void> {
    // Notify the task creator
    await this.notify({
      userId,
      workspaceId,
      type: 'TASK_CREATED',
      eventType: NotificationEventType.TASK_CREATED,
      title: taskTitle,
      message: `New task created: "${taskTitle}". We'll start working on it soon.`,
      payload: { taskId },
      channels: { inApp: true, email: true, slack: true },
    });

    // Fan out to workspace owners (excluding task creator to avoid duplicate)
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'TASK_CREATED',
        eventType: NotificationEventType.TASK_CREATED,
        title: taskTitle,
        message: `New task created: "${taskTitle}".`,
        payload: { taskId },
        channels: { inApp: true, email: true, slack: false },
      });
    }

    // Notify studio admins
    const adminIds = await this.getStudioAdminIds(userId);
    for (const adminId of adminIds) {
      await this.notify({
        userId: adminId,
        workspaceId,
        type: 'TASK_CREATED',
        eventType: NotificationEventType.TASK_CREATED,
        title: taskTitle,
        message: `New task submitted: "${taskTitle}".`,
        payload: { taskId },
        channels: { inApp: true, email: true, slack: false },
        isAdminNotification: true,
      });
    }

    // Admin Slack mirror for high-signal events
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    await this.sendAdminSlackNotification(
      'TASK_CREATED',
      `New task: ${taskTitle}`,
      workspace?.name,
      taskId,
    );
  }

  async notifyTaskInReview(userId: string, workspaceId: string, taskId: string, taskTitle: string): Promise<void> {
    // Notify the task creator
    await this.notify({
      userId,
      workspaceId,
      type: 'TASK_IN_REVIEW',
      eventType: NotificationEventType.TASK_IN_REVIEW,
      title: taskTitle,
      message: `Your task "${taskTitle}" is ready for review. Please check the deliverables and provide feedback.`,
      payload: { taskId },
      channels: { inApp: true, email: true, slack: true },
    });

    // Fan out to workspace owners (excluding task creator to avoid duplicate)
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'TASK_IN_REVIEW',
        eventType: NotificationEventType.TASK_IN_REVIEW,
        title: taskTitle,
        message: `Task "${taskTitle}" is ready for review.`,
        payload: { taskId },
        channels: { inApp: true, email: true, slack: false },
      });
    }

    // Notify studio admins
    const adminIds = await this.getStudioAdminIds(userId);
    for (const adminId of adminIds) {
      await this.notify({
        userId: adminId,
        workspaceId,
        type: 'TASK_IN_REVIEW',
        eventType: NotificationEventType.TASK_IN_REVIEW,
        title: taskTitle,
        message: `Task moved to review: "${taskTitle}".`,
        payload: { taskId },
        channels: { inApp: true, email: true, slack: false },
        isAdminNotification: true,
      });
    }
  }

  async notifyTaskCompleted(userId: string, workspaceId: string, taskId: string, taskTitle: string): Promise<void> {
    // Notify the task creator
    await this.notify({
      userId,
      workspaceId,
      type: 'TASK_COMPLETED',
      eventType: NotificationEventType.TASK_COMPLETED,
      title: taskTitle,
      message: `Great news! Your task "${taskTitle}" has been marked as completed.`,
      payload: { taskId },
      channels: { inApp: true, email: true, slack: true },
    });

    // Fan out to workspace owners (excluding task creator to avoid duplicate)
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'TASK_COMPLETED',
        eventType: NotificationEventType.TASK_COMPLETED,
        title: taskTitle,
        message: `Task "${taskTitle}" has been completed.`,
        payload: { taskId },
        channels: { inApp: true, email: true, slack: false },
      });
    }

    // Notify studio admins
    const adminIds = await this.getStudioAdminIds(userId);
    for (const adminId of adminIds) {
      await this.notify({
        userId: adminId,
        workspaceId,
        type: 'TASK_COMPLETED',
        eventType: NotificationEventType.TASK_COMPLETED,
        title: taskTitle,
        message: `Task completed: "${taskTitle}".`,
        payload: { taskId },
        channels: { inApp: true, email: true, slack: false },
        isAdminNotification: true,
      });
    }

    // Admin Slack notification for task completion
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    await this.sendAdminSlackNotification(
      'TASK_COMPLETED',
      `✅ Task completed: ${taskTitle}`,
      workspace?.name,
      taskId,
    );
  }

  async notifyRevisionRequested(
    userId: string,
    workspaceId: string,
    taskId: string,
    taskTitle: string,
    feedback?: string,
  ): Promise<void> {
    // Notify the task creator
    await this.notify({
      userId,
      workspaceId,
      type: 'REVISION_REQUESTED',
      eventType: NotificationEventType.REVISION_REQUESTED,
      title: taskTitle,
      message: feedback ? `Changes requested: ${feedback}` : `Changes have been requested for task "${taskTitle}".`,
      payload: { taskId, feedback },
      channels: { inApp: true, email: true, slack: true },
    });

    // Fan out to workspace owners (excluding task creator to avoid duplicate)
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'REVISION_REQUESTED',
        eventType: NotificationEventType.REVISION_REQUESTED,
        title: taskTitle,
        message: feedback ? `Revision requested: ${feedback}` : `Revision requested for "${taskTitle}".`,
        payload: { taskId, feedback },
        channels: { inApp: true, email: true, slack: false },
      });
    }

    // Notify studio admins
    const adminIds = await this.getStudioAdminIds(userId);
    for (const adminId of adminIds) {
      await this.notify({
        userId: adminId,
        workspaceId,
        type: 'REVISION_REQUESTED',
        eventType: NotificationEventType.REVISION_REQUESTED,
        title: taskTitle,
        message: feedback ? `Revision requested: ${feedback}` : `Revision requested for "${taskTitle}".`,
        payload: { taskId, feedback },
        channels: { inApp: true, email: true, slack: false },
        isAdminNotification: true,
      });
    }

    // Admin Slack mirror for high-signal events
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    await this.sendAdminSlackNotification(
      'REVISION_REQUESTED',
      `Revision requested: ${taskTitle}`,
      workspace?.name,
      taskId,
    );
  }

  async notifyTaskInProgress(userId: string, workspaceId: string, taskId: string, taskTitle: string): Promise<void> {
    // Notify the task creator
    await this.notify({
      userId,
      workspaceId,
      type: 'TASK_IN_PROGRESS',
      eventType: NotificationEventType.TASK_IN_PROGRESS,
      title: taskTitle,
      message: `Work has started on your task "${taskTitle}". Expected turnaround: 48 hours.`,
      payload: { taskId },
      channels: { inApp: true, email: true, slack: true },
    });

    // Fan out to workspace owners (excluding task creator to avoid duplicate)
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'TASK_IN_PROGRESS',
        eventType: NotificationEventType.TASK_IN_PROGRESS,
        title: taskTitle,
        message: `Work started on "${taskTitle}".`,
        payload: { taskId },
        channels: { inApp: true, email: true, slack: false },
      });
    }

    // Notify studio admins (they initiated this, so just log for other admins)
    const adminIds = await this.getStudioAdminIds(userId);
    for (const adminId of adminIds) {
      await this.notify({
        userId: adminId,
        workspaceId,
        type: 'TASK_IN_PROGRESS',
        eventType: NotificationEventType.TASK_IN_PROGRESS,
        title: taskTitle,
        message: `Work started on "${taskTitle}".`,
        payload: { taskId },
        channels: { inApp: true, email: true, slack: false },
        isAdminNotification: true,
      });
    }

    // Admin Slack notification for task started
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    await this.sendAdminSlackNotification(
      'TASK_IN_PROGRESS',
      `🔄 Work started: ${taskTitle}`,
      workspace?.name,
      taskId,
    );
  }

  async notifyTaskComment(
    userId: string,
    workspaceId: string,
    taskId: string,
    taskTitle: string,
    commenterName: string,
    commentPreview: string,
  ): Promise<void> {
    // Notify the task creator
    await this.notify({
      userId,
      workspaceId,
      type: 'TASK_COMMENT',
      eventType: NotificationEventType.TASK_COMMENT,
      title: `New comment on "${taskTitle}"`,
      message: `${commenterName} commented: "${commentPreview}"`,
      payload: { taskId, commenterName },
      channels: { inApp: true, email: true, slack: true },
    });

    // Fan out to workspace owners (excluding task creator to avoid duplicate)
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'TASK_COMMENT',
        eventType: NotificationEventType.TASK_COMMENT,
        title: `New comment on "${taskTitle}"`,
        message: `${commenterName} commented: "${commentPreview}"`,
        payload: { taskId, commenterName },
        channels: { inApp: true, email: true, slack: false },
      });
    }

    // Notify studio admins
    const adminIds = await this.getStudioAdminIds(userId);
    for (const adminId of adminIds) {
      await this.notify({
        userId: adminId,
        workspaceId,
        type: 'TASK_COMMENT',
        eventType: NotificationEventType.TASK_COMMENT,
        title: `New comment on "${taskTitle}"`,
        message: `${commenterName} commented: "${commentPreview}"`,
        payload: { taskId, commenterName },
        channels: { inApp: true, email: true, slack: false },
        isAdminNotification: true,
      });
    }
  }

  /**
   * Notify when a new revision is uploaded on a review asset
   * Typically called when studio uploads new work for client review
   */
  async notifyNewRevisionUploaded(
    userId: string,
    workspaceId: string,
    taskId: string,
    taskTitle: string,
    revisionLabel: string,
    assetTitle: string,
  ): Promise<void> {
    // Notify the task creator
    await this.notify({
      userId,
      workspaceId,
      type: 'REVIEW_REVISION_UPLOADED',
      eventType: NotificationEventType.REVIEW_REVISION_UPLOADED,
      title: `New revision uploaded for "${taskTitle}"`,
      message: `${revisionLabel} has been uploaded for "${assetTitle}". Please review the updated work.`,
      payload: { taskId, revisionLabel, assetTitle },
      channels: { inApp: true, email: true, slack: true },
    });

    // Fan out to workspace owners (excluding task creator to avoid duplicate)
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'REVIEW_REVISION_UPLOADED',
        eventType: NotificationEventType.REVIEW_REVISION_UPLOADED,
        title: `New revision for "${taskTitle}"`,
        message: `${revisionLabel} uploaded for "${assetTitle}".`,
        payload: { taskId, revisionLabel, assetTitle },
        channels: { inApp: true, email: true, slack: false },
      });
    }
  }

  /**
   * Notify when a comment/annotation is added on a review revision
   */
  async notifyReviewComment(
    userId: string,
    workspaceId: string,
    taskId: string,
    taskTitle: string,
    commenterName: string,
    commentPreview: string,
    isAdminCommenter: boolean,
  ): Promise<void> {
    // Notify the task creator
    await this.notify({
      userId,
      workspaceId,
      type: 'REVIEW_COMMENT_ADDED',
      eventType: NotificationEventType.REVIEW_COMMENT_ADDED,
      title: `New feedback on "${taskTitle}"`,
      message: `${commenterName} left feedback: "${commentPreview}"`,
      payload: { taskId, commenterName },
      channels: { inApp: true, email: true, slack: true },
    });

    // Fan out to workspace owners (excluding task creator to avoid duplicate)
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'REVIEW_COMMENT_ADDED',
        eventType: NotificationEventType.REVIEW_COMMENT_ADDED,
        title: `Feedback on "${taskTitle}"`,
        message: `${commenterName} commented: "${commentPreview}"`,
        payload: { taskId, commenterName },
        channels: { inApp: true, email: true, slack: false },
      });
    }

    // If it's a client comment, also notify studio admins
    if (!isAdminCommenter) {
      const adminIds = await this.getStudioAdminIds(userId);
      for (const adminId of adminIds) {
        await this.notify({
          userId: adminId,
          workspaceId,
          type: 'REVIEW_COMMENT_ADDED',
          eventType: NotificationEventType.REVIEW_COMMENT_ADDED,
          title: `Client feedback on "${taskTitle}"`,
          message: `${commenterName} left feedback: "${commentPreview}"`,
          payload: { taskId, commenterName },
          channels: { inApp: true, email: true, slack: false },
          isAdminNotification: true,
        });
      }
    }
  }

  async notifyWelcome(userId: string, workspaceId: string, workspaceName: string): Promise<void> {
    await this.notify({
      userId,
      workspaceId,
      type: 'WELCOME',
      eventType: NotificationEventType.MEMBER_JOINED,
      title: 'Welcome to Sako!',
      message: `You've successfully joined ${workspaceName}. Start by creating your first task.`,
      payload: { workspaceName },
      channels: { inApp: true, email: true },
    });

    // Admin Slack mirror for new user signup
    await this.sendAdminSlackNotification(
      'NEW_USER_SIGNUP',
      `🎉 New user signed up to ${workspaceName}`,
      workspaceName,
    );
  }

  async notifyPaymentFailed(userId: string, workspaceId: string, workspaceName: string): Promise<void> {
    await this.notify({
      userId,
      workspaceId,
      type: 'PAYMENT_FAILED',
      eventType: NotificationEventType.PAYMENT_FAILED,
      title: 'Payment Failed',
      message: `We were unable to process the payment for ${workspaceName}. Please update your payment method.`,
      payload: { workspaceName },
      channels: { inApp: true, email: true },
    });

    // Admin Slack mirror for high-signal events
    await this.sendAdminSlackNotification(
      'PAYMENT_FAILED',
      `Payment failed for ${workspaceName}`,
      workspaceName,
    );
  }

  async notifySubscriptionPaused(userId: string, workspaceId: string, workspaceName: string): Promise<void> {
    await this.notify({
      userId,
      workspaceId,
      type: 'SUBSCRIPTION_PAUSED',
      eventType: NotificationEventType.SUBSCRIPTION_PAUSED,
      title: 'Subscription Paused',
      message: `Your subscription for ${workspaceName} has been paused. Unused credits will roll over.`,
      payload: { workspaceName },
      channels: { inApp: true, email: true },
    });

    // Admin Slack mirror
    await this.sendAdminSlackNotification(
      'SUBSCRIPTION_PAUSED',
      `⏸️ Subscription paused for ${workspaceName}`,
      workspaceName,
    );
  }

  async notifySubscriptionResumed(userId: string, workspaceId: string, workspaceName: string): Promise<void> {
    await this.notify({
      userId,
      workspaceId,
      type: 'SUBSCRIPTION_RESUMED',
      eventType: NotificationEventType.SUBSCRIPTION_RESUMED,
      title: 'Subscription Resumed',
      message: `Your subscription for ${workspaceName} has been resumed. You can now submit new tasks.`,
      payload: { workspaceName },
      channels: { inApp: true, email: true },
    });

    // Admin Slack mirror
    await this.sendAdminSlackNotification(
      'SUBSCRIPTION_RESUMED',
      `▶️ Subscription resumed for ${workspaceName}`,
      workspaceName,
    );
  }

  async notifySubscriptionCanceled(userId: string, workspaceId: string, workspaceName: string): Promise<void> {
    await this.notify({
      userId,
      workspaceId,
      type: 'SUBSCRIPTION_CANCELED',
      eventType: NotificationEventType.SUBSCRIPTION_CANCELED,
      title: 'Subscription Canceled',
      message: `Your subscription for ${workspaceName} has been canceled. You can still access your existing tasks until the period ends.`,
      payload: { workspaceName },
      channels: { inApp: true, email: true },
    });

    // Admin Slack mirror for high-signal events
    await this.sendAdminSlackNotification(
      'SUBSCRIPTION_CANCELED',
      `Subscription canceled for ${workspaceName}`,
      workspaceName,
    );
  }

  async notifyWorkspaceInvite(userId: string, workspaceId: string, workspaceName: string, inviterName: string): Promise<void> {
    await this.notify({
      userId,
      workspaceId,
      type: 'WORKSPACE_INVITE',
      eventType: NotificationEventType.WORKSPACE_INVITE,
      title: `Invited to ${workspaceName}`,
      message: `${inviterName} has invited you to join ${workspaceName}.`,
      payload: { workspaceName, inviterName },
      channels: { inApp: true, email: true },
    });

    // Admin Slack mirror
    await this.sendAdminSlackNotification(
      'WORKSPACE_INVITE',
      `📧 ${inviterName} invited someone to ${workspaceName}`,
      workspaceName,
    );
  }

  async notifyMemberJoined(userId: string, workspaceId: string, workspaceName: string, memberName: string): Promise<void> {
    await this.notify({
      userId,
      workspaceId,
      type: 'MEMBER_JOINED',
      eventType: NotificationEventType.MEMBER_JOINED,
      title: 'New team member',
      message: `${memberName} has joined ${workspaceName}.`,
      payload: { workspaceName, memberName },
      channels: { inApp: true, slack: true },
    });

    // Admin Slack mirror
    await this.sendAdminSlackNotification(
      'MEMBER_JOINED',
      `👋 ${memberName} joined ${workspaceName}`,
      workspaceName,
    );
  }

  // ========================================
  // ADMIN SLACK MIRROR (HIGH-SIGNAL EVENTS)
  // ========================================

  /**
   * Send high-signal events to internal Sako admin Slack channel
   */
  private async sendAdminSlackNotification(
    eventType: string,
    message: string,
    workspaceName?: string,
    taskId?: string,
  ): Promise<void> {
    const webhookUrl = this.configService.get<string>('ADMIN_SLACK_WEBHOOK_URL');
    const botToken = this.configService.get<string>('ADMIN_SLACK_BOT_TOKEN');
    const channelId = this.configService.get<string>('ADMIN_SLACK_CHANNEL_ID');

    if (!webhookUrl && (!botToken || !channelId)) {
      // Admin Slack not configured, skip silently
      return;
    }

    try {
      const studioUrl = this.configService.get<string>('STUDIO_URL') || 'https://studio.trysako.com';
      let fullMessage = message;

      if (workspaceName) {
        fullMessage = `${message} (Workspace: ${workspaceName})`;
      }

      if (taskId) {
        fullMessage += `\nView: ${studioUrl}/tasks/${taskId}`;
      }

      if (webhookUrl) {
        // Use webhook approach
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullMessage }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          this.logger.error(`Admin Slack webhook failed: ${response.status} ${response.statusText} - ${errorText}`);
        } else {
          this.logger.debug(`Sent admin Slack notification via webhook: ${eventType}`);
        }
      } else if (botToken && channelId) {
        // Use bot token approach
        await this.slackService.postMessage(channelId, fullMessage, botToken);
        this.logger.debug(`Sent admin Slack notification via bot token: ${eventType}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send admin Slack notification: ${err.message}`, {
        eventType,
        error: err.stack,
      });
      // Don't throw - admin notifications are not critical
    }
  }

  async notifyMemberRemoved(userId: string, workspaceId: string, workspaceName: string): Promise<void> {
    await this.notify({
      userId,
      workspaceId,
      type: 'MEMBER_REMOVED',
      eventType: NotificationEventType.MEMBER_REMOVED,
      title: 'Removed from workspace',
      message: `You have been removed from ${workspaceName}.`,
      payload: { workspaceName },
      channels: { inApp: true, email: true },
    });
  }

  /**
   * Notify user when task is approaching SLA deadline (<6 hours remaining)
   */
  async notifySlaWarning(
    userId: string,
    workspaceId: string,
    taskId: string,
    taskTitle: string,
    hoursRemaining: number,
  ): Promise<void> {
    // Notify the task creator
    await this.notify({
      userId,
      workspaceId,
      type: 'SLA_WARNING',
      eventType: NotificationEventType.SLA_WARNING,
      title: 'Task Approaching Deadline',
      message: `Your task "${taskTitle}" has approximately ${hoursRemaining} hours remaining until the SLA deadline.`,
      payload: { taskId, taskTitle, hoursRemaining },
      channels: { inApp: true, email: false, slack: true },
    });

    // Fan out to workspace owners
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'SLA_WARNING',
        eventType: NotificationEventType.SLA_WARNING,
        title: 'Task Approaching SLA Deadline',
        message: `Task "${taskTitle}" has ${hoursRemaining} hours remaining until SLA deadline.`,
        payload: { taskId, taskTitle, hoursRemaining },
        channels: { inApp: true, email: false, slack: false },
      });
    }

    // Notify studio admins
    const adminIds = await this.getStudioAdminIds(userId);
    for (const adminId of adminIds) {
      await this.notify({
        userId: adminId,
        workspaceId,
        type: 'SLA_WARNING',
        eventType: NotificationEventType.SLA_WARNING,
        title: 'Task Approaching SLA Deadline',
        message: `Task "${taskTitle}" has ${hoursRemaining} hours remaining - monitor closely.`,
        payload: { taskId, taskTitle, hoursRemaining },
        channels: { inApp: true, email: false, slack: true },
        isAdminNotification: true,
      });
    }

    // Admin Slack mirror
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    await this.sendAdminSlackNotification(
      'SLA_WARNING',
      `⚠️ Task "${taskTitle}" approaching SLA deadline (${hoursRemaining}h remaining)`,
      workspace?.name,
      taskId,
    );
  }

  /**
   * Notify when task misses SLA deadline
   */
  async notifySlaMissed(
    userId: string,
    workspaceId: string,
    taskId: string,
    taskTitle: string,
    hoursLate: number,
  ): Promise<void> {
    // Notify the task creator
    await this.notify({
      userId,
      workspaceId,
      type: 'SLA_MISSED',
      eventType: NotificationEventType.SLA_MISSED,
      title: 'Task Completed Late',
      message: `Your task "${taskTitle}" was completed ${hoursLate} hours after the SLA deadline.`,
      payload: { taskId, taskTitle, hoursLate },
      channels: { inApp: true, email: false, slack: true },
    });

    // Fan out to workspace owners
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'SLA_MISSED',
        eventType: NotificationEventType.SLA_MISSED,
        title: 'Task Completed Late',
        message: `Task "${taskTitle}" completed ${hoursLate} hours past SLA deadline.`,
        payload: { taskId, taskTitle, hoursLate },
        channels: { inApp: true, email: false, slack: false },
      });
    }

    // Notify studio admins
    const adminIds = await this.getStudioAdminIds(userId);
    for (const adminId of adminIds) {
      await this.notify({
        userId: adminId,
        workspaceId,
        type: 'SLA_MISSED',
        eventType: NotificationEventType.SLA_MISSED,
        title: 'SLA Missed - Action Required',
        message: `Task "${taskTitle}" completed ${hoursLate} hours late. Credit has been issued automatically.`,
        payload: { taskId, taskTitle, hoursLate },
        channels: { inApp: true, email: false, slack: true },
        isAdminNotification: true,
      });
    }

    // Admin Slack mirror
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    await this.sendAdminSlackNotification(
      'SLA_MISSED',
      `🚨 SLA missed: "${taskTitle}" completed ${hoursLate}h late - credit issued`,
      workspace?.name,
      taskId,
    );
  }

  /**
   * Notify user when an SLA credit is issued due to late task completion
   */
  async notifySlaCreditIssued(
    userId: string,
    workspaceId: string,
    taskId: string,
    taskTitle: string,
  ): Promise<void> {
    // Notify the task creator about the SLA credit
    await this.notify({
      userId,
      workspaceId,
      type: 'SLA_CREDIT_ISSUED',
      title: 'SLA Credit Applied',
      message: `Your task "${taskTitle}" was completed after our SLA deadline. We've added 1 extra day to your account.`,
      payload: { taskId, taskTitle },
      channels: { inApp: true, email: true, slack: true },
    });

    // Fan out to workspace owners (excluding task creator to avoid duplicate)
    const ownerIds = await this.getWorkspaceOwnerIds(workspaceId, userId);
    for (const ownerId of ownerIds) {
      await this.notify({
        userId: ownerId,
        workspaceId,
        type: 'SLA_CREDIT_ISSUED',
        title: 'SLA Credit Applied',
        message: `SLA credit issued for "${taskTitle}". 1 day credit added.`,
        payload: { taskId, taskTitle },
        channels: { inApp: true, email: true, slack: false },
      });
    }

    // Notify studio admins about the SLA miss
    const adminIds = await this.getStudioAdminIds(userId);
    for (const adminId of adminIds) {
      await this.notify({
        userId: adminId,
        workspaceId,
        type: 'SLA_CREDIT_ISSUED',
        title: 'SLA Miss - Credit Issued',
        message: `SLA missed on "${taskTitle}". 1 day credit automatically issued to client.`,
        payload: { taskId, taskTitle },
        channels: { inApp: true, email: true, slack: false },
        isAdminNotification: true,
      });
    }

    // Admin Slack mirror for high-signal events
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    await this.sendAdminSlackNotification(
      'SLA_CREDIT_ISSUED',
      `⚠️ SLA missed on "${taskTitle}" - 1 day credit issued`,
      workspace?.name,
      taskId,
    );
  }

  /**
   * Direct email send for cases where we have email but no userId
   * (e.g., invitations, password resets)
   */
  async sendDirectEmail(email: string, type: string, data: Record<string, any>): Promise<void> {
    // Ensure Resend is initialized
    await this.ensureResendInitialized();

    if (!this.resendEnabled || !this.resendClient) {
      this.logger.warn(`Cannot send direct email - Resend not enabled`);
      return;
    }

    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'SAKO <noreply@updates.trysako.com>';
    const baseUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.trysako.com';

    let subject: string;
    let htmlBody: string;
    let textBody: string;

    const heading = (text: string) =>
      `<h2 style="color: var(--brand-dark); margin: 0 0 20px 0; font-size: 24px;">${text}</h2>`;
    const muted = (text: string) =>
      `<p style="font-size: 14px; line-height: 1.6; color: var(--brand-gray); margin: 0 0 16px 0;" class="text-muted">${text}</p>`;

    switch (type) {
      case 'WORKSPACE_INVITE':
        subject = `You're invited to join ${data.workspaceName} on Sako`;
        const inviteBody = `
            ${heading("You're invited!")}
            ${paragraph(`${data.inviterName || 'A team member'} has invited you to join <strong>${data.workspaceName}</strong> on Sako.`)}
            ${muted('Sako is a design operations platform that helps B2B SaaS teams ship launch-ready assets in 48 hours.')}
            ${ctaButton('Accept Invitation →', data.inviteUrl || baseUrl)}
          `;
        htmlBody = wrapInBaseTemplate({
          subject,
          preheader: `${data.inviterName || 'A team member'} invited you to join ${data.workspaceName}.`,
          bodyHtml: inviteBody,
          unsubscribeUrl: `${baseUrl}/unsubscribe`,
          companyAddress: this.configService.get<string>('MARKETING_COMPANY_ADDRESS') || 'SAKO',
          signatureAvatarUrl: SAKO_ICON_URL,
        });
        textBody = `You're invited to join ${data.workspaceName} on Sako.\n\nAccept: ${data.inviteUrl || baseUrl}`;
        break;

      default:
        subject = data.subject || 'Message from Sako';
        const defaultBody = `
            ${heading(subject)}
            ${data.message ? paragraph(data.message) : ''}
            ${ctaButton('Open Sako →', baseUrl)}
          `;
        htmlBody = wrapInBaseTemplate({
          subject,
          preheader: data.message || subject,
          bodyHtml: defaultBody,
          unsubscribeUrl: `${baseUrl}/unsubscribe`,
          companyAddress: this.configService.get<string>('MARKETING_COMPANY_ADDRESS') || 'SAKO',
          signatureAvatarUrl: SAKO_ICON_URL,
        });
        textBody = data.message || '';
    }

    try {
      const result = await this.resendClient.emails.send({
        from: emailFrom,
        to: [email], // Resend expects array
        subject,
        html: htmlBody,
        text: textBody,
      });
      this.logger.debug(`Sent direct email to ${email}: ${type} (id: ${result?.data?.id || 'unknown'})`);
    } catch (err) {
      this.logger.error(`Failed to send direct email to ${email}: ${err}`);
    }
  }
}
