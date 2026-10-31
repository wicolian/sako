/**
 * Unified Context System
 * 
 * Builds comprehensive context for AI generation by combining:
 * - Brand voice and guidelines
 * - Target audience profiles
 * - Knowledge base items
 * - Project-specific settings
 * - Asset-level overrides
 * 
 * Implements hierarchy: Workspace Default → Project Settings → Asset Override
 */

import { createServiceClient } from '@/lib/supabase/service'
import { BrandContext, getBrandContext, formatBrandPrompt } from '@/lib/ai/brand-context'
import { AudienceProfile, getAudienceById, formatAudienceForPrompt } from '@/lib/audiences/audience-manager'

export interface UnifiedContext {
  // Brand context
  brand?: BrandContext
  brandPrompt?: string
  
  // Audience context
  audience?: AudienceProfile
  audiencePrompt?: string
  
  // Knowledge context
  knowledge?: Array<{ id: string; title: string; content: string }>
  knowledgePrompt?: string
  
  // Project-specific
  projectGoals?: string
  toneOverride?: string
  keywords?: { include: string[]; avoid: string[] }
  customInstructions?: string
  
  // Full combined prompt
  fullContextPrompt: string
}

export interface BuildContextOptions {
  workspaceId: string
  projectId?: string
  assetId?: string
  brandId?: string
  audienceId?: string
  knowledgeIds?: string[]
  includeKnowledge?: boolean
}

/**
 * Build unified context for AI generation
 */
export async function buildUnifiedContext(
  options: BuildContextOptions
): Promise<UnifiedContext> {
  const supabase = createServiceClient()
  const context: Partial<UnifiedContext> = {}
  const promptParts: string[] = []

  // Resolve IDs from hierarchy if asset/project provided
  let resolvedBrandId = options.brandId
  let resolvedAudienceId = options.audienceId
  let resolvedKnowledgeIds = options.knowledgeIds || []
  let projectGoals: string | undefined
  let toneOverride: string | undefined
  let keywordsInclude: string[] = []
  let keywordsAvoid: string[] = []
  let customInstructions: string | undefined

  // Get asset-level overrides
  if (options.assetId) {
    const { data: asset } = await supabase
      .from('project_assets')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('id', options.assetId)
      .single()

    if (asset) {
      const project = asset.project as Record<string, unknown>
      
      // Asset overrides take priority
      resolvedBrandId = asset.brand_id_override || (project?.brand_id as string) || resolvedBrandId
      resolvedAudienceId = asset.audience_id_override || (project?.audience_id as string) || resolvedAudienceId
      toneOverride = asset.tone_override || (project?.tone_override as string)
      customInstructions = asset.custom_instructions || (project?.custom_instructions as string)
      
      // Project-level settings
      if (project) {
        projectGoals = project.campaign_goals as string
        keywordsInclude = (project.keywords_include as string[]) || []
        keywordsAvoid = (project.keywords_avoid as string[]) || []
      }
    }
  }
  // Get project-level settings
  else if (options.projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', options.projectId)
      .single()

    if (project) {
      resolvedBrandId = resolvedBrandId || project.brand_id
      resolvedAudienceId = resolvedAudienceId || project.audience_id
      projectGoals = project.campaign_goals
      toneOverride = project.tone_override
      keywordsInclude = project.keywords_include || []
      keywordsAvoid = project.keywords_avoid || []
      customInstructions = project.custom_instructions
    }
  }

  // Get brand context
  if (resolvedBrandId) {
    const brand = await getBrandContext(options.workspaceId, resolvedBrandId)
    if (brand) {
      context.brand = brand
      context.brandPrompt = formatBrandPrompt(brand)
      promptParts.push('=== BRAND VOICE ===')
      promptParts.push(context.brandPrompt)
      promptParts.push('')
    }
  }

  // Get audience context
  if (resolvedAudienceId) {
    const audience = await getAudienceById(resolvedAudienceId)
    if (audience) {
      context.audience = audience
      context.audiencePrompt = formatAudienceForPrompt(audience)
      promptParts.push('=== TARGET AUDIENCE ===')
      promptParts.push(context.audiencePrompt)
      promptParts.push('')
    }
  }

  // Get knowledge items
  if (options.includeKnowledge !== false && resolvedKnowledgeIds.length > 0) {
    const { data: knowledgeItems } = await supabase
      .from('knowledge_items')
      .select('id, title, content')
      .in('id', resolvedKnowledgeIds)
      .eq('status', 'active')

    if (knowledgeItems && knowledgeItems.length > 0) {
      context.knowledge = knowledgeItems
      context.knowledgePrompt = knowledgeItems
        .map((item) => `[${item.title}]\n${item.content}`)
        .join('\n\n')
      promptParts.push('=== REFERENCE KNOWLEDGE ===')
      promptParts.push(context.knowledgePrompt)
      promptParts.push('')
    }
  }

  // Add project goals
  if (projectGoals) {
    context.projectGoals = projectGoals
    promptParts.push('=== CAMPAIGN GOALS ===')
    promptParts.push(projectGoals)
    promptParts.push('')
  }

  // Add tone override
  if (toneOverride) {
    context.toneOverride = toneOverride
    promptParts.push(`=== TONE ===\nWrite in a ${toneOverride} tone.`)
    promptParts.push('')
  }

  // Add keyword guidance
  if (keywordsInclude.length > 0 || keywordsAvoid.length > 0) {
    context.keywords = { include: keywordsInclude, avoid: keywordsAvoid }
    promptParts.push('=== KEYWORDS ===')
    if (keywordsInclude.length > 0) {
      promptParts.push(`Include these keywords: ${keywordsInclude.join(', ')}`)
    }
    if (keywordsAvoid.length > 0) {
      promptParts.push(`Avoid these words: ${keywordsAvoid.join(', ')}`)
    }
    promptParts.push('')
  }

  // Add custom instructions
  if (customInstructions) {
    context.customInstructions = customInstructions
    promptParts.push('=== ADDITIONAL INSTRUCTIONS ===')
    promptParts.push(customInstructions)
    promptParts.push('')
  }

  // Combine all parts into full context
  context.fullContextPrompt = promptParts.join('\n').trim()

  return context as UnifiedContext
}

/**
 * Format context for use in system prompt
 */
export function formatContextForPrompt(context: UnifiedContext): string {
  return context.fullContextPrompt || ''
}

/**
 * Get a summary of what context is available
 */
export function getContextSummary(context: UnifiedContext): {
  hasBrand: boolean
  hasAudience: boolean
  hasKnowledge: boolean
  hasProjectGoals: boolean
  hasToneOverride: boolean
  hasKeywords: boolean
  hasCustomInstructions: boolean
} {
  return {
    hasBrand: !!context.brand,
    hasAudience: !!context.audience,
    hasKnowledge: !!context.knowledge && context.knowledge.length > 0,
    hasProjectGoals: !!context.projectGoals,
    hasToneOverride: !!context.toneOverride,
    hasKeywords: !!context.keywords && (context.keywords.include.length > 0 || context.keywords.avoid.length > 0),
    hasCustomInstructions: !!context.customInstructions,
  }
}
