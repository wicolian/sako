/**
 * Marketing Email Service
 *
 * Handles sending marketing nurture emails with idempotency.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail/mail.service';
import { MarketingService } from './marketing.service';
import { MarketingOfferService } from './marketing-offer.service';
import { MarketingEmailStep, MarketingEmailStatus } from '@prisma/client';
import {
  getD0Template,
  getD1Template,
  getD3Template,
  getD5Template,
  getD10Template,
} from './templates';

@Injectable()
export class MarketingEmailService {
  private readonly logger = new Logger(MarketingEmailService.name);
  private readonly emailsEnabled: boolean;
  private readonly dryRun: boolean;
  private readonly fromEmail: string;
  private readonly replyTo: string;
  private readonly frontendUrl: string;
  private readonly calendarLink: string;
  private readonly companyAddress: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private mailService: MailService,
    private marketingService: MarketingService,
    private offerService: MarketingOfferService,
  ) {
    this.emailsEnabled = this.configService.get<string>('MARKETING_EMAILS_ENABLED') === 'true';
    this.dryRun = this.configService.get<string>('MARKETING_EMAILS_DRY_RUN') === 'true';
    this.fromEmail = this.configService.get<string>('MARKETING_EMAILS_FROM') || 'hello@trysako.com';
    this.replyTo = this.configService.get<string>('MARKETING_EMAILS_REPLY_TO') || 'hello@example.com';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.trysako.com';
    this.calendarLink = this.configService.get<string>('MARKETING_CALENDAR_LINK') || '';
    this.companyAddress = this.configService.get<string>('MARKETING_COMPANY_ADDRESS') || 'SAKO';

    if (this.emailsEnabled) {
      this.logger.log(`Marketing emails enabled (dry_run=${this.dryRun})`);
    } else {
      this.logger.log('Marketing emails disabled (MARKETING_EMAILS_ENABLED != true)');
    }
  }

  isEnabled(): boolean {
    return this.emailsEnabled;
  }

  isDryRun(): boolean {
    return this.dryRun;
  }

  /**
   * Send a specific step to a lead (called by worker)
   */
  async sendStepDirect(leadId: string, step: MarketingEmailStep | string): Promise<MarketingEmailStatus> {
    const stepEnum = step as MarketingEmailStep;

    // Check if already sent (idempotency)
    const existing = await this.prisma.marketingEmailSend.findUnique({
      where: {
        leadId_step: { leadId, step: stepEnum },
      },
    });

    if (existing) {
      this.logger.debug(`Step ${step} already sent to lead ${leadId}, skipping`);
      return MarketingEmailStatus.SKIPPED;
    }

    // Get lead
    const lead = await this.marketingService.getLeadById(leadId);
    if (!lead) {
      this.logger.warn(`Lead ${leadId} not found`);
      return MarketingEmailStatus.FAILED;
    }

    // Check if unsubscribed or suppressed
    if (lead.unsubscribed || lead.suppressMarketing) {
      this.logger.debug(`Lead ${leadId} is unsubscribed/suppressed, skipping`);
      return MarketingEmailStatus.SKIPPED;
    }

    // Check if converted (don't send to converted leads)
    if (lead.converted) {
      this.logger.debug(`Lead ${leadId} is already converted, skipping`);
      return MarketingEmailStatus.SKIPPED;
    }

    // Build email content
    const template = await this.buildEmailContent(lead, stepEnum);
    if (!template) {
      this.logger.error(`Failed to build template for step ${step}`);
      return MarketingEmailStatus.FAILED;
    }

    // Dry run mode
    if (this.dryRun) {
      this.logger.log(`[DRY RUN] Would send ${step} to ${this.maskEmail(lead.email)}: "${template.subject}"`);
      
      await this.prisma.marketingEmailSend.create({
        data: {
          leadId,
          step: stepEnum,
          subject: template.subject,
          status: MarketingEmailStatus.DRY_RUN,
        },
      });

      return MarketingEmailStatus.DRY_RUN;
    }

    // Actually send
    try {
      const result = await this.mailService.sendMarketingEmailDirect(
        lead.email,
        template.subject,
        template.html,
        this.fromEmail,
        this.replyTo,
      );

      await this.prisma.marketingEmailSend.create({
        data: {
          leadId,
          step: stepEnum,
          subject: template.subject,
          status: result.success ? MarketingEmailStatus.SENT : MarketingEmailStatus.FAILED,
          providerMessageId: result.messageId,
          error: result.error?.slice(0, 500),
        },
      });

      if (result.success) {
        this.logger.log(`Sent ${step} to ${this.maskEmail(lead.email)}`);
        return MarketingEmailStatus.SENT;
      } else {
        this.logger.error(`Failed to send ${step} to ${this.maskEmail(lead.email)}: ${result.error}`);
        return MarketingEmailStatus.FAILED;
      }
    } catch (error: any) {
      this.logger.error(`Exception sending ${step}: ${error.message}`);

      await this.prisma.marketingEmailSend.create({
        data: {
          leadId,
          step: stepEnum,
          subject: template.subject,
          status: MarketingEmailStatus.FAILED,
          error: error.message?.slice(0, 500),
        },
      });

      throw error;
    }
  }

  /**
   * Build email content for a step
   */
  private async buildEmailContent(
    lead: { id: string; email: string; name?: string | null },
    step: MarketingEmailStep,
  ): Promise<{ subject: string; html: string } | null> {
    const firstName = lead.name?.split(' ')[0] || 'there';
    const pricingUrl = `${this.frontendUrl}/pricing`;
    const unsubscribeUrl = this.marketingService.getUnsubscribeUrl(lead.email);

    const commonVars = {
      firstName,
      pricingUrl,
      unsubscribeUrl,
      companyAddress: this.companyAddress,
    };

    switch (step) {
      case MarketingEmailStep.D0:
        return getD0Template(commonVars);

      case MarketingEmailStep.D1:
        return getD1Template(commonVars);

      case MarketingEmailStep.D3:
        return getD3Template(commonVars);

      case MarketingEmailStep.D5:
        // Generate promo code for D5
        const promoResult = await this.offerService.getOrCreatePromoCode(lead.id);
        return getD5Template({
          ...commonVars,
          promoCode: promoResult?.code || 'SAKO10',
          promoExpiryDate: promoResult?.expiresAt
            ? new Date(promoResult.expiresAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : '5 days from now',
          redeemUrl: promoResult?.code
            ? `${this.frontendUrl}/redeem?code=${promoResult.code}`
            : pricingUrl,
        });

      case MarketingEmailStep.D10:
        return getD10Template({
          ...commonVars,
          calendarUrl: this.calendarLink || `mailto:${this.replyTo}?subject=SAKO%20Demo`,
        });

      default:
        return null;
    }
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    const masked = local.length > 2 ? `${local[0]}***${local.slice(-1)}` : '***';
    return `${masked}@${domain}`;
  }
}
