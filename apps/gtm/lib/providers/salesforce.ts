/**
 * Salesforce / Pardot Deployment Provider
 * 
 * Full implementation for Salesforce Marketing Cloud and Pardot
 * Handles landing pages, forms, emails, and performance tracking.
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
  EmailContent,
  DeployResult,
  PerformanceMetrics,
} from './types'

interface SalesforceTokens {
  accessToken: string
  refreshToken: string
  instanceUrl: string
  issuedAt: number
  expiresIn: number
}

export class SalesforceProvider implements DeploymentProvider {
  id = 'salesforce' as const
  name = 'Salesforce / Pardot'
  icon = 'cloud'
  description = 'Deploy landing pages, forms, and emails to Salesforce Marketing Cloud or Pardot'

  capabilities: ProviderCapabilities = {
    deployPage: true,
    deployForm: true,
    deployEmail: true,
    deploySequence: true, // Pardot Engagement Studio
    getPerformance: true,
    biDirectionalSync: true,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken) return false
    
    // Check if token is still valid
    const tokens = this.parseStoredTokens(connection)
    if (!tokens) return false
    
    const now = Date.now()
    const expiresAt = tokens.issuedAt + (tokens.expiresIn * 1000)
    
    return now < expiresAt
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.SALESFORCE_CLIENT_ID
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    
    // Salesforce OAuth 2.0 authorization endpoint
    const baseUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
    
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId!,
      redirect_uri: redirectUrl,
      state,
      scope: [
        'api',
        'refresh_token',
        'pardot_api',
        'content',
        'web',
        'full',
      ].join(' '),
    })
    
    return `${baseUrl}/services/oauth2/authorize?${params}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const supabase = createServiceClient()
    const clientId = process.env.SALESFORCE_CLIENT_ID
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET
    const redirectUri = process.env.SALESFORCE_REDIRECT_URI
    const baseUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'

    // Exchange code for tokens
    const tokenResponse = await fetch(`${baseUrl}/services/oauth2/token`, {
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
      const errorText = await tokenResponse.text()
      throw new Error(`Salesforce OAuth failed: ${errorText}`)
    }

    const tokens = await tokenResponse.json()

    // Get org info
    const userInfoResponse = await fetch(`${tokens.instance_url}/services/oauth2/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoResponse.json()

    // Store connection
    const connectionData = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      instanceUrl: tokens.instance_url,
      issuedAt: Date.now(),
      expiresIn: 7200, // Salesforce tokens typically valid for 2 hours
    }

    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'salesforce',
        access_token: encrypt(JSON.stringify(connectionData)),
        external_id: userInfo.organization_id,
        external_name: userInfo.organization_id,
        metadata: {
          userName: userInfo.name,
          userEmail: userInfo.email,
          instanceUrl: tokens.instance_url,
        },
        expires_at: new Date(Date.now() + 7200 * 1000).toISOString(),
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'salesforce',
      isConnected: true,
      externalId: userInfo.organization_id,
      externalName: userInfo.name,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    
    // Revoke token if possible
    const connection = await this.getConnection(workspaceId)
    if (connection?.accessToken) {
      try {
        const tokens = this.parseStoredTokens(connection)
        if (tokens) {
          await fetch(`${tokens.instanceUrl}/services/oauth2/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: tokens.accessToken }),
          })
        }
      } catch {
        // Ignore revoke errors
      }
    }
    
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'salesforce')
  }

  async deployPage(html: string, metadata: PageMetadata): Promise<DeployResult> {
    const tokens = await this.getValidTokens(metadata.workspaceId)
    if (!tokens) {
      return { success: false, externalId: '', error: 'Salesforce not connected' }
    }

    try {
      // Create Content Version (Salesforce's way to store HTML)
      const contentPayload = {
        Title: metadata.name,
        PathOnClient: `${metadata.slug || 'landing-page'}.html`,
        VersionData: Buffer.from(html).toString('base64'),
        FirstPublishLocationId: null, // Will be added to a library
      }

      const response = await fetch(
        `${tokens.instanceUrl}/services/data/v59.0/sobjects/ContentVersion`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contentPayload),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create content: ${errorText}`)
      }

      const result = await response.json()

      // For Pardot, we'd also create a Landing Page
      // This requires Pardot API access
      await this.createPardotLandingPage(tokens, html, metadata)

      return {
        success: true,
        externalId: result.id,
        url: `${tokens.instanceUrl}/lightning/r/ContentVersion/${result.id}/view`,
        metadata: {
          instanceUrl: tokens.instanceUrl,
          contentVersionId: result.id,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to deploy page'
      return { success: false, externalId: '', error: message }
    }
  }

  async deployForm(fields: FormField[], metadata: FormMetadata): Promise<DeployResult> {
    const tokens = await this.getValidTokens(metadata.workspaceId)
    if (!tokens) {
      return { success: false, externalId: '', error: 'Salesforce not connected' }
    }

    try {
      // Create Pardot Form via API
      const formFields = fields.map((field, index) => ({
        field_id: field.name,
        label: field.label,
        type: this.mapFieldType(field.type),
        required: field.required,
        order: index,
      }))

      // Pardot API v5
      const businessUnitId = await this.getPardotBusinessUnitId(tokens)
      
      const response = await fetch(
        `${tokens.instanceUrl}/api/v5/objects/forms`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
            'Pardot-Business-Unit-Id': businessUnitId,
          },
          body: JSON.stringify({
            name: metadata.name,
            campaign: { id: metadata.campaignId },
            fields: formFields,
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create Pardot form: ${errorText}`)
      }

      const result = await response.json()

      return {
        success: true,
        externalId: result.id,
        url: `${tokens.instanceUrl}/lightning/n/pi__pardot_form?id=${result.id}`,
        metadata: {
          pardotFormId: result.id,
          embedCode: result.embedCode,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create form'
      return { success: false, externalId: '', error: message }
    }
  }

  async deployEmail(content: EmailContent): Promise<DeployResult> {
    const tokens = await this.getValidTokens(content.metadata?.workspaceId || '')
    if (!tokens) {
      return { success: false, externalId: '', error: 'Salesforce not connected' }
    }

    try {
      const businessUnitId = await this.getPardotBusinessUnitId(tokens)

      // Create Pardot Email Template
      const response = await fetch(
        `${tokens.instanceUrl}/api/v5/objects/email-templates`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
            'Pardot-Business-Unit-Id': businessUnitId,
          },
          body: JSON.stringify({
            name: content.subject,
            subject: content.subject,
            htmlMessage: content.bodyHtml,
            textMessage: content.bodyText,
            isOneToOneEmail: false,
            isArchived: false,
            isAutoResponderEmail: false,
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create Pardot email: ${errorText}`)
      }

      const result = await response.json()

      return {
        success: true,
        externalId: result.id,
        url: `${tokens.instanceUrl}/lightning/n/pi__pardot_email_template?id=${result.id}`,
        metadata: {
          pardotEmailTemplateId: result.id,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create email'
      return { success: false, externalId: '', error: message }
    }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    const supabase = createServiceClient()
    
    // Get the deployment with Salesforce info
    const { data: deployment } = await supabase
      .from('deployments')
      .select('workspace_id, metadata')
      .eq('campaign_id', campaignId)
      .eq('provider', 'salesforce')
      .single()

    if (!deployment?.metadata?.pardotFormId) return null

    const tokens = await this.getValidTokens(deployment.workspace_id)
    if (!tokens) return null

    try {
      const businessUnitId = await this.getPardotBusinessUnitId(tokens)
      
      // Get form stats from Pardot
      const response = await fetch(
        `${tokens.instanceUrl}/api/v5/objects/forms/${deployment.metadata.pardotFormId}/stats`,
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Pardot-Business-Unit-Id': businessUnitId,
          },
        }
      )

      if (!response.ok) return null

      const stats = await response.json()

      return {
        formSubmissions: stats.totalSubmissions || 0,
        pageViews: stats.totalViews || 0,
        conversionRate: stats.conversionRate || 0,
        contactsCreated: stats.newProspects || 0,
      }
    } catch {
      return null
    }
  }

  // Helper methods
  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'salesforce')
      .single()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'salesforce',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private parseStoredTokens(connection: ProviderConnection): SalesforceTokens | null {
    if (!connection.accessToken) return null
    try {
      return JSON.parse(decrypt(connection.accessToken))
    } catch {
      return null
    }
  }

  private async getValidTokens(workspaceId: string): Promise<SalesforceTokens | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken) return null

    const tokens = this.parseStoredTokens(connection)
    if (!tokens) return null

    // Check if token needs refresh
    const now = Date.now()
    const expiresAt = tokens.issuedAt + (tokens.expiresIn * 1000)

    if (now >= expiresAt - 300000) { // Refresh 5 min before expiry
      return this.refreshTokens(workspaceId, tokens)
    }

    return tokens
  }

  private async refreshTokens(workspaceId: string, tokens: SalesforceTokens): Promise<SalesforceTokens | null> {
    const clientId = process.env.SALESFORCE_CLIENT_ID
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET
    const baseUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'

    try {
      const response = await fetch(`${baseUrl}/services/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
          client_id: clientId!,
          client_secret: clientSecret!,
        }),
      })

      if (!response.ok) return null

      const newTokens = await response.json()

      const updatedTokens: SalesforceTokens = {
        accessToken: newTokens.access_token,
        refreshToken: tokens.refreshToken, // Refresh token doesn't change
        instanceUrl: newTokens.instance_url || tokens.instanceUrl,
        issuedAt: Date.now(),
        expiresIn: 7200,
      }

      // Update stored tokens
      const supabase = createServiceClient()
      await supabase
        .from('provider_connections')
        .update({
          access_token: encrypt(JSON.stringify(updatedTokens)),
          expires_at: new Date(Date.now() + 7200 * 1000).toISOString(),
        })
        .eq('workspace_id', workspaceId)
        .eq('provider', 'salesforce')

      return updatedTokens
    } catch {
      return null
    }
  }

  private async getPardotBusinessUnitId(tokens: SalesforceTokens): Promise<string> {
    // Query Pardot Business Units
    const response = await fetch(
      `${tokens.instanceUrl}/api/v5/objects/business-units`,
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('Failed to get Pardot business unit')
    }

    const result = await response.json()
    return result.values?.[0]?.id || ''
  }

  private async createPardotLandingPage(
    tokens: SalesforceTokens,
    html: string,
    metadata: PageMetadata
  ): Promise<void> {
    try {
      const businessUnitId = await this.getPardotBusinessUnitId(tokens)
      
      await fetch(`${tokens.instanceUrl}/api/v5/objects/landing-pages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
          'Pardot-Business-Unit-Id': businessUnitId,
        },
        body: JSON.stringify({
          name: metadata.name,
          title: metadata.seoTitle || metadata.name,
          layoutTemplate: html,
          isDoNotIndex: false,
        }),
      })
    } catch {
      // Pardot landing page is optional - don't fail the whole deploy
      console.warn('Failed to create Pardot landing page')
    }
  }

  private mapFieldType(type: FormField['type']): string {
    const mapping: Record<FormField['type'], string> = {
      text: 'Text',
      email: 'Email',
      phone: 'Text',
      textarea: 'Textarea',
      select: 'Dropdown',
      checkbox: 'Checkbox',
      hidden: 'Hidden',
    }
    return mapping[type] || 'Text'
  }
}
