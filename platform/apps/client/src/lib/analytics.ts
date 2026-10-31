import posthog from 'posthog-js';

/**
 * PostHog Analytics Wrapper for Client App
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
    app: 'client',
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
        client.register({ app: 'client' });
        posthogClient = client;
      },
    });
    posthogClient = posthog;
    if (import.meta.env.DEV) {
      console.log('✓ PostHog analytics enabled for client app');
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
    posthog.identify(userId, traits);
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
      source: 'client',
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

/**
 * Set workspace context for future events
 */
export function setWorkspaceContext(workspaceId: string, workspaceName?: string): void {
  if (!posthogClient) return;

  try {
    posthog.group('workspace', workspaceId, {
      name: workspaceName,
    });
  } catch (err) {
    console.error('Failed to set workspace context', err);
  }
}

// Convenience tracking functions for common events
export const analytics = {
  identify,
  track,
  reset,
  setWorkspaceContext,

  // Page views
  pageViewed: (pageName: string, properties?: Record<string, any>) =>
    track('PageViewed', { pageName, ...properties }),

  // Auth events
  loginStarted: (method: string) => track('LoginStarted', { method }),
  loginCompleted: (method: string) => track('LoginCompleted', { method }),
  signupStarted: () => track('SignupStarted', {}),
  signupCompleted: (source?: string) => track('SignupCompleted', { source }),
  logoutClicked: () => track('LogoutClicked', {}),

  // Onboarding events
  onboardingStarted: () => track('OnboardingStarted', {}),
  onboardingStepCompleted: (step: string, stepNumber: number) =>
    track('OnboardingStepCompleted', { step, stepNumber }),
  onboardingCompleted: () => track('OnboardingCompleted', {}),
  pricingPageViewed: () => track('PricingPageViewed', {}),
  planSelected: (planCode: string, interval: string) =>
    track('PlanSelected', { planCode, interval }),

  // Task events
  taskCreateOpened: (workspaceId: string) => track('TaskCreateOpened', { workspaceId }),
  taskCreateSubmitted: (workspaceId: string, taskId: string, category: string) =>
    track('TaskCreateSubmitted', { workspaceId, taskId, category }),
  taskViewed: (taskId: string, status: string) =>
    track('TaskViewed', { taskId, status }),
  taskStatusChanged: (taskId: string, fromStatus: string, toStatus: string) =>
    track('TaskStatusChanged', { taskId, fromStatus, toStatus }),
  taskApproved: (taskId: string) => track('TaskApproved', { taskId }),
  revisionRequested: (taskId: string, revisionNumber: number) =>
    track('RevisionRequested', { taskId, revisionNumber }),

  // File events
  fileUploadStarted: (taskId: string, fileType: string) =>
    track('FileUploadStarted', { taskId, fileType }),
  fileUploadCompleted: (taskId: string, fileType: string, success: boolean) =>
    track('FileUploadCompleted', { taskId, fileType, success }),
  fileDownloadClicked: (taskId: string, fileType: string, fileName: string) =>
    track('FileDownloadClicked', { taskId, fileType, fileName }),

  // Search events
  searchUsed: (query: string, resultCount: number) =>
    track('SearchUsed', { query, resultCount }),

  // Review board events
  reviewBoardOpened: (taskId: string) =>
    track('ReviewBoardOpened', { taskId }),
  annotationCreated: (taskId: string, assetType: string) =>
    track('AnnotationCreated', { taskId, assetType }),
  deliverableDownloaded: (taskId: string, fileName: string) =>
    track('DeliverableDownloaded', { taskId, fileName }),

  // Settings events
  settingsOpened: (tab?: string) => track('SettingsOpened', { tab }),
  settingsUpdated: (section: string) => track('SettingsUpdated', { section }),

  // Brand events
  brandCreated: (brandId: string) => track('BrandCreated', { brandId }),
  brandUpdated: (brandId: string) => track('BrandUpdated', { brandId }),

  // Billing events
  billingPageViewed: () => track('BillingPageViewed', {}),
  subscriptionPauseClicked: () => track('SubscriptionPauseClicked', {}),
  subscriptionResumeClicked: () => track('SubscriptionResumeClicked', {}),
  manageBillingClicked: () => track('ManageBillingClicked', {}),

  // Navigation events
  navItemClicked: (item: string) => track('NavItemClicked', { item }),
  dashboardViewed: () => track('DashboardViewed', {}),

  // Error tracking
  errorOccurred: (errorType: string, errorMessage: string, context?: Record<string, any>) =>
    track('ErrorOccurred', { errorType, errorMessage, ...context }),
  
  // Feature usage
  featureUsed: (featureName: string, properties?: Record<string, any>) =>
    track('FeatureUsed', { featureName, ...properties }),
  
  // AI features
  aiEstimatorUsed: (taskId: string, success: boolean) =>
    track('AIEstimatorUsed', { taskId, success }),
  structureBriefUsed: (taskId: string, success: boolean) =>
    track('StructureBriefUsed', { taskId, success }),
  
  // Slack integration
  slackConnectClicked: () => track('SlackConnectClicked', {}),
  slackConnected: (workspaceId: string) => track('SlackConnected', { workspaceId }),
};

export default analytics;

