/**
 * Snippet Manager
 * 
 * CRUD operations for reusable code snippets.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface Snippet {
  id: string
  workspace_id: string
  name: string
  description: string | null
  category: SnippetCategory
  code: string
  language: 'html' | 'css' | 'javascript' | 'mixed'
  preview_html: string | null
  tags: string[]
  is_public: boolean
  usage_count: number
  created_by: string
  created_at: string
  updated_at: string
  // Computed
  is_favorited?: boolean
}

export type SnippetCategory = 
  | 'animation'
  | 'effect'
  | 'layout'
  | 'style'
  | 'interactive'
  | 'custom'

export const SNIPPET_CATEGORIES: Array<{
  id: SnippetCategory
  label: string
  description: string
  icon: string
}> = [
  { id: 'animation', label: 'Animations', description: 'Motion and transitions', icon: '✨' },
  { id: 'effect', label: 'Effects', description: 'Visual effects and filters', icon: '🎨' },
  { id: 'layout', label: 'Layouts', description: 'Grid and flexbox patterns', icon: '📐' },
  { id: 'style', label: 'Styles', description: 'Typography and colors', icon: '🎭' },
  { id: 'interactive', label: 'Interactive', description: 'Hover and click effects', icon: '👆' },
  { id: 'custom', label: 'Custom', description: 'Other snippets', icon: '📝' },
]

export interface CreateSnippetInput {
  workspace_id: string
  name: string
  description?: string
  category?: SnippetCategory
  code: string
  language?: 'html' | 'css' | 'javascript' | 'mixed'
  preview_html?: string
  tags?: string[]
  is_public?: boolean
  created_by: string
}

export interface UpdateSnippetInput {
  name?: string
  description?: string
  category?: SnippetCategory
  code?: string
  language?: 'html' | 'css' | 'javascript' | 'mixed'
  preview_html?: string
  tags?: string[]
  is_public?: boolean
}

/**
 * Create a new snippet
 */
export async function createSnippet(input: CreateSnippetInput): Promise<Snippet> {
  const supabase = createServiceClient()

  // Auto-detect language if not provided
  const language = input.language || detectLanguage(input.code)

  // Generate preview HTML if not provided
  const preview_html = input.preview_html || generatePreview(input.code, language)

  const { data, error } = await supabase
    .from('snippets')
    .insert({
      workspace_id: input.workspace_id,
      name: input.name,
      description: input.description || null,
      category: input.category || 'custom',
      code: input.code,
      language,
      preview_html,
      tags: input.tags || [],
      is_public: input.is_public || false,
      created_by: input.created_by,
    })
    .select()
    .single()

  if (error) throw error

  return data as Snippet
}

/**
 * Get snippets for a workspace
 */
export async function getSnippets(
  workspaceId: string,
  options?: {
    category?: SnippetCategory
    search?: string
    tags?: string[]
    includePublic?: boolean
    favoritesOnly?: boolean
    userId?: string
    limit?: number
    offset?: number
  }
): Promise<Snippet[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('snippets')
    .select('*')
    .order('created_at', { ascending: false })

  // Filter by workspace or include public
  if (options?.includePublic) {
    query = query.or(`workspace_id.eq.${workspaceId},is_public.eq.true`)
  } else {
    query = query.eq('workspace_id', workspaceId)
  }

  if (options?.category) {
    query = query.eq('category', options.category)
  }

  if (options?.search) {
    query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`)
  }

  if (options?.tags && options.tags.length > 0) {
    query = query.overlaps('tags', options.tags)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1)
  }

  const { data, error } = await query

  if (error) throw error

  let snippets = (data || []) as Snippet[]

  // Get favorites if user ID provided
  if (options?.userId) {
    const { data: favorites } = await supabase
      .from('snippet_favorites')
      .select('snippet_id')
      .eq('user_id', options.userId)

    const favoriteIds = new Set(favorites?.map((f) => f.snippet_id) || [])
    snippets = snippets.map((s) => ({
      ...s,
      is_favorited: favoriteIds.has(s.id),
    }))

    if (options.favoritesOnly) {
      snippets = snippets.filter((s) => s.is_favorited)
    }
  }

  return snippets
}

/**
 * Get a single snippet by ID
 */
export async function getSnippet(snippetId: string): Promise<Snippet | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('snippets')
    .select('*')
    .eq('id', snippetId)
    .single()

  if (error) return null

  return data as Snippet
}

/**
 * Update a snippet
 */
export async function updateSnippet(
  snippetId: string,
  input: UpdateSnippetInput
): Promise<Snippet> {
  const supabase = createServiceClient()

  const updateData: Record<string, unknown> = {}

  if (input.name !== undefined) updateData.name = input.name
  if (input.description !== undefined) updateData.description = input.description
  if (input.category !== undefined) updateData.category = input.category
  if (input.code !== undefined) {
    updateData.code = input.code
    updateData.language = input.language || detectLanguage(input.code)
    updateData.preview_html = input.preview_html || generatePreview(input.code, updateData.language as string)
  }
  if (input.tags !== undefined) updateData.tags = input.tags
  if (input.is_public !== undefined) updateData.is_public = input.is_public

  const { data, error } = await supabase
    .from('snippets')
    .update(updateData)
    .eq('id', snippetId)
    .select()
    .single()

  if (error) throw error

  return data as Snippet
}

/**
 * Delete a snippet
 */
export async function deleteSnippet(snippetId: string): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('snippets')
    .delete()
    .eq('id', snippetId)

  if (error) throw error
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(
  snippetId: string,
  userId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  // Check if already favorited
  const { data: existing } = await supabase
    .from('snippet_favorites')
    .select('id')
    .eq('snippet_id', snippetId)
    .eq('user_id', userId)
    .single()

  if (existing) {
    // Remove favorite
    await supabase
      .from('snippet_favorites')
      .delete()
      .eq('id', existing.id)
    return false
  } else {
    // Add favorite
    await supabase
      .from('snippet_favorites')
      .insert({ snippet_id: snippetId, user_id: userId })
    return true
  }
}

/**
 * Increment usage count when snippet is used
 */
export async function recordSnippetUsage(snippetId: string): Promise<void> {
  const supabase = createServiceClient()

  await supabase.rpc('increment_snippet_usage', { snippet_id: snippetId })
}

/**
 * Get popular snippets
 */
export async function getPopularSnippets(
  workspaceId: string,
  limit: number = 10
): Promise<Snippet[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('snippets')
    .select('*')
    .or(`workspace_id.eq.${workspaceId},is_public.eq.true`)
    .order('usage_count', { ascending: false })
    .limit(limit)

  if (error) throw error

  return (data || []) as Snippet[]
}

/**
 * Auto-detect language from code
 */
function detectLanguage(code: string): 'html' | 'css' | 'javascript' | 'mixed' {
  const hasHtml = /<[a-z][\s\S]*>/i.test(code)
  const hasCss = /[\w-]+\s*:\s*[^;]+;/.test(code) || /@keyframes|\.[\w-]+\s*\{/.test(code)
  const hasJs = /function\s|const\s|let\s|var\s|=>|document\.|window\./.test(code)

  const count = [hasHtml, hasCss, hasJs].filter(Boolean).length

  if (count > 1) return 'mixed'
  if (hasHtml) return 'html'
  if (hasCss) return 'css'
  if (hasJs) return 'javascript'
  return 'mixed'
}

/**
 * Generate preview HTML from code
 */
function generatePreview(code: string, language: string): string {
  switch (language) {
    case 'html':
      return code
    case 'css':
      return `<style>${code}</style><div class="preview-element">Preview</div>`
    case 'javascript':
      return `<script>${code}</script>`
    case 'mixed':
    default:
      return code
  }
}

/**
 * Get snippet statistics
 */
export async function getSnippetStats(workspaceId: string): Promise<{
  total: number
  byCategory: Record<string, number>
  totalUsage: number
}> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('snippets')
    .select('category, usage_count')
    .eq('workspace_id', workspaceId)

  if (!data || data.length === 0) {
    return { total: 0, byCategory: {}, totalUsage: 0 }
  }

  const byCategory: Record<string, number> = {}
  let totalUsage = 0

  for (const snippet of data) {
    byCategory[snippet.category] = (byCategory[snippet.category] || 0) + 1
    totalUsage += snippet.usage_count || 0
  }

  return {
    total: data.length,
    byCategory,
    totalUsage,
  }
}
