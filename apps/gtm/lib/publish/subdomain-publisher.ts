/**
 * Subdomain Publisher
 * 
 * Publish websites to subdomains with:
 * - Custom subdomain selection
 * - SSL certificate provisioning
 * - Version updates on same URL
 * - Private share links
 */

import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

// ============================================================================
// Types
// ============================================================================

export interface PublishedSite {
  id: string
  design_id: string
  workspace_id: string
  
  // URL
  subdomain: string
  custom_domain?: string
  full_url: string
  
  // Status
  status: 'pending' | 'provisioning' | 'active' | 'error'
  ssl_status: 'pending' | 'provisioning' | 'active' | 'error'
  
  // Private sharing
  is_password_protected: boolean
  password_hash?: string
  
  // Version
  version: number
  published_at: string
  
  // Stats
  view_count: number
  unique_visitors: number
  
  created_at: string
  updated_at: string
}

export interface PublishOptions {
  designId: string
  workspaceId: string
  subdomain: string
  customDomain?: string
  isPasswordProtected?: boolean
  password?: string
}

export interface ShareLink {
  id: string
  site_id: string
  code: string
  expires_at?: string
  max_views?: number
  view_count: number
  is_password_protected: boolean
  created_at: string
}

// ============================================================================
// Subdomain Publisher
// ============================================================================

export class SubdomainPublisher {
  private static readonly BASE_DOMAIN = process.env.PUBLISH_DOMAIN || 'sako.pub'

  /**
   * Publish a website
   */
  static async publish(options: PublishOptions): Promise<PublishedSite> {
    const { designId, workspaceId, subdomain, customDomain, isPasswordProtected, password } = options

    // Validate subdomain
    const validation = this.validateSubdomain(subdomain)
    if (!validation.valid) {
      throw new Error(validation.error!)
    }

    // Check availability
    const available = await this.isSubdomainAvailable(subdomain)
    if (!available) {
      throw new Error('This subdomain is already taken')
    }

    const supabase = createServiceClient()

    // Hash password if provided
    let passwordHash: string | undefined
    if (isPasswordProtected && password) {
      passwordHash = await this.hashPassword(password)
    }

    // Create or update published site
    const { data, error } = await supabase
      .from('published_sites')
      .upsert({
        design_id: designId,
        workspace_id: workspaceId,
        subdomain: subdomain.toLowerCase(),
        custom_domain: customDomain?.toLowerCase(),
        full_url: `https://${subdomain}.${this.BASE_DOMAIN}`,
        status: 'provisioning',
        ssl_status: 'provisioning',
        is_password_protected: isPasswordProtected || false,
        password_hash: passwordHash,
        version: 1,
        published_at: new Date().toISOString(),
      }, {
        onConflict: 'design_id',
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to publish: ${error.message}`)
    }

    // Update design with published URL
    await supabase
      .from('website_designs')
      .update({
        status: 'published',
        published_url: data.full_url,
        published_at: new Date().toISOString(),
        subdomain: subdomain.toLowerCase(),
        custom_domain: customDomain?.toLowerCase(),
      })
      .eq('id', designId)

    // Trigger deployment (in production, this would call your hosting provider)
    await this.triggerDeployment(data)

    return data
  }

  /**
   * Update a published site
   */
  static async update(designId: string): Promise<PublishedSite> {
    const supabase = createServiceClient()

    // Get existing site
    const { data: site, error: siteError } = await supabase
      .from('published_sites')
      .select('*')
      .eq('design_id', designId)
      .single()

    if (siteError || !site) {
      throw new Error('Site not found')
    }

    // Increment version
    const { data, error } = await supabase
      .from('published_sites')
      .update({
        version: site.version + 1,
        published_at: new Date().toISOString(),
        status: 'provisioning',
      })
      .eq('id', site.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update: ${error.message}`)
    }

    // Trigger redeployment
    await this.triggerDeployment(data)

    return data
  }

  /**
   * Unpublish a site
   */
  static async unpublish(designId: string): Promise<void> {
    const supabase = createServiceClient()

    // Delete published site
    const { error } = await supabase
      .from('published_sites')
      .delete()
      .eq('design_id', designId)

    if (error) {
      throw new Error(`Failed to unpublish: ${error.message}`)
    }

    // Update design status
    await supabase
      .from('website_designs')
      .update({
        status: 'draft',
        published_url: null,
        subdomain: null,
        custom_domain: null,
      })
      .eq('id', designId)
  }

  /**
   * Check subdomain availability
   */
  static async isSubdomainAvailable(subdomain: string): Promise<boolean> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('published_sites')
      .select('id')
      .eq('subdomain', subdomain.toLowerCase())
      .single()

    if (error && error.code === 'PGRST116') {
      return true // Not found = available
    }

    return !data
  }

  /**
   * Validate subdomain
   */
  static validateSubdomain(subdomain: string): { valid: boolean; error?: string } {
    if (!subdomain) {
      return { valid: false, error: 'Subdomain is required' }
    }

    if (subdomain.length < 3) {
      return { valid: false, error: 'Subdomain must be at least 3 characters' }
    }

    if (subdomain.length > 63) {
      return { valid: false, error: 'Subdomain must be 63 characters or less' }
    }

    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return { valid: false, error: 'Subdomain can only contain lowercase letters, numbers, and hyphens' }
    }

    if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
      return { valid: false, error: 'Subdomain cannot start or end with a hyphen' }
    }

    const reserved = [
      'www', 'app', 'api', 'admin', 'mail', 'ftp', 'blog',
      'help', 'support', 'status', 'docs', 'dev', 'test',
      'staging', 'prod', 'cdn', 'static', 'assets',
    ]

    if (reserved.includes(subdomain)) {
      return { valid: false, error: 'This subdomain is reserved' }
    }

    return { valid: true }
  }

  /**
   * Create a private share link
   */
  static async createShareLink(
    siteId: string,
    options?: {
      expiresInHours?: number
      maxViews?: number
      password?: string
    }
  ): Promise<ShareLink> {
    const supabase = createServiceClient()

    const code = crypto.randomBytes(16).toString('hex')
    let expiresAt: string | undefined
    
    if (options?.expiresInHours) {
      const expires = new Date()
      expires.setHours(expires.getHours() + options.expiresInHours)
      expiresAt = expires.toISOString()
    }

    const { data, error } = await supabase
      .from('share_links')
      .insert({
        site_id: siteId,
        code,
        expires_at: expiresAt,
        max_views: options?.maxViews,
        is_password_protected: !!options?.password,
        password_hash: options?.password ? await this.hashPassword(options.password) : undefined,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create share link: ${error.message}`)
    }

    return data
  }

  /**
   * Verify share link
   */
  static async verifyShareLink(
    code: string,
    password?: string
  ): Promise<{ valid: boolean; siteId?: string; error?: string }> {
    const supabase = createServiceClient()

    const { data: link, error } = await supabase
      .from('share_links')
      .select('*')
      .eq('code', code)
      .single()

    if (error || !link) {
      return { valid: false, error: 'Invalid link' }
    }

    // Check expiry
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return { valid: false, error: 'Link has expired' }
    }

    // Check max views
    if (link.max_views && link.view_count >= link.max_views) {
      return { valid: false, error: 'Link has reached maximum views' }
    }

    // Check password
    if (link.is_password_protected) {
      if (!password) {
        return { valid: false, error: 'Password required' }
      }
      const valid = await this.verifyPassword(password, link.password_hash)
      if (!valid) {
        return { valid: false, error: 'Invalid password' }
      }
    }

    // Increment view count
    await supabase
      .from('share_links')
      .update({ view_count: link.view_count + 1 })
      .eq('id', link.id)

    return { valid: true, siteId: link.site_id }
  }

  /**
   * Get published site by subdomain
   */
  static async getSiteBySubdomain(subdomain: string): Promise<PublishedSite | null> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('published_sites')
      .select('*')
      .eq('subdomain', subdomain.toLowerCase())
      .eq('status', 'active')
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get site: ${error.message}`)
    }

    return data
  }

  /**
   * Track page view
   */
  static async trackView(siteId: string, isUnique: boolean): Promise<void> {
    const supabase = createServiceClient()

    const updates: Record<string, unknown> = {
      view_count: supabase.rpc('increment', { column_name: 'view_count' }),
    }

    if (isUnique) {
      updates.unique_visitors = supabase.rpc('increment', { column_name: 'unique_visitors' })
    }

    await supabase
      .from('published_sites')
      .update({ view_count: supabase.rpc('increment_site_views', { site_id: siteId }) })
      .eq('id', siteId)
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private static async triggerDeployment(site: PublishedSite): Promise<void> {
    // In production, this would:
    // 1. Generate static HTML from the design
    // 2. Upload to CDN/hosting provider (Vercel, Netlify, Cloudflare)
    // 3. Configure DNS/SSL
    // 4. Update status when complete

    // For now, just update status to active after a delay
    const supabase = createServiceClient()

    setTimeout(async () => {
      await supabase
        .from('published_sites')
        .update({
          status: 'active',
          ssl_status: 'active',
        })
        .eq('id', site.id)
    }, 2000)
  }

  private static async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs')
    return bcrypt.hash(password, 10)
  }

  private static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs')
    return bcrypt.compare(password, hash)
  }
}

// ============================================================================
// URL Helpers
// ============================================================================

export function getPublishedUrl(subdomain: string): string {
  const baseDomain = process.env.PUBLISH_DOMAIN || 'sako.pub'
  return `https://${subdomain}.${baseDomain}`
}

export function getPreviewUrl(designId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.sako.ai'
  return `${baseUrl}/preview/${designId}`
}

export function getShareLinkUrl(code: string): string {
  const baseDomain = process.env.PUBLISH_DOMAIN || 'sako.app'
  return `https://${baseDomain}/s/${code}`
}
