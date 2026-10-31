/**
 * Template Remix Tracker
 * 
 * Track remix relationships and attribution for templates.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface RemixInfo {
  original_template_id: string
  original_template_name: string
  original_creator_id: string
  original_creator_name?: string
  remix_count: number
  depth: number
}

export interface TemplateWithRemix {
  id: string
  name: string
  description: string | null
  html: string
  category: string
  thumbnail_url: string | null
  is_public: boolean
  creator_id: string
  workspace_id: string
  price_cents: number | null
  creator_payout_percent: number
  original_template_id: string | null
  remix_count: number
  created_at: string
  // Joined
  remix_info?: RemixInfo
  is_purchased?: boolean
}

/**
 * Create a remix of a template
 */
export async function createRemix(
  originalTemplateId: string,
  workspaceId: string,
  userId: string,
  modifications: {
    name?: string
    description?: string
    html?: string
  }
): Promise<TemplateWithRemix> {
  const supabase = createServiceClient()

  // Get the original template
  const { data: original, error: fetchError } = await supabase
    .from('design_templates')
    .select('*')
    .eq('id', originalTemplateId)
    .single()

  if (fetchError || !original) {
    throw new Error('Original template not found')
  }

  // Check if it's a paid template and user has purchased
  if (original.price_cents && original.price_cents > 0) {
    const hasPurchased = await hasUserPurchased(userId, originalTemplateId)
    if (!hasPurchased && original.creator_id !== userId) {
      throw new Error('You must purchase this template to remix it')
    }
  }

  // Create the remix
  const { data: remix, error: createError } = await supabase
    .from('design_templates')
    .insert({
      workspace_id: workspaceId,
      creator_id: userId,
      name: modifications.name || `${original.name} (Remix)`,
      description: modifications.description || original.description,
      html: modifications.html || original.html,
      category: original.category,
      thumbnail_url: original.thumbnail_url,
      is_public: false, // Remixes start as private
      original_template_id: originalTemplateId,
    })
    .select()
    .single()

  if (createError) throw createError

  return remix as TemplateWithRemix
}

/**
 * Get remix attribution chain for a template
 */
export async function getRemixChain(templateId: string): Promise<RemixInfo[]> {
  const supabase = createServiceClient()
  const chain: RemixInfo[] = []

  let currentId: string | null = templateId

  while (currentId) {
    const { data: template }: { data: { id: string; name: string; original_template_id: string | null; creator_id: string | null; remix_count: number } | null } = await supabase
      .from('design_templates')
      .select('id, name, original_template_id, creator_id, remix_count')
      .eq('id', currentId)
      .single()

    if (!template || !template.original_template_id) break

    // Get original template info
    const { data: original } = await supabase
      .from('design_templates')
      .select('id, name, creator_id, remix_count')
      .eq('id', template.original_template_id)
      .single()

    if (original) {
      chain.push({
        original_template_id: original.id,
        original_template_name: original.name,
        original_creator_id: original.creator_id,
        remix_count: original.remix_count,
        depth: chain.length + 1,
      })
    }

    currentId = template.original_template_id
  }

  return chain
}

/**
 * Get all remixes of a template
 */
export async function getTemplateRemixes(
  templateId: string,
  options?: {
    publicOnly?: boolean
    limit?: number
    offset?: number
  }
): Promise<TemplateWithRemix[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('design_templates')
    .select('*')
    .eq('original_template_id', templateId)
    .order('created_at', { ascending: false })

  if (options?.publicOnly) {
    query = query.eq('is_public', true)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
  }

  const { data, error } = await query

  if (error) throw error

  return (data || []) as TemplateWithRemix[]
}

/**
 * Get remix statistics for a template
 */
export async function getRemixStats(templateId: string): Promise<{
  total_remixes: number
  public_remixes: number
  remix_tree_depth: number
}> {
  const supabase = createServiceClient()

  // Get direct remixes
  const { count: directRemixes } = await supabase
    .from('design_templates')
    .select('*', { count: 'exact', head: true })
    .eq('original_template_id', templateId)

  // Get public remixes
  const { count: publicRemixes } = await supabase
    .from('design_templates')
    .select('*', { count: 'exact', head: true })
    .eq('original_template_id', templateId)
    .eq('is_public', true)

  // Calculate tree depth (recursively count remix chains)
  const chain = await getRemixChain(templateId)

  return {
    total_remixes: directRemixes || 0,
    public_remixes: publicRemixes || 0,
    remix_tree_depth: chain.length,
  }
}

/**
 * Check if a template is a remix
 */
export async function isRemix(templateId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('design_templates')
    .select('original_template_id')
    .eq('id', templateId)
    .single()

  return !!data?.original_template_id
}

/**
 * Check if user has purchased a template
 */
export async function hasUserPurchased(
  userId: string,
  templateId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('template_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('template_id', templateId)
    .eq('status', 'completed')
    .single()

  return !!data
}

/**
 * Get user's purchased templates
 */
export async function getUserPurchases(
  userId: string
): Promise<TemplateWithRemix[]> {
  const supabase = createServiceClient()

  const { data: purchases } = await supabase
    .from('template_purchases')
    .select('template_id')
    .eq('user_id', userId)
    .eq('status', 'completed')

  if (!purchases || purchases.length === 0) return []

  const templateIds = purchases.map((p) => p.template_id)

  const { data: templates, error } = await supabase
    .from('design_templates')
    .select('*')
    .in('id', templateIds)

  if (error) throw error

  return (templates || []).map((t) => ({
    ...t,
    is_purchased: true,
  })) as TemplateWithRemix[]
}

/**
 * Get templates the user can access (their own + purchased + public free)
 */
export async function getAccessibleTemplates(
  userId: string,
  workspaceId: string
): Promise<Set<string>> {
  const supabase = createServiceClient()
  const accessible = new Set<string>()

  // Own templates
  const { data: own } = await supabase
    .from('design_templates')
    .select('id')
    .eq('workspace_id', workspaceId)

  own?.forEach((t) => accessible.add(t.id))

  // Purchased templates
  const { data: purchased } = await supabase
    .from('template_purchases')
    .select('template_id')
    .eq('user_id', userId)
    .eq('status', 'completed')

  purchased?.forEach((p) => accessible.add(p.template_id))

  // Public free templates
  const { data: free } = await supabase
    .from('design_templates')
    .select('id')
    .eq('is_public', true)
    .is('price_cents', null)

  free?.forEach((t) => accessible.add(t.id))

  return accessible
}
