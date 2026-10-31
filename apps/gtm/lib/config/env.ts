/**
 * Environment Configuration (Jan 2026)
 * 
 * HARD REQUIREMENT: All features must have their env vars set.
 * NO fallbacks, NO preview modes, NO optional features.
 * If it's in this app, it MUST work.
 */

// ============================================================================
// CORE - App cannot start without these
// ============================================================================
export const CORE_ENV = {
  // Supabase
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  
  // App URL
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  
  // Encryption (for OAuth tokens etc)
  ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET!,
} as const;

// ============================================================================
// AI GENERATION - Required for all AI features
// ============================================================================
export const AI_ENV = {
  // OpenRouter (unified routing) - REQUIRED
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
  
  // OpenRouter optional settings
  OPENROUTER_SITE_URL: process.env.OPENROUTER_SITE_URL,
  OPENROUTER_SITE_NAME: process.env.OPENROUTER_SITE_NAME,
  OPENROUTER_SYSTEM_PROMPT: process.env.OPENROUTER_SYSTEM_PROMPT,
  
  // Direct OpenAI key (only for LangGraph/LangChain pipelines)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
} as const;

// ============================================================================
// EVIDENCE RESEARCH - Required for claim validation
// ============================================================================
export const RESEARCH_ENV = {
  TAVILY_API_KEY: process.env.TAVILY_API_KEY!,
} as const;

// ============================================================================
// VIDEO GENERATION - Required for video features
// ============================================================================
export const VIDEO_ENV = {
  // Voice generation
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY!,
  
  // Video rendering (one of these is required)
  CREATOMATE_API_KEY: process.env.CREATOMATE_API_KEY,
  SHOTSTACK_API_KEY: process.env.SHOTSTACK_API_KEY,
  REMOTION_LAMBDA_FUNCTION_NAME: process.env.REMOTION_LAMBDA_FUNCTION_NAME,
} as const;

// ============================================================================
// COMPETITOR INTELLIGENCE - Required for competitor features
// ============================================================================
// COMPETITOR INTELLIGENCE (Now uses Tavily instead of G2 API)
// G2_API_KEY is deprecated - competitor data is fetched via Tavily search
export const COMPETITOR_ENV = {
  // Deprecated: G2_API_KEY no longer required
  // G2_API_KEY: process.env.G2_API_KEY!,
} as const;

// ============================================================================
// INTEGRATIONS - OAuth credentials for third-party services
// ============================================================================
export const HUBSPOT_ENV = {
  CLIENT_ID: process.env.HUBSPOT_CLIENT_ID!,
  CLIENT_SECRET: process.env.HUBSPOT_CLIENT_SECRET!,
  REDIRECT_URI: process.env.HUBSPOT_REDIRECT_URI!,
} as const;

export const WEBFLOW_ENV = {
  CLIENT_ID: process.env.WEBFLOW_CLIENT_ID!,
  CLIENT_SECRET: process.env.WEBFLOW_CLIENT_SECRET!,
  REDIRECT_URI: process.env.WEBFLOW_REDIRECT_URI!,
} as const;

export const FIGMA_ENV = {
  CLIENT_ID: process.env.FIGMA_CLIENT_ID!,
  CLIENT_SECRET: process.env.FIGMA_CLIENT_SECRET!,
  REDIRECT_URI: process.env.FIGMA_REDIRECT_URI!,
} as const;

export const LINKEDIN_ENV = {
  CLIENT_ID: process.env.LINKEDIN_CLIENT_ID!,
  CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET!,
  REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI!,
} as const;

export const META_ENV = {
  APP_ID: process.env.META_APP_ID!,
  APP_SECRET: process.env.META_APP_SECRET!,
  REDIRECT_URI: process.env.META_REDIRECT_URI!,
} as const;

export const GOOGLE_ADS_ENV = {
  CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID!,
  CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET!,
  REDIRECT_URI: process.env.GOOGLE_ADS_REDIRECT_URI!,
  DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
} as const;

export const SLACK_ENV = {
  CLIENT_ID: process.env.SLACK_CLIENT_ID!,
  CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET!,
  REDIRECT_URI: process.env.SLACK_REDIRECT_URI!,
} as const;

export const SALESFORCE_ENV = {
  CLIENT_ID: process.env.SALESFORCE_CLIENT_ID!,
  CLIENT_SECRET: process.env.SALESFORCE_CLIENT_SECRET!,
  REDIRECT_URI: process.env.SALESFORCE_REDIRECT_URI!,
  LOGIN_URL: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com',
} as const;

export const MAILCHIMP_ENV = {
  CLIENT_ID: process.env.MAILCHIMP_CLIENT_ID!,
  CLIENT_SECRET: process.env.MAILCHIMP_CLIENT_SECRET!,
  REDIRECT_URI: process.env.MAILCHIMP_REDIRECT_URI!,
} as const;

export const GOOGLE_ANALYTICS_ENV = {
  CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI!,
} as const;

// ============================================================================
// SAKO AGENCY API - For human escalation
// ============================================================================
export const SAKO_ENV = {
  API_URL: process.env.SAKO_V1_API_URL!,
  API_KEY: process.env.SAKO_V1_API_KEY!,
  WEBHOOK_SECRET: process.env.SAKO_WEBHOOK_SECRET,
} as const;

// ============================================================================
// BILLING - Stripe
// ============================================================================
export const STRIPE_ENV = {
  SECRET_KEY: process.env.STRIPE_SECRET_KEY!,
  WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET!,
  PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
} as const;

// ============================================================================
// TRACING/OBSERVABILITY (optional but recommended)
// ============================================================================
export const TRACING_ENV = {
  LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY,
  LANGSMITH_PROJECT: process.env.LANGSMITH_PROJECT || 'sako-composer',
} as const;

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

type EnvConfig = Record<string, string | undefined>;

export class EnvValidationError extends Error {
  constructor(
    public readonly missingVars: string[],
    public readonly context: string
  ) {
    super(`Missing required environment variables for ${context}: ${missingVars.join(', ')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Validate that required env vars are set
 * Throws EnvValidationError if any are missing
 */
export function validateEnv(config: EnvConfig, context: string, required: string[]): void {
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new EnvValidationError(missing, context);
  }
}

/**
 * Get a required env var - throws if not set
 */
export function requireEnv(name: string, context?: string): string {
  const value = process.env[name];
  if (!value) {
    throw new EnvValidationError([name], context || 'environment');
  }
  return value;
}

/**
 * Check if a feature is available based on env vars
 * Returns { available: true } or { available: false, missing: string[] }
 */
export function checkFeatureAvailability(
  requiredVars: string[]
): { available: true } | { available: false; missing: string[] } {
  const missing = requiredVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    return { available: false, missing };
  }
  
  return { available: true };
}

// ============================================================================
// FEATURE AVAILABILITY CHECKS
// ============================================================================

export function isEvidenceResearchAvailable() {
  return checkFeatureAvailability(['TAVILY_API_KEY']);
}

export function isVideoGenerationAvailable() {
  const voiceAvailable = !!process.env.ELEVENLABS_API_KEY;
  const renderAvailable = !!(
    process.env.CREATOMATE_API_KEY ||
    process.env.SHOTSTACK_API_KEY ||
    process.env.REMOTION_LAMBDA_FUNCTION_NAME
  );
  
  if (!voiceAvailable) {
    return { available: false, missing: ['ELEVENLABS_API_KEY'] };
  }
  if (!renderAvailable) {
    return { 
      available: false, 
      missing: ['CREATOMATE_API_KEY or SHOTSTACK_API_KEY or REMOTION_LAMBDA_FUNCTION_NAME'] 
    };
  }
  
  return { available: true };
}

export function isCompetitorIntelligenceAvailable() {
  // Competitor intelligence now uses Tavily search instead of G2 API
  return checkFeatureAvailability(['TAVILY_API_KEY']);
}

export function isHubSpotAvailable() {
  return checkFeatureAvailability([
    'HUBSPOT_CLIENT_ID',
    'HUBSPOT_CLIENT_SECRET',
    'HUBSPOT_REDIRECT_URI'
  ]);
}

export function isWebflowAvailable() {
  return checkFeatureAvailability([
    'WEBFLOW_CLIENT_ID',
    'WEBFLOW_CLIENT_SECRET',
    'WEBFLOW_REDIRECT_URI'
  ]);
}

export function isFigmaAvailable() {
  return checkFeatureAvailability([
    'FIGMA_CLIENT_ID',
    'FIGMA_CLIENT_SECRET',
    'FIGMA_REDIRECT_URI'
  ]);
}

export function isSakoEscalationAvailable() {
  return checkFeatureAvailability([
    'SAKO_V1_API_URL',
    'SAKO_V1_API_KEY'
  ]);
}

export function isStripeAvailable() {
  return checkFeatureAvailability([
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  ]);
}
