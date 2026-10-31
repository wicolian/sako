/**
 * Brand Manager
 * 
 * Multi-brand management with plan-based limits:
 * - Starter: 1 brand
 * - Pro: 5 brands
 * - Max: 10 brands
 * - Enterprise: Unlimited
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getBrandLimit, canAddBrand } from '@/lib/billing/plans'
import { isValidUrl, normalizeUrl, smartFetch } from '@/lib/import/url-fetcher'
import { parseHtml } from '@/lib/import/html-parser'
import { extractDesignTokens } from '@/lib/import/design-extractor'
import { analyzeBrand, extractBrandNameQuick } from '@/lib/import/brand-extractor'

// ============================================================================
// Types
// ============================================================================

export interface Brand {
  id: string
  workspace_id: string
  name: string
  description?: string
  
  // Visual identity
  logo_url?: string
  primary_color: string
  secondary_color?: string
  accent_color?: string
  font_family?: string
  
  // Brand voice
  tone_of_voice?: string
  writing_style?: string
  personality_traits?: string[]
  
  // Guidelines
  do_phrases?: string[]
  dont_phrases?: string[]
  key_messages?: string[]
  
  // Contact
  website_url?: string
  social_profiles?: Record<string, string>
  
  // Meta
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface CreateBrandInput {
  name: string
  description?: string
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  fontFamily?: string
  toneOfVoice?: string
  writingStyle?: string
  personalityTraits?: string[]
  doPhrases?: string[]
  dontPhrases?: string[]
  keyMessages?: string[]
  websiteUrl?: string
  socialProfiles?: Record<string, string>
}

export interface UpdateBrandInput extends Partial<CreateBrandInput> {
  isDefault?: boolean
}

// ============================================================================
// Brand Manager
// ============================================================================

export class BrandManager {
  /**
   * Create a new brand
   */
  static async createBrand(
    workspaceId: string,
    planId: string,
    input: CreateBrandInput
  ): Promise<Brand> {
    const supabase = createServiceClient()
    
    // Check brand limit
    const { count } = await supabase
      .from('brands')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    
    const currentCount = count || 0
    
    if (!canAddBrand(planId, currentCount)) {
      const limit = getBrandLimit(planId)
      throw new Error(
        `Brand limit reached. Your ${planId} plan allows ${limit} brand(s). ` +
        `Upgrade to add more brands.`
      )
    }
    
    // Check if this should be the default (first brand)
    const isDefault = currentCount === 0
    
    const { data, error } = await supabase
      .from('brands')
      .insert({
        workspace_id: workspaceId,
        name: input.name,
        description: input.description,
        logo_url: input.logoUrl,
        primary_color: input.primaryColor || '#6366f1',
        secondary_color: input.secondaryColor,
        accent_color: input.accentColor,
        font_family: input.fontFamily,
        tone_of_voice: input.toneOfVoice,
        writing_style: input.writingStyle,
        personality_traits: input.personalityTraits || [],
        do_phrases: input.doPhrases || [],
        dont_phrases: input.dontPhrases || [],
        key_messages: input.keyMessages || [],
        website_url: input.websiteUrl,
        social_profiles: input.socialProfiles || {},
        is_default: isDefault,
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to create brand: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Get all brands for a workspace
   */
  static async getBrands(workspaceId: string): Promise<Brand[]> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('is_default', { ascending: false })
      .order('name')
    
    if (error) {
      throw new Error(`Failed to get brands: ${error.message}`)
    }
    
    return data || []
  }
  
  /**
   * Get a single brand
   */
  static async getBrand(brandId: string): Promise<Brand | null> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get brand: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Get the default brand for a workspace
   */
  static async getDefaultBrand(workspaceId: string): Promise<Brand | null> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_default', true)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get default brand: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Update a brand
   */
  static async updateBrand(
    brandId: string,
    workspaceId: string,
    input: UpdateBrandInput
  ): Promise<Brand> {
    const supabase = createServiceClient()
    
    // If setting as default, unset others
    if (input.isDefault) {
      await supabase
        .from('brands')
        .update({ is_default: false })
        .eq('workspace_id', workspaceId)
        .neq('id', brandId)
    }
    
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    
    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.logoUrl !== undefined) updateData.logo_url = input.logoUrl
    if (input.primaryColor !== undefined) updateData.primary_color = input.primaryColor
    if (input.secondaryColor !== undefined) updateData.secondary_color = input.secondaryColor
    if (input.accentColor !== undefined) updateData.accent_color = input.accentColor
    if (input.fontFamily !== undefined) updateData.font_family = input.fontFamily
    if (input.toneOfVoice !== undefined) updateData.tone_of_voice = input.toneOfVoice
    if (input.writingStyle !== undefined) updateData.writing_style = input.writingStyle
    if (input.personalityTraits !== undefined) updateData.personality_traits = input.personalityTraits
    if (input.doPhrases !== undefined) updateData.do_phrases = input.doPhrases
    if (input.dontPhrases !== undefined) updateData.dont_phrases = input.dontPhrases
    if (input.keyMessages !== undefined) updateData.key_messages = input.keyMessages
    if (input.websiteUrl !== undefined) updateData.website_url = input.websiteUrl
    if (input.socialProfiles !== undefined) updateData.social_profiles = input.socialProfiles
    if (input.isDefault !== undefined) updateData.is_default = input.isDefault
    
    const { data, error } = await supabase
      .from('brands')
      .update(updateData)
      .eq('id', brandId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to update brand: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Delete a brand
   */
  static async deleteBrand(brandId: string, workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    
    // Get the brand to check if it's default
    const brand = await this.getBrand(brandId)
    if (!brand) {
      throw new Error('Brand not found')
    }
    
    // Don't allow deleting the only brand
    const { count } = await supabase
      .from('brands')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    
    if (count === 1) {
      throw new Error('Cannot delete the only brand. Create another brand first.')
    }
    
    // Delete the brand
    const { error } = await supabase
      .from('brands')
      .delete()
      .eq('id', brandId)
    
    if (error) {
      throw new Error(`Failed to delete brand: ${error.message}`)
    }
    
    // If this was the default, set another as default
    if (brand.is_default) {
      const { data: otherBrand } = await supabase
        .from('brands')
        .select('id')
        .eq('workspace_id', workspaceId)
        .limit(1)
        .single()
      
      if (otherBrand) {
        await supabase
          .from('brands')
          .update({ is_default: true })
          .eq('id', otherBrand.id)
      }
    }
  }
  
  /**
   * Get brand usage for a workspace
   */
  static async getBrandUsage(
    workspaceId: string,
    planId: string
  ): Promise<{
    used: number
    limit: number | 'unlimited'
    canAdd: boolean
  }> {
    const supabase = createServiceClient()
    
    const { count } = await supabase
      .from('brands')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
    
    const used = count || 0
    const limit = getBrandLimit(planId)
    
    return {
      used,
      limit,
      canAdd: canAddBrand(planId, used),
    }
  }
  
  /**
   * Extract brand DNA from a website
   */
  static async extractBrandDNA(websiteUrl: string): Promise<Partial<CreateBrandInput>> {
    const normalizedUrl = normalizeUrl(websiteUrl)
    if (!isValidUrl(normalizedUrl)) {
      throw new Error('Invalid website URL')
    }

    const fetched = await smartFetch(normalizedUrl, {
      timeout: 20000,
      retries: 2,
      renderJs: false,
    })

    if (!fetched.html) {
      throw new Error(fetched.error || 'Failed to fetch website content')
    }

    const parsed = parseHtml(fetched.html, fetched.url || normalizedUrl)
    const designTokens = extractDesignTokens(fetched.html)

    let analyzed:
      | Awaited<ReturnType<typeof analyzeBrand>>
      | null = null

    try {
      analyzed = await analyzeBrand(parsed, designTokens)
    } catch (error) {
      console.warn('Brand AI analysis failed, using structural fallback:', error)
    }

    const fallbackName = extractBrandNameQuick(parsed)

    return {
      websiteUrl: normalizedUrl,
      name: analyzed?.name || fallbackName,
      description: analyzed?.tagline || parsed.description || undefined,
      primaryColor: designTokens.colors.primary,
      secondaryColor: designTokens.colors.secondary,
      accentColor: designTokens.colors.accent,
      fontFamily: designTokens.typography.fontFamily,
      toneOfVoice: analyzed?.voice?.tone,
      writingStyle: analyzed?.voice?.formality,
      personalityTraits: analyzed?.voice?.personality || [],
      keyMessages: analyzed?.keyMessages || [],
    }
  }
}

// ============================================================================
// Brand Context Builder
// ============================================================================

/**
 * Build brand context for AI prompts
 */
export async function buildBrandContext(brandId: string): Promise<string> {
  const brand = await BrandManager.getBrand(brandId)
  
  if (!brand) {
    return ''
  }
  
  const parts: string[] = []
  
  parts.push(`Brand: ${brand.name}`)
  
  if (brand.description) {
    parts.push(`Description: ${brand.description}`)
  }
  
  if (brand.tone_of_voice) {
    parts.push(`Tone of voice: ${brand.tone_of_voice}`)
  }
  
  if (brand.writing_style) {
    parts.push(`Writing style: ${brand.writing_style}`)
  }
  
  if (brand.personality_traits?.length) {
    parts.push(`Brand personality: ${brand.personality_traits.join(', ')}`)
  }
  
  if (brand.key_messages?.length) {
    parts.push(`Key messages: ${brand.key_messages.join('; ')}`)
  }
  
  if (brand.do_phrases?.length) {
    parts.push(`Phrases to use: ${brand.do_phrases.join(', ')}`)
  }
  
  if (brand.dont_phrases?.length) {
    parts.push(`Phrases to avoid: ${brand.dont_phrases.join(', ')}`)
  }
  
  return parts.join('\n')
}
