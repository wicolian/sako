"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Extend the Window interface to include gtag
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    // Skip if GA measurement ID is not configured
    if (!GA_MEASUREMENT_ID) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[GA4] Missing NEXT_PUBLIC_GA_MEASUREMENT_ID environment variable');
      }
      return;
    }

    const CONSENT_KEY = 'sako_cookie_consent';
    const CONSENT_EVENT = 'sako_cookie_consent_updated';

    // Defer GA loading to improve LCP - and only load after explicit consent.
    const initGA = (consented: boolean) => {
      // Set default consent based on user choice
      window.gtag('consent', 'default', {
        ad_storage: consented ? 'granted' : 'denied',
        ad_user_data: consented ? 'granted' : 'denied',
        ad_personalization: consented ? 'granted' : 'denied',
        analytics_storage: consented ? 'granted' : 'denied',
        functionality_storage: consented ? 'granted' : 'denied',
        personalization_storage: consented ? 'granted' : 'denied',
        security_storage: 'granted' // Always granted for security
      });

      // Configure GA4
      window.gtag('config', GA_MEASUREMENT_ID, {
        page_title: document.title,
        page_location: window.location.href,
        send_page_view: false, // We'll send manually
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      });
    };

    // Load gtag script if not already loaded - defer to improve LCP
    if (!window.gtag) {
      // Use requestIdleCallback to load GA after critical rendering
      const loadGA = (consented: boolean) => {
        const script1 = document.createElement('script');
        script1.async = true;
        script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        script1.defer = true;
        document.head.appendChild(script1);

        const script2 = document.createElement('script');
        script2.innerHTML = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
        `;
        document.head.appendChild(script2);

        script1.onload = () => initGA(consented);
      };

      const scheduleLoad = (consented: boolean) => {
        // Load after page is interactive
        if (document.readyState === 'complete') {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => loadGA(consented), { timeout: 2000 });
          } else {
            setTimeout(() => loadGA(consented), 2000);
          }
        } else {
          window.addEventListener(
            'load',
            () => {
              if ('requestIdleCallback' in window) {
                requestIdleCallback(() => loadGA(consented), { timeout: 2000 });
              } else {
                setTimeout(() => loadGA(consented), 2000);
              }
            },
            { once: true }
          );
        }
      };

      const consentStatus =
        typeof window !== 'undefined' ? localStorage.getItem(CONSENT_KEY) : null;

      // Only load GA after explicit accept.
      if (consentStatus === 'accepted') {
        scheduleLoad(true);
      } else {
        const handleConsent = (event: Event) => {
          const detail = (event as CustomEvent<{ granted?: boolean }>).detail;
          const granted = Boolean(detail?.granted);
          if (granted) {
            scheduleLoad(true);
          }
          window.removeEventListener(CONSENT_EVENT, handleConsent as EventListener);
        };
        window.addEventListener(CONSENT_EVENT, handleConsent as EventListener);
      }
    } else {
      const consentStatus =
        typeof window !== 'undefined' ? localStorage.getItem('sako_cookie_consent') : null;
      initGA(consentStatus === 'accepted');
    }
  }, []);

  // Track page views
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    
    if (pathname && window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: pathname,
      });
    }
  }, [pathname]);

  return null;
}

// Utility functions for consent management
export const updateGoogleAnalyticsConsent = (granted: boolean) => {
  if (window.gtag) {
    window.gtag('consent', 'update', {
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
      analytics_storage: granted ? 'granted' : 'denied',
      functionality_storage: granted ? 'granted' : 'denied',
      personalization_storage: granted ? 'granted' : 'denied'
    });

    // Send consent update event
    window.gtag('event', 'consent_update', {
      consent_type: granted ? 'granted' : 'denied',
      consent_categories: granted
        ? ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage', 'functionality_storage', 'personalization_storage']
        : []
    });
  }
};
