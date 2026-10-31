/**
 * Webflow Deployment Provider
 * 
 * Handles deployment of landing pages to Webflow CMS.
 * Supports creating CMS items for programmatic page generation.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { encrypt, decrypt } from '@/lib/encryption'
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

const WEBFLOW_API_BASE = 'https://api.webflow.com/v2'

export class WebflowProvider implements DeploymentProvider {
  id = 'webflow' as const
  name = 'Webflow'
  icon = 'webflow'
  description = 'Publish landing pages directly to Webflow CMS'

  capabilities: ProviderCapabilities = {
    deployPage: true,
    deployForm: true, // Via Webflow Forms
    deployEmail: false,
    deploySequence: false,
    getPerformance: false, // Would require Webflow Analytics API
    biDirectionalSync: false,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return connection !== null
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.WEBFLOW_CLIENT_ID
    if (!clientId) {
      throw new Error(
        'Webflow integration requires WEBFLOW_CLIENT_ID. ' +
        'Get OAuth credentials from https://webflow.com/dashboard/integrations'
      )
    }
    
    const scopes = [
      'sites:read',
      'sites:write',
      'pages:read',
      'pages:write',
      'cms:read',
      'cms:write',
    ].join(' ')

    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')

    return `https://webflow.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${encodeURIComponent(scopes)}&state=${state}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const clientId = process.env.WEBFLOW_CLIENT_ID
    const clientSecret = process.env.WEBFLOW_CLIENT_SECRET
    const redirectUri = process.env.WEBFLOW_REDIRECT_URI
    
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'Webflow integration requires WEBFLOW_CLIENT_ID, WEBFLOW_CLIENT_SECRET, and WEBFLOW_REDIRECT_URI. ' +
        'Get OAuth credentials from https://webflow.com/dashboard/integrations'
      )
    }
    
    const supabase = createServiceClient()

    const response = await fetch('https://api.webflow.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to exchange Webflow OAuth code')
    }

    const tokens = await response.json()

    // Get authorized sites
    const sitesResponse = await fetch(`${WEBFLOW_API_BASE}/sites`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const sites = await sitesResponse.json()
    const primarySite = sites.sites?.[0]

    const { data: connection, error } = await supabase
      .from('webflow_connections')
      .upsert({
        workspace_id: workspaceId,
        access_token_encrypted: encrypt(tokens.access_token),
        site_id: primarySite?.id || null,
        site_name: primarySite?.name || null,
        domain: primarySite?.customDomains?.[0]?.url || primarySite?.shortName + '.webflow.io',
      }, { onConflict: 'workspace_id' })
      .select()
      .maybeSingle()

    if (error) {
      throw new Error('Failed to save Webflow connection')
    }

    return {
      id: connection.id,
      workspaceId: connection.workspace_id,
      provider: 'webflow',
      isConnected: true,
      externalId: connection.site_id,
      externalName: connection.site_name,
      metadata: { domain: connection.domain },
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('webflow_connections')
      .delete()
      .eq('workspace_id', workspaceId)
  }

  async deployPage(html: string, metadata: PageMetadata): Promise<DeployResult> {
    const connection = await this.getConnection(metadata.workspaceId)
    if (!connection) {
      return { success: false, externalId: '', error: 'Webflow not connected' }
    }

    const accessToken = await this.getAccessToken(metadata.workspaceId)
    if (!accessToken) {
      return { success: false, externalId: '', error: 'Invalid access token' }
    }

    try {
      // If collectionId is provided, create a CMS item
      if (metadata.collectionId) {
        return await this.createCmsItem(accessToken, connection, html, metadata)
      }

      // Otherwise, create a static page
      return await this.createStaticPage(accessToken, connection, html, metadata)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to deploy to Webflow'
      return { success: false, externalId: '', error: message }
    }
  }

  async deployForm(_fields: FormField[], _metadata: FormMetadata): Promise<DeployResult> {
    // Webflow forms are typically created within the CMS/page content
    // We include form markup in the page HTML
    return {
      success: true,
      externalId: 'embedded-in-page',
      warnings: ['Form fields embedded in page content. Configure Webflow form settings in the designer.'],
    }
  }

  async getPerformance(_campaignId: string): Promise<PerformanceMetrics | null> {
    // Webflow Analytics API requires Enterprise plan
    return null
  }

  // Private methods
  private async getConnection(workspaceId: string): Promise<{
    siteId: string
    domain: string
    siteName: string
  } | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('webflow_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!data) return null

    return {
      siteId: data.site_id,
      domain: data.domain,
      siteName: data.site_name,
    }
  }

  private async getAccessToken(workspaceId: string): Promise<string | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('webflow_connections')
      .select('access_token_encrypted')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!data?.access_token_encrypted) return null
    return decrypt(data.access_token_encrypted)
  }

  private async createCmsItem(
    accessToken: string,
    connection: { siteId: string; domain: string },
    html: string,
    metadata: PageMetadata
  ): Promise<DeployResult> {
    if (!metadata.collectionId) {
      return { success: false, externalId: '', error: 'Collection ID required for CMS items' }
    }

    const response = await fetch(
      `${WEBFLOW_API_BASE}/collections/${metadata.collectionId}/items`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isArchived: false,
          isDraft: false,
          fieldData: {
            name: metadata.name,
            slug: metadata.slug,
            'page-content': html, // Assumes a rich text field named 'page-content'
            'seo-title': metadata.seoTitle || metadata.name,
            'seo-description': metadata.seoDescription || '',
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Webflow CMS item creation failed: ${error}`)
    }

    const item = await response.json()

    // Publish the item
    await fetch(
      `${WEBFLOW_API_BASE}/collections/${metadata.collectionId}/items/publish`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds: [item.id] }),
      }
    )

    return {
      success: true,
      externalId: item.id,
      url: `https://${connection.domain}/${metadata.slug}`,
      metadata: {
        collectionId: metadata.collectionId,
        isPublished: true,
      },
    }
  }

  private async createStaticPage(
    accessToken: string,
    connection: { siteId: string; domain: string },
    html: string,
    metadata: PageMetadata
  ): Promise<DeployResult> {
    // Create a static page
    const response = await fetch(
      `${WEBFLOW_API_BASE}/sites/${connection.siteId}/pages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slug: metadata.slug,
          title: metadata.name,
          seo: {
            title: metadata.seoTitle || metadata.name,
            description: metadata.seoDescription || '',
          },
          openGraph: {
            title: metadata.seoTitle || metadata.name,
            description: metadata.seoDescription || '',
          },
          // Note: Webflow Pages API has limitations on custom HTML
          // Full HTML injection requires the Designer API or CMS approach
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Webflow page creation failed: ${error}`)
    }

    const page = await response.json()

    return {
      success: true,
      externalId: page.id,
      url: `https://${connection.domain}/${metadata.slug}`,
      warnings: [
        'Static page created. Custom HTML content may need to be added via Webflow Designer.',
        'Consider using CMS collection for full HTML support.',
      ],
    }
  }
}
