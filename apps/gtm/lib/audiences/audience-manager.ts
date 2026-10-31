/**
 * Audience Manager (Phase 1.4)
 * 
 * Structured audience profiles with AI-powered suggestions.
 */

import { generateObject } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { MODELS } from '@/lib/ai/ai-sdk-client'

export interface AudienceProfile {
  id: string
  workspace_id: string
  name: string
  description?: string
  
  // Demographics
  demographics: {
    ageRange?: { min: number; max: number }
    gender?: 'all' | 'male' | 'female' | 'other'
    locations?: string[]
    languages?: string[]
    income?: string
    education?: string
  }
  
  // Professional
  professional: {
    jobTitles?: string[]
    industries?: string[]
    companySize?: string
    seniority?: string
    department?: string
  }
  
  // Psychographics
  psychographics: {
    interests?: string[]
    values?: string[]
    challenges?: string[]
    goals?: string[]
    motivations?: string[]
  }
  
  // Behavioral
  behavioral: {
    buyingBehavior?: string
    mediaConsumption?: string[]
    devicePreferences?: string[]
    contentPreferences?: string[]
  }
  
  // Messaging
  messaging: {
    painPoints: string[]
    desiredOutcomes: string[]
    objections?: string[]
    preferredTone?: string
    keyMessages?: string[]
  }
  
  // Meta
  source?: 'manual' | 'ai_generated' | 'imported' | 'hubspot'
  hubspot_list_id?: string
  is_default: boolean
  created_at: string
  updated_at: string
}

const audienceAnalysisSchema = z.object({
  demographics: z.object({
    age_range: z.object({ min: z.number(), max: z.number() }).optional(),
    locations: z.array(z.string()).optional(),
    income_level: z.string().optional(),
  }),
  professional: z.object({
    job_titles: z.array(z.string()),
    industries: z.array(z.string()),
    company_sizes: z.array(z.string()),
    seniority_levels: z.array(z.string()),
  }),
  psychographics: z.object({
    interests: z.array(z.string()),
    values: z.array(z.string()),
    challenges: z.array(z.string()),
    goals: z.array(z.string()),
  }),
  messaging: z.object({
    pain_points: z.array(z.string()),
    desired_outcomes: z.array(z.string()),
    likely_objections: z.array(z.string()),
    recommended_tone: z.string(),
    key_messages: z.array(z.string()),
  }),
  persona_name: z.string(),
  persona_description: z.string(),
})

/**
 * Create a new audience profile
 */
export async function createAudienceProfile(
  workspaceId: string,
  profile: Omit<AudienceProfile, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>
): Promise<AudienceProfile | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('audiences')
    .insert({
      workspace_id: workspaceId,
      name: profile.name,
      description: profile.description,
      demographics: profile.demographics,
      professional: profile.professional,
      psychographics: profile.psychographics,
      behavioral: profile.behavioral,
      messaging: profile.messaging,
      source: profile.source || 'manual',
      hubspot_list_id: profile.hubspot_list_id,
      is_default: profile.is_default,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create audience profile:', error)
    return null
  }

  return data as AudienceProfile
}

/**
 * Generate audience profile from description
 */
export async function generateAudienceProfile(
  description: string,
  options?: {
    industry?: string
    product?: string
  }
): Promise<Omit<AudienceProfile, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>> {
  const { object } = await generateObject({
    model: MODELS.REASONING,
    schema: audienceAnalysisSchema,
    system: `You are an expert audience researcher and marketing strategist.

${options?.industry ? `Industry context: ${options.industry}` : ''}
${options?.product ? `Product/service: ${options.product}` : ''}

Create a detailed audience profile based on the description. Include:
- Specific job titles and roles (not generic)
- Real industries and company sizes
- Specific pain points relevant to their role
- Goals that your product can help achieve
- Common objections to address in marketing`,
    prompt: `Create a detailed audience profile for: ${description}`,
    temperature: 0.5,
  })

  return {
    name: (object as any).persona_name,
    description: (object as any).persona_description,
    demographics: {
      ageRange: (object as any).demographics.age_range
        ? { min: (object as any).demographics.age_range.min, max: (object as any).demographics.age_range.max }
        : undefined,
      locations: (object as any).demographics.locations,
      income: (object as any).demographics.income_level,
    },
    professional: {
      jobTitles: (object as any).professional.job_titles,
      industries: (object as any).professional.industries,
      companySize: (object as any).professional.company_sizes.join(', '),
      seniority: (object as any).professional.seniority_levels.join(', '),
    },
    psychographics: {
      interests: (object as any).psychographics.interests,
      values: (object as any).psychographics.values,
      challenges: (object as any).psychographics.challenges,
      goals: (object as any).psychographics.goals,
    },
    behavioral: {},
    messaging: {
      painPoints: (object as any).messaging.pain_points,
      desiredOutcomes: (object as any).messaging.desired_outcomes,
      objections: (object as any).messaging.likely_objections,
      preferredTone: (object as any).messaging.recommended_tone,
      keyMessages: (object as any).messaging.key_messages,
    },
    source: 'ai_generated',
    is_default: false,
  }
}

/**
 * Get audiences for a workspace
 */
export async function getWorkspaceAudiences(workspaceId: string): Promise<AudienceProfile[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('audiences')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('is_default', { ascending: false })
    .order('name')

  if (error) {
    console.error('Failed to get audiences:', error)
    return []
  }

  return data as AudienceProfile[]
}

/**
 * Get audience by ID
 */
export async function getAudienceById(audienceId: string): Promise<AudienceProfile | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('audiences')
    .select('*')
    .eq('id', audienceId)
    .single()

  if (error) {
    return null
  }

  return data as AudienceProfile
}

/**
 * Update audience profile
 */
export async function updateAudienceProfile(
  audienceId: string,
  updates: Partial<AudienceProfile>
): Promise<AudienceProfile | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('audiences')
    .update({
      name: updates.name,
      description: updates.description,
      demographics: updates.demographics,
      professional: updates.professional,
      psychographics: updates.psychographics,
      behavioral: updates.behavioral,
      messaging: updates.messaging,
      updated_at: new Date().toISOString(),
    })
    .eq('id', audienceId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update audience:', error)
    return null
  }

  return data as AudienceProfile
}

/**
 * Delete audience profile
 */
export async function deleteAudienceProfile(audienceId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('audiences')
    .delete()
    .eq('id', audienceId)

  return !error
}

/**
 * Set default audience for workspace
 */
export async function setDefaultAudience(workspaceId: string, audienceId: string): Promise<boolean> {
  const supabase = createServiceClient()

  // Unset current default
  await supabase
    .from('audiences')
    .update({ is_default: false })
    .eq('workspace_id', workspaceId)
    .eq('is_default', true)

  // Set new default
  const { error } = await supabase
    .from('audiences')
    .update({ is_default: true })
    .eq('id', audienceId)

  return !error
}

/**
 * Format audience for prompt
 */
export function formatAudienceForPrompt(audience: AudienceProfile): string {
  const parts: string[] = []

  parts.push(`## TARGET AUDIENCE: ${audience.name}`)
  
  if (audience.description) {
    parts.push(audience.description)
  }

  // Professional
  if (audience.professional.jobTitles?.length) {
    parts.push(`\nJob Titles: ${audience.professional.jobTitles.join(', ')}`)
  }
  if (audience.professional.industries?.length) {
    parts.push(`Industries: ${audience.professional.industries.join(', ')}`)
  }
  if (audience.professional.companySize) {
    parts.push(`Company Size: ${audience.professional.companySize}`)
  }

  // Psychographics
  if (audience.psychographics.challenges?.length) {
    parts.push(`\nChallenges they face:`)
    for (const challenge of audience.psychographics.challenges) {
      parts.push(`- ${challenge}`)
    }
  }
  if (audience.psychographics.goals?.length) {
    parts.push(`\nGoals:`)
    for (const goal of audience.psychographics.goals) {
      parts.push(`- ${goal}`)
    }
  }

  // Messaging
  if (audience.messaging.painPoints?.length) {
    parts.push(`\nPain points to address:`)
    for (const pain of audience.messaging.painPoints) {
      parts.push(`- ${pain}`)
    }
  }
  if (audience.messaging.desiredOutcomes?.length) {
    parts.push(`\nDesired outcomes:`)
    for (const outcome of audience.messaging.desiredOutcomes) {
      parts.push(`- ${outcome}`)
    }
  }
  if (audience.messaging.preferredTone) {
    parts.push(`\nPreferred tone: ${audience.messaging.preferredTone}`)
  }

  return parts.join('\n')
}

/**
 * Suggest audiences based on product/service
 */
export async function suggestAudiences(
  productDescription: string,
  count: number = 3
): Promise<Array<{ name: string; description: string }>> {
  const { object } = await generateObject({
    model: MODELS.FAST,
    schema: z.object({
      suggestions: z.array(z.object({
        name: z.string(),
        description: z.string(),
      })),
    }),
    system: 'You are a marketing strategist suggesting target audiences.',
    prompt: `Suggest ${count} distinct target audiences for this product/service:\n\n${productDescription}`,
    temperature: 0.7,
  })

  return (object as any).suggestions
}
