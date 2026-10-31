/**
 * Setup Status API (Jan 2026)
 * 
 * Returns the configuration status of all environment variables
 * and service connections. Useful for debugging setup issues.
 * 
 * GET /api/setup/status
 */

import { NextResponse } from 'next/server'

interface ConfigStatus {
  name: string
  configured: boolean
  required: boolean
  category: 'core' | 'ai' | 'integration' | 'billing' | 'media' | 'observability'
  description: string
}

interface ServiceHealth {
  name: string
  healthy: boolean
  error?: string
}

interface SetupStatusResponse {
  ready: boolean
  environment: string
  timestamp: string
  config: ConfigStatus[]
  services: ServiceHealth[]
  summary: {
    requiredConfigured: number
    requiredTotal: number
    optionalConfigured: number
    optionalTotal: number
    servicesHealthy: number
    servicesTotal: number
  }
}

export async function GET(): Promise<NextResponse<SetupStatusResponse>> {
  const env = process.env.NODE_ENV || 'development'
  
  // Check all configuration
  const config: ConfigStatus[] = [
    // Core (Required)
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      required: true,
      category: 'core',
      description: 'Supabase project URL',
    },
    {
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      configured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      required: true,
      category: 'core',
      description: 'Supabase anonymous key',
    },
    {
      name: 'SUPABASE_SERVICE_ROLE_KEY',
      configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      required: true,
      category: 'core',
      description: 'Supabase service role key (server-side only)',
    },
    {
      name: 'ENCRYPTION_SECRET',
      configured: !!process.env.ENCRYPTION_SECRET,
      required: true,
      category: 'core',
      description: 'Encryption key for OAuth tokens',
    },
    
    // AI (Required for AI features)
    {
      name: 'OPENROUTER_API_KEY',
      configured: !!process.env.OPENROUTER_API_KEY,
      required: true,
      category: 'ai',
      description: 'OpenRouter API key (unified AI routing)',
    },
    {
      name: 'OPENROUTER_SITE_URL',
      configured: !!process.env.OPENROUTER_SITE_URL,
      required: false,
      category: 'ai',
      description: 'OpenRouter site URL (for rankings)',
    },
    {
      name: 'OPENROUTER_SYSTEM_PROMPT',
      configured: !!process.env.OPENROUTER_SYSTEM_PROMPT,
      required: false,
      category: 'ai',
      description: 'Global system prompt for all AI calls',
    },
    {
      name: 'OPENAI_API_KEY',
      configured: !!process.env.OPENAI_API_KEY,
      required: false,
      category: 'ai',
      description: 'OpenAI API key (for LangGraph only)',
    },
    
    // Media (Optional)
    {
      name: 'REPLICATE_API_TOKEN',
      configured: !!process.env.REPLICATE_API_TOKEN,
      required: false,
      category: 'media',
      description: 'Replicate API token (image generation)',
    },
    {
      name: 'ELEVENLABS_API_KEY',
      configured: !!process.env.ELEVENLABS_API_KEY,
      required: false,
      category: 'media',
      description: 'ElevenLabs API key (voiceover generation)',
    },
    {
      name: 'CREATOMATE_API_KEY',
      configured: !!process.env.CREATOMATE_API_KEY,
      required: false,
      category: 'media',
      description: 'Creatomate API key (video rendering)',
    },
    {
      name: 'SHOTSTACK_API_KEY',
      configured: !!process.env.SHOTSTACK_API_KEY,
      required: false,
      category: 'media',
      description: 'Shotstack API key (video rendering)',
    },
    
    // Rate Limiting (Production)
    {
      name: 'UPSTASH_REDIS_REST_URL',
      configured: !!process.env.UPSTASH_REDIS_REST_URL,
      required: env === 'production',
      category: 'core',
      description: 'Upstash Redis URL (rate limiting)',
    },
    {
      name: 'UPSTASH_REDIS_REST_TOKEN',
      configured: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      required: env === 'production',
      category: 'core',
      description: 'Upstash Redis token (rate limiting)',
    },
    
    // Integrations (Optional)
    {
      name: 'HUBSPOT_CLIENT_ID',
      configured: !!process.env.HUBSPOT_CLIENT_ID,
      required: false,
      category: 'integration',
      description: 'HubSpot OAuth client ID',
    },
    {
      name: 'WEBFLOW_CLIENT_ID',
      configured: !!process.env.WEBFLOW_CLIENT_ID,
      required: false,
      category: 'integration',
      description: 'Webflow OAuth client ID',
    },
    {
      name: 'FIGMA_CLIENT_ID',
      configured: !!process.env.FIGMA_CLIENT_ID,
      required: false,
      category: 'integration',
      description: 'Figma OAuth client ID',
    },
    {
      name: 'FRAMER_CLIENT_ID',
      configured: !!process.env.FRAMER_CLIENT_ID,
      required: false,
      category: 'integration',
      description: 'Framer OAuth client ID',
    },
    {
      name: 'TAVILY_API_KEY',
      configured: !!process.env.TAVILY_API_KEY,
      required: false,
      category: 'integration',
      description: 'Tavily API key (evidence research)',
    },
    
    // Billing (Optional)
    {
      name: 'STRIPE_SECRET_KEY',
      configured: !!process.env.STRIPE_SECRET_KEY,
      required: false,
      category: 'billing',
      description: 'Stripe secret key',
    },
    {
      name: 'STRIPE_WEBHOOK_SECRET',
      configured: !!process.env.STRIPE_WEBHOOK_SECRET,
      required: false,
      category: 'billing',
      description: 'Stripe webhook signing secret',
    },
    
    // Observability (Optional)
    {
      name: 'LANGSMITH_API_KEY',
      configured: !!process.env.LANGSMITH_API_KEY,
      required: false,
      category: 'observability',
      description: 'LangSmith API key (AI tracing)',
    },
  ]
  
  // Check service health
  const services: ServiceHealth[] = []
  
  // Check Supabase
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        method: 'HEAD',
        headers: {
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        },
        signal: AbortSignal.timeout(5000),
      })
      services.push({
        name: 'supabase',
        healthy: response.ok || response.status === 400,
      })
    } catch (error) {
      services.push({
        name: 'supabase',
        healthy: false,
        error: (error as Error).message,
      })
    }
  } else {
    services.push({
      name: 'supabase',
      healthy: false,
      error: 'Not configured',
    })
  }
  
  // Check OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      })
      services.push({
        name: 'openrouter',
        healthy: response.ok,
      })
    } catch (error) {
      services.push({
        name: 'openrouter',
        healthy: false,
        error: (error as Error).message,
      })
    }
  } else {
    services.push({
      name: 'openrouter',
      healthy: false,
      error: 'Not configured',
    })
  }
  
  // Check Upstash Redis
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const response = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: {
          'Authorization': `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
        signal: AbortSignal.timeout(5000),
      })
      services.push({
        name: 'upstash_redis',
        healthy: response.ok,
      })
    } catch (error) {
      services.push({
        name: 'upstash_redis',
        healthy: false,
        error: (error as Error).message,
      })
    }
  } else {
    services.push({
      name: 'upstash_redis',
      healthy: false,
      error: 'Not configured',
    })
  }
  
  // Calculate summary
  const requiredConfigs = config.filter(c => c.required)
  const optionalConfigs = config.filter(c => !c.required)
  
  const summary = {
    requiredConfigured: requiredConfigs.filter(c => c.configured).length,
    requiredTotal: requiredConfigs.length,
    optionalConfigured: optionalConfigs.filter(c => c.configured).length,
    optionalTotal: optionalConfigs.length,
    servicesHealthy: services.filter(s => s.healthy).length,
    servicesTotal: services.length,
  }
  
  // App is ready if all required config is set
  const ready = summary.requiredConfigured === summary.requiredTotal
  
  return NextResponse.json({
    ready,
    environment: env,
    timestamp: new Date().toISOString(),
    config,
    services,
    summary,
  })
}
