/**
 * HubSpot API Types
 * Based on HubSpot API v3
 */

// =============================================================================
// AUTH & TOKENS
// =============================================================================

export interface HubSpotTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: 'bearer'
}

export interface HubSpotPortalInfo {
  user: string
  hub_id: number
  scopes: string[]
  hub_domain: string
  app_id: number
}

// =============================================================================
// FORMS API
// =============================================================================

export interface HubSpotFormField {
  name: string
  label: string
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox'
  required: boolean
  placeholder?: string
  options?: Array<{ label: string; value: string }>
}

export interface HubSpotFormCreate {
  name: string
  formType: 'hubspot'
  configuration: {
    language: string
    createNewContactForNewEmail: boolean
    prePopulateKnownValues: boolean
    cloneable: boolean
    postSubmitAction: {
      type: 'thank_you' | 'redirect' | 'inline_message'
      value?: string
    }
  }
  displayOptions: {
    renderRawHtml: boolean
    style?: {
      fontFamily?: string
      submitColor?: string
      submitAlignment?: string
      submitFontColor?: string
    }
  }
  fieldGroups: Array<{
    groupType: 'default_group'
    richTextType: 'text'
    fields: HubSpotFormField[]
  }>
  legalConsentOptions?: {
    type: 'legitimate_interest_with_unsubscribe'
    lawfulBasis: 'PERFORMANCE_OF_CONTRACT'
    privacyPolicyText?: string
  }
}

export interface HubSpotFormResponse {
  id: string
  name: string
  formType: string
  createdAt: string
  updatedAt: string
  portalId: number
  guid: string
}

// =============================================================================
// LANDING PAGES API
// =============================================================================

export interface HubSpotPageCreate {
  name: string
  slug: string
  state: 'DRAFT' | 'PUBLISHED'
  templatePath?: string
  layoutSections?: Record<string, unknown>
  htmlTitle?: string
  metaDescription?: string
  campaignGuid?: string
}

export interface HubSpotPageResponse {
  id: string
  name: string
  slug: string
  state: string
  publishDate: string
  createdAt: string
  updatedAt: string
  url: string
  absoluteUrl: string
}

// =============================================================================
// EMAILS API (Marketing Emails)
// =============================================================================

export interface HubSpotEmailCreate {
  name: string
  subject: string
  fromName: string
  content: {
    plainTextVersion?: string
    htmlContent: string
  }
  campaignGuid?: string
}

export interface HubSpotEmailResponse {
  id: number
  name: string
  subject: string
  state: string
  publishDate: string | null
  createdAt: string
  updatedAt: string
}

// =============================================================================
// ANALYTICS API
// =============================================================================

export interface HubSpotAnalyticsParams {
  start: string // ISO date
  end: string // ISO date
  breakdown?: 'totals' | 'daily' | 'weekly' | 'monthly'
}

export interface HubSpotPageAnalytics {
  pageViews: number
  uniquePageViews: number
  bounceRate: number
  avgTimeOnPage: number
  entrances: number
  exits: number
}

export interface HubSpotFormAnalytics {
  views: number
  submissions: number
  conversionRate: number
  contactsGenerated: number
}

export interface HubSpotCampaignAnalytics {
  // Form metrics
  formViews: number
  formSubmissions: number
  formConversionRate: number
  
  // Page metrics
  pageViews: number
  uniquePageViews: number
  bounceRate: number
  avgTimeOnPage: number
  
  // Contact/Lead metrics
  contactsCreated: number
  newContacts: number
  
  // Email metrics (if applicable)
  emailsSent?: number
  emailsOpened?: number
  emailsClicked?: number
  openRate?: number
  clickRate?: number
}

// =============================================================================
// CAMPAIGN METADATA
// =============================================================================

export interface HubSpotCampaignCreate {
  name: string
  type: string
  budget?: number
  contentIds?: {
    pages?: string[]
    forms?: string[]
    emails?: number[]
  }
}

export interface HubSpotCampaignResponse {
  guid: string
  name: string
  type: string
  createdAt: string
  updatedAt: string
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export interface HubSpotError {
  status: 'error'
  message: string
  correlationId: string
  category: string
}

export type HubSpotApiResult<T> = 
  | { success: true; data: T }
  | { success: false; error: HubSpotError | string }
