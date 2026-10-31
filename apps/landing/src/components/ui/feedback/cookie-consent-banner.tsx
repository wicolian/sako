"use client";

import { useState, useEffect, useCallback } from 'react';
import { posthog, enableSessionRecording, disableSessionRecording } from '@/lib/analytics';
import { updateGoogleAnalyticsConsent } from '@/providers/GoogleAnalytics';
import { tokens } from '@/lib/design-tokens';
import Link from 'next/link';

// Global event for reopening banner
const COOKIE_BANNER_EVENT = 'openCookieBanner';

// Function to open cookie banner from anywhere
export function openCookieBanner() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(COOKIE_BANNER_EVENT));
  }
}

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const CONSENT_EVENT = 'sako_cookie_consent_updated';

  const checkAndShowBanner = useCallback(() => {
    // Check PostHog consent status first
    const consentStatus = posthog.get_explicit_consent_status();

    // Check localStorage as fallback (for mobile browsers that don't persist PostHog consent well)
    const localConsent = typeof window !== 'undefined' ? localStorage.getItem('sako_cookie_consent') : null;

    // Show banner if PostHog says pending AND we haven't locally consented
    if (consentStatus === 'pending' && localConsent !== 'accepted') {
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    // Check initial consent status after a small delay
    const timer = setTimeout(() => {
      checkAndShowBanner();
    }, 1000);

    // Listen for reopen events
    const handleOpenEvent = () => {
      setIsVisible(true);
    };
    
    window.addEventListener(COOKIE_BANNER_EVENT, handleOpenEvent);

    return () => {
      clearTimeout(timer);
      window.removeEventListener(COOKIE_BANNER_EVENT, handleOpenEvent);
    };
  }, [checkAndShowBanner]);

  const handleAcceptCookies = () => {
    posthog.opt_in_capturing();
    updateGoogleAnalyticsConsent(true);
    // Enable session recording after consent
    enableSessionRecording();
    // Store consent in localStorage as backup
    if (typeof window !== 'undefined') {
      localStorage.setItem('sako_cookie_consent', 'accepted');
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { granted: true } }));
    }
    setIsVisible(false);
  };

  const handleDeclineCookies = () => {
    posthog.opt_out_capturing();
    updateGoogleAnalyticsConsent(false);
    // Disable session recording when declined
    disableSessionRecording();
    // Store consent in localStorage as backup
    if (typeof window !== 'undefined') {
      localStorage.setItem('sako_cookie_consent', 'declined');
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { granted: false } }));
    }
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl animate-in slide-in-from-bottom duration-500"
      style={{ backgroundColor: tokens.colors.bgCard }}
    >
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-gray-600 leading-relaxed">
              We use tracking cookies to understand how you use Sako and help us improve it.
              Please accept cookies to help us provide a better experience.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              You can change your preferences anytime in our{' '}
              <Link
                href="/legal/cookies"
                className="text-black underline underline-offset-2 hover:text-[#9AE83E] transition-colors"
              >
                Cookie Policy
              </Link>
              .
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDeclineCookies}
              className="px-6 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-full hover:bg-gray-50 transition-all duration-200"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={handleAcceptCookies}
              className="px-6 py-2.5 bg-[#1a1a1a] text-white text-sm font-semibold rounded-full hover:bg-gray-800 hover:scale-105 transition-all duration-200 shadow-lg"
              style={{
                backgroundColor: tokens.colors.black,
                boxShadow: `0 10px 25px -5px ${tokens.colors.lime}20`
              }}
            >
              Accept Cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
