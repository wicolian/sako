/*
 * Sako Stripe plan bootstrap script
 *
 * Usage (from repo root):
 *   STRIPE_SECRET_KEY=sk_test_xxx npx ts-node scripts/create-stripe-plans.ts
 *
 * This script is intended to be run once per Stripe environment
 * (test and live) to create products + prices for:
 *   - COMPOSER_FREE (product only, no prices)
 *   - COMPOSER_PRO
 *   - CORE
 *   - OPS ("Ops Base")
 *   - ENTERPRISE
 *
 * It prints a JSON summary of created IDs that you can copy into
 * STRIPE_PRODUCT_ID_* and STRIPE_PRICE_ID_* env vars.
 */

import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  // eslint-disable-next-line no-console
  console.error('STRIPE_SECRET_KEY is required to run this script.');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
});

type PlanCode = 'COMPOSER_FREE' | 'COMPOSER_PRO' | 'CORE' | 'OPS' | 'ENTERPRISE';

type PlanType = 'composer' | 'studio';

type PlanPricingConfig = {
  monthly: {
    amount: number; // cents
    lookupKey: string;
  };
  yearly: {
    amount: number; // cents
    lookupKey: string;
  };
};

type PlanBootstrapConfig = {
  plan_code: PlanCode;
  name: string;
  plan_type: PlanType;
  pricing?: PlanPricingConfig; // omitted for COMPOSER_FREE
  metadata: Record<string, string>;
};

const plans: PlanBootstrapConfig[] = [
  {
    plan_code: 'COMPOSER_FREE',
    name: 'Sako Composer Free',
    plan_type: 'composer',
    // No Stripe prices for free tier
    metadata: {
      plan_code: 'COMPOSER_FREE',
      plan_type: 'composer',
      throughput: 'credit_based',
      scope: 'design',
      speed: 'instant_ai_generation',
      team_seats: '0',
      composer_credits_per_month: '10',
      day_credits_validity: '30_days_monthly_365_days_annual',
      pause_rollover_policy: 'none_no_studio_access',
      flexibility: 'copy_html_download_html_pdf_jpg',
      inclusion: 'design_ui_ux_landing_pages_decks_social_ads',
      additionally: 'none',
      send_to_studio: 'no',
    },
  },
  {
    plan_code: 'COMPOSER_PRO',
    name: 'Sako Composer Pro',
    plan_type: 'composer',
    pricing: {
      monthly: {
        amount: 3000, // $30
        lookupKey: 'composer_pro_monthly',
      },
      yearly: {
        amount: 36000, // $360
        lookupKey: 'composer_pro_yearly',
      },
    },
    metadata: {
      plan_code: 'COMPOSER_PRO',
      plan_type: 'composer',
      throughput: 'credit_based',
      scope: 'design',
      speed: 'instant_ai_generation',
      team_seats: '0',
      composer_credits_per_month: '100',
      day_credits_validity: '30_days_monthly_365_days_annual',
      pause_rollover_policy: 'none_no_studio_access',
      flexibility: 'copy_html_download_html_pdf_jpg',
      inclusion: 'design_ui_ux_landing_pages_decks_social_ads',
      additionally: 'copy_to_figma_publish_to_domain',
      send_to_studio: 'no_direct_studio_access_core_ops_enterprise_required',
    },
  },
  {
    plan_code: 'CORE',
    name: 'Sako Core',
    plan_type: 'studio',
    pricing: {
      monthly: {
        amount: 250000, // $2,500
        lookupKey: 'core_monthly',
      },
      yearly: {
        amount: 2700000, // $27,000 (10% off)
        lookupKey: 'core_yearly',
      },
    },
    metadata: {
      plan_code: 'CORE',
      plan_type: 'studio',
      throughput: '1_active_task',
      scope: 'design_and_motion',
      speed: '48h_turnaround',
      team_seats: '2',
      composer_credits_per_month: 'unlimited',
      day_credits_validity: '30_days_monthly_365_days_annual',
      pause_rollover_policy: '3_months_rollover_monthly_6_months_annual',
      flexibility: 'pause_and_bank_days',
      inclusion:
        'full_design_ui_ux_landing_pages_decks_social_ads_plus_motion_reels_explainers_motion_graphics_transitions_video_editing',
      additionally: 'unlimited_requests_unlimited_revisions_slack_and_dashboard',
      send_to_studio: 'included',
    },
  },
  {
    plan_code: 'OPS',
    name: 'Sako Ops Base',
    plan_type: 'studio',
    pricing: {
      monthly: {
        amount: 450000, // $4,500
        lookupKey: 'ops_monthly',
      },
      yearly: {
        amount: 4860000, // $48,600 (10% off)
        lookupKey: 'ops_yearly',
      },
    },
    metadata: {
      plan_code: 'OPS',
      plan_type: 'studio',
      throughput: '2_active_tasks_parallel',
      scope: 'design_and_motion',
      speed: '48h_turnaround',
      team_seats: '4',
      composer_credits_per_month: 'unlimited',
      day_credits_validity: '30_days_monthly_365_days_annual',
      pause_rollover_policy: '3_months_rollover_monthly_6_months_annual',
      flexibility: 'pause_and_bank_days',
      inclusion:
        'full_design_ui_ux_landing_pages_decks_social_ads_plus_motion_reels_explainers_motion_graphics_transitions_video_editing',
      additionally: 'unlimited_requests_unlimited_revisions_slack_and_dashboard',
      send_to_studio: 'included',
    },
  },
  {
    plan_code: 'ENTERPRISE',
    name: 'Sako Enterprise',
    plan_type: 'studio',
    pricing: {
      monthly: {
        amount: 850000, // $8,500 base
        lookupKey: 'enterprise_monthly',
      },
      yearly: {
        amount: 9180000, // $91,800 (10% off)
        lookupKey: 'enterprise_yearly',
      },
    },
    metadata: {
      plan_code: 'ENTERPRISE',
      plan_type: 'studio',
      throughput: '3_plus_tasks_volume_scaling',
      scope: 'design_motion_strategy',
      speed: 'priority_or_custom',
      team_seats: '5_plus',
      composer_credits_per_month: 'unlimited',
      day_credits_validity: '30_days_monthly_365_days_annual',
      pause_rollover_policy: '3_months_rollover_monthly_6_months_annual',
      flexibility: 'pause_and_bank_days_custom_terms',
      inclusion:
        'full_design_ui_ux_landing_pages_decks_social_ads_plus_motion_reels_explainers_motion_graphics_transitions_video_editing',
      additionally:
        'unlimited_requests_unlimited_revisions_slack_dashboard_strategy_call_on_request',
      send_to_studio: 'included',
    },
  },
];

async function main() {
  const results: Array<{
    plan_code: PlanCode;
    product_id: string;
    monthly_price_id: string | null;
    yearly_price_id: string | null;
    lookup_keys: { monthly: string; yearly: string } | null;
  }> = [];

  for (const plan of plans) {
    // eslint-disable-next-line no-console
    console.log(`\nCreating product for plan ${plan.plan_code} (${plan.name})...`);

    const product = await stripe.products.create({
      name: plan.name,
      metadata: plan.metadata,
    });

    let monthlyPriceId: string | null = null;
    let yearlyPriceId: string | null = null;

    if (plan.pricing) {
      const monthly = await stripe.prices.create({
        currency: 'usd',
        unit_amount: plan.pricing.monthly.amount,
        recurring: { interval: 'month' },
        product: product.id,
        lookup_key: plan.pricing.monthly.lookupKey,
        metadata: {
          plan_code: plan.plan_code,
          billing_interval: 'MONTHLY',
        },
      });

      const yearly = await stripe.prices.create({
        currency: 'usd',
        unit_amount: plan.pricing.yearly.amount,
        recurring: { interval: 'year' },
        product: product.id,
        lookup_key: plan.pricing.yearly.lookupKey,
        metadata: {
          plan_code: plan.plan_code,
          billing_interval: 'YEARLY',
        },
      });

      monthlyPriceId = monthly.id;
      yearlyPriceId = yearly.id;
    }

    results.push({
      plan_code: plan.plan_code,
      product_id: product.id,
      monthly_price_id: monthlyPriceId,
      yearly_price_id: yearlyPriceId,
      lookup_keys: plan.pricing
        ? {
            monthly: plan.pricing.monthly.lookupKey,
            yearly: plan.pricing.yearly.lookupKey,
          }
        : null,
    });
  }

  // eslint-disable-next-line no-console
  console.log('\nStripe products and prices created:');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error creating Stripe plans:', err);
  process.exit(1);
});
