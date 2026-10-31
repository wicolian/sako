/**
 * PostHog Event Tracking
 * 
 * Centralized event tracking for all success metrics.
 * 
 * Success Metrics:
 * - validation_started: User starts a validation on /gate
 * - validation_completed: Validation finishes successfully
 * - kit_created: Launch kit generation started
 * - kit_completed: Launch kit generation finished
 * - kit_exported: Kit exported to any format
 * - report_shared: Compliance report shared
 * - request_created: Team request created
 * - signup_completed: User signed up
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface ValidationStartedEvent {
  industry: string
  textLength: number
  source: 'gate' | 'app'
}

export interface ValidationCompletedEvent {
  industry: string
  textLength: number
  claimsCount: number
  approvedCount: number
  needsReviewCount: number
  blockedCount: number
  averageRiskScore: number
  processingTimeMs: number
}

export interface KitCreatedEvent {
  launchType: string
  hasValidatedCopy: boolean
  source: 'gate' | 'app' | 'request'
}

export interface KitCompletedEvent {
  kitId: string
  launchType: string
  assetCounts: {
    landingPage: boolean
    ads: number
    emails: number
    socialPosts: number
    deck: boolean
  }
  complianceScore: number
  generationTimeMs: number
}

export interface KitExportedEvent {
  kitId: string
  format: 'zip' | 'figma' | 'webflow' | 'hubspot' | 'framer' | 'subdomain'
  assetTypes: string[]
}

export interface ReportSharedEvent {
  reportToken: string
  complianceScore: number
  method: 'link' | 'embed'
}

export interface RequestCreatedEvent {
  assetType: string
  priority: string
  source: 'app' | 'slack' | 'email' | 'api'
}

export interface SignupCompletedEvent {
  source: 'gate' | 'gate_ratelimit' | 'organic' | 'invite'
  action?: string
}

// ============================================================================
// PostHog Client
// ============================================================================

type EventName = 
  | 'validation_started'
  | 'validation_completed'
  | 'kit_created'
  | 'kit_completed'
  | 'kit_exported'
  | 'report_shared'
  | 'request_created'
  | 'signup_completed'

type EventProperties = 
  | ValidationStartedEvent
  | ValidationCompletedEvent
  | KitCreatedEvent
  | KitCompletedEvent
  | KitExportedEvent
  | ReportSharedEvent
  | RequestCreatedEvent
  | SignupCompletedEvent

/**
 * Check if PostHog is available (client-side only)
 */
function getPostHog(): { capture: (event: string, properties?: Record<string, unknown>) => void } | null {
  if (typeof window === 'undefined') {
    return null
  }
  
  const posthog = (window as unknown as { posthog?: { capture: (event: string, properties?: Record<string, unknown>) => void } }).posthog
  return posthog || null
}

/**
 * Track an event with PostHog
 */
export function trackEvent(event: EventName, properties: EventProperties): void {
  const posthog = getPostHog()
  
  if (posthog) {
    posthog.capture(event, properties as unknown as Record<string, unknown>)
  } else {
    // Log for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', event, properties)
    }
  }
}

// ============================================================================
// Event-Specific Tracking Functions
// ============================================================================

export function trackValidationStarted(properties: ValidationStartedEvent): void {
  trackEvent('validation_started', properties)
}

export function trackValidationCompleted(properties: ValidationCompletedEvent): void {
  trackEvent('validation_completed', properties)
}

export function trackKitCreated(properties: KitCreatedEvent): void {
  trackEvent('kit_created', properties)
}

export function trackKitCompleted(properties: KitCompletedEvent): void {
  trackEvent('kit_completed', properties)
}

export function trackKitExported(properties: KitExportedEvent): void {
  trackEvent('kit_exported', properties)
}

export function trackReportShared(properties: ReportSharedEvent): void {
  trackEvent('report_shared', properties)
}

export function trackRequestCreated(properties: RequestCreatedEvent): void {
  trackEvent('request_created', properties)
}

export function trackSignupCompleted(properties: SignupCompletedEvent): void {
  trackEvent('signup_completed', properties)
}

// ============================================================================
// Server-Side Tracking (for API routes)
// ============================================================================

/**
 * Track event from server side using PostHog API
 */
export async function trackServerEvent(
  distinctId: string,
  event: EventName,
  properties: EventProperties
): Promise<void> {
  const apiKey = process.env.POSTHOG_API_KEY
  const host = process.env.POSTHOG_HOST || 'https://app.posthog.com'
  
  if (!apiKey) {
    console.warn('PostHog API key not configured')
    return
  }
  
  try {
    await fetch(`${host}/capture/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          $lib: 'sako-server',
        },
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (error) {
    console.error('Failed to track server event:', error)
  }
}
