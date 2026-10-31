/**
 * Redeem Page
 *
 * Handles promo code redemption from marketing emails.
 * Validates the code and redirects to Stripe checkout with discount applied.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export function RedeemPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const [status, setStatus] = useState<'loading' | 'error' | 'redirecting'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!code) {
      setStatus('error');
      setErrorMessage('No promo code provided');
      return;
    }

    const redeemCode = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/stripe/create-checkout-session-redeem`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ promoCode: code }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to redeem code');
        }

        if (data.url) {
          setStatus('redirecting');
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL returned');
        }
      } catch (error: any) {
        setStatus('error');
        setErrorMessage(error.message || 'Failed to redeem promo code');
      }
    };

    redeemCode();
  }, [code]);

  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a1a1a]">
        <LoadingSpinner />
        <p className="mt-4 text-white/70 text-sm">
          {status === 'loading' ? 'Validating your promo code...' : 'Redirecting to checkout...'}
        </p>
        {code && (
          <p className="mt-2 text-white/50 text-xs font-mono">
            Code: {code}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#1a1a1a] px-4">
      <div className="max-w-md w-full bg-[#252525] rounded-xl p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">
          Unable to Redeem Code
        </h1>
        <p className="text-white/60 mb-6">
          {errorMessage}
        </p>
        {code && (
          <p className="text-white/40 text-sm mb-6 font-mono">
            Attempted code: {code}
          </p>
        )}
        <a
          href="/pricing"
          className="inline-block px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition-colors"
        >
          View Plans
        </a>
      </div>
    </div>
  );
}

export default RedeemPage;
