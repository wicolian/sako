/**
 * Analytics Type Definitions
 * Strict TypeScript types for GA4 and PostHog analytics events
 */

// =============================================================================
// GA4 TYPES
// =============================================================================

/**
 * GA4 Consent Mode categories
 */
export type GA4ConsentCategory =
  | 'ad_storage'
  | 'ad_user_data'
  | 'ad_personalization'
  | 'analytics_storage'
  | 'functionality_storage'
  | 'personalization_storage'
  | 'security_storage';

export type GA4ConsentState = 'granted' | 'denied';

export interface GA4ConsentConfig {
  ad_storage: GA4ConsentState;
  ad_user_data: GA4ConsentState;
  ad_personalization: GA4ConsentState;
  analytics_storage: GA4ConsentState;
  functionality_storage: GA4ConsentState;
  personalization_storage: GA4ConsentState;
  security_storage: GA4ConsentState;
}

/**
 * GA4 Standard Event Parameters
 */
export interface GA4PageViewParams {
  page_title?: string;
  page_location?: string;
  page_path?: string;
}

export interface GA4EventParams {
  event_category?: string;
  event_label?: string;
  value?: number;
  [key: string]: string | number | boolean | undefined;
}

// =============================================================================
// CUSTOM EVENT TYPES
// =============================================================================

/**
 * CTA Interaction event
 */
export interface CTAInteractionEvent {
  cta_name: string;
  location: string;
  action: 'click' | 'hover' | 'view';
  page: string;
}

/**
 * Button click event
 */
export interface ButtonClickEvent {
  button_name: string;
  section?: string;
  page: string;
}

/**
 * Form events
 */
export interface FormStartEvent {
  form_name: string;
  page: string;
}

export interface FormSubmitEvent {
  form_name: string;
  success: boolean;
  page: string;
}

export interface FormFieldEvent {
  form_name: string;
  field_name: string;
  has_value?: boolean;
  fields_interacted_count?: number;
  fields_completed_count?: number;
}

export interface FormAbandonmentEvent {
  form_name: string;
  fields_interacted: string[];
  fields_completed: string[];
  time_spent_seconds: number;
  completion_rate: number;
  page: string;
}

/**
 * Scroll and engagement events
 */
export interface ScrollDepthEvent {
  depth_percent: number;
  page: string;
}

export interface TimeOnPageEvent {
  seconds: number;
  page: string;
}

/**
 * Content engagement events
 */
export interface ContentViewEvent {
  content_type: string;
  content_id: string;
  title?: string;
  page: string;
}

export interface ContentInteractionEvent {
  content_type: string;
  content_id: string;
  action: string;
  page: string;
}

/**
 * Business intent events
 */
export type BusinessIntentType =
  | 'pricing_view'
  | 'demo_request'
  | 'contact_form'
  | 'book_call';

export interface BusinessIntentEvent {
  intent_type: BusinessIntentType;
  page: string;
}

/**
 * Product attribution events
 */
export type ProductDestination = 'app_signup' | 'app_dashboard' | 'app_login';

export interface ProductClickEvent {
  destination: ProductDestination;
  campaign: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_content?: string | null;
  page: string;
  timestamp: string;
}

/**
 * Error tracking
 */
export interface ErrorEvent {
  type: string;
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  componentStack?: string;
  page: string;
  url: string;
  userAgent: string;
  timestamp: string;
}

/**
 * Web Vitals
 */
export type WebVitalName = 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';
export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

export interface WebVitalEvent {
  metric_name: WebVitalName;
  metric_value: number;
  metric_rating: WebVitalRating;
  page: string;
}

/**
 * Funnel tracking
 */
export interface FunnelStepEvent {
  funnel_name: string;
  step_number: number;
  step_name: string;
  page: string;
  [key: string]: string | number | undefined;
}

/**
 * Marketing funnel steps
 */
export type MarketingFunnelStep =
  | 'LAND'
  | 'SCROLL_50'
  | 'VIEW_PRICING'
  | 'CLICK_CTA'
  | 'START_SIGNUP'
  | 'COMPLETE_SIGNUP';

/**
 * A/B Testing
 */
export interface ExperimentEvent {
  experiment_name: string;
  variant: string;
  page: string;
}

export interface ExperimentConversionEvent extends ExperimentEvent {
  conversion_type: string;
}

/**
 * Reading progress
 */
export interface ReadingMilestoneEvent {
  content_id: string;
  content_type: string;
  title: string;
  milestone_percent: number;
  time_to_milestone_seconds: number;
}

export interface ReadingCompleteEvent {
  content_id: string;
  content_type: string;
  title: string;
  max_scroll_depth: number;
  total_time_seconds: number;
  milestones_reached: number[];
  completed: boolean;
  page: string;
}

/**
 * Attribution data
 */
export interface AttributionData {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  landing_page: string;
  timestamp: string;
}

/**
 * Page view with source attribution
 */
export interface PageViewEvent {
  path: string;
  source: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  referrer: string;
}

// =============================================================================
// UNION TYPES FOR ALL EVENTS
// =============================================================================

/**
 * All custom event names
 */
export type CustomEventName =
  | '$pageview'
  | '$exception'
  | 'cta_interaction'
  | 'button_clicked'
  | 'nav_clicked'
  | 'form_view'
  | 'form_started'
  | 'form_submitted'
  | 'form_field_focus'
  | 'form_field_blur'
  | 'form_abandoned'
  | 'scroll_depth'
  | 'time_on_page'
  | 'content_viewed'
  | 'content_interaction'
  | 'content_start'
  | 'content_complete'
  | 'business_intent'
  | 'product_click'
  | 'web_vital'
  | 'funnel_step'
  | 'reading_milestone'
  | '$experiment_started'
  | 'experiment_conversion'
  | 'consent_update';

/**
 * Event payload union type
 */
export type AnalyticsEventPayload =
  | CTAInteractionEvent
  | ButtonClickEvent
  | FormStartEvent
  | FormSubmitEvent
  | FormFieldEvent
  | FormAbandonmentEvent
  | ScrollDepthEvent
  | TimeOnPageEvent
  | ContentViewEvent
  | ContentInteractionEvent
  | BusinessIntentEvent
  | ProductClickEvent
  | ErrorEvent
  | WebVitalEvent
  | FunnelStepEvent
  | ReadingMilestoneEvent
  | ReadingCompleteEvent
  | PageViewEvent
  | ExperimentEvent
  | ExperimentConversionEvent;
