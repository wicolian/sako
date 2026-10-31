"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { 
  initAnalytics, 
  trackPageView, 
  trackScrollDepth, 
  trackTimeOnPage,
  trackWebVitals,
  trackMarketingFunnelStep,
} from "@/lib/analytics";
import { persistUTM, getUTMFromURL } from "@/lib/utm-store";
import { initDebugShortcut } from "@/lib/analytics-debug";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageStartTime = useRef<number>(Date.now());
  const maxScrollDepth = useRef<number>(0);
  const webVitalsTracked = useRef<boolean>(false);
  const scroll50Tracked = useRef<boolean>(false);

  // Initialize PostHog on mount - defer to improve LCP
  useEffect(() => {
    // Defer PostHog initialization until after page is interactive
    const initPostHog = () => {
      initAnalytics();
      
      // Initialize debug shortcut (Ctrl+Shift+A) in development
      initDebugShortcut();
      
      // Track Core Web Vitals after analytics init
      if (!webVitalsTracked.current) {
        webVitalsTracked.current = true;
        // Small delay to let vitals be captured
        setTimeout(() => {
          trackWebVitals();
        }, 3000);
      }
    };

    // Load after page is interactive or user interaction
    if (document.readyState === 'complete') {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(initPostHog, { timeout: 2000 });
      } else {
        setTimeout(initPostHog, 2000);
      }
    } else {
      window.addEventListener('load', () => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(initPostHog, { timeout: 2000 });
        } else {
          setTimeout(initPostHog, 2000);
        }
      }, { once: true });
    }
  }, []);

  // Track page views on route change + funnel step
  useEffect(() => {
    if (pathname) {
      trackPageView(pathname);
      pageStartTime.current = Date.now();
      maxScrollDepth.current = 0;
      scroll50Tracked.current = false;

      // Persist UTM when present in URL on route change
      if (typeof window !== 'undefined') {
        const utm = getUTMFromURL();
        if (Object.values(utm).some((v) => v != null && v !== '')) {
          persistUTM();
        }
      }
      
      // Track marketing funnel: landing
      if (pathname === '/') {
        trackMarketingFunnelStep('LAND');
      }
      
      // Track pricing view funnel step
      if (pathname === '/pricing') {
        trackMarketingFunnelStep('VIEW_PRICING');
      }
    }
  }, [pathname, searchParams]);

  // Track scroll depth + funnel progression
  useEffect(() => {
    let rafId: number | null = null;
    let ticking = false;

    // Cache docHeight - defer calculation to avoid forced reflow
    let cachedDocHeight = 0;
    let docHeightInitialized = false;

    // Update cached docHeight on resize (debounced with RAF)
    let resizeTimeout: NodeJS.Timeout | null = null;
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
          cachedDocHeight = document.documentElement.scrollHeight - window.innerHeight;
        });
      }, 200);
    };

    // Initialize docHeight with RAF to avoid forced reflow
    requestAnimationFrame(() => {
      cachedDocHeight = document.documentElement.scrollHeight - window.innerHeight;
      docHeightInitialized = true;
    });
    
    const handleScroll = () => {
      if (typeof window === 'undefined') return;
      
      // Use RAF to batch DOM reads and avoid forced reflow
      if (!ticking) {
        ticking = true;
        rafId = requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          const scrollPercent = Math.round((scrollTop / cachedDocHeight) * 100);

          if (scrollPercent > maxScrollDepth.current && scrollPercent > 0) {
            maxScrollDepth.current = scrollPercent;

            // Track at 25%, 50%, 75%, 90% milestones
            if ([25, 50, 75, 90].includes(scrollPercent)) {
              trackScrollDepth(scrollPercent);
              
              // Track funnel: scrolled 50% on homepage
              if (scrollPercent >= 50 && !scroll50Tracked.current && pathname === '/') {
                scroll50Tracked.current = true;
                trackMarketingFunnelStep('SCROLL_50');
              }
            }
          }
          ticking = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [pathname]);

  // Track time on page when user leaves
  useEffect(() => {
    const handleBeforeUnload = () => {
      const timeOnPage = Math.round((Date.now() - pageStartTime.current) / 1000);
      if (timeOnPage > 10) { // Only track if user spent more than 10 seconds
        trackTimeOnPage(timeOnPage);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const timeOnPage = Math.round((Date.now() - pageStartTime.current) / 1000);
        if (timeOnPage > 10) {
          trackTimeOnPage(timeOnPage);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pathname]);

  return <>{children}</>;
}


