import Stripe from 'stripe';
import { getISTDateBoundaries, getISTMonthBoundaries, formatCurrency, formatNumber } from '@/lib/utils';
import type { MetricValue } from '@/types';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export interface StripeMetrics {
  revenueToday: number;
  revenueMTD: number;
  activeSubscriptions: number;
  refundsToday: number;
}

/**
 * Fetch revenue for today (IST timezone)
 */
export async function getRevenueToday(): Promise<{ gross: number; refunds: number; net: number }> {
  const stripe = getStripe();
  const { start, end } = getISTDateBoundaries();

  // Get successful charges
  const charges = await stripe.charges.list({
    created: {
      gte: Math.floor(start.getTime() / 1000),
      lte: Math.floor(end.getTime() / 1000),
    },
    limit: 100,
  });

  let gross = 0;
  for (const charge of charges.data) {
    if (charge.status === 'succeeded' && !charge.refunded) {
      gross += charge.amount;
    }
  }

  // Get refunds
  const refunds = await stripe.refunds.list({
    created: {
      gte: Math.floor(start.getTime() / 1000),
      lte: Math.floor(end.getTime() / 1000),
    },
    limit: 100,
  });

  let totalRefunds = 0;
  for (const refund of refunds.data) {
    totalRefunds += refund.amount;
  }

  // Convert from cents to dollars
  return {
    gross: gross / 100,
    refunds: totalRefunds / 100,
    net: (gross - totalRefunds) / 100,
  };
}

/**
 * Fetch MTD revenue (IST timezone)
 */
export async function getRevenueMTD(): Promise<{ gross: number; refunds: number; net: number }> {
  const stripe = getStripe();
  const { start, end } = getISTMonthBoundaries();

  // Get all charges this month (paginated)
  let gross = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const charges = await stripe.charges.list({
      created: {
        gte: Math.floor(start.getTime() / 1000),
        lte: Math.floor(end.getTime() / 1000),
      },
      limit: 100,
      starting_after: startingAfter,
    });

    for (const charge of charges.data) {
      if (charge.status === 'succeeded' && !charge.refunded) {
        gross += charge.amount;
      }
    }

    hasMore = charges.has_more;
    if (charges.data.length > 0) {
      startingAfter = charges.data[charges.data.length - 1].id;
    }
  }

  // Get all refunds this month (paginated)
  let totalRefunds = 0;
  let hasMoreRefunds = true;
  let refundCursor: string | undefined;

  while (hasMoreRefunds) {
    const listParams: Stripe.RefundListParams = {
      created: {
        gte: Math.floor(start.getTime() / 1000),
        lte: Math.floor(end.getTime() / 1000),
      },
      limit: 100,
    };
    if (refundCursor) {
      listParams.starting_after = refundCursor;
    }

    const refundsPage = await stripe.refunds.list(listParams);

    for (const refund of refundsPage.data) {
      totalRefunds += refund.amount;
    }

    hasMoreRefunds = refundsPage.has_more;
    if (refundsPage.data.length > 0) {
      refundCursor = refundsPage.data[refundsPage.data.length - 1].id;
    }
  }

  return {
    gross: gross / 100,
    refunds: totalRefunds / 100,
    net: (gross - totalRefunds) / 100,
  };
}

/**
 * Get count of active subscriptions
 */
export async function getActiveSubscriptions(): Promise<number> {
  const stripe = getStripe();

  const subscriptions = await stripe.subscriptions.list({
    status: 'active',
    limit: 100,
  });

  // For more than 100 subscriptions, we'd need pagination
  // For now, return the count from this page + check has_more
  let count = subscriptions.data.length;

  if (subscriptions.has_more) {
    // Do full count
    let hasMore = true;
    let startingAfter = subscriptions.data[subscriptions.data.length - 1].id;

    while (hasMore) {
      const more = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        starting_after: startingAfter,
      });

      count += more.data.length;
      hasMore = more.has_more;
      if (more.data.length > 0) {
        startingAfter = more.data[more.data.length - 1].id;
      }
    }
  }

  return count;
}

/**
 * Fetch all Stripe metrics
 */
export async function fetchStripeMetrics(): Promise<StripeMetrics> {
  const [today, mtd, subs] = await Promise.all([
    getRevenueToday(),
    getRevenueMTD(),
    getActiveSubscriptions(),
  ]);

  return {
    revenueToday: today.net,
    revenueMTD: mtd.net,
    activeSubscriptions: subs,
    refundsToday: today.refunds,
  };
}

/**
 * Convert Stripe metrics to MetricValue format
 */
export function toMetricValue(
  key: string,
  value: number,
  prevValue: number = 0,
  format: 'currency' | 'number' = 'currency'
): MetricValue {
  const delta = prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : 0;
  const deltaIsPositive = delta >= 0;

  return {
    key,
    value,
    prevValue,
    formattedValue: format === 'currency' ? formatCurrency(value) : formatNumber(value),
    delta: `${deltaIsPositive ? '+' : ''}${delta.toFixed(1)}%`,
    deltaIsPositive,
    timestamp: Date.now(),
    sparkline: [], // Would be filled from snapshots
  };
}
