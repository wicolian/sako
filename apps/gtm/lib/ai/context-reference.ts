/**
 * Context Reference System
 * 
 * Parse and resolve @ references in prompts to inject context from
 * templates, components, snippets, brand voice, and audiences.
 */

import { createServiceClient } from '@/lib/supabase/service'

export type ReferenceType = 
  | 'template'
  | 'component'
  | 'snippet'
  | 'brand'
  | 'audience'

export interface Reference {
  type: ReferenceType
  id: string
  name: string
  content?: string
  metadata?: Record<string, unknown>
}

export interface ParsedReference {
  type: ReferenceType
  identifier: string // The name or ID after the colon
  fullMatch: string // The full @type:identifier match
  startIndex: number
  endIndex: number
}

export interface ResolvedReference extends ParsedReference {
  resolved: boolean
  content?: string
  metadata?: Record<string, unknown>
  error?: string
}

/**
 * Parse @ references from text
 * Format: @type:identifier or @type:"identifier with spaces"
 */
export function parseReferences(text: string): ParsedReference[] {
  const references: ParsedReference[] = []
  
  // Match patterns like @template:hero-section or @brand:"My Brand Voice"
  const regex = /@(template|component|snippet|brand|audience):(?:"([^"]+)"|(\S+))/gi
  
  let match
  while ((match = regex.exec(text)) !== null) {
    const type = match[1].toLowerCase() as ReferenceType
    const identifier = match[2] || match[3] // Quoted or unquoted
    
    references.push({
      type,
      identifier,
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }
  
  return references
}

/**
 * Resolve all references in text, fetching their content
 */
export async function resolveReferences(
  text: string,
  workspaceId: string
): Promise<{
  resolvedText: string
  references: ResolvedReference[]
  totalContextLength: number
}> {
  const parsed = parseReferences(text)
  const resolved: ResolvedReference[] = []
  
  let resolvedText = text
  let totalContextLength = 0
  
  // Process in reverse order to maintain string indices
  const sortedParsed = [...parsed].sort((a, b) => b.startIndex - a.startIndex)
  
  for (const ref of sortedParsed) {
    const resolution = await resolveReference(ref, workspaceId)
    resolved.unshift(resolution) // Maintain original order
    
    if (resolution.resolved && resolution.content) {
      // Replace the reference with its content
      const contextBlock = formatContextBlock(resolution)
      resolvedText = 
        resolvedText.slice(0, ref.startIndex) +
        contextBlock +
        resolvedText.slice(ref.endIndex)
      totalContextLength += contextBlock.length
    }
  }
  
  return {
    resolvedText,
    references: resolved,
    totalContextLength,
  }
}

/**
 * Resolve a single reference
 */
async function resolveReference(
  ref: ParsedReference,
  workspaceId: string
): Promise<ResolvedReference> {
  const supabase = createServiceClient()
  
  try {
    switch (ref.type) {
      case 'template': {
        const { data } = await supabase
          .from('design_templates')
          .select('id, name, html, category')
          .eq('workspace_id', workspaceId)
          .or(`name.ilike.%${ref.identifier}%,id.eq.${ref.identifier}`)
          .limit(1)
          .single()
        
        if (data) {
          return {
            ...ref,
            resolved: true,
            content: data.html,
            metadata: { id: data.id, name: data.name, category: data.category },
          }
        }
        break
      }
      
      case 'component': {
        const { data } = await supabase
          .from('ui_components')
          .select('id, name, html, category')
          .eq('workspace_id', workspaceId)
          .or(`name.ilike.%${ref.identifier}%,id.eq.${ref.identifier}`)
          .limit(1)
          .single()
        
        if (data) {
          return {
            ...ref,
            resolved: true,
            content: data.html,
            metadata: { id: data.id, name: data.name, category: data.category },
          }
        }
        break
      }
      
      case 'snippet': {
        const { data } = await supabase
          .from('snippets')
          .select('id, name, code, category')
          .eq('workspace_id', workspaceId)
          .or(`name.ilike.%${ref.identifier}%,id.eq.${ref.identifier}`)
          .limit(1)
          .single()
        
        if (data) {
          return {
            ...ref,
            resolved: true,
            content: data.code,
            metadata: { id: data.id, name: data.name, category: data.category },
          }
        }
        break
      }
      
      case 'brand': {
        const { data } = await supabase
          .from('brands')
          .select('*')
          .eq('workspace_id', workspaceId)
          .or(`name.ilike.%${ref.identifier}%,id.eq.${ref.identifier}`)
          .limit(1)
          .single()
        
        if (data) {
          const brandContent = formatBrandContext(data)
          return {
            ...ref,
            resolved: true,
            content: brandContent,
            metadata: { id: data.id, name: data.name },
          }
        }
        break
      }
      
      case 'audience': {
        const { data } = await supabase
          .from('audiences')
          .select('*')
          .eq('workspace_id', workspaceId)
          .or(`name.ilike.%${ref.identifier}%,id.eq.${ref.identifier}`)
          .limit(1)
          .single()
        
        if (data) {
          const audienceContent = formatAudienceContext(data)
          return {
            ...ref,
            resolved: true,
            content: audienceContent,
            metadata: { id: data.id, name: data.name },
          }
        }
        break
      }
    }
    
    return {
      ...ref,
      resolved: false,
      error: `Could not find ${ref.type} with identifier "${ref.identifier}"`,
    }
  } catch (error) {
    return {
      ...ref,
      resolved: false,
      error: `Failed to resolve reference: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Format context block for insertion
 */
function formatContextBlock(ref: ResolvedReference): string {
  const header = `\n<!-- ${ref.type.toUpperCase()}: ${ref.metadata?.name || ref.identifier} -->\n`
  const footer = `\n<!-- END ${ref.type.toUpperCase()} -->\n`
  return header + ref.content + footer
}

/**
 * Format brand data into context string
 */
function formatBrandContext(brand: Record<string, unknown>): string {
  const parts = ['## Brand Voice Guidelines']
  
  if (brand.name) parts.push(`Brand: ${brand.name}`)
  if (brand.tagline) parts.push(`Tagline: ${brand.tagline}`)
  if (brand.mission) parts.push(`Mission: ${brand.mission}`)
  if (brand.voice_tone) parts.push(`Voice & Tone: ${brand.voice_tone}`)
  
  if (brand.voice_attributes && Array.isArray(brand.voice_attributes)) {
    parts.push(`Voice Attributes: ${brand.voice_attributes.join(', ')}`)
  }
  
  if (brand.dos && Array.isArray(brand.dos)) {
    parts.push(`\nDO:`)
    brand.dos.forEach((d: string) => parts.push(`- ${d}`))
  }
  
  if (brand.donts && Array.isArray(brand.donts)) {
    parts.push(`\nDON'T:`)
    brand.donts.forEach((d: string) => parts.push(`- ${d}`))
  }
  
  if (brand.primary_color) parts.push(`Primary Color: ${brand.primary_color}`)
  if (brand.secondary_color) parts.push(`Secondary Color: ${brand.secondary_color}`)
  
  return parts.join('\n')
}

/**
 * Format audience data into context string
 */
function formatAudienceContext(audience: Record<string, unknown>): string {
  const parts = ['## Target Audience Profile']
  
  if (audience.name) parts.push(`Audience: ${audience.name}`)
  if (audience.description) parts.push(`Description: ${audience.description}`)
  
  const profile = audience.profile as Record<string, unknown> | undefined
  if (profile) {
    if (profile.demographics) {
      parts.push(`\nDemographics:`)
      const demo = profile.demographics as Record<string, unknown>
      if (demo.age_range) parts.push(`- Age: ${demo.age_range}`)
      if (demo.gender) parts.push(`- Gender: ${demo.gender}`)
      if (demo.income) parts.push(`- Income: ${demo.income}`)
      if (demo.location) parts.push(`- Location: ${demo.location}`)
    }
    
    if (profile.psychographics) {
      parts.push(`\nPsychographics:`)
      const psych = profile.psychographics as Record<string, unknown>
      if (psych.values && Array.isArray(psych.values)) {
        parts.push(`- Values: ${psych.values.join(', ')}`)
      }
      if (psych.interests && Array.isArray(psych.interests)) {
        parts.push(`- Interests: ${psych.interests.join(', ')}`)
      }
    }
    
    if (profile.pain_points && Array.isArray(profile.pain_points)) {
      parts.push(`\nPain Points:`)
      profile.pain_points.forEach((p: string) => parts.push(`- ${p}`))
    }
    
    if (profile.goals && Array.isArray(profile.goals)) {
      parts.push(`\nGoals:`)
      profile.goals.forEach((g: string) => parts.push(`- ${g}`))
    }
    
    if (profile.buying_triggers && Array.isArray(profile.buying_triggers)) {
      parts.push(`\nBuying Triggers:`)
      profile.buying_triggers.forEach((t: string) => parts.push(`- ${t}`))
    }
  }
  
  return parts.join('\n')
}

/**
 * Search for referenceable items
 */
export async function searchReferences(
  workspaceId: string,
  query: string,
  types?: ReferenceType[],
  limit: number = 10
): Promise<Reference[]> {
  const supabase = createServiceClient()
  const results: Reference[] = []
  const searchTypes = types || ['template', 'component', 'snippet', 'brand', 'audience']
  
  for (const type of searchTypes) {
    let data: unknown[] | null = null
    
    switch (type) {
      case 'template':
        const { data: templates } = await supabase
          .from('design_templates')
          .select('id, name, category')
          .eq('workspace_id', workspaceId)
          .ilike('name', `%${query}%`)
          .limit(limit)
        data = templates
        break
        
      case 'component':
        const { data: components } = await supabase
          .from('ui_components')
          .select('id, name, category')
          .eq('workspace_id', workspaceId)
          .ilike('name', `%${query}%`)
          .limit(limit)
        data = components
        break
        
      case 'snippet':
        const { data: snippets } = await supabase
          .from('snippets')
          .select('id, name, category')
          .eq('workspace_id', workspaceId)
          .ilike('name', `%${query}%`)
          .limit(limit)
        data = snippets
        break
        
      case 'brand':
        const { data: brands } = await supabase
          .from('brands')
          .select('id, name')
          .eq('workspace_id', workspaceId)
          .ilike('name', `%${query}%`)
          .limit(limit)
        data = brands
        break
        
      case 'audience':
        const { data: audiences } = await supabase
          .from('audiences')
          .select('id, name, description')
          .eq('workspace_id', workspaceId)
          .ilike('name', `%${query}%`)
          .limit(limit)
        data = audiences
        break
    }
    
    if (data) {
      for (const item of data as Array<{ id: string; name: string; [key: string]: unknown }>) {
        results.push({
          type,
          id: item.id,
          name: item.name,
          metadata: item,
        })
      }
    }
  }
  
  return results.slice(0, limit)
}

/**
 * Get reference syntax help
 */
export function getReferenceHelp(): {
  type: ReferenceType
  syntax: string
  example: string
  description: string
}[] {
  return [
    {
      type: 'template',
      syntax: '@template:name',
      example: '@template:hero-section',
      description: 'Inject a design template HTML',
    },
    {
      type: 'component',
      syntax: '@component:name',
      example: '@component:pricing-table',
      description: 'Inject a UI component',
    },
    {
      type: 'snippet',
      syntax: '@snippet:name',
      example: '@snippet:fade-animation',
      description: 'Inject a saved code snippet',
    },
    {
      type: 'brand',
      syntax: '@brand:name',
      example: '@brand:"My Brand"',
      description: 'Inject brand voice guidelines',
    },
    {
      type: 'audience',
      syntax: '@audience:name',
      example: '@audience:enterprise-buyers',
      description: 'Inject target audience profile',
    },
  ]
}

/**
 * Check if text contains any references
 */
export function hasReferences(text: string): boolean {
  return /@(template|component|snippet|brand|audience):/i.test(text)
}

/**
 * Get the reference type being typed (for autocomplete)
 */
export function getActiveReferenceType(
  text: string,
  cursorPosition: number
): { type: ReferenceType | null; query: string } {
  const beforeCursor = text.slice(0, cursorPosition)
  const match = beforeCursor.match(/@(template|component|snippet|brand|audience):([^@\s]*)$/i)
  
  if (match) {
    return {
      type: match[1].toLowerCase() as ReferenceType,
      query: match[2] || '',
    }
  }
  
  // Check if just typed @
  if (beforeCursor.endsWith('@')) {
    return { type: null, query: '' }
  }
  
  return { type: null, query: '' }
}
