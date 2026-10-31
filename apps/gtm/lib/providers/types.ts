/**
 * Deployment Provider Interface
 * 
 * Defines the contract for all deployment destinations (HubSpot, Webflow, Figma, etc.)
 * Enables multi-channel deployment with a consistent API.
 */

export type ProviderType = 
  // Marketing Automation
  | 'hubspot' 
  | 'salesforce' 
  | 'marketo' 
  | 'activecampaign' 
  | 'mailchimp' 
  | 'klaviyo'
  // Website/CMS
  | 'webflow' 
  | 'figma' 
  | 'framer' 
  | 'wordpress' 
  | 'shopify'
  // Advertising
  | 'google-ads' 
  | 'meta-ads' 
  | 'linkedin-ads'
  // Social
  | 'twitter'
  // Analytics
  | 'ga4' 
  | 'amplitude' 
  | 'mixpanel' 
  | 'segment'
  // Notifications
  | 'slack' 
  | 'notion'
  // Custom
  | 'custom'

export interface ProviderCapabilities {
  deployPage: boolean
  deployForm: boolean
  deployEmail: boolean
  deploySequence: boolean
  deployAd?: boolean // For ad platforms (Google, Meta, LinkedIn)
  sendNotification?: boolean // For notification providers (Slack)
  getPerformance: boolean
  biDirectionalSync: boolean
}

export interface ProviderConnection {
  id: string
  workspaceId: string
  provider: ProviderType
  isConnected: boolean
  externalId?: string
  externalName?: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: Date
  scopes?: string[]
  metadata?: Record<string, unknown>
}

export interface PageMetadata {
  name: string
  slug: string
  workspaceId: string
  campaignId: string
  domain?: string
  collectionId?: string // For CMS-based systems
  templateId?: string
  seoTitle?: string
  seoDescription?: string
}

export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'hidden'
  required: boolean
  options?: string[]
  defaultValue?: string
  placeholder?: string
}

export interface FormMetadata {
  name: string
  redirectUrl?: string
  submitButtonText?: string
  campaignId: string
  workspaceId: string
}

export interface EmailContent {
  subject: string
  preheader?: string
  previewText?: string
  body?: string
  bodyHtml?: string
  bodyText?: string
  from?: string
  fromName?: string
  fromEmail?: string
  replyTo?: string
  metadata?: Record<string, any>
}

export interface SequenceStep {
  type: 'email' | 'wait' | 'condition'
  delay?: number // in hours
  content?: EmailContent
  condition?: {
    type: 'opened' | 'clicked' | 'replied'
    action: 'continue' | 'exit' | 'branch'
  }
}

export interface DeployResult {
  success: boolean
  externalId: string
  url?: string
  error?: string
  warnings?: string[]
  metadata?: Record<string, unknown>
}

export interface PerformanceMetrics {
  // Page metrics
  pageViews?: number
  formSubmissions?: number
  formConversionRate?: number
  uniqueVisitors?: number
  bounceRate?: number
  avgTimeOnPage?: number
  contactsCreated?: number
  
  // Email metrics
  emailsSent?: number
  emailsOpened?: number
  emailsClicked?: number
  emailOpens?: number
  emailClicks?: number
  openRate?: number
  clickRate?: number
  unsubscribes?: number
  bounces?: number
  
  // Ad metrics
  impressions?: number
  clicks?: number
  spend?: number
  conversions?: number
  ctr?: number
  cpc?: number
  reach?: number
  frequency?: number
  conversionRate?: number
  dataSource?: 'hubspot_api' | 'estimated'
  lastUpdated?: string
}

export interface TextUpdate {
  nodeId: string
  text: string
  layerName?: string
}

export interface ImportedContent {
  claims: Array<{
    nodeId: string
    text: string
    type: string
    layerPath?: string
  }>
  structure?: Record<string, unknown>
  assets?: Array<{
    id: string
    url: string
    type: 'image' | 'icon' | 'illustration'
  }>
}

/**
 * Core Deployment Provider Interface
 */
export interface DeploymentProvider {
  // Provider identity
  id: ProviderType
  name: string
  icon: string
  description: string
  capabilities: ProviderCapabilities

  // Authentication
  isConnected(workspaceId: string): Promise<boolean>
  getAuthUrl(workspaceId: string, redirectUrl: string): string
  handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection>
  disconnect(workspaceId: string): Promise<void>

  // Deployment capabilities (optional based on capabilities)
  deployPage?(html: string, metadata: PageMetadata): Promise<DeployResult>
  deployForm?(fields: FormField[], metadata: FormMetadata): Promise<DeployResult>
  deployEmail?(content: EmailContent): Promise<DeployResult>
  deploySequence?(steps: SequenceStep[]): Promise<DeployResult>

  // Performance feedback
  getPerformance?(campaignId: string): Promise<PerformanceMetrics | null>

  // Bi-directional sync (for Figma, etc.)
  importContent?(sourceUrl: string): Promise<ImportedContent | null>
  pushContent?(updates: TextUpdate[], fileKey: string): Promise<DeployResult>
}

/**
 * Provider Registry Entry
 */
export interface ProviderRegistryEntry {
  type: ProviderType
  provider: DeploymentProvider
  enabled: boolean
}

/**
 * Batch deployment request
 */
export interface BatchDeployRequest {
  campaignId: string
  workspaceId: string
  destinations: ProviderType[]
  html: string
  formFields?: FormField[]
  metadata: PageMetadata
}

/**
 * Batch deployment result
 */
export interface BatchDeployResult {
  /** true only when ALL destinations succeeded */
  success: boolean
  /** true when at least one succeeded but not all */
  partial: boolean
  results: Record<ProviderType, DeployResult>
  errors: string[]
}
