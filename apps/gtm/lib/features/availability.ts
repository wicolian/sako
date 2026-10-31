/**
 * Feature Availability Checker (Jan 2026)
 * 
 * Checks which features are available based on configured API keys.
 * Returns clear status for each feature so UI can show appropriate messages.
 */

export interface FeatureStatus {
  available: boolean;
  reason?: string;
  requiredEnvVar?: string;
  docsUrl?: string;
}

export interface FeatureAvailability {
  // Core features (require Supabase + OpenAI)
  core: {
    authentication: FeatureStatus;
    campaigns: FeatureStatus;
    aiGeneration: FeatureStatus;
    brandImport: FeatureStatus;
  };
  // Video features
  video: {
    scriptGeneration: FeatureStatus;
    voiceover: FeatureStatus;
    assembly: FeatureStatus;
  };
  // Research features
  research: {
    evidenceResearch: FeatureStatus;
    competitorIntel: FeatureStatus;
  };
  // Integration features
  integrations: {
    hubspot: FeatureStatus;
    figma: FeatureStatus;
    webflow: FeatureStatus;
  };
}

/**
 * Check if an environment variable is set and non-empty
 */
function hasEnvVar(name: string): boolean {
  const value = process.env[name];
  return !!value && value.trim().length > 0;
}

/**
 * Get the availability status for all features
 * Note: This function checks env vars at runtime, not build time
 */
export function getFeatureAvailability(): FeatureAvailability {
  const hasSupabase = hasEnvVar('NEXT_PUBLIC_SUPABASE_URL') && hasEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const hasSupabaseService = hasEnvVar('SUPABASE_SERVICE_ROLE_KEY') || hasEnvVar('SUPABASE_URL'); // SUPABASE_URL is also used
  const hasOpenRouter = hasEnvVar('OPENROUTER_API_KEY');
  const hasElevenLabs = hasEnvVar('ELEVENLABS_API_KEY');
  const hasCreatomate = hasEnvVar('CREATOMATE_API_KEY');
  const hasShotstack = hasEnvVar('SHOTSTACK_API_KEY');
  const hasRemotion = hasEnvVar('REMOTION_LAMBDA_FUNCTION_NAME');
  const hasTavily = hasEnvVar('TAVILY_API_KEY');
  // G2_API_KEY no longer required - competitor intel now uses Tavily
  const hasHubspot = hasEnvVar('HUBSPOT_CLIENT_ID') && hasEnvVar('HUBSPOT_CLIENT_SECRET');
  const hasFigma = hasEnvVar('CODE_TO_DESIGN_API_KEY');
  const hasWebflow = hasEnvVar('WEBFLOW_CLIENT_ID') && hasEnvVar('WEBFLOW_CLIENT_SECRET');
  
  return {
    core: {
      authentication: {
        available: hasSupabase,
        reason: hasSupabase ? undefined : 'Supabase credentials not configured',
        requiredEnvVar: 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY',
        docsUrl: 'https://supabase.com/docs/guides/getting-started',
      },
      campaigns: {
        available: hasSupabase && hasOpenRouter,
        reason: !hasSupabase 
          ? 'Supabase not configured' 
          : !hasOpenRouter 
          ? 'OpenRouter API key not configured' 
          : undefined,
        requiredEnvVar: 'OPENROUTER_API_KEY',
        docsUrl: 'https://openrouter.ai/keys',
      },
      aiGeneration: {
        available: hasOpenRouter,
        reason: hasOpenRouter ? undefined : 'OpenRouter API key not configured',
        requiredEnvVar: 'OPENROUTER_API_KEY',
        docsUrl: 'https://openrouter.ai/keys',
      },
      brandImport: {
        available: hasOpenRouter,
        reason: hasOpenRouter ? undefined : 'OpenRouter API key required for brand analysis',
        requiredEnvVar: 'OPENROUTER_API_KEY',
      },
    },
    video: {
      scriptGeneration: {
        available: hasOpenRouter,
        reason: hasOpenRouter ? undefined : 'OpenRouter API key required for script generation',
        requiredEnvVar: 'OPENROUTER_API_KEY',
      },
      voiceover: {
        available: hasElevenLabs,
        reason: hasElevenLabs ? undefined : 'ElevenLabs API key not configured',
        requiredEnvVar: 'ELEVENLABS_API_KEY',
        docsUrl: 'https://elevenlabs.io/docs/api-reference/get-voices',
      },
      assembly: {
        available: hasCreatomate || hasShotstack || hasRemotion,
        reason: (hasCreatomate || hasShotstack || hasRemotion) 
          ? undefined 
          : 'Video rendering requires Creatomate, Shotstack, or Remotion Lambda',
        requiredEnvVar: 'CREATOMATE_API_KEY, SHOTSTACK_API_KEY, or REMOTION_LAMBDA_FUNCTION_NAME',
        docsUrl: 'https://creatomate.com/docs/api',
      },
    },
    research: {
      evidenceResearch: {
        available: hasTavily,
        reason: hasTavily ? undefined : 'Tavily API key not configured for evidence research',
        requiredEnvVar: 'TAVILY_API_KEY',
        docsUrl: 'https://tavily.com/docs',
      },
      competitorIntel: {
        available: hasTavily,
        reason: hasTavily ? undefined : 'Tavily API key not configured for competitor intelligence (searches G2, Capterra, LinkedIn)',
        requiredEnvVar: 'TAVILY_API_KEY',
        docsUrl: 'https://tavily.com/docs',
      },
    },
    integrations: {
      hubspot: {
        available: hasHubspot,
        reason: hasHubspot ? undefined : 'HubSpot OAuth not configured',
        requiredEnvVar: 'HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET',
        docsUrl: 'https://developers.hubspot.com/docs/api/oauth-quickstart-guide',
      },
      figma: {
        available: hasFigma,
        reason: hasFigma ? undefined : 'Code to Design API key not configured',
        requiredEnvVar: 'CODE_TO_DESIGN_API_KEY',
      },
      webflow: {
        available: hasWebflow,
        reason: hasWebflow ? undefined : 'Webflow OAuth not configured',
        requiredEnvVar: 'WEBFLOW_CLIENT_ID, WEBFLOW_CLIENT_SECRET',
      },
    },
  };
}

/**
 * Check if a specific feature is available
 */
export function isFeatureAvailable(feature: string): boolean {
  const availability = getFeatureAvailability();
  
  const featurePaths: Record<string, boolean> = {
    'core.authentication': availability.core.authentication.available,
    'core.campaigns': availability.core.campaigns.available,
    'core.aiGeneration': availability.core.aiGeneration.available,
    'core.brandImport': availability.core.brandImport.available,
    'video.scriptGeneration': availability.video.scriptGeneration.available,
    'video.voiceover': availability.video.voiceover.available,
    'video.assembly': availability.video.assembly.available,
    'research.evidenceResearch': availability.research.evidenceResearch.available,
    'research.competitorIntel': availability.research.competitorIntel.available,
    'integrations.hubspot': availability.integrations.hubspot.available,
    'integrations.figma': availability.integrations.figma.available,
    'integrations.webflow': availability.integrations.webflow.available,
  };
  
  return featurePaths[feature] ?? false;
}

/**
 * Get a summary of unavailable features
 */
export function getUnavailableFeatures(): Array<{
  feature: string;
  reason: string;
  requiredEnvVar?: string;
}> {
  const availability = getFeatureAvailability();
  const unavailable: Array<{
    feature: string;
    reason: string;
    requiredEnvVar?: string;
  }> = [];
  
  // Check core
  if (!availability.core.aiGeneration.available) {
    unavailable.push({
      feature: 'AI Generation',
      reason: availability.core.aiGeneration.reason || 'Not configured',
      requiredEnvVar: availability.core.aiGeneration.requiredEnvVar,
    });
  }
  
  // Check video
  if (!availability.video.voiceover.available) {
    unavailable.push({
      feature: 'AI Voiceover',
      reason: availability.video.voiceover.reason || 'Not configured',
      requiredEnvVar: availability.video.voiceover.requiredEnvVar,
    });
  }
  if (!availability.video.assembly.available) {
    unavailable.push({
      feature: 'Video Rendering',
      reason: availability.video.assembly.reason || 'Not configured',
      requiredEnvVar: availability.video.assembly.requiredEnvVar,
    });
  }
  
  // Check research
  if (!availability.research.evidenceResearch.available) {
    unavailable.push({
      feature: 'Evidence Research',
      reason: availability.research.evidenceResearch.reason || 'Not configured',
      requiredEnvVar: availability.research.evidenceResearch.requiredEnvVar,
    });
  }
  
  return unavailable;
}

/**
 * Get environment status for settings page
 */
export function getEnvStatus(): Record<string, { set: boolean; required: boolean; description: string }> {
  return {
    // Required
    NEXT_PUBLIC_SUPABASE_URL: {
      set: hasEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
      required: true,
      description: 'Supabase project URL',
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      set: hasEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      required: true,
      description: 'Supabase anonymous key',
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      set: hasEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
      required: true,
      description: 'Supabase service role key (for server operations)',
    },
    OPENROUTER_API_KEY: {
      set: hasEnvVar('OPENROUTER_API_KEY'),
      required: true,
      description: 'OpenRouter API key for AI generation',
    },
    // Optional but enhance functionality
    OPENAI_API_KEY: {
      set: hasEnvVar('OPENAI_API_KEY'),
      required: false,
      description: 'OpenAI API key (optional, for LangGraph pipelines only)',
    },
    ELEVENLABS_API_KEY: {
      set: hasEnvVar('ELEVENLABS_API_KEY'),
      required: false,
      description: 'ElevenLabs API key for AI voiceovers',
    },
    CREATOMATE_API_KEY: {
      set: hasEnvVar('CREATOMATE_API_KEY'),
      required: false,
      description: 'Creatomate API key for video rendering',
    },
    SHOTSTACK_API_KEY: {
      set: hasEnvVar('SHOTSTACK_API_KEY'),
      required: false,
      description: 'Shotstack API key (alternative video rendering)',
    },
    TAVILY_API_KEY: {
      set: hasEnvVar('TAVILY_API_KEY'),
      required: false,
      description: 'Tavily API key for evidence research and competitor intelligence',
    },
    HUBSPOT_CLIENT_ID: {
      set: hasEnvVar('HUBSPOT_CLIENT_ID'),
      required: false,
      description: 'HubSpot OAuth client ID',
    },
    HUBSPOT_CLIENT_SECRET: {
      set: hasEnvVar('HUBSPOT_CLIENT_SECRET'),
      required: false,
      description: 'HubSpot OAuth client secret',
    },
  };
}
