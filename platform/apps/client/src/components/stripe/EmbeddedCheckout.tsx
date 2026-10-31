/**
 * Embedded Checkout Component
 * Renders Stripe's embedded checkout UI in a modal overlay
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout as StripeEmbeddedCheckout,
} from '@stripe/react-stripe-js';
import { useStripeContext } from '../../lib/stripe';
import { X, Loader2 } from 'lucide-react';

interface EmbeddedCheckoutProps {
  /** Checkout session ID from the API */
  sessionId: string;
  /** Client secret from checkout session (required for embedded checkout) */
  clientSecret: string;
  /** Called when checkout is completed successfully */
  onSuccess?: () => void;
  /** Called when checkout is cancelled/closed */
  onCancel?: () => void;
}

export function EmbeddedCheckout({
  sessionId,
  clientSecret,
  onSuccess,
  onCancel,
}: EmbeddedCheckoutProps) {
  const { stripe, isLoading: stripeLoading, error: stripeError } = useStripeContext();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Handle completion - Stripe embedded checkout handles the redirect via return_url
  const handleComplete = useCallback(() => {
    onSuccess?.();
  }, [onSuccess]);

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel?.();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  if (stripeLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-card rounded-xl p-8 flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading payment system...</p>
        </div>
      </div>
    );
  }

  if (stripeError || !stripe) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-card rounded-xl p-8 max-w-md text-center">
          <p className="text-destructive font-medium mb-4">
            {stripeError || 'Failed to load payment system'}
          </p>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (checkoutError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-card rounded-xl p-8 max-w-md text-center">
          <p className="text-destructive font-medium mb-4">{checkoutError}</p>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* Modal container */}
      <div className="relative w-full max-w-2xl max-h-[90vh] m-4 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Complete your subscription</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close checkout"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Embedded checkout container */}
        <div className="flex-1 overflow-auto p-4 min-h-[400px]">
          <EmbeddedCheckoutProvider
            stripe={stripe}
            options={{ clientSecret }}
          >
            <StripeEmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  );
}

export default EmbeddedCheckout;


