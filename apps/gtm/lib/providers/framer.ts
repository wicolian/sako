/**
 * Framer Deployment Provider
 * 
 * Exports designs to Framer via API.
 * Supports page creation and component export.
 */

import { encrypt, decrypt } from '@/lib/encryption'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  DeploymentProvider,
  ProviderCapabilities,
  ProviderConnection,
  PageMetadata,
  DeployResult,
  PerformanceMetrics,
} from './types'

export class FramerProvider implements DeploymentProvider {
  id = 'framer' as const
  name = 'Framer'
  icon = 'framer'
  description = 'Export landing pages to Framer for design refinement'

  capabilities: ProviderCapabilities = {
    deployPage: true,
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    getPerformance: true, // Via Framer Analytics
    biDirectionalSync: true, // Can import from Framer too
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.accessToken
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.FRAMER_CLIENT_ID
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')

    return `https://framer.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=projects:write&state=${state}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const clientId = process.env.FRAMER_CLIENT_ID
    const clientSecret = process.env.FRAMER_CLIENT_SECRET
    const redirectUri = process.env.FRAMER_REDIRECT_URI

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.framer.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri!,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange Framer OAuth code')
    }

    const tokens = await tokenResponse.json()

    // Get user info
    const userResponse = await fetch('https://api.framer.com/v1/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const user = await userResponse.json()

    // Store connection
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'framer',
        access_token: encrypt(tokens.access_token),
        external_id: user.id,
        external_name: user.name || user.email,
        metadata: {
          userId: user.id,
          email: user.email,
          refreshToken: tokens.refresh_token,
        },
        expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'framer',
      isConnected: true,
      externalId: user.id,
      externalName: user.name || user.email,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'framer')
  }

  async deployPage(html: string, metadata: PageMetadata): Promise<DeployResult> {
    const accessToken = await this.getAccessToken(metadata.workspaceId)
    if (!accessToken) {
      return { success: false, externalId: '', error: 'Framer not connected' }
    }

    try {
      // Create a new project for the landing page
      const projectResponse = await fetch('https://api.framer.com/v1/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: metadata.name,
          template: 'blank',
        }),
      })

      if (!projectResponse.ok) {
        throw new Error('Failed to create Framer project')
      }

      const project = await projectResponse.json()

      // Create page in project with HTML content
      // Note: Framer API may require conversion to their internal format
      const pageResponse = await fetch(
        `https://api.framer.com/v1/projects/${project.id}/pages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: metadata.name,
            path: metadata.slug || '/',
            html: html, // Framer will convert to their format
          }),
        }
      )

      if (!pageResponse.ok) {
        // If HTML import fails, just return the project
        return {
          success: true,
          externalId: project.id,
          url: `https://framer.com/projects/${project.id}`,
          warnings: ['HTML import may require manual adjustment in Framer'],
          metadata: {
            projectId: project.id,
          },
        }
      }

      const page = await pageResponse.json()

      return {
        success: true,
        externalId: project.id,
        url: `https://framer.com/projects/${project.id}`,
        metadata: {
          projectId: project.id,
          pageId: page.id,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to deploy to Framer'
      return { success: false, externalId: '', error: message }
    }
  }

  async deployForm(): Promise<DeployResult> {
    return {
      success: false,
      externalId: '',
      error: 'Framer forms are configured within Framer projects',
    }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    const supabase = createServiceClient()
    
    const { data: deployment } = await supabase
      .from('deployments')
      .select('workspace_id, metadata')
      .eq('campaign_id', campaignId)
      .eq('provider', 'framer')
      .single()

    if (!deployment?.metadata?.projectId) return null

    const accessToken = await this.getAccessToken(deployment.workspace_id)
    if (!accessToken) return null

    try {
      // Get project analytics
      const response = await fetch(
        `https://api.framer.com/v1/projects/${deployment.metadata.projectId}/analytics`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )

      if (!response.ok) return null

      const analytics = await response.json()

      return {
        pageViews: analytics.pageViews || 0,
        uniqueVisitors: analytics.uniqueVisitors || 0,
        bounceRate: analytics.bounceRate,
        avgTimeOnPage: analytics.avgTimeOnPage,
      }
    } catch {
      return null
    }
  }

  /**
   * Export Framer project to HTML
   */
  async exportToHtml(workspaceId: string, projectId: string): Promise<string | null> {
    const accessToken = await this.getAccessToken(workspaceId)
    if (!accessToken) return null

    try {
      const response = await fetch(
        `https://api.framer.com/v1/projects/${projectId}/export?format=html`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )

      if (!response.ok) return null

      const data = await response.json()
      return data.html || null
    } catch {
      return null
    }
  }

  /**
   * List user's Framer projects
   */
  async listProjects(workspaceId: string): Promise<{ id: string; name: string }[]> {
    const accessToken = await this.getAccessToken(workspaceId)
    if (!accessToken) return []

    try {
      const response = await fetch('https://api.framer.com/v1/projects', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) return []

      const data = await response.json()
      return (data.projects || []).map((p: any) => ({
        id: p.id,
        name: p.name,
      }))
    } catch {
      return []
    }
  }

  // Helper methods
  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'framer')
      .single()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'framer',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private async getAccessToken(workspaceId: string): Promise<string | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken) return null

    return decrypt(connection.accessToken)
  }
}
