/**
 * Stripe Configuration
 * Reads Stripe credentials from environment variables only.
 * No hardcoded keys - all values must come from .env
 */

export interface StripeConfig {
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
}

/**
 * Check if Stripe is configured (all required env vars are set)
 */
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_PUBLISHABLE_KEY &&
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

/**
 * Load and validate Stripe configuration from environment variables
 * Throws error if any required key is missing
 */
export function loadStripeConfig(): StripeConfig {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!publishableKey) {
    throw new Error('STRIPE_PUBLISHABLE_KEY is not set in environment variables');
  }

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
  }

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set in environment variables');
  }

  return {
    publishableKey,
    secretKey,
    webhookSecret,
  };
}

