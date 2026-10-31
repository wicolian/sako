/**
 * Template Marketplace with Tier Gating
 * 
 * Free/Pro/Paid template access:
 * - Tier-based access control
 * - Creator revenue share
 * - Template discovery
 */

import { createServiceClient } from '@/lib/supabase/service'
import { getPlan } from '@/lib/billing/plans'

// ============================================================================
// Types
// ============================================================================

export type TemplateTier = 'free' | 'pro' | 'paid'

export interface Template {
  id: string
  name: string
  description: string
  category: string
  thumbnail_url: string
  preview_url?: string
  
  // Tier information
  tier: TemplateTier
  price?: number // For paid templates (in cents)
  
  // Creator info
  creator_id?: string
  creator_name?: string
  creator_avatar?: string
  
  // Content
  structure: TemplateStructure
  
  // Stats
  usage_count: number
  rating?: number
  review_count: number
  
  // Meta
  tags: string[]
  is_featured: boolean
  is_new: boolean
  created_at: string
  updated_at: string
}

export interface TemplateStructure {
  sections: Array<{
    type: string
    content: Record<string, unknown>
    styles: Record<string, unknown>
  }>
  globalStyles: Record<string, unknown>
}

export interface TemplateAccess {
  canAccess: boolean
  reason?: 'free' | 'plan_included' | 'purchased' | 'requires_upgrade' | 'requires_purchase'
  requiredPlan?: string
  price?: number
}

// ============================================================================
// Marketplace Manager
// ============================================================================

export class MarketplaceManager {
  /**
   * Get templates with tier gating
   */
  static async getTemplates(options?: {
    category?: string
    tier?: TemplateTier
    featured?: boolean
    limit?: number
    offset?: number
    search?: string
  }): Promise<{ templates: Template[]; total: number }> {
    const supabase = createServiceClient()

    let query = supabase
      .from('templates')
      .select('*', { count: 'exact' })
      .eq('is_public', true)

    if (options?.category) {
      query = query.eq('category', options.category)
    }

    if (options?.tier) {
      query = query.eq('tier', options.tier)
    }

    if (options?.featured) {
      query = query.eq('is_featured', true)
    }

    if (options?.search) {
      query = query.ilike('name', `%${options.search}%`)
    }

    query = query
      .order('is_featured', { ascending: false })
      .order('usage_count', { ascending: false })

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
    }

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to get templates: ${error.message}`)
    }

    return {
      templates: data || [],
      total: count || 0,
    }
  }

  /**
   * Get a single template
   */
  static async getTemplate(templateId: string): Promise<Template | null> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get template: ${error.message}`)
    }

    return data
  }

  /**
   * Check if user has access to a template
   */
  static async checkAccess(
    templateId: string,
    userId: string,
    planId: string
  ): Promise<TemplateAccess> {
    const template = await this.getTemplate(templateId)
    
    if (!template) {
      return { canAccess: false, reason: 'requires_purchase' }
    }

    // Free templates are accessible to everyone
    if (template.tier === 'free') {
      return { canAccess: true, reason: 'free' }
    }

    // Pro templates require pro plan or higher
    if (template.tier === 'pro') {
      const plan = getPlan(planId)
      const proPlans = ['pro', 'max', 'enterprise']
      
      if (proPlans.includes(plan.id)) {
        return { canAccess: true, reason: 'plan_included' }
      }
      
      return { 
        canAccess: false, 
        reason: 'requires_upgrade',
        requiredPlan: 'pro',
      }
    }

    // Paid templates require purchase
    if (template.tier === 'paid') {
      const supabase = createServiceClient()
      
      // Check if user has purchased this template
      const { data: purchase } = await supabase
        .from('template_purchases')
        .select('id')
        .eq('user_id', userId)
        .eq('template_id', templateId)
        .single()
      
      if (purchase) {
        return { canAccess: true, reason: 'purchased' }
      }
      
      return {
        canAccess: false,
        reason: 'requires_purchase',
        price: template.price,
      }
    }

    return { canAccess: false }
  }

  /**
   * Use a template (increment usage count)
   */
  static async useTemplate(templateId: string): Promise<void> {
    const supabase = createServiceClient()

    await supabase.rpc('increment_template_usage', { template_id: templateId })
  }

  /**
   * Purchase a paid template
   */
  static async purchaseTemplate(
    templateId: string,
    userId: string,
    paymentIntentId: string
  ): Promise<void> {
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('template_purchases')
      .insert({
        template_id: templateId,
        user_id: userId,
        payment_intent_id: paymentIntentId,
        purchased_at: new Date().toISOString(),
      })

    if (error) {
      throw new Error(`Failed to record purchase: ${error.message}`)
    }
  }

  /**
   * Get user's purchased templates
   */
  static async getPurchasedTemplates(userId: string): Promise<Template[]> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('template_purchases')
      .select('template:templates(*)')
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to get purchased templates: ${error.message}`)
    }

    return (data || []).map(d => d.template as unknown as Template)
  }

  /**
   * Submit a template to the marketplace
   */
  static async submitTemplate(
    userId: string,
    template: {
      name: string
      description: string
      category: string
      thumbnailUrl: string
      previewUrl?: string
      tier: TemplateTier
      price?: number
      structure: TemplateStructure
      tags: string[]
    }
  ): Promise<Template> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('templates')
      .insert({
        name: template.name,
        description: template.description,
        category: template.category,
        thumbnail_url: template.thumbnailUrl,
        preview_url: template.previewUrl,
        tier: template.tier,
        price: template.price,
        creator_id: userId,
        structure: template.structure,
        tags: template.tags,
        is_public: false, // Requires review
        is_featured: false,
        is_new: true,
      })
      .select()
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to submit template: ${error.message}`)
    }

    return data
  }

  /**
   * Get creator's templates
   */
  static async getCreatorTemplates(creatorId: string): Promise<Template[]> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to get creator templates: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get creator earnings
   */
  static async getCreatorEarnings(creatorId: string): Promise<{
    totalEarnings: number
    pendingEarnings: number
    paidEarnings: number
    totalSales: number
  }> {
    const supabase = createServiceClient()

    // Get creator's template IDs
    const { data: templates } = await supabase
      .from('templates')
      .select('id, price')
      .eq('creator_id', creatorId)
      .eq('tier', 'paid')

    if (!templates?.length) {
      return {
        totalEarnings: 0,
        pendingEarnings: 0,
        paidEarnings: 0,
        totalSales: 0,
      }
    }

    const templateIds = templates.map(t => t.id)

    // Get purchases
    const { data: purchases, count } = await supabase
      .from('template_purchases')
      .select('*, template:templates(price)', { count: 'exact' })
      .in('template_id', templateIds)

    const totalSales = count || 0
    const totalEarnings = (purchases || []).reduce((sum, p) => {
      const price = (p.template as { price?: number })?.price || 0
      return sum + (price * 0.7) // 70% to creator
    }, 0)

    return {
      totalEarnings: totalEarnings / 100, // Convert from cents
      pendingEarnings: totalEarnings / 100, // Simplified
      paidEarnings: 0,
      totalSales,
    }
  }
}

// ============================================================================
// Template Categories
// ============================================================================

export const TEMPLATE_CATEGORIES = [
  { id: 'landing', name: 'Landing Pages', icon: '🚀' },
  { id: 'portfolio', name: 'Portfolio', icon: '💼' },
  { id: 'blog', name: 'Blog', icon: '📝' },
  { id: 'saas', name: 'SaaS', icon: '💻' },
  { id: 'ecommerce', name: 'E-commerce', icon: '🛒' },
  { id: 'agency', name: 'Agency', icon: '🏢' },
  { id: 'startup', name: 'Startup', icon: '🌟' },
  { id: 'restaurant', name: 'Restaurant', icon: '🍽️' },
  { id: 'real-estate', name: 'Real Estate', icon: '🏠' },
  { id: 'event', name: 'Event', icon: '🎉' },
  { id: 'personal', name: 'Personal', icon: '👤' },
  { id: 'creative', name: 'Creative', icon: '🎨' },
]

// ============================================================================
// Tier Badge Components
// ============================================================================

export function getTierBadge(tier: TemplateTier): {
  label: string
  color: string
  bgColor: string
} {
  switch (tier) {
    case 'free':
      return {
        label: 'Free',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-100',
      }
    case 'pro':
      return {
        label: 'Pro',
        color: 'text-purple-700',
        bgColor: 'bg-purple-100',
      }
    case 'paid':
      return {
        label: 'Premium',
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
      }
  }
}
