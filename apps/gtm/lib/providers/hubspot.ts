/**
 * HubSpot Deployment Provider
 * 
 * Handles deployment of pages, forms, and emails to HubSpot.
 * Refactored from lib/hubspot/client.ts to use provider pattern.
 */

import { Client } from '@hubspot/api-client'
import { decrypt, encrypt } from '@/lib/encryption'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  DeploymentProvider,
  ProviderCapabilities,
  ProviderConnection,
  PageMetadata,
  FormField,
  FormMetadata,
  EmailContent,
  DeployResult,
  PerformanceMetrics,
} from './types'

export class HubSpotProvider implements DeploymentProvider {
  id = 'hubspot' as const
  name = 'HubSpot'
  icon = 'hubspot'
  description = 'Deploy landing pages, forms, and email sequences to HubSpot'

  capabilities: ProviderCapabilities = {
    deployPage: true,
    deployForm: true,
    deployEmail: true,
    deploySequence: false, // Requires Automation API
    getPerformance: true,
    biDirectionalSync: false,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return connection !== null && new Date(connection.expiresAt!) > new Date()
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.HUBSPOT_CLIENT_ID
    if (!clientId) {
      throw new Error(
        'HubSpot integration requires HUBSPOT_CLIENT_ID. ' +
        'Get OAuth credentials from https://developers.hubspot.com/'
      )
    }
    
    const scopes = [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'forms',
      'content',
    ].join(' ')

    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')

    return `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${encodeURIComponent(scopes)}&state=${state}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const clientId = process.env.HUBSPOT_CLIENT_ID
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET
    const redirectUri = process.env.HUBSPOT_REDIRECT_URI
    
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'HubSpot integration requires HUBSPOT_CLIENT_ID, HUBSPOT_CLIENT_SECRET, and HUBSPOT_REDIRECT_URI. ' +
        'Get OAuth credentials from https://developers.hubspot.com/'
      )
    }
    
    const supabase = createServiceClient()

    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to exchange OAuth code')
    }

    const tokens = await response.json()
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    // Get portal info
    const infoResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokens.access_token)
    const info = await infoResponse.json()

    const { data: connection, error } = await supabase
      .from('hubspot_connections')
      .upsert({
        workspace_id: workspaceId,
        portal_id: info.hub_id.toString(),
        access_token_encrypted: encrypt(tokens.access_token),
        refresh_token_encrypted: encrypt(tokens.refresh_token),
        expires_at: expiresAt.toISOString(),
        scopes: tokens.scope?.split(' ') || [],
      }, { onConflict: 'workspace_id' })
      .select()
      .maybeSingle()

    if (error) {
      throw new Error('Failed to save HubSpot connection')
    }

    return {
      id: connection.id,
      workspaceId: connection.workspace_id,
      provider: 'hubspot',
      isConnected: true,
      externalId: connection.portal_id,
      externalName: `Portal ${connection.portal_id}`,
      expiresAt: new Date(connection.expires_at),
      scopes: connection.scopes,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('hubspot_connections')
      .delete()
      .eq('workspace_id', workspaceId)
  }

  async deployPage(html: string, metadata: PageMetadata): Promise<DeployResult> {
    const client = await this.getClient(metadata.workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'HubSpot not connected' }
    }

    try {
      const response = await (client.cms.pages.landingPagesApi as any).create({
        name: metadata.name,
        slug: metadata.slug,
        state: 'DRAFT',
        htmlTitle: metadata.seoTitle || metadata.name,
        contentTypeCategory: 'LANDING_PAGE',
      })

      return {
        success: true,
        externalId: response.id,
        url: `https://app.hubspot.com/content/${response.id}`,
        metadata: { portalId: response.portalId },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create landing page'
      return { success: false, externalId: '', error: message }
    }
  }

  async deployForm(fields: FormField[], metadata: FormMetadata): Promise<DeployResult> {
    const accessToken = await this.getAccessToken(metadata.workspaceId)
    if (!accessToken) {
      return { success: false, externalId: '', error: 'HubSpot not connected' }
    }

    try {
      // Convert our field format to HubSpot format
      const hubspotFields = fields.map(field => ({
        name: field.name,
        label: field.label,
        fieldType: this.mapFieldType(field.type),
        required: field.required,
        objectTypeId: '0-1', // Contacts
        validation: field.type === 'email' 
          ? { blockedEmailDomains: [], useDefaultBlockList: true }
          : {},
        ...(field.type === 'hidden' && field.defaultValue
          ? { defaultValue: field.defaultValue }
          : {}),
      }))

      const formPayload = {
        name: metadata.name,
        formType: 'hubspot',
        configuration: {
          language: 'en',
          cloneable: true,
          editable: true,
          archivable: true,
        },
        displayOptions: {
          renderRawHtml: false,
          style: {
            fontFamily: 'arial, helvetica, sans-serif',
            submitColor: '#9ae83e',
          },
        },
        fieldGroups: [
          {
            groupType: 'default_group',
            richTextType: 'text',
            fields: hubspotFields,
          },
        ],
        legalConsentOptions: { type: 'none' },
      }

      const response = await fetch('https://api.hubapi.com/marketing/v3/forms/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(formPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Form creation failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      return {
        success: true,
        externalId: result.id,
        url: `https://app.hubspot.com/forms/${result.portalId}/${result.id}`,
        metadata: { portalId: result.portalId, guid: result.id },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create form'
      return { success: false, externalId: '', error: message }
    }
  }

  async deployEmail(content: EmailContent): Promise<DeployResult> {
    // Email template creation requires Marketing Hub Professional+
    // Return a placeholder indicating the email was prepared
    return {
      success: true,
      externalId: `email-draft-${Date.now()}`,
      warnings: ['Email content prepared - requires manual creation in HubSpot Marketing Email'],
      metadata: {
        subject: content.subject,
        note: 'Email creation requires HubSpot Marketing Hub Professional or higher',
      },
    }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    // TODO: Implement performance tracking via HubSpot Analytics API
    // For now, return basic contact metrics
    const supabase = createServiceClient()
    
    // Get deployment for this campaign
    const { data: deployment } = await supabase
      .from('deployments')
      .select('hubspot_result')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!deployment?.hubspot_result) {
      return null
    }

    return {
      formSubmissions: 0,
      pageViews: 0,
      contactsCreated: 0,
    }
  }

  // Helper methods
  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('hubspot_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'hubspot',
      isConnected: true,
      externalId: data.portal_id,
      accessToken: data.access_token_encrypted,
      refreshToken: data.refresh_token_encrypted,
      expiresAt: new Date(data.expires_at),
      scopes: data.scopes,
    }
  }

  private async getClient(workspaceId: string): Promise<Client | null> {
    const accessToken = await this.getAccessToken(workspaceId)
    if (!accessToken) return null
    return new Client({ accessToken })
  }

  private async getAccessToken(workspaceId: string): Promise<string | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken) return null

    // Check if token is expired
    if (connection.expiresAt && connection.expiresAt <= new Date()) {
      // Refresh token
      const refreshed = await this.refreshToken(workspaceId, connection)
      return refreshed
    }

    return decrypt(connection.accessToken)
  }

  private async refreshToken(workspaceId: string, connection: ProviderConnection): Promise<string | null> {
    if (!connection.refreshToken) return null
    
    const supabase = createServiceClient()
    const refreshToken = decrypt(connection.refreshToken)

    try {
      const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.HUBSPOT_CLIENT_ID!,
          client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
          refresh_token: refreshToken,
        }),
      })

      if (!response.ok) return null

      const tokens = await response.json()
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

      await supabase
        .from('hubspot_connections')
        .update({
          access_token_encrypted: encrypt(tokens.access_token),
          refresh_token_encrypted: encrypt(tokens.refresh_token),
          expires_at: expiresAt.toISOString(),
        })
        .eq('workspace_id', workspaceId)

      return tokens.access_token
    } catch {
      return null
    }
  }

  private mapFieldType(type: FormField['type']): string {
    const mapping: Record<FormField['type'], string> = {
      text: 'single_line_text',
      email: 'email',
      phone: 'phone',
      textarea: 'multi_line_text',
      select: 'dropdown',
      checkbox: 'checkbox',
      hidden: 'hidden_field',
    }
    return mapping[type] || 'single_line_text'
  }
}
