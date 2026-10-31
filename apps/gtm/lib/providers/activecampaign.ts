/**
 * ActiveCampaign Deployment Provider
 * 
 * Full implementation for ActiveCampaign
 * Handles contacts, forms, automations, and campaigns.
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

export class ActiveCampaignProvider implements DeploymentProvider {
  id = 'activecampaign' as const
  name = 'ActiveCampaign'
  icon = 'mail'
  description = 'Deploy forms, emails, and automations to ActiveCampaign'

  capabilities: ProviderCapabilities = {
    deployPage: false, // AC doesn't have native landing pages
    deployForm: true,
    deployEmail: true,
    deploySequence: true, // Automations
    getPerformance: true,
    biDirectionalSync: true,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.metadata?.accountUrl
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    // ActiveCampaign uses API key auth, not OAuth
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    return `/settings/connections/activecampaign/setup?state=${state}&redirect=${encodeURIComponent(redirectUrl)}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    // Code contains the API config
    const config = JSON.parse(Buffer.from(code, 'base64').toString())
    const { accountUrl, apiKey } = config

    // Validate credentials
    const response = await fetch(`${accountUrl}/api/3/users/me`, {
      headers: { 'Api-Token': apiKey },
    })

    if (!response.ok) {
      throw new Error('Invalid ActiveCampaign credentials')
    }

    const user = await response.json()

    // Store connection
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'activecampaign',
        access_token: encrypt(apiKey),
        external_id: user.userId.toString(),
        external_name: user.user.email,
        metadata: {
          accountUrl,
          userName: user.user.username,
          userEmail: user.user.email,
        },
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .maybeSingle()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'activecampaign',
      isConnected: true,
      externalId: user.userId.toString(),
      externalName: user.user.email,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'activecampaign')
  }

  async deployPage(): Promise<DeployResult> {
    return {
      success: false,
      externalId: '',
      error: 'ActiveCampaign does not support landing pages. Use forms instead.',
    }
  }

  async deployForm(fields: FormField[], metadata: FormMetadata): Promise<DeployResult> {
    const client = await this.getClient(metadata.workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'ActiveCampaign not connected' }
    }

    try {
      // Create form
      const formPayload = {
        form: {
          name: metadata.name,
          action: 'Subscribe to list',
          actiondata: {
            list: '1', // TODO: Allow list selection
          },
          submit: 'Submit',
        },
      }

      const response = await fetch(`${client.accountUrl}/api/3/forms`, {
        method: 'POST',
        headers: {
          'Api-Token': client.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formPayload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create form: ${errorText}`)
      }

      const result = await response.json()
      const form = result.form

      // Add custom fields if needed
      for (const field of fields) {
        if (!['email', 'firstname', 'lastname', 'phone'].includes(field.name.toLowerCase())) {
          // Create custom field
          await fetch(`${client.accountUrl}/api/3/fields`, {
            method: 'POST',
            headers: {
              'Api-Token': client.apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              field: {
                title: field.label,
                type: this.mapFieldType(field.type),
                perstag: field.name.toUpperCase(),
              },
            }),
          })
        }
      }

      return {
        success: true,
        externalId: form.id.toString(),
        url: `${client.accountUrl}/app/forms/${form.id}`,
        metadata: {
          embedCode: form.code,
          formUrl: form.url,
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
      return { success: false, externalId: '', error: 'ActiveCampaign not connected' }
    }

    try {
      // Create campaign
      const campaignPayload = {
        campaign: {
          type: 'single',
          name: content.subject,
          sdate: null, // Send immediately or schedule
          status: 0, // Draft
          public: 1,
          tracklinks: 'all',
          trackopens: 1,
          trackreads: 1,
          analytics_campaign_name: content.subject,
        },
      }

      const campaignResponse = await fetch(`${client.accountUrl}/api/3/campaigns`, {
        method: 'POST',
        headers: {
          'Api-Token': client.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(campaignPayload),
      })

      if (!campaignResponse.ok) {
        throw new Error('Failed to create campaign')
      }

      const campaignResult = await campaignResponse.json()
      const campaign = campaignResult.campaign

      // Create message for campaign
      const messagePayload = {
        message: {
          ed_instanceid: campaign.id,
          ed_version: 2,
          subject: content.subject,
          fromname: content.fromName || 'Marketing',
          fromemail: content.fromEmail || 'marketing@example.com',
          html: content.bodyHtml,
          text: content.bodyText || '',
        },
      }

      await fetch(`${client.accountUrl}/api/3/messages`, {
        method: 'POST',
        headers: {
          'Api-Token': client.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      })

      return {
        success: true,
        externalId: campaign.id.toString(),
        url: `${client.accountUrl}/app/campaigns/${campaign.id}`,
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
      .eq('provider', 'activecampaign')
      .maybeSingle()

    if (!deployment?.metadata?.acCampaignId) return null

    const client = await this.getClient(deployment.workspace_id)
    if (!client) return null

    try {
      const response = await fetch(
        `${client.accountUrl}/api/3/campaigns/${deployment.metadata.acCampaignId}`,
        {
          headers: { 'Api-Token': client.apiKey },
        }
      )

      if (!response.ok) return null

      const result = await response.json()
      const campaign = result.campaign

      return {
        emailsSent: campaign.send_amt || 0,
        emailsOpened: campaign.uniqueopens || 0,
        emailsClicked: campaign.linkclicks || 0,
        openRate: campaign.open_rate || 0,
        clickRate: campaign.click_rate || 0,
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
      .eq('provider', 'activecampaign')
      .maybeSingle()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'activecampaign',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private async getClient(workspaceId: string): Promise<{
    accountUrl: string
    apiKey: string
  } | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken || !connection?.metadata?.accountUrl) return null

    return {
      accountUrl: connection.metadata.accountUrl as string,
      apiKey: decrypt(connection.accessToken),
    }
  }

  private mapFieldType(type: FormField['type']): string {
    const mapping: Record<FormField['type'], string> = {
      text: 'text',
      email: 'text',
      phone: 'text',
      textarea: 'textarea',
      select: 'dropdown',
      checkbox: 'checkbox',
      hidden: 'hidden',
    }
    return mapping[type] || 'text'
  }
}
