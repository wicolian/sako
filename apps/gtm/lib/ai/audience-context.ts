/**
 * Audience Context (Phase 1.5)
 * 
 * Structured audiencimport { Database } from '@/lib/supabase/types'

e/persona management for targeted messaging.
 * "One brand, many voices" - adapt content for different audience segments.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface Audience {
  id: string
  workspace_id: string
  name: string
  title?: string
  description?: string
  seniority?: string
  department?: string
  company_size?: string
  industry?: string
  pain_points: string[]
  goals: string[]
  buying_triggers: string[]
  objections: string[]
  decision_criteria: string[]
  language_style: string
  jargon_level: string
  formality_level: string
  tone_adjustments: Record<string, unknown>
  preferred_content_types: string[]
  preferred_channels: string[]
  demographic_notes?: string
  competitive_context?: string
  success_metrics?: string
  is_primary: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Get audience by ID
 */
export async function getAudience(audienceId: string): Promise<Audience | null> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('audiences')
    .select('*')
    .eq('id', audienceId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as Audience
}

/**
 * Get primary audience for a workspace
 */
export async function getPrimaryAudience(workspaceId: string): Promise<Audience | null> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('audiences')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_primary', true)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as Audience
}

/**
 * Get all active audiences for a workspace
 */
export async function getWorkspaceAudiences(workspaceId: string): Promise<Audience[]> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('audiences')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .order('name')

  if (error) {
    console.error('Failed to fetch audiences:', error)
    return []
  }

  return (data || []) as Audience[]
}

/**
 * Format audience context as a prompt section
 */
export function formatAudiencePrompt(audience: Audience): string {
  const sections: string[] = []

  // Core identity
  sections.push(`## TARGET AUDIENCE: ${audience.name}`)
  if (audience.title) {
    sections.push(`Role: ${audience.title}`)
  }
  if (audience.description) {
    sections.push(`Profile: ${audience.description}`)
  }

  // Demographics
  const demographics: string[] = []
  if (audience.seniority) demographics.push(`Seniority: ${audience.seniority}`)
  if (audience.department) demographics.push(`Department: ${audience.department}`)
  if (audience.company_size) demographics.push(`Company Size: ${audience.company_size}`)
  if (audience.industry) demographics.push(`Industry: ${audience.industry}`)
  
  if (demographics.length > 0) {
    sections.push(`
## DEMOGRAPHICS
${demographics.join('\n')}`)
  }

  // Pain points
  if (audience.pain_points.length > 0) {
    sections.push(`
## PAIN POINTS (address these directly)
${audience.pain_points.map(p => `• ${p}`).join('\n')}`)
  }

  // Goals
  if (audience.goals.length > 0) {
    sections.push(`
## GOALS (what they want to achieve)
${audience.goals.map(g => `• ${g}`).join('\n')}`)
  }

  // Buying triggers
  if (audience.buying_triggers.length > 0) {
    sections.push(`
## BUYING TRIGGERS (what motivates action)
${audience.buying_triggers.map(t => `• ${t}`).join('\n')}`)
  }

  // Objections
  if (audience.objections.length > 0) {
    sections.push(`
## COMMON OBJECTIONS (address proactively)
${audience.objections.map(o => `• ${o}`).join('\n')}`)
  }

  // Communication style
  sections.push(`
## COMMUNICATION STYLE
- Language: ${audience.language_style}
- Jargon Level: ${audience.jargon_level}
- Formality: ${audience.formality_level}`)

  // Tone adjustments
  if (Object.keys(audience.tone_adjustments).length > 0) {
    sections.push(`
## TONE ADJUSTMENTS
${Object.entries(audience.tone_adjustments).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`)
  }

  // Additional context
  if (audience.competitive_context) {
    sections.push(`
## COMPETITIVE CONTEXT
${audience.competitive_context}`)
  }

  if (audience.success_metrics) {
    sections.push(`
## HOW THEY MEASURE SUCCESS
${audience.success_metrics}`)
  }

  return sections.join('\n')
}

/**
 * Get combined audience context for AI prompts
 * Combines brand context with audience context
 */
export async function getAudienceContext(
  workspaceId: string,
  audienceId?: string
): Promise<string | null> {
  const audience = audienceId 
    ? await getAudience(audienceId)
    : await getPrimaryAudience(workspaceId)

  if (!audience) {
    return null
  }

  return formatAudiencePrompt(audience)
}

/**
 * Create a new audience
 */
export async function createAudience(
  workspaceId: string,
  audienceData: Partial<Audience>
): Promise<Audience | null> {
  const supabase = createServiceClient()

  // If this is marked as primary, unset other primary audiences
  if (audienceData.is_primary) {
    await supabase
      .from('audiences')
      .update({ is_primary: false })
      .eq('workspace_id', workspaceId)
  }

  const { data, error } = await supabase
    .from('audiences')
    .insert({
      workspace_id: workspaceId,
      name: audienceData.name || 'New Audience',
      title: audienceData.title,
      description: audienceData.description,
      seniority: audienceData.seniority,
      department: audienceData.department,
      company_size: audienceData.company_size,
      industry: audienceData.industry,
      pain_points: audienceData.pain_points || [],
      goals: audienceData.goals || [],
      buying_triggers: audienceData.buying_triggers || [],
      objections: audienceData.objections || [],
      decision_criteria: audienceData.decision_criteria || [],
      language_style: audienceData.language_style || 'professional',
      jargon_level: audienceData.jargon_level || 'moderate',
      formality_level: audienceData.formality_level || 'professional',
      tone_adjustments: audienceData.tone_adjustments || {},
      preferred_content_types: audienceData.preferred_content_types || [],
      preferred_channels: audienceData.preferred_channels || [],
      demographic_notes: audienceData.demographic_notes,
      competitive_context: audienceData.competitive_context,
      success_metrics: audienceData.success_metrics,
      is_primary: audienceData.is_primary || false,
      is_active: true,
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Failed to create audience:', error)
    return null
  }

  return data as Audience
}

/**
 * Update an existing audience
 */
export async function updateAudience(
  audienceId: string,
  audienceData: Partial<Audience>
): Promise<Audience | null> {
  const supabase = createServiceClient()

  // If setting as primary, unset other primary audiences first
  if (audienceData.is_primary) {
    const { data: existing } = await supabase
      .from('audiences')
      .select('workspace_id')
      .eq('id', audienceId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('audiences')
        .update({ is_primary: false })
        .eq('workspace_id', existing.workspace_id)
        .neq('id', audienceId)
    }
  }

  const { data, error } = await supabase
    .from('audiences')
    .update(audienceData)
    .eq('id', audienceId)
    .select()
    .maybeSingle()

  if (error) {
    console.error('Failed to update audience:', error)
    return null
  }

  return data as Audience
}

/**
 * Delete an audience
 */
export async function deleteAudience(audienceId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('audiences')
    .delete()
    .eq('id', audienceId)

  if (error) {
    console.error('Failed to delete audience:', error)
    return false
  }

  return true
}

/**
 * Get audience suggestions based on industry and role
 */
export function getAudienceTemplate(industry: string, role: string): Partial<Audience> {
  const templates: Record<string, Record<string, Partial<Audience>>> = {
    saas: {
      cto: {
        name: 'Enterprise CTO',
        title: 'Chief Technology Officer',
        seniority: 'C-Level',
        department: 'Engineering',
        company_size: 'Enterprise',
        pain_points: [
          'Managing technical debt while shipping new features',
          'Hiring and retaining top engineering talent',
          'Ensuring security and compliance',
          'Balancing innovation with stability',
        ],
        goals: [
          'Reduce time-to-market for new features',
          'Improve system reliability and uptime',
          'Build a world-class engineering team',
          'Stay ahead of technological trends',
        ],
        buying_triggers: [
          'Competitor adoption of new technology',
          'Major security incident or near-miss',
          'Board pressure on technical metrics',
          'Scaling challenges',
        ],
        objections: [
          'Integration complexity with existing systems',
          'Learning curve for the team',
          'Vendor lock-in concerns',
          'Total cost of ownership',
        ],
        language_style: 'technical',
        jargon_level: 'heavy',
        formality_level: 'professional',
      },
      marketing_leader: {
        name: 'VP Marketing',
        title: 'VP of Marketing / CMO',
        seniority: 'VP',
        department: 'Marketing',
        company_size: 'Mid-Market',
        pain_points: [
          'Proving marketing ROI to the board',
          'Generating quality leads at scale',
          'Standing out in a crowded market',
          'Aligning with sales on lead quality',
        ],
        goals: [
          'Hit pipeline and revenue targets',
          'Build a recognized brand',
          'Create repeatable, scalable campaigns',
          'Enable sales with quality content',
        ],
        buying_triggers: [
          'Quarter-end pressure to hit targets',
          'Competitor launching new campaigns',
          'New product launch needs',
          'Expansion into new markets',
        ],
        objections: [
          'Already have a similar tool',
          'Team doesn\'t have bandwidth to learn new tool',
          'Budget constraints this quarter',
          'Need to see proven results first',
        ],
        language_style: 'business',
        jargon_level: 'moderate',
        formality_level: 'professional',
      },
    },
  }

  return templates[industry.toLowerCase()]?.[role.toLowerCase()] || {}
}
