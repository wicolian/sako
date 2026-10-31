/**
 * Website Page Manager
 * 
 * Multi-page website support:
 * - Page CRUD within projects
 * - Page ordering
 * - Navigation links
 * - Home page designation
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { WebsiteSection } from './ai-designer'

// ============================================================================
// Types
// ============================================================================

export interface WebsitePage {
  id: string
  design_id: string
  workspace_id: string
  slug: string
  title: string
  is_home: boolean
  sections: WebsiteSection[]
  seo_meta: SEOMeta
  page_transitions: PageTransitions
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SEOMeta {
  title?: string
  description?: string
  keywords?: string[]
  ogImage?: string
  noIndex?: boolean
}

export interface PageTransitions {
  enterTransition?: string
  exitTransition?: string
  duration?: number
}

export interface CreatePageInput {
  designId: string
  workspaceId: string
  slug: string
  title: string
  isHome?: boolean
  sections?: WebsiteSection[]
  seoMeta?: SEOMeta
}

export interface UpdatePageInput {
  slug?: string
  title?: string
  isHome?: boolean
  sections?: WebsiteSection[]
  seoMeta?: SEOMeta
  pageTransitions?: PageTransitions
  sortOrder?: number
}

// ============================================================================
// Page Manager
// ============================================================================

export class PageManager {
  /**
   * Create a new page
   */
  static async createPage(input: CreatePageInput): Promise<WebsitePage> {
    const supabase = createServiceClient()

    // If setting as home, unset other home pages
    if (input.isHome) {
      await supabase
        .from('website_pages')
        .update({ is_home: false })
        .eq('design_id', input.designId)
    }

    // Get the next sort order
    const { data: existingPages } = await supabase
      .from('website_pages')
      .select('sort_order')
      .eq('design_id', input.designId)
      .order('sort_order', { ascending: false })
      .limit(1)

    const sortOrder = existingPages?.[0]?.sort_order
      ? existingPages[0].sort_order + 1
      : 0

    const { data, error } = await supabase
      .from('website_pages')
      .insert({
        design_id: input.designId,
        workspace_id: input.workspaceId,
        slug: input.slug,
        title: input.title,
        is_home: input.isHome || false,
        sections: input.sections || [],
        seo_meta: input.seoMeta || {},
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create page: ${error.message}`)
    }

    return data
  }

  /**
   * Get all pages for a design
   */
  static async getPages(designId: string): Promise<WebsitePage[]> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('website_pages')
      .select('*')
      .eq('design_id', designId)
      .order('sort_order')

    if (error) {
      throw new Error(`Failed to get pages: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get a single page
   */
  static async getPage(pageId: string): Promise<WebsitePage | null> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('website_pages')
      .select('*')
      .eq('id', pageId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get page: ${error.message}`)
    }

    return data
  }

  /**
   * Get page by slug
   */
  static async getPageBySlug(
    designId: string,
    slug: string
  ): Promise<WebsitePage | null> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('website_pages')
      .select('*')
      .eq('design_id', designId)
      .eq('slug', slug)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get page: ${error.message}`)
    }

    return data
  }

  /**
   * Get home page
   */
  static async getHomePage(designId: string): Promise<WebsitePage | null> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('website_pages')
      .select('*')
      .eq('design_id', designId)
      .eq('is_home', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get home page: ${error.message}`)
    }

    return data
  }

  /**
   * Update a page
   */
  static async updatePage(
    pageId: string,
    input: UpdatePageInput
  ): Promise<WebsitePage> {
    const supabase = createServiceClient()

    // Get the page first
    const page = await this.getPage(pageId)
    if (!page) {
      throw new Error('Page not found')
    }

    // If setting as home, unset other home pages
    if (input.isHome) {
      await supabase
        .from('website_pages')
        .update({ is_home: false })
        .eq('design_id', page.design_id)
        .neq('id', pageId)
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (input.slug !== undefined) updateData.slug = input.slug
    if (input.title !== undefined) updateData.title = input.title
    if (input.isHome !== undefined) updateData.is_home = input.isHome
    if (input.sections !== undefined) updateData.sections = input.sections
    if (input.seoMeta !== undefined) updateData.seo_meta = input.seoMeta
    if (input.pageTransitions !== undefined) updateData.page_transitions = input.pageTransitions
    if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder

    const { data, error } = await supabase
      .from('website_pages')
      .update(updateData)
      .eq('id', pageId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update page: ${error.message}`)
    }

    return data
  }

  /**
   * Delete a page
   */
  static async deletePage(pageId: string): Promise<void> {
    const supabase = createServiceClient()

    // Get the page first
    const page = await this.getPage(pageId)
    if (!page) {
      throw new Error('Page not found')
    }

    // Don't allow deleting the only page
    const pages = await this.getPages(page.design_id)
    if (pages.length === 1) {
      throw new Error('Cannot delete the only page')
    }

    // Don't allow deleting home page without designating another
    if (page.is_home) {
      throw new Error('Cannot delete home page. Set another page as home first.')
    }

    const { error } = await supabase
      .from('website_pages')
      .delete()
      .eq('id', pageId)

    if (error) {
      throw new Error(`Failed to delete page: ${error.message}`)
    }
  }

  /**
   * Duplicate a page
   */
  static async duplicatePage(pageId: string): Promise<WebsitePage> {
    const page = await this.getPage(pageId)
    if (!page) {
      throw new Error('Page not found')
    }

    return this.createPage({
      designId: page.design_id,
      workspaceId: page.workspace_id,
      slug: `${page.slug}-copy`,
      title: `${page.title} (Copy)`,
      isHome: false,
      sections: page.sections,
      seoMeta: page.seo_meta,
    })
  }

  /**
   * Reorder pages
   */
  static async reorderPages(
    designId: string,
    pageIds: string[]
  ): Promise<void> {
    const supabase = createServiceClient()

    // Update sort order for each page
    for (let i = 0; i < pageIds.length; i++) {
      await supabase
        .from('website_pages')
        .update({ sort_order: i })
        .eq('id', pageIds[i])
        .eq('design_id', designId)
    }
  }
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Generate navigation from pages
 */
export function generateNavigation(pages: WebsitePage[]): NavigationItem[] {
  return pages
    .filter(p => !p.slug.startsWith('_')) // Exclude private pages
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(page => ({
      id: page.id,
      label: page.title,
      href: page.is_home ? '/' : `/${page.slug}`,
      isHome: page.is_home,
    }))
}

export interface NavigationItem {
  id: string
  label: string
  href: string
  isHome: boolean
  children?: NavigationItem[]
}

/**
 * Get internal link options for a design
 */
export function getInternalLinkOptions(pages: WebsitePage[]): LinkOption[] {
  const options: LinkOption[] = []

  for (const page of pages) {
    // Add page link
    options.push({
      type: 'page',
      label: page.title,
      value: page.is_home ? '/' : `/${page.slug}`,
    })

    // Add section links
    for (const section of page.sections) {
      options.push({
        type: 'section',
        label: `${page.title} - ${section.type}`,
        value: page.is_home
          ? `/#${section.id}`
          : `/${page.slug}#${section.id}`,
      })
    }
  }

  return options
}

export interface LinkOption {
  type: 'page' | 'section' | 'external'
  label: string
  value: string
}

/**
 * Validate slug
 */
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug) {
    return { valid: false, error: 'Slug is required' }
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' }
  }

  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'Slug cannot start or end with a hyphen' }
  }

  if (slug.includes('--')) {
    return { valid: false, error: 'Slug cannot contain consecutive hyphens' }
  }

  const reserved = ['api', 'admin', 'login', 'signup', 'dashboard', '_next', 'static']
  if (reserved.includes(slug)) {
    return { valid: false, error: 'This slug is reserved' }
  }

  return { valid: true }
}

/**
 * Generate unique slug
 */
export function generateUniqueSlug(title: string, existingSlugs: string[]): string {
  let baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug
  }

  let counter = 1
  while (existingSlugs.includes(`${baseSlug}-${counter}`)) {
    counter++
  }

  return `${baseSlug}-${counter}`
}
