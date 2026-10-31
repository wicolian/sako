/**
 * Stripe Client Singleton
 * Exports a configured Stripe instance using environment-based configuration.
 */

import Stripe from 'stripe';
import { loadStripeConfig } from './stripe.config';

let stripeInstance: Stripe | null = null;

/**
 * Get the configured Stripe client instance
 * Lazily initializes the Stripe SDK with credentials from environment variables
 */
export function getStripeClient(): Stripe {
  if (!stripeInstance) {
    const config = loadStripeConfig();
    
    stripeInstance = new Stripe(config.secretKey, {
      apiVersion: '2025-10-29.clover', // Use latest API version
      typescript: true,
    });
  }

  return stripeInstance;
}

/**
 * Get the webhook secret for signature verification
 */
export function getWebhookSecret(): string {
  const config = loadStripeConfig();
  return config.webhookSecret;
}

/**
 * Get the publishable key for frontend usage
 */
export function getPublishableKey(): string {
  const config = loadStripeConfig();
  return config.publishableKey;
}

