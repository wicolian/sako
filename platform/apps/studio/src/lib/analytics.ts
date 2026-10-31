import posthog from 'posthog-js';

/**
 * PostHog Analytics Wrapper for Studio App
 * Gracefully no-ops if env vars are missing or the browser runtime is unavailable
 */

const isBrowser = typeof window !== 'undefined';
const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY || import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

const DEFAULT_OPTIONS = {
  api_host: POSTHOG_HOST,
  persistence: 'localStorage+cookie',
  capture_pageview: true,
  capture_pageleave: true,
  disable_session_recording: true,
  enable_session_recording: false,
  default_event_properties: {
    app: 'studio',
  },
} satisfies Parameters<typeof posthog.init>[1];

let initialized = false;
let posthogClient: typeof posthog | null = null;

function logDisabledReason(reason: string): void {
  if (import.meta.env.DEV) {
    console.log(`⚠ PostHog analytics disabled (${reason})`);
  }
}

/**
 * Initialize PostHog if key is available
 */
function ensureInitialized(): boolean {
  if (posthogClient) return true;
  if (initialized) return false;

  initialized = true;

  if (!isBrowser) {
    logDisabledReason('non-browser runtime');
    return false;
  }

  if (!POSTHOG_KEY) {
    logDisabledReason('VITE_PUBLIC_POSTHOG_KEY not set');
    return false;
  }

  try {
    posthog.init(POSTHOG_KEY, {
      ...DEFAULT_OPTIONS,
      loaded: client => {
        client.register({ app: 'studio' });
        posthogClient = client;
      },
    });
    posthogClient = posthog;
    if (import.meta.env.DEV) {
      console.log('✓ PostHog analytics enabled for studio app');
    }
    return true;
  } catch (err) {
    console.error('Failed to initialize PostHog analytics', err);
    return false;
  }
}

// Initialize on module load
ensureInitialized();

export function getPosthogClient() {
  ensureInitialized();
  return posthogClient;
}

export const POSTHOG_OPTIONS = DEFAULT_OPTIONS;

/**
 * Identify a user for analytics
 */
export function identify(
  userId: string,
  traits?: Record<string, any>,
): void {
  if (!posthogClient) return;

  try {
    posthog.identify(userId, {
      ...traits,
      isStudioUser: true,
    });
  } catch (err) {
    console.error('Failed to identify user in analytics', err);
  }
}

/**
 * Track an event
 */
export function track(
  event: string,
  properties?: Record<string, any>,
): void {
  if (!posthogClient) {
    if (import.meta.env.DEV) {
      console.log(`[Analytics NO-OP] track: ${event}`, properties);
    }
    return;
  }

  try {
    posthog.capture(event, {
      ...properties,
      source: 'studio',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`Failed to track event ${event}`, err);
  }
}

/**
 * Reset analytics (on logout)
 */
export function reset(): void {
  if (!posthogClient) return;

  try {
    posthog.reset();
  } catch (err) {
    console.error('Failed to reset analytics', err);
  }
}

// Convenience tracking functions for studio-specific events
export const analytics = {
  identify,
  track,
  reset,

  // Admin events
  adminClientOpened: (workspaceId: string) =>
    track('AdminClientOpened', { workspaceId }),
  adminTaskOpened: (taskId: string, workspaceId: string) =>
    track('AdminTaskOpened', { taskId, workspaceId }),
  billingInspectorOpened: (workspaceId: string) =>
    track('BillingInspectorOpened', { workspaceId }),

  // Search events
  searchUsed: (query: string, resultCount: number) =>
    track('SearchUsed', { query, resultCount }),

  // Enterprise events
  enterpriseClientCreated: (workspaceId: string, planCode: string) =>
    track('EnterpriseClientCreated', { workspaceId, planCode }),
  adminPromoted: (userId: string) =>
    track('AdminPromoted', { userId }),

  // Review board events
  adminRevisionUploaded: (taskId: string, revisionId: string) =>
    track('AdminRevisionUploaded', { taskId, revisionId }),
  adminAnnotationResolved: (annotationId: string, taskId: string) =>
    track('AdminAnnotationResolved', { annotationId, taskId }),
};

export default analytics;

