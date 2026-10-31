/**
 * Stripe Price IDs for Client App
 * 
 * V1 SUPPORTED PLANS:
 * - Core (CORE): $2,500/mo - Design + Motion, 1 active task
 * - Ops (OPS): $4,500/mo - Design + Motion, 2 active tasks
 * - Enterprise (ENTERPRISE): $8,500/mo - Design + Motion + Strategy, 3+ tasks
 * 
 * Composer-only plans (handled by Composer app, not Client app):
 * - COMPOSER_FREE: Free, 10 AI credits/month
 * - COMPOSER_PRO: $30/mo, 100 AI credits/month
 * 
 * Price IDs are loaded from environment variables.
 * Set VITE_STRIPE_PRICE_* vars in .env for production.
 * Test values are used as fallbacks for development.
 */

// Test Stripe price IDs (fallbacks for development)
const TEST_PRICE_IDS = {
  CORE_MONTHLY: 'price_1ScNpICtHBOocph1Takpk7NP',
  CORE_YEARLY: 'price_1ScNpJCtHBOocph1vvcq38zY',
  OPS_MONTHLY: 'price_1ScNpJCtHBOocph1uAoQDiyx',
  OPS_YEARLY: 'price_1ScNpKCtHBOocph1zVI3HSvy',
  ENTERPRISE_MONTHLY: 'price_1ScNpLCtHBOocph1SBLfzScP',
  ENTERPRISE_YEARLY: 'price_1ScNpLCtHBOocph1MiI0JlA9',
};

// Load from environment with fallbacks
export const PLAN_PRICES = {
  CORE_MONTHLY: import.meta.env.VITE_STRIPE_PRICE_CORE_MONTHLY || TEST_PRICE_IDS.CORE_MONTHLY,
  CORE_YEARLY: import.meta.env.VITE_STRIPE_PRICE_CORE_YEARLY || TEST_PRICE_IDS.CORE_YEARLY,
  OPS_MONTHLY: import.meta.env.VITE_STRIPE_PRICE_OPS_MONTHLY || TEST_PRICE_IDS.OPS_MONTHLY,
  OPS_YEARLY: import.meta.env.VITE_STRIPE_PRICE_OPS_YEARLY || TEST_PRICE_IDS.OPS_YEARLY,
  ENTERPRISE_MONTHLY: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE_MONTHLY || TEST_PRICE_IDS.ENTERPRISE_MONTHLY,
  ENTERPRISE_YEARLY: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE_YEARLY || TEST_PRICE_IDS.ENTERPRISE_YEARLY,
};

// Warn in production if using test price IDs
if (import.meta.env.PROD) {
  const missingEnvVars: string[] = [];
  if (!import.meta.env.VITE_STRIPE_PRICE_CORE_MONTHLY) missingEnvVars.push('VITE_STRIPE_PRICE_CORE_MONTHLY');
  if (!import.meta.env.VITE_STRIPE_PRICE_OPS_MONTHLY) missingEnvVars.push('VITE_STRIPE_PRICE_OPS_MONTHLY');
  if (!import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE_MONTHLY) missingEnvVars.push('VITE_STRIPE_PRICE_ENTERPRISE_MONTHLY');
  
  if (missingEnvVars.length > 0) {
    console.warn(
      `⚠️ Production build using test Stripe price IDs. Set these env vars: ${missingEnvVars.join(', ')}`
    );
  }
}

export type PlanKey = keyof typeof PLAN_PRICES;

export type PlanCode = 'CORE' | 'OPS' | 'ENTERPRISE' | 'COMPOSER_FREE' | 'COMPOSER_PRO';

export const PLANS = [
  {
    id: 'core',
    name: 'Core',
    planCode: 'CORE' as PlanCode,
    priceMonthlyId: PLAN_PRICES.CORE_MONTHLY,
    priceAnnualId: PLAN_PRICES.CORE_YEARLY,
    monthlyKey: 'CORE_MONTHLY' as PlanKey,
    annualKey: 'CORE_YEARLY' as PlanKey,
    priceMonthly: 250000, // $2,500 in cents
    priceAnnual: 2700000, // $27,000 in cents
    description: 'Full design + motion coverage',
    activeTaskLimit: 1,
    seats: 2,
  },
  {
    id: 'ops',
    name: 'Ops Base',
    planCode: 'OPS' as PlanCode,
    priceMonthlyId: PLAN_PRICES.OPS_MONTHLY,
    priceAnnualId: PLAN_PRICES.OPS_YEARLY,
    monthlyKey: 'OPS_MONTHLY' as PlanKey,
    annualKey: 'OPS_YEARLY' as PlanKey,
    priceMonthly: 450000, // $4,500 in cents
    priceAnnual: 4860000, // $48,600 in cents
    description: 'Full design + motion coverage, 4 seats',
    activeTaskLimit: 2,
    seats: 4,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    planCode: 'ENTERPRISE' as PlanCode,
    priceMonthlyId: PLAN_PRICES.ENTERPRISE_MONTHLY,
    priceAnnualId: PLAN_PRICES.ENTERPRISE_YEARLY,
    monthlyKey: 'ENTERPRISE_MONTHLY' as PlanKey,
    annualKey: 'ENTERPRISE_YEARLY' as PlanKey,
    priceMonthly: 850000, // $8,500 in cents
    priceAnnual: 9180000, // $91,800 in cents
    description: 'Full design + motion + strategy, 5+ seats',
    activeTaskLimit: 3,
    seats: 5,
  },
];

export const getPlanDisplayName = (workspace: any): string => {
  if (!workspace) return 'Unknown Plan';

  const planCode = workspace.plan?.code || workspace.subscription?.planCode;

  switch (planCode) {
    case 'CORE':
      return 'Core';
    case 'OPS':
      return 'Ops Base';
    case 'ENTERPRISE':
      return 'Enterprise';
    case 'COMPOSER_FREE':
      return 'Composer Free';
    case 'COMPOSER_PRO':
      return 'Composer Pro';
    default:
      return workspace.plan?.name || 'Custom Plan';
  }
};

/**
 * Check if plan has Studio access (human fulfillment)
 */
export const hasStudioAccess = (planCode: PlanCode): boolean => {
  return ['CORE', 'OPS', 'ENTERPRISE'].includes(planCode);
};

/**
 * Check if plan has unlimited Composer credits
 */
export const hasUnlimitedComposerCredits = (planCode: PlanCode): boolean => {
  return ['CORE', 'OPS', 'ENTERPRISE'].includes(planCode);
};
