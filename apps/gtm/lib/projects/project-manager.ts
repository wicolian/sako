/**
 * Project Manager
 * 
 * Manages projects, pages, and project assets for the Canvas workspace.
 * Implements hierarchical context: Workspace Default → Project Settings → Asset Override
 * 
 * Now supports multi-page websites with navigation and page transitions.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface Project {
  id: string
  workspace_id: string
  name: string
  description?: string
  icon?: string
  color: string
  canvas_id?: string
  brand_id?: string
  audience_id?: string
  campaign_goals?: string
  tone_override?: string
  keywords_include: string[]
  keywords_avoid: string[]
  custom_instructions?: string
  status: 'active' | 'completed' | 'archived'
  is_multipage: boolean
  default_transition: PageTransition
  created_by?: string
  created_at: string
  updated_at: string
}

export type PageTransition = 'none' | 'fade' | 'slide' | 'scale' | 'blur' | 'push' | 'wipe'

export interface ProjectPage {
  id: string
  project_id: string
  name: string
  slug: string
  is_home: boolean
  blocks: PageBlock[]
  seo_title?: string
  seo_description?: string
  og_image?: string
  transition: PageTransition
  order: number
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
}

export interface PageBlock {
  id: string
  type: string
  content: Record<string, unknown>
  styles?: Record<string, string>
  order: number
}

export interface PageNavigation {
  pages: Array<{
    id: string
    name: string
    slug: string
    isHome: boolean
  }>
  links: Array<{
    fromPageId: string
    toPageId: string
    elementId: string
    linkText: string
  }>
}

export interface ProjectAsset {
  id: string
  project_id: string
  name: string
  type: 'landing_page' | 'email' | 'social_post' | 'ad_creative' | 'video_script' | 'sales_deck'
  position_x: number
  position_y: number
  width: number
  height: number
  content: Record<string, unknown>
  html?: string
  brand_id_override?: string
  audience_id_override?: string
  tone_override?: string
  custom_instructions?: string
  status: 'draft' | 'review' | 'approved' | 'published'
  connected_to: string[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  workspace_id: string
  name: string
  description?: string
  icon?: string
  color?: string
  brand_id?: string
  audience_id?: string
  campaign_goals?: string
  is_multipage?: boolean
}

export interface CreateAssetInput {
  project_id: string
  name: string
  type: ProjectAsset['type']
  position_x?: number
  position_y?: number
  content?: Record<string, unknown>
}

export interface CreatePageInput {
  project_id: string
  name: string
  slug?: string
  is_home?: boolean
  blocks?: PageBlock[]
  seo_title?: string
  seo_description?: string
  transition?: PageTransition
}

/**
 * Create a new project
 */
export async function createProject(input: CreateProjectInput): Promise<Project | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('projects')
    .insert({
      workspace_id: input.workspace_id,
      name: input.name,
      description: input.description,
      icon: input.icon || '📁',
      color: input.color || '#6366f1',
      brand_id: input.brand_id,
      audience_id: input.audience_id,
      campaign_goals: input.campaign_goals,
      keywords_include: [],
      keywords_avoid: [],
      status: 'active',
      is_multipage: input.is_multipage || false,
      default_transition: 'fade',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create project:', error)
    return null
  }

  // If multipage project, create default home page
  if (input.is_multipage) {
    await createPage({
      project_id: data.id,
      name: 'Home',
      slug: '',
      is_home: true,
      blocks: [],
    })
  }

  return data as Project
}

/**
 * Get project by ID
 */
export async function getProject(projectId: string): Promise<Project | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error) {
    return null
  }

  return data as Project
}

/**
 * Get all projects for a workspace
 */
export async function getWorkspaceProjects(workspaceId: string): Promise<Project[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Failed to get projects:', error)
    return []
  }

  return data as Project[]
}

/**
 * Update project
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Project>
): Promise<Project | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update project:', error)
    return null
  }

  return data as Project
}

/**
 * Delete project
 */
export async function deleteProject(projectId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  return !error
}

/**
 * Create a project asset
 */
export async function createProjectAsset(input: CreateAssetInput): Promise<ProjectAsset | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('project_assets')
    .insert({
      project_id: input.project_id,
      name: input.name,
      type: input.type,
      position_x: input.position_x || 0,
      position_y: input.position_y || 0,
      width: 300,
      height: 200,
      content: input.content || {},
      status: 'draft',
      connected_to: [],
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create asset:', error)
    return null
  }

  return data as ProjectAsset
}

/**
 * Get all assets for a project
 */
export async function getProjectAssets(projectId: string): Promise<ProjectAsset[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('project_assets')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to get assets:', error)
    return []
  }

  return data as ProjectAsset[]
}

/**
 * Update project asset
 */
export async function updateProjectAsset(
  assetId: string,
  updates: Partial<ProjectAsset>
): Promise<ProjectAsset | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('project_assets')
    .update(updates)
    .eq('id', assetId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update asset:', error)
    return null
  }

  return data as ProjectAsset
}

/**
 * Delete project asset
 */
export async function deleteProjectAsset(assetId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('project_assets')
    .delete()
    .eq('id', assetId)

  return !error
}

/**
 * Batch update asset positions (for canvas drag operations)
 */
export async function updateAssetPositions(
  updates: Array<{ id: string; position_x: number; position_y: number }>
): Promise<boolean> {
  const supabase = createServiceClient()

  // Use transaction-like updates
  const results = await Promise.all(
    updates.map((update) =>
      supabase
        .from('project_assets')
        .update({ position_x: update.position_x, position_y: update.position_y })
        .eq('id', update.id)
    )
  )

  return results.every((r) => !r.error)
}

/**
 * Duplicate an asset
 */
export async function duplicateAsset(assetId: string): Promise<ProjectAsset | null> {
  const supabase = createServiceClient()

  // Get original asset
  const { data: original, error: fetchError } = await supabase
    .from('project_assets')
    .select('*')
    .eq('id', assetId)
    .single()

  if (fetchError || !original) {
    return null
  }

  // Create duplicate with offset position
  const { data, error } = await supabase
    .from('project_assets')
    .insert({
      project_id: original.project_id,
      name: `${original.name} (Copy)`,
      type: original.type,
      position_x: original.position_x + 50,
      position_y: original.position_y + 50,
      width: original.width,
      height: original.height,
      content: original.content,
      status: 'draft',
      connected_to: [],
    })
    .select()
    .single()

  if (error) {
    return null
  }

  return data as ProjectAsset
}

/**
 * Get resolved context for an asset (implements hierarchy)
 */
export async function getAssetContext(assetId: string): Promise<{
  brandId?: string
  audienceId?: string
  tone?: string
  customInstructions?: string
  campaignGoals?: string
  keywordsInclude: string[]
  keywordsAvoid: string[]
} | null> {
  const supabase = createServiceClient()

  // Get asset with project
  const { data: asset, error: assetError } = await supabase
    .from('project_assets')
    .select(`
      *,
      project:projects(*)
    `)
    .eq('id', assetId)
    .single()

  if (assetError || !asset) {
    return null
  }

  const project = asset.project as Project

  // Resolve hierarchy: Asset Override > Project Settings
  return {
    brandId: asset.brand_id_override || project.brand_id,
    audienceId: asset.audience_id_override || project.audience_id,
    tone: asset.tone_override || project.tone_override,
    customInstructions: asset.custom_instructions || project.custom_instructions,
    campaignGoals: project.campaign_goals,
    keywordsInclude: project.keywords_include || [],
    keywordsAvoid: project.keywords_avoid || [],
  }
}

// ============================================================================
// Multi-Page Website Functions
// ============================================================================

/**
 * Create a new page in a project
 */
export async function createPage(input: CreatePageInput): Promise<ProjectPage | null> {
  const supabase = createServiceClient()

  // Get current page count for ordering
  const { count } = await supabase
    .from('project_pages')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', input.project_id)

  // Generate slug from name if not provided
  const slug = input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const { data, error } = await supabase
    .from('project_pages')
    .insert({
      project_id: input.project_id,
      name: input.name,
      slug: input.is_home ? '' : slug,
      is_home: input.is_home || false,
      blocks: input.blocks || [],
      seo_title: input.seo_title,
      seo_description: input.seo_description,
      transition: input.transition || 'fade',
      order: count || 0,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create page:', error)
    return null
  }

  return data as ProjectPage
}

/**
 * Get all pages for a project
 */
export async function getProjectPages(projectId: string): Promise<ProjectPage[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('project_pages')
    .select('*')
    .eq('project_id', projectId)
    .order('order', { ascending: true })

  if (error) {
    console.error('Failed to get pages:', error)
    return []
  }

  return data as ProjectPage[]
}

/**
 * Get a single page by ID
 */
export async function getPage(pageId: string): Promise<ProjectPage | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('project_pages')
    .select('*')
    .eq('id', pageId)
    .single()

  if (error) {
    return null
  }

  return data as ProjectPage
}

/**
 * Get page by slug within a project
 */
export async function getPageBySlug(
  projectId: string,
  slug: string
): Promise<ProjectPage | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('project_pages')
    .select('*')
    .eq('project_id', projectId)
    .eq('slug', slug)
    .single()

  if (error) {
    return null
  }

  return data as ProjectPage
}

/**
 * Update a page
 */
export async function updatePage(
  pageId: string,
  updates: Partial<ProjectPage>
): Promise<ProjectPage | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('project_pages')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pageId)
    .select()
    .single()

  if (error) {
    console.error('Failed to update page:', error)
    return null
  }

  return data as ProjectPage
}

/**
 * Delete a page
 */
export async function deletePage(pageId: string): Promise<boolean> {
  const supabase = createServiceClient()

  // Don't allow deleting home page
  const page = await getPage(pageId)
  if (page?.is_home) {
    console.error('Cannot delete home page')
    return false
  }

  const { error } = await supabase
    .from('project_pages')
    .delete()
    .eq('id', pageId)

  return !error
}

/**
 * Update page blocks
 */
export async function updatePageBlocks(
  pageId: string,
  blocks: PageBlock[]
): Promise<ProjectPage | null> {
  return updatePage(pageId, { blocks })
}

/**
 * Reorder pages
 */
export async function reorderPages(
  projectId: string,
  pageOrder: string[]
): Promise<boolean> {
  const supabase = createServiceClient()

  const updates = pageOrder.map((pageId, index) =>
    supabase
      .from('project_pages')
      .update({ order: index })
      .eq('id', pageId)
      .eq('project_id', projectId)
  )

  const results = await Promise.all(updates)
  return results.every((r) => !r.error)
}

/**
 * Duplicate a page
 */
export async function duplicatePage(pageId: string): Promise<ProjectPage | null> {
  const supabase = createServiceClient()

  const original = await getPage(pageId)
  if (!original) {
    return null
  }

  // Get page count for new slug
  const { count } = await supabase
    .from('project_pages')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', original.project_id)

  const newSlug = `${original.slug}-copy-${count}`

  const { data, error } = await supabase
    .from('project_pages')
    .insert({
      project_id: original.project_id,
      name: `${original.name} (Copy)`,
      slug: newSlug,
      is_home: false, // Duplicates can't be home page
      blocks: original.blocks,
      seo_title: original.seo_title,
      seo_description: original.seo_description,
      transition: original.transition,
      order: (count || 0) + 1,
      status: 'draft',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to duplicate page:', error)
    return null
  }

  return data as ProjectPage
}

/**
 * Set home page
 */
export async function setHomePage(
  projectId: string,
  pageId: string
): Promise<boolean> {
  const supabase = createServiceClient()

  // First, unset current home page
  await supabase
    .from('project_pages')
    .update({ is_home: false, slug: 'old-home' })
    .eq('project_id', projectId)
    .eq('is_home', true)

  // Set new home page
  const { error } = await supabase
    .from('project_pages')
    .update({ is_home: true, slug: '' })
    .eq('id', pageId)

  return !error
}

/**
 * Get navigation structure for a project
 */
export async function getProjectNavigation(projectId: string): Promise<PageNavigation> {
  const pages = await getProjectPages(projectId)

  return {
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      isHome: p.is_home,
    })),
    links: [], // Links would be extracted from block content
  }
}

/**
 * Generate sitemap for a project
 */
export async function generateSitemap(
  projectId: string,
  baseUrl: string
): Promise<string> {
  const pages = await getProjectPages(projectId)

  const urls = pages
    .filter((p) => p.status === 'published')
    .map((page) => {
      const loc = page.is_home ? baseUrl : `${baseUrl}/${page.slug}`
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${page.updated_at}</lastmod>
    <priority>${page.is_home ? '1.0' : '0.8'}</priority>
  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}
