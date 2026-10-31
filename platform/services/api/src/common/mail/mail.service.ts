import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Import unified dark mode template helpers
import {
  wrapInBaseTemplate,
  ctaButton,
  accentBox,
  paragraph,
  mutedText,
  statusBadge,
  heading,
  BRAND_GREEN,
  BRAND_TEXT,
  BRAND_TEXT_MUTED,
} from '../../marketing/templates/base';

// Re-export for notification service compatibility
export { ctaButton, accentBox, paragraph };

/**
 * Mail Service - Uses Resend for email delivery
 * 
 * All emails use the unified dark mode template.
 * For notification-based emails (task updates, etc.), prefer using NotificationService.
 */

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resendClient: any = null;
  private resendEnabled = false;
  private resendInitialized = false;
  private initPromise: Promise<void> | null = null;
  private fromEmail: string;
  private frontendUrl: string;
  private companyAddress: string;

  constructor(private configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('EMAIL_FROM') || 'SAKO <noreply@updates.trysako.com>';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.trysako.com';
    this.companyAddress = this.configService.get<string>('MARKETING_COMPANY_ADDRESS') || 'SAKO';
    this.initPromise = this.initializeResend();
  }

  private async initializeResend(): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not configured - MailService emails disabled');
      this.resendInitialized = true;
      return;
    }

    try {
      // @ts-ignore - resend is dynamically imported
      const { Resend } = await import('resend');
      this.resendClient = new Resend(apiKey);
      this.resendEnabled = true;
      this.logger.log('✓ MailService Resend enabled');
    } catch (err) {
      this.logger.warn('Resend package not installed - MailService emails disabled. Run: npm install resend');
    }
    this.resendInitialized = true;
  }

  /** Ensure Resend is initialized before sending */
  private async ensureInitialized(): Promise<void> {
    if (!this.resendInitialized && this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Wrap content in the unified dark mode email template
   * 
   * Note: Transactional emails link to settings for notification preferences,
   * not a separate unsubscribe page (those are for logged-in users).
   */
  private wrapHtml(subject: string, preheader: string, bodyHtml: string): string {
    // For transactional emails, link to settings where users can manage preferences
    const unsubscribeUrl = `${this.frontendUrl}/settings?tab=notifications`;
    return wrapInBaseTemplate({
      subject,
      preheader,
      bodyHtml,
      unsubscribeUrl,
      companyAddress: this.companyAddress,
    });
  }

  async sendMail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    await this.ensureInitialized();

    if (!this.resendEnabled || !this.resendClient) {
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.log(`📧 [DEV - NO RESEND] Would send to ${to}: ${subject}`);
      } else {
        this.logger.error(`Cannot send email - Resend not configured`);
      }
      return false;
    }

    try {
      this.logger.log(`📧 Attempting to send email to ${to}: ${subject} from ${this.fromEmail}`);
      
      const result = await this.resendClient.emails.send({
        from: this.fromEmail,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      });

      if (result?.error) {
        this.logger.error(`Resend API error: ${JSON.stringify(result.error)}`);
        return false;
      }

      this.logger.log(`📧 Email sent to ${to}: ${subject} (id: ${result?.data?.id || 'unknown'})`);

      // Forward to admin if configured (async, non-blocking)
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
      if (adminEmail && to !== adminEmail) {
        this.forwardToAdmin(adminEmail, subject, html, to).catch(err => 
          this.logger.error(`Failed to forward email to admin: ${err.message}`)
        );
      }

      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`, error.stack);
      this.logger.error(`Error details: ${JSON.stringify(error)}`);
      return false;
    }
  }

  /**
   * Forwards a copy of the user email to the admin with a context header
   */
  private async forwardToAdmin(adminEmail: string, subject: string, originalHtml: string, userEmail: string): Promise<void> {
    if (!this.resendEnabled || !this.resendClient) return;

    // Inject an admin info bar at the top of the body
    const adminHeader = `
      <div style="background-color: #fef2f2; border-bottom: 2px solid #ef4444; padding: 12px 20px; font-family: sans-serif; font-size: 12px; color: #991b1b; text-align: center;">
        <strong>ADMIN COPY</strong> — Sent to: <code>${userEmail}</code><br>
        <span style="opacity: 0.8;">This is a mirror for visibility into user communications.</span>
      </div>
    `;

    // Try to insert after <body> or at the very beginning
    let adminHtml = originalHtml;
    if (adminHtml.includes('<body')) {
      adminHtml = adminHtml.replace(/(<body[^>]*>)/i, `$1${adminHeader}`);
    } else {
      adminHtml = adminHeader + adminHtml;
    }

    try {
      await this.resendClient.emails.send({
        from: this.fromEmail,
        to: [adminEmail],
        subject: `[Admin Mirror] ${subject}`,
        html: adminHtml,
      });
    } catch (err: any) {
      this.logger.error(`Failed to send admin mirror: ${err.message}`);
    }
  }

  // ==========================================
  // TRANSACTIONAL EMAILS
  // ==========================================

  async sendWelcomeEmail(email: string, workspaceName: string): Promise<boolean> {
    const subject = 'Welcome to SAKO';
    const preheader = `You've joined ${workspaceName}. Let's ship some design.`;

    const bodyHtml = `
      ${heading('Welcome to SAKO')}

      ${paragraph(`You've successfully joined <strong>${workspaceName}</strong>. Your design operations journey starts now.`)}

      ${accentBox(`
        <p style="font-size: 14px; color: ${BRAND_TEXT}; margin: 0;">
          <strong>What's next?</strong><br>
          <span style="color: ${BRAND_TEXT_MUTED};">Submit your first task and experience a 48-hour turnaround on production-ready design and motion assets.</span>
        </p>
      `)}

      ${ctaButton('Create Your First Task →', `${this.frontendUrl}/tasks/new`)}

      ${mutedText(`Questions? Just reply to this email.`)}
    `;

    const html = this.wrapHtml(subject, preheader, bodyHtml);
    return this.sendMail(email, subject, html);
  }

  async sendPaymentFailedEmail(email: string, workspaceName: string, invoiceUrl?: string): Promise<boolean> {
    const subject = 'Action Required: Payment Failed';
    const preheader = 'Please update your payment method to avoid service interruption.';

    const bodyHtml = `
      ${heading('Payment Failed')}

      ${paragraph(`We were unable to process the payment for <strong>${workspaceName}</strong>.`)}

      ${paragraph(`Please update your payment method to avoid service interruption. Your workspace will be paused if payment isn't received within 7 days.`)}

      ${ctaButton(invoiceUrl ? 'View Invoice →' : 'Update Payment Method →', invoiceUrl || `${this.frontendUrl}/settings?tab=billing`)}

      ${mutedText(`Need help? Reply to this email and we'll sort it out.`)}
    `;

    const html = this.wrapHtml(subject, preheader, bodyHtml);
    return this.sendMail(email, subject, html);
  }

  async sendTaskStatusUpdateEmail(email: string, taskTitle: string, status: string, taskId: string): Promise<boolean> {
    const taskUrl = `${this.frontendUrl}/tasks/${taskId}`;
    const subject = `Task Update: ${taskTitle}`;
    
    let statusMessage: string;
    let buttonText: string;
    let badge: string;
    let preheader: string;

    switch (status.toUpperCase()) {
      case 'QUEUED':
        statusMessage = 'Your task has been created and is now in queue. We\'ll start working on it soon.';
        buttonText = 'View Task →';
        badge = statusBadge('Queued', 'gray');
        preheader = 'Your task is in queue and will be picked up soon.';
        break;
      case 'IN_PROGRESS':
        statusMessage = 'Work has started on your task. Expected turnaround: <strong>48 hours</strong>.';
        buttonText = 'View Task →';
        badge = statusBadge('In Progress', 'blue');
        preheader = 'Work has started on your task!';
        break;
      case 'IN_REVIEW':
        statusMessage = 'Your task is ready for review. Please check the deliverables and provide feedback.';
        buttonText = 'Review Deliverables →';
        badge = statusBadge('In Review', 'green');
        preheader = 'Your deliverables are ready for review!';
        break;
      case 'COMPLETED':
        statusMessage = 'Great news! Your task has been marked as completed. Download your assets below.';
        buttonText = 'View & Download →';
        badge = statusBadge('Completed', 'green');
        preheader = 'Your task is complete! Download your assets.';
        break;
      default:
        statusMessage = `Your task status has been updated to ${status}.`;
        buttonText = 'View Task →';
        badge = statusBadge(status, 'gray');
        preheader = `Your task status is now ${status}.`;
    }

    const bodyHtml = `
      ${heading('Task Update')}

      <p style="font-size: 16px; font-weight: 600; line-height: 1.5; color: ${BRAND_TEXT}; margin: 0 0 8px 0;">
        ${taskTitle}
      </p>
      <p style="margin: 0 0 20px 0;">${badge}</p>

      ${paragraph(statusMessage)}

      ${ctaButton(buttonText, taskUrl)}
    `;

    const html = this.wrapHtml(subject, preheader, bodyHtml);
    return this.sendMail(email, subject, html);
  }

  async sendInviteEmail(email: string, workspaceName: string, inviterName: string, inviteUrl: string): Promise<boolean> {
    const subject = `You're invited to join ${workspaceName} on SAKO`;
    const preheader = `${inviterName} has invited you to join their design team.`;

    const bodyHtml = `
      ${heading("You're invited")}

      ${paragraph(`<strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> on SAKO.`)}

      ${accentBox(`
        <p style="font-size: 14px; color: ${BRAND_TEXT}; margin: 0;">
          <strong>What is SAKO?</strong><br>
          <span style="color: ${BRAND_TEXT_MUTED};">A design operations platform that helps B2B SaaS teams ship launch-ready assets in 48 hours.</span>
        </p>
      `)}

      ${ctaButton('Accept Invitation →', inviteUrl)}

      ${mutedText(`This invitation will expire in 7 days.`)}
    `;

    const html = this.wrapHtml(subject, preheader, bodyHtml);
    return this.sendMail(email, subject, html);
  }

  async sendSubscriptionPausedEmail(email: string, workspaceName: string): Promise<boolean> {
    const subject = 'Subscription Paused';
    const preheader = 'Your SAKO subscription is now paused. Credits are preserved.';

    const bodyHtml = `
      ${heading('Subscription Paused')}

      ${paragraph(`Your subscription for <strong>${workspaceName}</strong> has been paused.`)}

      ${accentBox(`
        <p style="font-size: 14px; color: ${BRAND_TEXT}; margin: 0;">
          <strong style="color: ${BRAND_GREEN};">Good news:</strong><br>
          <span style="color: ${BRAND_TEXT_MUTED};">Your unused day credits will roll over for up to 3 months (monthly) or 6 months (annual). Resume anytime to continue.</span>
        </p>
      `)}

      ${ctaButton('Manage Subscription →', `${this.frontendUrl}/settings?tab=billing`)}

      ${mutedText(`Questions? Reply to this email.`)}
    `;

    const html = this.wrapHtml(subject, preheader, bodyHtml);
    return this.sendMail(email, subject, html);
  }

  async sendSubscriptionResumedEmail(email: string, workspaceName: string): Promise<boolean> {
    const subject = 'Subscription Resumed';
    const preheader = 'Your SAKO subscription is active again. Let\'s ship some design!';

    const bodyHtml = `
      ${heading('Welcome back')}

      ${paragraph(`Your subscription for <strong>${workspaceName}</strong> has been resumed.`)}

      ${paragraph(`You can now submit new tasks and your design team is ready to help. Your rolled-over credits are available.`)}

      ${ctaButton('Create a Task →', `${this.frontendUrl}/tasks/new`)}

      ${mutedText(`Ready to ship some design? We're here to help.`)}
    `;

    const html = this.wrapHtml(subject, preheader, bodyHtml);
    return this.sendMail(email, subject, html);
  }

  // ==========================================
  // DIRECT METHODS (called by queue processor)
  // ==========================================

  async sendWelcomeEmailDirect(email: string, workspaceName: string): Promise<boolean> {
    return this.sendWelcomeEmail(email, workspaceName);
  }

  async sendPaymentFailedEmailDirect(email: string, workspaceName: string, invoiceUrl?: string): Promise<boolean> {
    return this.sendPaymentFailedEmail(email, workspaceName, invoiceUrl);
  }

  async sendTaskStatusUpdateEmailDirect(email: string, taskTitle: string, status: string, taskId: string): Promise<boolean> {
    return this.sendTaskStatusUpdateEmail(email, taskTitle, status, taskId);
  }

  async sendInviteEmailDirect(email: string, workspaceName: string, inviterName: string, inviteUrl: string): Promise<boolean> {
    return this.sendInviteEmail(email, workspaceName, inviterName, inviteUrl);
  }

  async sendSubscriptionPausedEmailDirect(email: string, workspaceName: string): Promise<boolean> {
    return this.sendSubscriptionPausedEmail(email, workspaceName);
  }

  async sendSubscriptionResumedEmailDirect(email: string, workspaceName: string): Promise<boolean> {
    return this.sendSubscriptionResumedEmail(email, workspaceName);
  }

  /**
   * Send marketing email with unified dark mode template
   */
  async sendMarketingEmail(
    to: string,
    subject: string,
    bodyHtml: string,
    preheader: string = subject,
  ): Promise<boolean> {
    const html = this.wrapHtml(subject, preheader, bodyHtml);
    return this.sendMail(to, subject, html);
  }

  async sendMarketingEmailDirect(
    to: string,
    subject: string,
    html: string,
    fromEmail?: string,
    replyTo?: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    await this.ensureInitialized();

    if (!this.resendEnabled || !this.resendClient) {
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.log(`📧 [DEV - NO RESEND] Would send marketing to ${to}: ${subject}`);
      }
      return { success: false, error: 'Resend not configured' };
    }

    try {
      const result = await this.resendClient.emails.send({
        from: fromEmail || this.fromEmail,
        to: [to],
        subject,
        html,
        text: html.replace(/<[^>]*>/g, ''),
        ...(replyTo && { reply_to: replyTo }),
      });

      if (result?.error) {
        this.logger.error(`Resend API error: ${JSON.stringify(result.error)}`);
        return { success: false, error: JSON.stringify(result.error) };
      }

      this.logger.log(`📧 Marketing email sent to ${to}: ${subject} (id: ${result?.data?.id || 'unknown'})`);
      return { success: true, messageId: result?.data?.id };
    } catch (error: any) {
      this.logger.error(`Failed to send marketing email to ${to}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
