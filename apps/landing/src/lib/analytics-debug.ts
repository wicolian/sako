/**
 * Analytics Debug Utilities
 * Development tools for verifying analytics events are being sent correctly
 */

import type { CustomEventName, AnalyticsEventPayload } from './analytics-types';

// =============================================================================
// DEBUG CONFIGURATION
// =============================================================================

const DEBUG_ENABLED =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_ANALYTICS_DEBUG !== 'false' &&
  process.env.NEXT_PUBLIC_ANALYTICS_DEBUG !== 'disabled';
const DEBUG_VERBOSE = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'verbose';

// Style configurations for console output
const STYLES = {
  posthog: 'background: #1D4ED8; color: white; padding: 2px 6px; border-radius: 3px;',
  ga4: 'background: #F59E0B; color: black; padding: 2px 6px; border-radius: 3px;',
  event: 'background: #10B981; color: white; padding: 2px 6px; border-radius: 3px;',
  error: 'background: #EF4444; color: white; padding: 2px 6px; border-radius: 3px;',
  warning: 'background: #F59E0B; color: black; padding: 2px 6px; border-radius: 3px;',
  info: 'background: #6366F1; color: white; padding: 2px 6px; border-radius: 3px;',
} as const;

// =============================================================================
// DEBUG LOGGER
// =============================================================================

/**
 * Analytics debug logger
 * Only logs in development mode
 */
export const analyticsDebug = {
  /**
   * Check if debug mode is enabled
   */
  get enabled(): boolean {
    return DEBUG_ENABLED;
  },

  /**
   * Check if verbose mode is enabled
   */
  get verbose(): boolean {
    return DEBUG_VERBOSE;
  },

  /**
   * Log a PostHog event
   */
  logPostHog(eventName: string, data?: Record<string, unknown>): void {
    if (!DEBUG_ENABLED) return;

    console.groupCollapsed(
      `%cPostHog%c ${eventName}`,
      STYLES.posthog,
      'color: inherit; font-weight: bold;'
    );
    console.log('Event:', eventName);
    if (data) {
      console.log('Data:', data);
    }
    console.log('Timestamp:', new Date().toISOString());
    if (DEBUG_VERBOSE) {
      console.trace('Stack trace');
    }
    console.groupEnd();
  },

  /**
   * Log a GA4 event
   */
  logGA4(eventName: string, data?: Record<string, unknown>): void {
    if (!DEBUG_ENABLED) return;

    console.groupCollapsed(
      `%cGA4%c ${eventName}`,
      STYLES.ga4,
      'color: inherit; font-weight: bold;'
    );
    console.log('Event:', eventName);
    if (data) {
      console.log('Data:', data);
    }
    console.log('Timestamp:', new Date().toISOString());
    if (DEBUG_VERBOSE) {
      console.trace('Stack trace');
    }
    console.groupEnd();
  },

  /**
   * Log a unified event (sent to both PostHog and GA4)
   */
  logEvent(eventName: CustomEventName | string, data?: AnalyticsEventPayload | Record<string, unknown>): void {
    if (!DEBUG_ENABLED) return;

    console.groupCollapsed(
      `%cAnalytics%c ${eventName}`,
      STYLES.event,
      'color: inherit; font-weight: bold;'
    );
    console.log('Event:', eventName);
    if (data) {
      console.log('Data:', data);
    }
    console.log('Sent to: PostHog + GA4');
    console.log('Timestamp:', new Date().toISOString());
    if (DEBUG_VERBOSE) {
      console.trace('Stack trace');
    }
    console.groupEnd();
  },

  /**
   * Log an error
   */
  logError(message: string, error?: unknown): void {
    if (!DEBUG_ENABLED) return;

    console.groupCollapsed(
      `%cAnalytics Error%c ${message}`,
      STYLES.error,
      'color: inherit; font-weight: bold;'
    );
    if (error) {
      console.error('Error:', error);
    }
    console.log('Timestamp:', new Date().toISOString());
    console.trace('Stack trace');
    console.groupEnd();
  },

  /**
   * Log a warning
   */
  logWarning(message: string, data?: unknown): void {
    if (!DEBUG_ENABLED) return;

    console.groupCollapsed(
      `%cAnalytics Warning%c ${message}`,
      STYLES.warning,
      'color: inherit; font-weight: bold;'
    );
    if (data) {
      console.log('Data:', data);
    }
    console.log('Timestamp:', new Date().toISOString());
    console.groupEnd();
  },

  /**
   * Log info
   */
  logInfo(message: string, data?: unknown): void {
    if (!DEBUG_ENABLED) return;

    console.groupCollapsed(
      `%cAnalytics Info%c ${message}`,
      STYLES.info,
      'color: inherit; font-weight: bold;'
    );
    if (data) {
      console.log('Data:', data);
    }
    console.log('Timestamp:', new Date().toISOString());
    console.groupEnd();
  },

  /**
   * Log consent status
   */
  logConsent(provider: 'posthog' | 'ga4', granted: boolean): void {
    if (!DEBUG_ENABLED) return;

    const style = provider === 'posthog' ? STYLES.posthog : STYLES.ga4;
    const providerName = provider === 'posthog' ? 'PostHog' : 'GA4';

    console.log(
      `%c${providerName}%c Consent ${granted ? 'granted' : 'denied'}`,
      style,
      `color: ${granted ? '#10B981' : '#EF4444'}; font-weight: bold;`
    );
  },

  /**
   * Log initialization status
   */
  logInit(provider: 'posthog' | 'ga4', success: boolean, details?: string): void {
    if (!DEBUG_ENABLED) return;

    const style = provider === 'posthog' ? STYLES.posthog : STYLES.ga4;
    const providerName = provider === 'posthog' ? 'PostHog' : 'GA4';

    console.log(
      `%c${providerName}%c ${success ? 'Initialized' : 'Failed to initialize'}${details ? `: ${details}` : ''}`,
      style,
      `color: ${success ? '#10B981' : '#EF4444'}; font-weight: bold;`
    );
  },
};

// =============================================================================
// EVENT VALIDATION
// =============================================================================

/**
 * Validate event data against expected schema
 */
export function validateEventData(
  eventName: string,
  data: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for required 'page' field on most events
  const eventsRequiringPage = [
    'cta_interaction',
    'button_clicked',
    'nav_clicked',
    'form_submitted',
    'scroll_depth',
    'time_on_page',
    'content_viewed',
    'business_intent',
  ];

  if (eventsRequiringPage.includes(eventName) && !data.page) {
    errors.push(`Event "${eventName}" is missing required field "page"`);
  }

  // Validate specific event types
  switch (eventName) {
    case 'cta_interaction':
      if (!data.cta_name) errors.push('cta_interaction missing "cta_name"');
      if (!data.location) errors.push('cta_interaction missing "location"');
      if (!data.action) errors.push('cta_interaction missing "action"');
      break;

    case 'form_submitted':
      if (!data.form_name) errors.push('form_submitted missing "form_name"');
      if (typeof data.success !== 'boolean') errors.push('form_submitted missing "success" boolean');
      break;

    case 'scroll_depth':
      if (typeof data.depth_percent !== 'number') errors.push('scroll_depth missing "depth_percent" number');
      break;

    case 'web_vital':
      if (!data.metric_name) errors.push('web_vital missing "metric_name"');
      if (typeof data.metric_value !== 'number') errors.push('web_vital missing "metric_value" number');
      if (!data.metric_rating) errors.push('web_vital missing "metric_rating"');
      break;
  }

  if (DEBUG_ENABLED && errors.length > 0) {
    analyticsDebug.logWarning(`Event validation failed for "${eventName}"`, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// DEBUG OVERLAY (Optional)
// =============================================================================

let overlayElement: HTMLDivElement | null = null;
let eventLog: Array<{ time: string; event: string; provider: string }> = [];

/**
 * Show debug overlay in browser
 */
export function showDebugOverlay(): void {
  if (typeof window === 'undefined' || !DEBUG_ENABLED) return;

  if (overlayElement) {
    overlayElement.style.display = 'block';
    return;
  }

  overlayElement = document.createElement('div');
  overlayElement.id = 'analytics-debug-overlay';
  overlayElement.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    width: 350px;
    max-height: 300px;
    background: rgba(0, 0, 0, 0.9);
    color: #fff;
    font-family: monospace;
    font-size: 11px;
    padding: 10px;
    border-radius: 8px;
    z-index: 99999;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #333;
  `;
  header.innerHTML = `
    <span style="font-weight: bold; color: #10B981;">Analytics Debug</span>
    <button id="analytics-debug-close" style="background: #EF4444; border: none; color: white; padding: 2px 8px; border-radius: 4px; cursor: pointer;">×</button>
  `;

  const logContainer = document.createElement('div');
  logContainer.id = 'analytics-debug-log';

  overlayElement.appendChild(header);
  overlayElement.appendChild(logContainer);
  document.body.appendChild(overlayElement);

  document.getElementById('analytics-debug-close')?.addEventListener('click', hideDebugOverlay);

  // Render existing events
  renderEventLog();
}

/**
 * Hide debug overlay
 */
export function hideDebugOverlay(): void {
  if (overlayElement) {
    overlayElement.style.display = 'none';
  }
}

/**
 * Add event to debug overlay
 */
export function addToDebugOverlay(eventName: string, provider: 'posthog' | 'ga4' | 'both'): void {
  if (!DEBUG_ENABLED) return;

  const time = new Date().toLocaleTimeString();
  eventLog.unshift({ time, event: eventName, provider });

  // Keep only last 50 events
  if (eventLog.length > 50) {
    eventLog = eventLog.slice(0, 50);
  }

  renderEventLog();
}

function renderEventLog(): void {
  const logContainer = document.getElementById('analytics-debug-log');
  if (!logContainer) return;

  logContainer.innerHTML = eventLog
    .map(({ time, event, provider }) => {
      const color = provider === 'posthog' ? '#1D4ED8' : provider === 'ga4' ? '#F59E0B' : '#10B981';
      return `<div style="margin-bottom: 4px; padding: 2px 0; border-bottom: 1px solid #222;">
        <span style="color: #666;">${time}</span>
        <span style="color: ${color}; margin-left: 5px;">[${provider.toUpperCase()}]</span>
        <span style="margin-left: 5px;">${event}</span>
      </div>`;
    })
    .join('');
}

// =============================================================================
// KEYBOARD SHORTCUT
// =============================================================================

/**
 * Initialize debug keyboard shortcut (Ctrl+Shift+A)
 */
export function initDebugShortcut(): void {
  if (typeof window === 'undefined' || !DEBUG_ENABLED) return;

  window.addEventListener('keydown', (e) => {
    // Ctrl+Shift+A to toggle overlay
    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
      e.preventDefault();
      if (overlayElement?.style.display === 'none') {
        showDebugOverlay();
      } else if (overlayElement) {
        hideDebugOverlay();
      } else {
        showDebugOverlay();
      }
    }
  });

  analyticsDebug.logInfo('Debug shortcut initialized: Ctrl+Shift+A to toggle overlay');
}
