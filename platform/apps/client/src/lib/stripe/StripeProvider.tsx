/**
 * Stripe Provider
 * Fetches publishable key from API and provides Stripe.js instance to the app
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { apiFetch } from '../http';

interface StripeContextValue {
  stripe: Stripe | null;
  isLoading: boolean;
  error: string | null;
}

const StripeContext = createContext<StripeContextValue>({
  stripe: null,
  isLoading: true,
  error: null,
});

export function useStripeContext() {
  return useContext(StripeContext);
}

interface StripeProviderProps {
  children: React.ReactNode;
}

// Cache the stripe promise to avoid re-initialization
let stripePromiseCache: Promise<Stripe | null> | null = null;
let cachedPublishableKey: string | null = null;

export function StripeProvider({ children }: StripeProviderProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initStripe() {
      try {
        // Fetch publishable key from API (public endpoint)
        const config = await apiFetch<{ publishableKey: string }>('/stripe/config', {
          skipAuth: true,
          skipWorkspace: true,
        });

        if (!config.publishableKey) {
          throw new Error('Stripe publishable key not configured');
        }

        // Use cached promise if key matches
        if (cachedPublishableKey !== config.publishableKey) {
          cachedPublishableKey = config.publishableKey;
          stripePromiseCache = loadStripe(config.publishableKey);
        }

        const stripeInstance = await stripePromiseCache;
        setStripe(stripeInstance);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize Stripe:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize payment system');
      } finally {
        setIsLoading(false);
      }
    }

    initStripe();
  }, []);

  const value = useMemo(() => ({
    stripe,
    isLoading,
    error,
  }), [stripe, isLoading, error]);

  return (
    <StripeContext.Provider value={value}>
      {children}
    </StripeContext.Provider>
  );
}

export default StripeProvider;


