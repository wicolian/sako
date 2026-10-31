/**
 * Launch Kit Type Definitions
 * 
 * Types for the Launch Kit generator that creates complete marketing
 * asset bundles from a single brief.
 */

import type { DesignDirection } from '@/lib/design/archetype-selector'
import type { GenerationPlan } from '@/lib/planning/types'

// ============================================================================
// Launch Types
// ============================================================================

export type LaunchType = 'product' | 'feature' | 'campaign' | 'event' | 'webinar'

export type KitStatus = 'generating' | 'review' | 'approved' | 'exported'

// ============================================================================
// Brief
// ============================================================================

export interface LaunchKitBrief {
  /** Type of launch (affects asset mix) */
  launchType: LaunchType
  
  /** Target audience description */
  audience: string
  
  /** Main offer or value proposition */
  offer: string
  
  /** Primary call-to-action */
  cta: string
  
  /** Optional constraints */
  constraints: {
    /** Terms/phrases that must appear */
    mustInclude: string[]
    /** Terms/phrases to avoid */
    mustAvoid: string[]
  }
  
  /** Associated brand ID */
  brandId: string
  
  /** Optional: Pre-validated copy from /gate */
  validatedCopy?: string
  
  /** Optional: Pre-validated claims from /gate */
  validatedClaims?: string[]

  /** Optional reviewed planning snapshot */
  planning?: GenerationPlan
}

// ============================================================================
// Assets
// ============================================================================

export interface LandingPageAsset {
  id: string
  html: string
  headline: string
  subheadline: string
  sections: Array<{
    type: string
    html: string
  }>
  designTokens: {
    primaryColor: string
    secondaryColor: string
    fontFamily: string
  }
  claims: string[]
}

export interface AdVariant {
  id: string
  angle: string
  platform: 'facebook' | 'instagram' | 'linkedin' | 'google'
  format: 'feed' | 'story' | 'carousel' | 'display'
  primaryText: string
  headline: string
  description?: string
  callToAction: string
  imagePrompt: string
  dimensions: { width: number; height: number }
  claims: string[]
}

export interface EmailMessage {
  subject: string
  preheader: string
  bodyHtml: string
  ctaText: string
  ctaUrl: string
  delayDays: number
  emailType: 'welcome' | 'nurture' | 'value' | 'social_proof' | 'urgency' | 'closing'
  claims: string[]
}

export interface EmailSequence {
  campaignName: string
  emails: EmailMessage[]
}

export interface SocialPost {
  id: string
  platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram' | 'tiktok'
  content: string
  hashtags: string[]
  characterCount: number
  imagePrompt?: string
  claims: string[]
  variantLabel: string
}

export interface DeckSlide {
  id: string
  type: 'title' | 'problem' | 'solution' | 'features' | 'benefits' | 'proof' | 'pricing' | 'cta'
  order: number
  headline: string
  subheadline?: string
  bullets?: string[]
  speakerNotes: string
  visualSuggestion: string
  claims: string[]
}

export interface DeckAsset {
  id: string
  title: string
  slides: DeckSlide[]
  totalSlides: number
  estimatedDuration: string
  theme: {
    primaryColor: string
    fontFamily: string
  }
}

// ============================================================================
// Launch Kit
// ============================================================================

export interface LaunchKit {
  id: string
  campaignId: string
  workspaceId: string
  brandId?: string
  
  /** The brief that generated this kit */
  brief: LaunchKitBrief
  
  /** Current status */
  status: KitStatus
  
  /** Generated assets */
  assets: {
    /** Full landing page */
    landingPage: LandingPageAsset | null
    
    /** 6 ad variants: 3 angles x 2 sizes */
    ads: AdVariant[]
    
    /** 5-email nurture sequence */
    emails: EmailSequence | null
    
    /** 10 social posts across platforms */
    socialPosts: SocialPost[]
    
    /** 6-slide mini deck */
    deck: DeckAsset | null
  }
  
  /** Compliance summary */
  compliance: {
    totalClaims: number
    approved: number
    needsReview: number
    blocked: number
    averageRiskScore: number
  }
  
  /** Marketing angles used for generation */
  angles: string[]
  
  /** Timestamps */
  createdAt: Date
  updatedAt: Date
  exportedAt?: Date
}

// ============================================================================
// Generation Progress
// ============================================================================

export type GenerationStep = 
  | 'angles'
  | 'landing_page'
  | 'ads'
  | 'emails'
  | 'social'
  | 'deck'
  | 'validation'
  | 'complete'

export interface GenerationProgress {
  step: GenerationStep
  progress: number // 0-100
  message: string
  error?: string
}

export type ProgressCallback = (progress: GenerationProgress) => void

// ============================================================================
// Generation Options
// ============================================================================

export interface KitGenerationOptions {
  /** Skip certain asset types */
  skip?: {
    landingPage?: boolean
    ads?: boolean
    emails?: boolean
    social?: boolean
    deck?: boolean
  }
  
  /** Number of variants */
  adVariants?: number
  emailCount?: number
  socialPostCount?: number
  deckSlideCount?: number
  
  /** Style preferences */
  style?: {
    theme?: 'dark' | 'light' | 'gradient' | 'glass'
    tone?: 'professional' | 'casual' | 'energetic' | 'authentic'
  }
  designDirection?: DesignDirection
  plan?: GenerationPlan
}

// ============================================================================
// API Types
// ============================================================================

export interface CreateKitRequest {
  brief: LaunchKitBrief
  options?: KitGenerationOptions
}

export interface KitResponse {
  success: boolean
  kit?: LaunchKit
  error?: {
    code: string
    message: string
  }
}

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = 'zip' | 'figma' | 'webflow' | 'hubspot' | 'framer' | 'subdomain'

export interface ExportOptions {
  format: ExportFormat
  includeAssets: {
    landingPage: boolean
    ads: boolean
    emails: boolean
    social: boolean
    deck: boolean
  }
}

export interface ExportResult {
  success: boolean
  format: ExportFormat
  url?: string
  downloadUrl?: string
  error?: string
}
