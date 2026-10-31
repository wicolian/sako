/**
 * Marketing Service
 *
 * Handles lead capture, conversion tracking, and queries.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface CaptureLeadParams {
  email: string;
  source: string;
  clerkUserId?: string;
  name?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);
  private readonly enabled: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.enabled = this.configService.get<string>('MARKETING_LEADS_ENABLED') === 'true';
    if (this.enabled) {
      this.logger.log('Marketing lead capture enabled');
    } else {
      this.logger.log('Marketing lead capture disabled (MARKETING_LEADS_ENABLED != true)');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Capture or update a marketing lead
   */
  async captureLead(params: CaptureLeadParams) {
    if (!this.enabled) {
      return { enabled: false, lead: null };
    }

    const email = params.email.trim().toLowerCase();
    if (!this.isValidEmail(email)) {
      this.logger.warn(`Invalid email format: ${this.maskEmail(email)}`);
      return { enabled: true, lead: null, error: 'Invalid email format' };
    }

    try {
      const lead = await this.prisma.marketingLead.upsert({
        where: { email },
        update: {
          lastActivity: new Date(),
          name: params.name || undefined,
          source: params.source,
          // Only update clerkUserId if not already set
          ...(params.clerkUserId && {
            clerkUserId: params.clerkUserId,
          }),
          // Update UTM params if provided
          ...(params.utmSource && { utmSource: params.utmSource }),
          ...(params.utmMedium && { utmMedium: params.utmMedium }),
          ...(params.utmCampaign && { utmCampaign: params.utmCampaign }),
          ...(params.utmContent && { utmContent: params.utmContent }),
          ...(params.utmTerm && { utmTerm: params.utmTerm }),
        },
        create: {
          email,
          name: params.name,
          source: params.source,
          clerkUserId: params.clerkUserId,
          utmSource: params.utmSource,
          utmMedium: params.utmMedium,
          utmCampaign: params.utmCampaign,
          utmContent: params.utmContent,
          utmTerm: params.utmTerm,
        },
      });

      this.logger.log(`Lead captured: ${this.maskEmail(email)} from ${params.source}`);
      return { enabled: true, lead };
    } catch (error: any) {
      // Handle clerkUserId unique constraint collision gracefully
      if (error.code === 'P2002' && error.meta?.target?.includes('clerkUserId')) {
        this.logger.warn(`ClerkUserId collision for ${this.maskEmail(email)}, retrying without clerkUserId`);
        
        // Retry without clerkUserId
        const lead = await this.prisma.marketingLead.upsert({
          where: { email },
          update: {
            lastActivity: new Date(),
            name: params.name || undefined,
            source: params.source,
          },
          create: {
            email,
            name: params.name,
            source: params.source,
            // Skip clerkUserId on retry
          },
        });

        return { enabled: true, lead };
      }

      this.logger.error(`Failed to capture lead: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update lead last activity
   */
  async touchLead(email: string, source?: string) {
    if (!this.enabled) return;

    const normalizedEmail = email.trim().toLowerCase();

    await this.prisma.marketingLead.updateMany({
      where: { email: normalizedEmail },
      data: {
        lastActivity: new Date(),
        ...(source && { source }),
      },
    });
  }

  /**
   * Mark lead as converted
   */
  async markConverted(email: string) {
    if (!this.enabled) return;

    const normalizedEmail = email.trim().toLowerCase();

    await this.prisma.marketingLead.updateMany({
      where: { email: normalizedEmail },
      data: {
        converted: true,
        convertedAt: new Date(),
      },
    });

    this.logger.log(`Lead converted: ${this.maskEmail(normalizedEmail)}`);
  }

  /**
   * Get unconverted leads for email sequence
   */
  async getUnconvertedLeadsForSequence(maxDays = 45) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDays);

    return this.prisma.marketingLead.findMany({
      where: {
        converted: false,
        unsubscribed: false,
        suppressMarketing: false,
        signupDate: { gte: cutoffDate },
      },
      include: {
        emails: true,
      },
      orderBy: { signupDate: 'desc' },
    });
  }

  /**
   * Get lead by email
   */
  async getLeadByEmail(email: string) {
    return this.prisma.marketingLead.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        emails: { orderBy: { sentAt: 'desc' } },
        offers: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /**
   * Get lead by ID
   */
  async getLeadById(id: string) {
    return this.prisma.marketingLead.findUnique({
      where: { id },
      include: {
        emails: { orderBy: { sentAt: 'desc' } },
        offers: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  /**
   * List leads for admin
   */
  async listLeads(params: {
    converted?: boolean;
    limit?: number;
    sinceDays?: number;
    search?: string;
  }) {
    const { converted, limit = 100, sinceDays = 60, search } = params;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - sinceDays);

    return this.prisma.marketingLead.findMany({
      where: {
        ...(converted !== undefined && { converted }),
        signupDate: { gte: cutoffDate },
        ...(search && {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        _count: {
          select: { emails: true, offers: true },
        },
      },
      orderBy: { signupDate: 'desc' },
      take: limit,
    });
  }

  /**
   * Update lead (admin)
   */
  async updateLead(id: string, data: {
    unsubscribed?: boolean;
    suppressMarketing?: boolean;
    notes?: string;
    converted?: boolean;
  }, adminUserId?: string) {
    return this.prisma.marketingLead.update({
      where: { id },
      data: {
        ...data,
        ...(data.unsubscribed && { unsubscribedAt: new Date() }),
        ...(data.suppressMarketing && {
          suppressedAt: new Date(),
          suppressedBy: adminUserId,
        }),
        ...(data.converted && { convertedAt: new Date() }),
      },
    });
  }

  /**
   * Unsubscribe by token (public)
   */
  async unsubscribeByToken(email: string, token: string) {
    const secret = this.configService.get<string>('MARKETING_UNSUBSCRIBE_SECRET');
    if (!secret) {
      throw new Error('Unsubscribe secret not configured');
    }

    const expectedToken = this.generateUnsubscribeToken(email, secret);
    if (token !== expectedToken) {
      throw new Error('Invalid unsubscribe token');
    }

    const normalizedEmail = email.trim().toLowerCase();

    await this.prisma.marketingLead.updateMany({
      where: { email: normalizedEmail },
      data: {
        unsubscribed: true,
        unsubscribedAt: new Date(),
      },
    });

    this.logger.log(`Lead unsubscribed: ${this.maskEmail(normalizedEmail)}`);
    return true;
  }

  /**
   * Generate unsubscribe token
   */
  generateUnsubscribeToken(email: string, secret: string): string {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', secret)
      .update(email.trim().toLowerCase())
      .digest('hex')
      .slice(0, 32);
  }

  /**
   * Get unsubscribe URL for a lead
   */
  getUnsubscribeUrl(email: string): string {
    const secret = this.configService.get<string>('MARKETING_UNSUBSCRIBE_SECRET');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.trysako.com';
    
    if (!secret) return '';

    const token = this.generateUnsubscribeToken(email, secret);
    const encodedEmail = encodeURIComponent(email.trim().toLowerCase());
    
    return `${frontendUrl}/api/marketing/unsubscribe?email=${encodedEmail}&token=${token}`;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***';
    const masked = local.length > 2 ? `${local[0]}***${local.slice(-1)}` : '***';
    return `${masked}@${domain}`;
  }
}
