/**
 * WordPress Deployment Provider
 * 
 * Deploys pages and posts to WordPress sites via REST API.
 * Supports both WordPress.com and self-hosted with Application Passwords.
 */

import { encrypt, decrypt } from '@/lib/encryption'
import { createServiceClient } from '@/lib/supabase/service'

import type {
  DeploymentProvider,
  ProviderCapabilities,
  ProviderConnection,
  PageMetadata,
  FormField,
  FormMetadata,
  DeployResult,
  PerformanceMetrics,
} from './types'

export class WordPressProvider implements DeploymentProvider {
  id = 'wordpress' as const
  name = 'WordPress'
  icon = 'wordpress'
  description = 'Deploy landing pages and blog posts to WordPress'

  capabilities: ProviderCapabilities = {
    deployPage: true,
    deployForm: false, // WP forms need plugins
    deployEmail: false,
    deploySequence: false,
    getPerformance: true, // Via Jetpack Stats API
    biDirectionalSync: false,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.accessToken && !!connection?.metadata?.siteUrl
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    // WordPress uses Application Passwords or OAuth via Jetpack
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    return `/settings/connections/wordpress/setup?state=${state}&redirect=${encodeURIComponent(redirectUrl)}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    // Code contains the credentials from setup page
    const config = JSON.parse(Buffer.from(code, 'base64').toString())
    const { siteUrl, username, applicationPassword } = config

    // Validate credentials by making a test request
    const auth = Buffer.from(`${username}:${applicationPassword}`).toString('base64')
    
    const response = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    })

    if (!response.ok) {
      throw new Error('Invalid WordPress credentials')
    }

    const user = await response.json()

    // Store connection
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'wordpress',
        access_token: encrypt(JSON.stringify({ username, applicationPassword })),
        external_id: userId.toString(),
        external_name: user.name || user.username,
        metadata: {
          siteUrl,
          siteName: user.name,
          userId: userId,
          capabilities: user.capabilities,
        },
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .maybeSingle()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'wordpress',
      isConnected: true,
      externalId: userId.toString(),
      externalName: user.name || user.username,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'wordpress')
  }

  async deployPage(html: string, metadata: PageMetadata): Promise<DeployResult> {
    const client = await this.getClient(metadata.workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'WordPress not connected' }
    }

    try {
      // Create or update page
      const pageData = {
        title: metadata.name,
        content: html,
        status: 'draft', // Start as draft for review
        slug: metadata.slug,
        meta: {
          _sako_campaign_id: metadata.campaignId,
          _sako_seo_title: metadata.seoTitle,
          _sako_seo_description: metadata.seoDescription,
        },
      }

      const response = await fetch(`${client.siteUrl}/wp-json/wp/v2/pages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${client.auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pageData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create page: ${errorText}`)
      }

      const page = await response.json()

      return {
        success: true,
        externalId: page.id.toString(),
        url: page.link,
        metadata: {
          pageId: page.id,
          status: page.status,
          editLink: page.guid?.rendered,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to deploy page'
      return { success: false, externalId: '', error: message }
    }
  }

  async deployForm(fields: FormField[], metadata: FormMetadata): Promise<DeployResult> {
    return {
      success: false,
      externalId: '',
      error: 'WordPress form deployment requires Contact Form 7 or WPForms plugin. Use embedded forms instead.',
    }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    const supabase = createServiceClient()
    
    const { data: deployment } = await supabase
      .from('deployments')
      .select('workspace_id, metadata')
      .eq('campaign_id', campaignId)
      .eq('provider', 'wordpress')
      .maybeSingle()

    if (!deployment?.metadata?.pageId) return null

    const client = await this.getClient(deployment.workspace_id)
    if (!client) return null

    try {
      // Try Jetpack Stats API if available
      const statsResponse = await fetch(
        `${client.siteUrl}/wp-json/jetpack/v4/stats/post/${deployment.metadata.pageId}`,
        {
          headers: { Authorization: `Basic ${client.auth}` },
        }
      )

      if (statsResponse.ok) {
        const stats = await statsResponse.json()
        return {
          pageViews: stats.views || 0,
          uniqueVisitors: stats.visitors || 0,
        }
      }

      // Fallback: just return basic page info
      return null
    } catch {
      return null
    }
  }

  /**
   * Update an existing page
   */
  async updatePage(
    workspaceId: string,
    pageId: string,
    html: string,
    metadata?: Partial<PageMetadata>
  ): Promise<DeployResult> {
    const client = await this.getClient(workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'WordPress not connected' }
    }

    try {
      const updateData: any = {
        content: html,
      }

      if (metadata?.name) updateData.title = metadata.name
      if (metadata?.slug) updateData.slug = metadata.slug

      const response = await fetch(`${client.siteUrl}/wp-json/wp/v2/pages/${pageId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${client.auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        throw new Error('Failed to update page')
      }

      const page = await response.json()

      return {
        success: true,
        externalId: page.id.toString(),
        url: page.link,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update page'
      return { success: false, externalId: '', error: message }
    }
  }

  /**
   * Publish a draft page
   */
  async publishPage(workspaceId: string, pageId: string): Promise<DeployResult> {
    const client = await this.getClient(workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'WordPress not connected' }
    }

    try {
      const response = await fetch(`${client.siteUrl}/wp-json/wp/v2/pages/${pageId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${client.auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'publish' }),
      })

      if (!response.ok) {
        throw new Error('Failed to publish page')
      }

      const page = await response.json()

      return {
        success: true,
        externalId: page.id.toString(),
        url: page.link,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to publish page'
      return { success: false, externalId: '', error: message }
    }
  }

  // Helper methods
  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'wordpress')
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'wordpress',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private async getClient(workspaceId: string): Promise<{
    siteUrl: string
    auth: string
  } | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken || !connection?.metadata?.siteUrl) return null

    try {
      const credentials = JSON.parse(decrypt(connection.accessToken))
      const auth = Buffer.from(
        `${credentials.username}:${credentials.applicationPassword}`
      ).toString('base64')

      return {
        siteUrl: connection.metadata.siteUrl as string,
        auth,
      }
    } catch {
      return null
    }
  }
}
