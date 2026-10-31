import { ConfigService } from '@nestjs/config';

export const BillingInterval = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;

export type BillingInterval = typeof BillingInterval[keyof typeof BillingInterval];

/**
 * SUPPORTED PLANS (canonical pricing from Composer/Core/Ops/Enterprise sheet):
 * - CORE: $2,500/mo or $27,000/yr – 1 active task, Design + Motion
 * - OPS: $4,500/mo or $48,600/yr – 2 active tasks, Design + Motion
 * - ENTERPRISE: starts at $8,500/mo or $91,800/yr – 3+ active tasks, Design + Motion + Strategy
 * - COMPOSER_FREE: Free tier, 10 AI credits/month (PLG)
 * - COMPOSER_PRO: $30/mo or $360/yr – 100 AI credits/month, no Studio access
 *
 * Composer Pro is enabled when Stripe products/prices exist and the following env vars are set:
 * - STRIPE_PRODUCT_ID_COMPOSER_PRO
 * - STRIPE_PRICE_ID_COMPOSER_PRO_MONTHLY
 * - STRIPE_PRICE_ID_COMPOSER_PRO_YEARLY
 *
 * Marketing labels (e.g. “Ops Base”, “Starts at $8,500”) are handled in the frontend
 * and do not affect these internal plan codes or env keys.
 */
export type PlanCode = 'CORE' | 'OPS' | 'ENTERPRISE' | 'COMPOSER_FREE' | 'COMPOSER_PRO';

/**
 * Plan configuration interface
 * All Stripe IDs are loaded from environment variables for enterprise flexibility
 */
export interface PlanConfig {
  planCode: PlanCode;
  name: string;
  stripeProductId: string;
  stripePriceIdMonthly: string;
  stripePriceIdYearly: string;
  activeTaskLimit: number;
  daysCreditsMonthly: number;
  daysCreditsYearly: number;
  seats: number;
  aiCreditsMonthly: number;
  aiCreditsYearly: number;
  tatSeconds: number;
}

/**
 * Plan definition for runtime use
 */
export interface PlanDefinition {
  planKey: string;
  planCode: PlanCode;
  billingInterval: BillingInterval;
  seats: number;
  stripePriceId: string;
  activeTaskLimit: number;
  tatSeconds: number;
  dayCreditsPerCycle: number;
  aiCreditsPerCycle: number;
  stripeProductId: string;
}

/**
 * Load plan configuration from environment variables
 * Enterprise-grade: All Stripe IDs configurable via env vars
 */
export function loadPlanConfig(configService: ConfigService): Record<PlanCode, PlanConfig> {
  return {
    CORE: {
      planCode: 'CORE',
      name: 'Core',
      stripeProductId: configService.get<string>('STRIPE_PRODUCT_ID_CORE') || '',
      stripePriceIdMonthly: configService.get<string>('STRIPE_PRICE_ID_CORE_MONTHLY') || '',
      stripePriceIdYearly: configService.get<string>('STRIPE_PRICE_ID_CORE_YEARLY') || '',
      activeTaskLimit: parseInt(configService.get<string>('PLAN_CORE_ACTIVE_TASKS') || '1', 10),
      daysCreditsMonthly: parseInt(configService.get<string>('PLAN_CORE_DAY_CREDITS_MONTHLY') || '30', 10),
      daysCreditsYearly: parseInt(configService.get<string>('PLAN_CORE_DAY_CREDITS_YEARLY') || '365', 10),
      seats: parseInt(configService.get<string>('PLAN_CORE_SEATS') || '2', 10),
      aiCreditsMonthly: parseInt(configService.get<string>('PLAN_CORE_AI_CREDITS_MONTHLY') || '999999', 10), // unlimited
      aiCreditsYearly: parseInt(configService.get<string>('PLAN_CORE_AI_CREDITS_YEARLY') || '999999', 10), // unlimited
      tatSeconds: parseInt(configService.get<string>('PLAN_CORE_TAT_SECONDS') || '172800', 10), // 48h default
    },
    OPS: {
      planCode: 'OPS',
      name: 'Ops Base',
      stripeProductId: configService.get<string>('STRIPE_PRODUCT_ID_OPS') || '',
      stripePriceIdMonthly: configService.get<string>('STRIPE_PRICE_ID_OPS_MONTHLY') || '',
      stripePriceIdYearly: configService.get<string>('STRIPE_PRICE_ID_OPS_YEARLY') || '',
      activeTaskLimit: parseInt(configService.get<string>('PLAN_OPS_ACTIVE_TASKS') || '2', 10),
      daysCreditsMonthly: parseInt(configService.get<string>('PLAN_OPS_DAY_CREDITS_MONTHLY') || '30', 10),
      daysCreditsYearly: parseInt(configService.get<string>('PLAN_OPS_DAY_CREDITS_YEARLY') || '365', 10),
      seats: parseInt(configService.get<string>('PLAN_OPS_SEATS') || '4', 10),
      aiCreditsMonthly: parseInt(configService.get<string>('PLAN_OPS_AI_CREDITS_MONTHLY') || '999999', 10), // unlimited
      aiCreditsYearly: parseInt(configService.get<string>('PLAN_OPS_AI_CREDITS_YEARLY') || '999999', 10), // unlimited
      tatSeconds: parseInt(configService.get<string>('PLAN_OPS_TAT_SECONDS') || '172800', 10), // 48h default
    },
    ENTERPRISE: {
      planCode: 'ENTERPRISE',
      name: 'Enterprise',
      stripeProductId: configService.get<string>('STRIPE_PRODUCT_ID_ENTERPRISE') || '',
      stripePriceIdMonthly: configService.get<string>('STRIPE_PRICE_ID_ENTERPRISE_MONTHLY') || '',
      stripePriceIdYearly: configService.get<string>('STRIPE_PRICE_ID_ENTERPRISE_YEARLY') || '',
      activeTaskLimit: parseInt(configService.get<string>('PLAN_ENTERPRISE_ACTIVE_TASKS') || '3', 10),
      daysCreditsMonthly: parseInt(configService.get<string>('PLAN_ENTERPRISE_DAY_CREDITS_MONTHLY') || '30', 10),
      daysCreditsYearly: parseInt(configService.get<string>('PLAN_ENTERPRISE_DAY_CREDITS_YEARLY') || '365', 10),
      seats: parseInt(configService.get<string>('PLAN_ENTERPRISE_SEATS') || '5', 10),
      aiCreditsMonthly: parseInt(configService.get<string>('PLAN_ENTERPRISE_AI_CREDITS_MONTHLY') || '999999', 10), // unlimited
      aiCreditsYearly: parseInt(configService.get<string>('PLAN_ENTERPRISE_AI_CREDITS_YEARLY') || '999999', 10), // unlimited
      tatSeconds: parseInt(configService.get<string>('PLAN_ENTERPRISE_TAT_SECONDS') || '172800', 10), // 48h default
    },
    // Composer-only plans (no Studio access)
    COMPOSER_FREE: {
      planCode: 'COMPOSER_FREE',
      name: 'Composer Free',
      stripeProductId: '', // No Stripe for free tier
      stripePriceIdMonthly: '',
      stripePriceIdYearly: '',
      activeTaskLimit: 0, // No Studio tasks
      daysCreditsMonthly: 0, // No day credits
      daysCreditsYearly: 0,
      seats: 0, // No team seats
      aiCreditsMonthly: 10, // 10 AI credits per month
      aiCreditsYearly: 120, // 10 per month for 12 months
      tatSeconds: 0, // No TAT (no Studio tasks)
    },
    COMPOSER_PRO: {
      planCode: 'COMPOSER_PRO',
      name: 'Composer Pro',
      stripeProductId: configService.get<string>('STRIPE_PRODUCT_ID_COMPOSER_PRO') || '',
      stripePriceIdMonthly: configService.get<string>('STRIPE_PRICE_ID_COMPOSER_PRO_MONTHLY') || '',
      stripePriceIdYearly: configService.get<string>('STRIPE_PRICE_ID_COMPOSER_PRO_YEARLY') || '',
      activeTaskLimit: 0, // No Studio tasks
      daysCreditsMonthly: 0, // No day credits
      daysCreditsYearly: 0,
      seats: 0, // No team seats
      aiCreditsMonthly: 100, // 100 AI credits per month
      aiCreditsYearly: 1200, // 100 per month for 12 months
      tatSeconds: 0, // No TAT (no Studio tasks)
    },
  };
}

/**
 * Build plan definitions from configuration
 * Creates monthly and yearly variants for each plan
 */
export function buildPlanDefinitions(configService: ConfigService): Record<string, PlanDefinition> {
  const plans = loadPlanConfig(configService);
  const definitions: Record<string, PlanDefinition> = {};

  Object.values(plans).forEach((plan) => {
    // Monthly variant
    definitions[`${plan.planCode}_${BillingInterval.MONTHLY}`] = {
      planKey: `${plan.planCode}_${BillingInterval.MONTHLY}`,
      planCode: plan.planCode,
      billingInterval: BillingInterval.MONTHLY,
      seats: plan.seats,
      stripePriceId: plan.stripePriceIdMonthly,
      activeTaskLimit: plan.activeTaskLimit,
      tatSeconds: plan.tatSeconds,
      dayCreditsPerCycle: plan.daysCreditsMonthly,
      aiCreditsPerCycle: plan.aiCreditsMonthly,
      stripeProductId: plan.stripeProductId,
    };

    // Yearly variant
    definitions[`${plan.planCode}_${BillingInterval.YEARLY}`] = {
      planKey: `${plan.planCode}_${BillingInterval.YEARLY}`,
      planCode: plan.planCode,
      billingInterval: BillingInterval.YEARLY,
      seats: plan.seats,
      stripePriceId: plan.stripePriceIdYearly,
      activeTaskLimit: plan.activeTaskLimit,
      tatSeconds: plan.tatSeconds,
      dayCreditsPerCycle: plan.daysCreditsYearly,
      aiCreditsPerCycle: plan.aiCreditsYearly,
      stripeProductId: plan.stripeProductId,
    };
  });

  return definitions;
}

/**
 * Get plan variant by Stripe price ID
 */
export function getPlanVariantByStripePriceId(
  priceId: string,
  configService: ConfigService,
): PlanDefinition | null {
  const definitions = buildPlanDefinitions(configService);
  return Object.values(definitions).find((variant) => variant.stripePriceId === priceId) ?? null;
}

/**
 * Get plan variant by key (e.g., "CORE_MONTHLY")
 */
export function getPlanVariantByKey(
  key: string,
  configService: ConfigService,
): PlanDefinition | null {
  const definitions = buildPlanDefinitions(configService);
  return definitions[key] ?? null;
}

/**
 * Get plan configuration by plan code
 */
export function getPlanByCode(
  planCode: PlanCode,
  configService: ConfigService,
): PlanConfig | null {
  const plans = loadPlanConfig(configService);
  return plans[planCode] ?? null;
}

/**
 * Normalize plan code input to PlanCode enum
 * CORE now supports both Design + Motion (1 active task at a time)
 */
export function normalizePlanCode(planCode?: string | null): PlanCode | null {
  if (!planCode) return null;
  const upper = planCode.toUpperCase();

  // Direct match
  if (upper === 'CORE' || upper === 'OPS' || upper === 'ENTERPRISE' || 
      upper === 'COMPOSER_FREE' || upper === 'COMPOSER_PRO') {
    return upper as PlanCode;
  }

  return null;
}

/**
 * Check if a plan code is a Composer-only plan (no Studio access)
 */
export function isComposerOnlyPlan(planCode: PlanCode): boolean {
  return planCode === 'COMPOSER_FREE' || planCode === 'COMPOSER_PRO';
}

/**
 * Check if a plan has Studio access
 */
export function hasStudioAccess(planCode: PlanCode): boolean {
  return planCode === 'CORE' || planCode === 'OPS' || planCode === 'ENTERPRISE';
}

/**
 * Get Stripe price ID for a plan and billing interval
 */
export function getPriceIdForPlan(
  planCodeInput: string,
  interval: BillingInterval,
  configService: ConfigService,
): string | null {
  const normalized = normalizePlanCode(planCodeInput);
  if (!normalized) return null;

  const plan = getPlanByCode(normalized, configService);
  if (!plan) return null;

  return interval === BillingInterval.MONTHLY
    ? plan.stripePriceIdMonthly
    : plan.stripePriceIdYearly;
}

/**
 * Get all available plan codes
 */
export function getAllPlanCodes(): PlanCode[] {
  return ['CORE', 'OPS', 'ENTERPRISE', 'COMPOSER_FREE', 'COMPOSER_PRO'];
}

/**
 * Get Studio plan codes only
 */
export function getStudioPlanCodes(): PlanCode[] {
  return ['CORE', 'OPS', 'ENTERPRISE'];
}

/**
 * Get Composer-only plan codes
 */
export function getComposerPlanCodes(): PlanCode[] {
  return ['COMPOSER_FREE', 'COMPOSER_PRO'];
}

// ========================================
// COMPOSER CAPABILITIES HELPERS
// ========================================

/**
 * Get human-readable display name for a plan code
 */
export function getPlanDisplayName(planCode: PlanCode): string {
  const names: Record<PlanCode, string> = {
    COMPOSER_FREE: 'Composer Free',
    COMPOSER_PRO: 'Composer Pro',
    CORE: 'Core',
    OPS: 'Ops Base',
    ENTERPRISE: 'Enterprise',
  };
  return names[planCode] || planCode;
}

/**
 * Check if a plan has Pro-tier features (Figma export, publish to domain)
 * Available for Composer Pro and all Studio plans
 */
export function hasProFeatures(planCode: PlanCode): boolean {
  return planCode !== 'COMPOSER_FREE';
}

/**
 * Check if a plan includes motion/video work
 * Available for all Studio plans (CORE, OPS, ENTERPRISE)
 */
export function hasMotion(planCode: PlanCode): boolean {
  return hasStudioAccess(planCode);
}

/**
 * Check if a plan includes strategy work
 * Available only for Enterprise
 */
export function hasStrategy(planCode: PlanCode): boolean {
  return planCode === 'ENTERPRISE';
}

/**
 * Check if a plan has unlimited Composer credits
 * Studio plans (CORE, OPS, ENTERPRISE) have unlimited credits
 */
export function hasUnlimitedComposerCredits(planCode: PlanCode): boolean {
  return hasStudioAccess(planCode);
}

/**
 * Get the default AI credit limit for a plan (for metered plans)
 */
export function getDefaultAiCreditLimit(planCode: PlanCode): number | null {
  if (hasUnlimitedComposerCredits(planCode)) {
    return null; // Unlimited
  }
  // Metered plans
  if (planCode === 'COMPOSER_FREE') return 10;
  if (planCode === 'COMPOSER_PRO') return 100;
  return null;
}
