/**
 * Mailchimp Deployment Provider
 * 
 * Full implementation for Mailchimp
 * Handles audiences, campaigns, landing pages, and automations.
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

export class MailchimpProvider implements DeploymentProvider {
  id = 'mailchimp' as const
  name = 'Mailchimp'
  icon = 'mail'
  description = 'Deploy landing pages, signup forms, and email campaigns to Mailchimp'

  capabilities: ProviderCapabilities = {
    deployPage: true, // Mailchimp has landing pages
    deployForm: true, // Embedded signup forms
    deployEmail: true,
    deploySequence: true, // Customer journeys
    getPerformance: true,
    biDirectionalSync: false,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.accessToken
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.MAILCHIMP_CLIENT_ID
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    
    return `https://login.mailchimp.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&state=${state}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const clientId = process.env.MAILCHIMP_CLIENT_ID
    const clientSecret = process.env.MAILCHIMP_CLIENT_SECRET
    const redirectUri = process.env.MAILCHIMP_REDIRECT_URI

    // Exchange code for token
    const tokenResponse = await fetch('https://login.mailchimp.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri!,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange Mailchimp OAuth code')
    }

    const tokens = await tokenResponse.json()

    // Get account metadata
    const metadataResponse = await fetch('https://login.mailchimp.com/oauth2/metadata', {
      headers: { Authorization: `OAuth ${tokens.access_token}` },
    })
    const metadata = await metadataResponse.json()

    // Store connection
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'mailchimp',
        access_token: encrypt(tokens.access_token),
        external_id: metadata.accountname,
        external_name: metadata.accountname,
        metadata: {
          dc: metadata.dc, // Data center
          apiEndpoint: metadata.api_endpoint,
          login: metadata.login,
        },
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .maybeSingle()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'mailchimp',
      isConnected: true,
      externalId: metadata.accountname,
      externalName: metadata.accountname,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'mailchimp')
  }

  async deployPage(html: string, metadata: PageMetadata): Promise<DeployResult> {
    const client = await this.getClient(metadata.workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'Mailchimp not connected' }
    }

    try {
      // Create landing page
      const response = await fetch(`${client.apiEndpoint}/landing-pages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: metadata.name,
          title: metadata.seoTitle || metadata.name,
          description: metadata.seoDescription || '',
          template: {
            id: 0, // Custom HTML
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create landing page: ${errorText}`)
      }

      const result = await response.json()

      // Update page content
      await fetch(`${client.apiEndpoint}/landing-pages/${result.id}/content`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: html,
        }),
      })

      return {
        success: true,
        externalId: result.id,
        url: result.url,
        metadata: {
          webId: result.web_id,
          status: result.status,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to deploy page'
      return { success: false, externalId: '', error: message }
    }
  }

  async deployForm(fields: FormField[], metadata: FormMetadata): Promise<DeployResult> {
    const client = await this.getClient(metadata.workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'Mailchimp not connected' }
    }

    try {
      // Get default list (or first list)
      const listsResponse = await fetch(`${client.apiEndpoint}/lists?count=1`, {
        headers: { Authorization: `Bearer ${client.accessToken}` },
      })
      const lists = await listsResponse.json()
      const listId = lists.lists?.[0]?.id

      if (!listId) {
        throw new Error('No Mailchimp audience found. Create an audience first.')
      }

      // Create signup form (embedded form)
      const response = await fetch(`${client.apiEndpoint}/lists/${listId}/signup-forms`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          header: metadata.name,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create signup form: ${errorText}`)
      }

      const result = await response.json()

      // Get embed code
      const embedResponse = await fetch(
        `${client.apiEndpoint}/lists/${listId}/signup-forms`,
        {
          headers: { Authorization: `Bearer ${client.accessToken}` },
        }
      )
      const embedData = await embedResponse.json()

      return {
        success: true,
        externalId: listId,
        url: `https://us1.admin.mailchimp.com/lists/members/?id=${listId}`,
        metadata: {
          listId,
          embedCode: embedData.signup_forms?.[0]?.embed_code || '',
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create form'
      return { success: false, externalId: '', error: message }
    }
  }

  async deployEmail(content: EmailContent): Promise<DeployResult> {
    const client = await this.getClient(content.metadata?.workspaceId || '')
    if (!client) {
      return { success: false, externalId: '', error: 'Mailchimp not connected' }
    }

    try {
      // Get default list
      const listsResponse = await fetch(`${client.apiEndpoint}/lists?count=1`, {
        headers: { Authorization: `Bearer ${client.accessToken}` },
      })
      const lists = await listsResponse.json()
      const listId = lists.lists?.[0]?.id

      if (!listId) {
        throw new Error('No Mailchimp audience found')
      }

      // Create campaign
      const campaignPayload = {
        type: 'regular',
        recipients: {
          list_id: listId,
        },
        settings: {
          subject_line: content.subject,
          preview_text: content.previewText || '',
          title: content.subject,
          from_name: content.fromName || 'Marketing',
          reply_to: content.fromEmail || 'marketing@example.com',
        },
      }

      const campaignResponse = await fetch(`${client.apiEndpoint}/campaigns`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaignPayload),
      })

      if (!campaignResponse.ok) {
        throw new Error('Failed to create campaign')
      }

      const campaign = await campaignResponse.json()

      // Set campaign content
      await fetch(`${client.apiEndpoint}/campaigns/${campaign.id}/content`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: content.bodyHtml,
          plain_text: content.bodyText,
        }),
      })

      return {
        success: true,
        externalId: campaign.id,
        url: `https://admin.mailchimp.com/campaigns/edit?id=${campaign.web_id}`,
        metadata: {
          campaignId: campaign.id,
          webId: campaign.web_id,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create email'
      return { success: false, externalId: '', error: message }
    }
  }

  async getPerformance(campaignId: string): Promise<PerformanceMetrics | null> {
    const supabase = createServiceClient()
    
    const { data: deployment } = await supabase
      .from('deployments')
      .select('workspace_id, metadata')
      .eq('campaign_id', campaignId)
      .eq('provider', 'mailchimp')
      .maybeSingle()

    if (!deployment?.metadata?.mcCampaignId) return null

    const client = await this.getClient(deployment.workspace_id)
    if (!client) return null

    try {
      const response = await fetch(
        `${client.apiEndpoint}/reports/${deployment.metadata.mcCampaignId}`,
        {
          headers: { Authorization: `Bearer ${client.accessToken}` },
        }
      )

      if (!response.ok) return null

      const report = await response.json()

      return {
        emailsSent: report.emails_sent || 0,
        emailsOpened: report.opens?.unique_opens || 0,
        emailsClicked: report.clicks?.unique_clicks || 0,
        openRate: report.opens?.open_rate || 0,
        clickRate: report.clicks?.click_rate || 0,
        unsubscribes: report.unsubscribed || 0,
        bounces: report.bounces?.hard_bounces || 0,
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
      .eq('provider', 'mailchimp')
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'mailchimp',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private async getClient(workspaceId: string): Promise<{
    apiEndpoint: string
    accessToken: string
  } | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken || !connection?.metadata?.apiEndpoint) return null

    return {
      apiEndpoint: connection.metadata.apiEndpoint as string,
      accessToken: decrypt(connection.accessToken),
    }
  }
}
