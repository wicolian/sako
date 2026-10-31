import posthog from 'posthog-js';
import { analyticsDebug, addToDebugOverlay, initDebugShortcut } from './analytics-debug';
import type { BusinessIntentType, MarketingFunnelStep, ProductDestination } from './analytics-types';
import { getUTMContext } from './utm-store';

// Google Analytics configuration
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Google Analytics gtag function
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

// =============================================================================
// CORE INITIALIZATION
// =============================================================================

// Initialize PostHog with enhanced features
export function initAnalytics() {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    // Suppress PostHog console warnings before initialization
    const originalWarn = console.warn;
    const originalLog = console.log;
    
    // Temporarily suppress PostHog's session recording warnings
    const suppressPostHogWarnings = () => {
      console.warn = (...args: any[]) => {
        const message = args[0]?.toString() || '';
        if (message.includes('Page data capture skipped') || 
            message.includes('isScreenSharingActive') ||
            message.includes('capturePageData')) {
          return; // Suppress PostHog session recording warnings
        }
        originalWarn.apply(console, args);
      };
      
      console.log = (...args: any[]) => {
        const message = args[0]?.toString() || '';
        if (message.includes('Page data capture skipped') || 
            message.includes('isScreenSharingActive') ||
            message.includes('capturePageData')) {
          return; // Suppress PostHog session recording logs
        }
        originalLog.apply(console, args);
      };
    };
    
    suppressPostHogWarnings();
    
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false, // We'll capture manually for more control
      capture_pageleave: true,
      autocapture: true,
      cookieless_mode: 'on_reject', // Don't set cookies until consent is given
      // Session recording is enabled but starts paused - only records after consent
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true, // Privacy: mask all form inputs
        maskTextSelector: '[data-mask]', // Custom mask selector
      },
      // Enable Core Web Vitals tracking
      capture_performance: true,
      // Restore console after initialization
      loaded: (ph) => {
        // Start with session recording paused until consent
        const consent = localStorage.getItem('sako_cookie_consent');
        if (consent !== 'accepted') {
          ph.stopSessionRecording();
        }
        // Initialize error tracking
        setupErrorTracking();
        // Register UTM for session and first-touch on person
        if (typeof window !== 'undefined') {
          const utm = getUTMContext();
          const hasUTM = Object.values(utm).some((v) => v != null && v !== '');
          if (hasUTM) {
            ph.register_for_session(utm);
            ph.register_once(utm);
          }
        }
      },
    });
  }
}

// Enable session recording after consent
export function enableSessionRecording() {
  if (posthog.__loaded) {
    posthog.startSessionRecording();
  }
}

// Disable session recording
export function disableSessionRecording() {
  if (posthog.__loaded) {
    posthog.stopSessionRecording();
  }
}

// =============================================================================
// ERROR TRACKING
// =============================================================================

let errorTrackingInitialized = false;

function setupErrorTracking() {
  if (typeof window === 'undefined' || errorTrackingInitialized) return;
  errorTrackingInitialized = true;

  // Track unhandled JavaScript errors
  window.addEventListener('error', (event) => {
    trackError({
      type: 'javascript_error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    trackError({
      type: 'unhandled_rejection',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
    });
  });
}

// Track errors to PostHog + GA
export function trackError(errorData: {
  type: string;
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  componentStack?: string;
}) {
  const utm = typeof window !== 'undefined' ? getUTMContext() : {};
  const utmFiltered = Object.fromEntries(
    Object.entries(utm).filter(([, v]) => v != null && v !== '')
  );
  const enrichedData = {
    ...utmFiltered,
    ...errorData,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    timestamp: new Date().toISOString(),
  };

  // PostHog error tracking
  if (posthog.__loaded) {
    posthog.capture('$exception', enrichedData);
  }

  // GA error tracking (include UTM for attribution)
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      window.gtag('event', 'exception', {
        description: `${errorData.type}: ${errorData.message}`,
        fatal: false,
        ...utmFiltered,
      });
    } catch {
      // Silently fail
    }
  }
}

// =============================================================================
// CORE WEB VITALS
// =============================================================================

interface WebVitalMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

// Track Core Web Vitals - call this from a useEffect
export function trackWebVitals() {
  if (typeof window === 'undefined') return;

  // Use the Performance Observer API for web vitals
  try {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      if (lastEntry) {
        const value = lastEntry.startTime;
        reportWebVital({
          name: 'LCP',
          value,
          rating: value < 2500 ? 'good' : value < 4000 ? 'needs-improvement' : 'poor',
        });
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    // First Input Delay (FID) / Interaction to Next Paint (INP)
    const fidObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry: PerformanceEntry & { processingStart?: number; startTime: number }) => {
        if (entry.processingStart) {
          const value = entry.processingStart - entry.startTime;
          reportWebVital({
            name: 'FID',
            value,
            rating: value < 100 ? 'good' : value < 300 ? 'needs-improvement' : 'poor',
          });
        }
      });
    });
    fidObserver.observe({ type: 'first-input', buffered: true });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry: PerformanceEntry & { hadRecentInput?: boolean; value?: number }) => {
        if (!entry.hadRecentInput && entry.value) {
          clsValue += entry.value;
        }
      });
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    // Report CLS on page hide
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        reportWebVital({
          name: 'CLS',
          value: clsValue,
          rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor',
        });
      }
    }, { once: true });

    // First Contentful Paint (FCP)
    const fcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const fcpEntry = entries.find(e => e.name === 'first-contentful-paint') as PerformanceEntry & { startTime: number };
      if (fcpEntry) {
        const value = fcpEntry.startTime;
        reportWebVital({
          name: 'FCP',
          value,
          rating: value < 1800 ? 'good' : value < 3000 ? 'needs-improvement' : 'poor',
        });
      }
    });
    fcpObserver.observe({ type: 'paint', buffered: true });

    // Time to First Byte (TTFB)
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const ttfb = navEntries[0].responseStart;
      reportWebVital({
        name: 'TTFB',
        value: ttfb,
        rating: ttfb < 800 ? 'good' : ttfb < 1800 ? 'needs-improvement' : 'poor',
      });
    }
  } catch {
    // PerformanceObserver not supported
  }
}

function reportWebVital(metric: WebVitalMetric) {
  const utm = typeof window !== 'undefined' ? getUTMContext() : {};
  const utmFiltered = Object.fromEntries(
    Object.entries(utm).filter(([, v]) => v != null && v !== '')
  );
  const data = {
    ...utmFiltered,
    metric_name: metric.name,
    metric_value: Math.round(metric.value),
    metric_rating: metric.rating,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  };

  // PostHog
  if (posthog.__loaded) {
    posthog.capture('web_vital', data);
  }

  // GA4
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      window.gtag('event', metric.name.toLowerCase(), {
        ...utmFiltered,
        value: Math.round(metric.value),
        metric_rating: metric.rating,
        metric_delta: Math.round(metric.value),
      });
    } catch {
      // Silently fail
    }
  }
}

/**
 * Unified tracking function that sends events to both PostHog and GA4
 * @param eventName - The name of the event to track
 * @param properties - Optional properties/parameters for the event
 * @internal
 */
function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  const utm = typeof window !== 'undefined' ? getUTMContext() : {};
  const utmFiltered = Object.fromEntries(
    Object.entries(utm).filter(([, v]) => v != null && v !== '')
  );
  const enriched = { ...utmFiltered, ...properties };

  // Debug logging
  analyticsDebug.logEvent(eventName, enriched);
  addToDebugOverlay(eventName, 'both');

  // PostHog tracking
  if (posthog.__loaded) {
    posthog.capture(eventName, enriched);
  }

  // Google Analytics tracking (only if consented)
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      window.gtag('event', eventName, enriched);
    } catch (error) {
      analyticsDebug.logError('GA tracking failed', error);
    }
  }
}

/**
 * Track page views with automatic source attribution
 * Captures UTM parameters and referrer information
 * @param path - The page path being viewed (e.g., '/pricing')
 * @example trackPageView('/pricing')
 */
export function trackPageView(path: string) {
  if (typeof window === 'undefined') return;

  const utm = getUTMContext();
  const source = utm.utm_source ||
                 new URL(window.location.href).searchParams.get('ref') ||
                 document.referrer ? getReferrerSource(document.referrer) : 'direct';

  const pageViewData = {
    path,
    source,
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
    utm_term: utm.utm_term,
    referrer: document.referrer,
  };

  // PostHog pageview
  if (posthog.__loaded) {
    posthog.capture('$pageview', pageViewData);
  }

  // GA pageview (include UTM for attribution)
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        ...pageViewData,
      });
    } catch (error) {
      console.warn('GA pageview failed:', error);
    }
  }
}

// Get source from referrer URL
function getReferrerSource(referrer: string): string {
  if (!referrer) return 'direct';

  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();

    if (host.includes('linkedin')) return 'linkedin';
    if (host.includes('twitter') || host.includes('x.com')) return 'twitter';
    if (host.includes('google')) return 'google';
    if (host.includes('facebook')) return 'facebook';
    if (host.includes('producthunt')) return 'producthunt';
    if (host.includes('ycombinator') || host.includes('news.ycombinator')) return 'hackernews';
    if (host.includes('reddit')) return 'reddit';

    return host;
  } catch {
    return 'unknown';
  }
}

/**
 * Track navigation menu item clicks
 * @param item - The navigation item that was clicked
 * @example trackNavClick('pricing')
 */
export function trackNavClick(item: string) {
  trackEvent('nav_clicked', {
    item,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Track CTA button interactions (clicks, hovers, views)
 * @param ctaName - Identifier for the CTA (e.g., 'hero_primary', 'pricing_start')
 * @param location - Where the CTA appears (e.g., 'hero', 'navbar', 'footer')
 * @param action - Type of interaction: 'click', 'hover', or 'view'
 * @example trackCTAInteraction('book_call', 'hero', 'click')
 */
export function trackCTAInteraction(ctaName: string, location: string, action: 'click' | 'hover' | 'view') {
  trackEvent('cta_interaction', {
    cta_name: ctaName,
    location,
    action,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Track generic button clicks
 * @param buttonName - Name/identifier of the button
 * @param section - Optional section where the button is located
 * @example trackButtonClick('submit', 'contact_form')
 */
export function trackButtonClick(buttonName: string, section?: string) {
  trackEvent('button_clicked', {
    button_name: buttonName,
    section,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Track when a user starts interacting with a form
 * @param formName - Identifier for the form
 * @example trackFormStart('contact_form')
 */
export function trackFormStart(formName: string) {
  trackEvent('form_started', {
    form_name: formName,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Track form submission (success or failure)
 * @param formName - Identifier for the form
 * @param success - Whether the submission was successful
 * @example trackFormSubmit('contact_form', true)
 */
export function trackFormSubmit(formName: string, success: boolean) {
  trackEvent('form_submitted', {
    form_name: formName,
    success,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Track scroll depth milestones (25%, 50%, 75%, 90%)
 * @param depth - The scroll depth percentage reached
 * @example trackScrollDepth(50)
 */
export function trackScrollDepth(depth: number) {
  trackEvent('scroll_depth', {
    depth_percent: depth,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Track time spent on page (typically called on page leave)
 * @param seconds - Number of seconds spent on the page
 * @example trackTimeOnPage(120)
 */
export function trackTimeOnPage(seconds: number) {
  trackEvent('time_on_page', {
    seconds,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Track content view events (blog posts, case studies, etc.)
 * @param contentType - Type of content (e.g., 'blog_post', 'case_study')
 * @param contentId - Unique identifier for the content
 * @param title - Optional title of the content
 * @example trackContentView('blog_post', 'intro-to-design-ops', 'Introduction to Design Ops')
 */
export function trackContentView(contentType: string, contentId: string, title?: string) {
  trackEvent('content_viewed', {
    content_type: contentType,
    content_id: contentId,
    title,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Track content interactions (shares, bookmarks, etc.)
 * @param contentType - Type of content
 * @param contentId - Unique identifier for the content
 * @param action - The interaction type (e.g., 'share', 'bookmark', 'copy_link')
 * @example trackContentInteraction('blog_post', 'intro-to-design-ops', 'share')
 */
export function trackContentInteraction(contentType: string, contentId: string, action: string) {
  trackEvent('content_interaction', {
    content_type: contentType,
    content_id: contentId,
    action,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Track high-intent business actions for conversion analysis
 * @param intent - Type of business intent signal
 * @example trackBusinessIntent('pricing_view')
 * @example trackBusinessIntent('book_call')
 */
export function trackBusinessIntent(intent: BusinessIntentType) {
  trackEvent('business_intent', {
    intent_type: intent,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Track clicks that lead to the product/app for conversion attribution
 * Automatically captures UTM parameters for cross-domain tracking
 * @param destination - Where the user is going ('app_signup', 'app_dashboard', 'app_login')
 * @param campaign - Optional campaign override (defaults to utm_campaign)
 * @example trackProductClick('app_signup')
 * @example trackProductClick('app_dashboard', 'onboarding_complete')
 */
export function trackProductClick(destination: ProductDestination, campaign?: string) {
  const utm = typeof window !== 'undefined' ? getUTMContext() : {};

  trackEvent('product_click', {
    destination,
    campaign: campaign || utm.utm_campaign || 'unknown',
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_content: utm.utm_content,
    utm_term: utm.utm_term,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
    timestamp: new Date().toISOString(),
  });
}

// Attribution helper - extracts UTM params (URL or persisted) for cross-domain tracking
export function getAttributionData() {
  if (typeof window === 'undefined') return {};

  const utm = getUTMContext();
  return {
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
    utm_term: utm.utm_term,
    landing_page: document.referrer || 'direct',
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// FORM FIELD ANALYTICS
// =============================================================================

interface FormFieldState {
  formName: string;
  startTime: number;
  fieldsInteracted: Set<string>;
  fieldsCompleted: Set<string>;
}

const formStates = new Map<string, FormFieldState>();

// Initialize form tracking - call when form mounts
export function initFormTracking(formName: string) {
  formStates.set(formName, {
    formName,
    startTime: Date.now(),
    fieldsInteracted: new Set(),
    fieldsCompleted: new Set(),
  });
  
  trackEvent('form_view', {
    form_name: formName,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

// Track when user focuses on a form field
export function trackFieldFocus(formName: string, fieldName: string) {
  const state = formStates.get(formName);
  if (!state) return;
  
  const isFirstInteraction = state.fieldsInteracted.size === 0;
  state.fieldsInteracted.add(fieldName);
  
  if (isFirstInteraction) {
    trackEvent('form_started', {
      form_name: formName,
      first_field: fieldName,
      page: typeof window !== 'undefined' ? window.location.pathname : '',
    });
  }
  
  trackEvent('form_field_focus', {
    form_name: formName,
    field_name: fieldName,
    fields_interacted_count: state.fieldsInteracted.size,
  });
}

// Track when user leaves a form field (blur)
export function trackFieldBlur(formName: string, fieldName: string, hasValue: boolean) {
  const state = formStates.get(formName);
  if (!state) return;
  
  if (hasValue) {
    state.fieldsCompleted.add(fieldName);
  }
  
  trackEvent('form_field_blur', {
    form_name: formName,
    field_name: fieldName,
    has_value: hasValue,
    fields_completed_count: state.fieldsCompleted.size,
  });
}

// Track form abandonment - call on unmount or page leave
export function trackFormAbandonment(formName: string) {
  const state = formStates.get(formName);
  if (!state) return;
  
  const timeSpent = Math.round((Date.now() - state.startTime) / 1000);
  
  // Only track if user interacted but didn't submit
  if (state.fieldsInteracted.size > 0) {
    trackEvent('form_abandoned', {
      form_name: formName,
      fields_interacted: Array.from(state.fieldsInteracted),
      fields_completed: Array.from(state.fieldsCompleted),
      time_spent_seconds: timeSpent,
      completion_rate: state.fieldsCompleted.size / Math.max(state.fieldsInteracted.size, 1),
      page: typeof window !== 'undefined' ? window.location.pathname : '',
    });
  }
  
  formStates.delete(formName);
}

// Track successful form submission with timing data
export function trackFormComplete(formName: string, success: boolean, metadata?: Record<string, any>) {
  const state = formStates.get(formName);
  const timeSpent = state ? Math.round((Date.now() - state.startTime) / 1000) : 0;
  
  trackEvent('form_submitted', {
    form_name: formName,
    success,
    time_spent_seconds: timeSpent,
    fields_completed: state ? state.fieldsCompleted.size : 0,
    ...metadata,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
  
  formStates.delete(formName);
}

// =============================================================================
// A/B TESTING & FEATURE FLAGS
// =============================================================================

// Get feature flag value from PostHog
export function getFeatureFlag(flagKey: string): boolean | string | undefined {
  if (!posthog.__loaded) return undefined;
  return posthog.getFeatureFlag(flagKey);
}

// Check if feature flag is enabled (boolean flags)
export function isFeatureEnabled(flagKey: string): boolean {
  const value = getFeatureFlag(flagKey);
  return value === true || value === 'true';
}

// Get feature flag payload (for multivariate flags)
export function getFeatureFlagPayload(flagKey: string): Record<string, any> | undefined {
  if (!posthog.__loaded) return undefined;
  return posthog.getFeatureFlagPayload(flagKey) as Record<string, any> | undefined;
}

// Track A/B test exposure (automatically done by PostHog, but manual option)
export function trackExperimentExposure(experimentName: string, variant: string) {
  trackEvent('$experiment_started', {
    experiment_name: experimentName,
    variant,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

// Track A/B test conversion
export function trackExperimentConversion(experimentName: string, variant: string, conversionType: string) {
  trackEvent('experiment_conversion', {
    experiment_name: experimentName,
    variant,
    conversion_type: conversionType,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

// Reload feature flags (useful after user identification)
export function reloadFeatureFlags() {
  if (posthog.__loaded) {
    posthog.reloadFeatureFlags();
  }
}

// =============================================================================
// CONTENT ENGAGEMENT & READING PROGRESS
// =============================================================================

interface ReadingState {
  contentId: string;
  contentType: string;
  title: string;
  startTime: number;
  maxScrollDepth: number;
  readingMilestones: Set<number>;
}

const readingStates = new Map<string, ReadingState>();

// Initialize reading progress tracking for a content piece
export function initReadingProgress(contentId: string, contentType: string, title: string) {
  readingStates.set(contentId, {
    contentId,
    contentType,
    title,
    startTime: Date.now(),
    maxScrollDepth: 0,
    readingMilestones: new Set(),
  });
  
  trackEvent('content_start', {
    content_id: contentId,
    content_type: contentType,
    title,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

// Update reading progress - call from scroll handler
export function updateReadingProgress(contentId: string, scrollPercent: number) {
  const state = readingStates.get(contentId);
  if (!state) return;
  
  if (scrollPercent > state.maxScrollDepth) {
    state.maxScrollDepth = scrollPercent;
    
    // Track milestones: 25%, 50%, 75%, 100%
    const milestones = [25, 50, 75, 100];
    for (const milestone of milestones) {
      if (scrollPercent >= milestone && !state.readingMilestones.has(milestone)) {
        state.readingMilestones.add(milestone);
        trackEvent('reading_milestone', {
          content_id: contentId,
          content_type: state.contentType,
          title: state.title,
          milestone_percent: milestone,
          time_to_milestone_seconds: Math.round((Date.now() - state.startTime) / 1000),
        });
      }
    }
  }
}

// Complete reading tracking - call on unmount
export function completeReadingProgress(contentId: string) {
  const state = readingStates.get(contentId);
  if (!state) return;
  
  const totalTimeSeconds = Math.round((Date.now() - state.startTime) / 1000);
  
  trackEvent('content_complete', {
    content_id: contentId,
    content_type: state.contentType,
    title: state.title,
    max_scroll_depth: state.maxScrollDepth,
    total_time_seconds: totalTimeSeconds,
    milestones_reached: Array.from(state.readingMilestones),
    completed: state.maxScrollDepth >= 90,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
  
  readingStates.delete(contentId);
}

// =============================================================================
// USER IDENTIFICATION
// =============================================================================

// Identify user after sign-in (for cross-session tracking)
export function identifyUser(userId: string, traits?: Record<string, any>) {
  if (posthog.__loaded) {
    posthog.identify(userId, traits);
  }
  
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      window.gtag('config', GA_MEASUREMENT_ID!, {
        user_id: userId,
      });
    } catch {
      // Silently fail
    }
  }
}

// Reset user identity (on sign-out)
export function resetUserIdentity() {
  if (posthog.__loaded) {
    posthog.reset();
  }
}

// Add user properties without identifying
export function setUserProperties(properties: Record<string, any>) {
  if (posthog.__loaded) {
    posthog.setPersonProperties(properties);
  }
}

// =============================================================================
// FUNNEL TRACKING
// =============================================================================

/**
 * Track a step in a custom funnel
 * @param funnelName - Name of the funnel (e.g., 'marketing_to_signup', 'onboarding')
 * @param stepNumber - Sequential step number (1, 2, 3, etc.)
 * @param stepName - Human-readable step name
 * @param metadata - Optional additional properties
 * @example trackFunnelStep('onboarding', 1, 'Account Created', { plan: 'pro' })
 */
export function trackFunnelStep(funnelName: string, stepNumber: number, stepName: string, metadata?: Record<string, unknown>) {
  trackEvent('funnel_step', {
    funnel_name: funnelName,
    step_number: stepNumber,
    step_name: stepName,
    ...metadata,
    page: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

/**
 * Pre-defined marketing funnel steps for the landing page to signup journey
 */
export const MarketingFunnel = {
  LAND: 1,
  SCROLL_50: 2,
  VIEW_PRICING: 3,
  CLICK_CTA: 4,
  START_SIGNUP: 5,
  COMPLETE_SIGNUP: 6,
} as const;

/**
 * Track a step in the marketing-to-signup funnel
 * Use this to analyze drop-off in the conversion journey
 * @param step - The funnel step (LAND, SCROLL_50, VIEW_PRICING, CLICK_CTA, START_SIGNUP, COMPLETE_SIGNUP)
 * @param metadata - Optional additional properties
 * @example trackMarketingFunnelStep('CLICK_CTA')
 * @example trackMarketingFunnelStep('VIEW_PRICING', { plan_highlighted: 'pro' })
 */
export function trackMarketingFunnelStep(step: MarketingFunnelStep, metadata?: Record<string, unknown>) {
  const stepNames: Record<keyof typeof MarketingFunnel, string> = {
    LAND: 'Landed on page',
    SCROLL_50: 'Scrolled 50%',
    VIEW_PRICING: 'Viewed pricing',
    CLICK_CTA: 'Clicked CTA',
    START_SIGNUP: 'Started signup',
    COMPLETE_SIGNUP: 'Completed signup',
  };
  
  trackFunnelStep('marketing_to_signup', MarketingFunnel[step], stepNames[step], metadata);
}

export { posthog };


