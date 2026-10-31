/**
 * Marketing Offer Service
 *
 * Handles Stripe promo code generation for marketing emails.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MarketingOfferKind } from '@prisma/client';
import { getStripeClient } from '../common/stripe/stripe-client';
import { isStripeConfigured } from '../common/stripe/stripe.config';
import Stripe from 'stripe';

@Injectable()
export class MarketingOfferService {
  private readonly logger = new Logger(MarketingOfferService.name);
  private readonly baseCouponId: string;
  private readonly percentOff: number;
  private readonly firstTimeOnly: boolean;
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.baseCouponId = this.configService.get<string>('STRIPE_MARKETING_BASE_COUPON_ID') || '';
    this.percentOff = parseInt(this.configService.get<string>('MARKETING_PROMO_PERCENT_OFF') || '10', 10);
    this.firstTimeOnly = this.configService.get<string>('MARKETING_PROMO_FIRST_TIME_ONLY') === 'true';

    if (this.baseCouponId) {
      this.logger.log(`Marketing offers configured with base coupon: ${this.baseCouponId}`);
    } else {
      this.logger.warn('STRIPE_MARKETING_BASE_COUPON_ID not configured - promo codes will not be generated');
    }
  }

  private getStripe(): Stripe | null {
    if (!isStripeConfigured()) {
      return null;
    }
    if (!this.stripe) {
      this.stripe = getStripeClient();
    }
    return this.stripe;
  }

  /**
   * Get or create a promo code for a lead
   */
  async getOrCreatePromoCode(leadId: string): Promise<{
    code: string;
    expiresAt: Date;
    stripePromotionCodeId: string;
  } | null> {
    const stripe = this.getStripe();
    if (!stripe || !this.baseCouponId) {
      this.logger.debug('Stripe not configured, skipping promo code generation');
      return null;
    }

    // Check for existing unexpired offer
    const existingOffer = await this.prisma.marketingOffer.findFirst({
      where: {
        leadId,
        kind: MarketingOfferKind.COUPON,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingOffer && existingOffer.code && existingOffer.stripePromotionCodeId) {
      this.logger.debug(`Reusing existing promo code for lead ${leadId}: ${existingOffer.code}`);
      return {
        code: existingOffer.code,
        expiresAt: existingOffer.expiresAt!,
        stripePromotionCodeId: existingOffer.stripePromotionCodeId,
      };
    }

    // Generate new promo code
    try {
      const code = `SAKO10-${this.generateShortId()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 5); // 5 days

      const restrictions: Stripe.PromotionCodeCreateParams.Restrictions = {};
      if (this.firstTimeOnly) {
        restrictions.first_time_transaction = true;
      }

      // Create promotion code with the base coupon
      const promotionCode = await stripe.promotionCodes.create({
        promotion: {
          type: 'coupon',
          coupon: this.baseCouponId,
        },
        code,
        max_redemptions: 1,
        expires_at: Math.floor(expiresAt.getTime() / 1000),
        ...(Object.keys(restrictions).length > 0 && { restrictions }),
      });

      // Save to database
      await this.prisma.marketingOffer.upsert({
        where: {
          leadId_kind_planCode: {
            leadId,
            kind: MarketingOfferKind.COUPON,
            planCode: null as any, // Default plan
          },
        },
        update: {
          stripeCouponId: this.baseCouponId,
          stripePromotionCodeId: promotionCode.id,
          code,
          percentOff: this.percentOff,
          expiresAt,
        },
        create: {
          leadId,
          kind: MarketingOfferKind.COUPON,
          stripeCouponId: this.baseCouponId,
          stripePromotionCodeId: promotionCode.id,
          code,
          percentOff: this.percentOff,
          expiresAt,
        },
      });

      this.logger.log(`Created promo code ${code} for lead ${leadId}, expires ${expiresAt.toISOString()}`);

      return {
        code,
        expiresAt,
        stripePromotionCodeId: promotionCode.id,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create promo code for lead ${leadId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate a promo code and return Stripe promotion code ID
   */
  async validatePromoCode(code: string): Promise<{
    valid: boolean;
    promotionCodeId?: string;
    error?: string;
  }> {
    const stripe = this.getStripe();
    if (!stripe) {
      return { valid: false, error: 'Stripe not configured' };
    }

    try {
      const list = await stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1,
      });

      if (list.data.length === 0) {
        return { valid: false, error: 'Invalid or expired promo code' };
      }

      const promo = list.data[0];

      // Check if expired
      if (promo.expires_at && promo.expires_at < Math.floor(Date.now() / 1000)) {
        return { valid: false, error: 'Promo code has expired' };
      }

      // Check if max redemptions reached
      if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) {
        return { valid: false, error: 'Promo code has already been used' };
      }

      return { valid: true, promotionCodeId: promo.id };
    } catch (error: any) {
      this.logger.error(`Failed to validate promo code ${code}: ${error.message}`);
      return { valid: false, error: 'Failed to validate promo code' };
    }
  }

  private generateShortId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like O, 0, I, 1
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}
