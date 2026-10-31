/**
 * Marketo Deployment Provider
 * 
 * Full implementation for Adobe Marketo Engage
 * Handles landing pages, forms, emails, and smart campaigns.
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

interface MarketoTokens {
  accessToken: string
  tokenType: string
  expiresAt: number
  scope: string
}

export class MarketoProvider implements DeploymentProvider {
  id = 'marketo' as const
  name = 'Marketo'
  icon = 'marketo'
  description = 'Deploy landing pages, forms, and emails to Adobe Marketo Engage'

  capabilities: ProviderCapabilities = {
    deployPage: true,
    deployForm: true,
    deployEmail: true,
    deploySequence: true, // Smart Campaigns
    getPerformance: true,
    biDirectionalSync: true,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.metadata?.munchkinId
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    // Marketo uses REST API with client credentials, not OAuth redirect
    // Return a URL to the setup page instead
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    return `/settings/connections/marketo/setup?state=${state}&redirect=${encodeURIComponent(redirectUrl)}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    // For Marketo, code contains the JSON config from setup page
    const config = JSON.parse(Buffer.from(code, 'base64').toString())
    const { munchkinId, clientId, clientSecret } = config

    // Validate credentials by getting access token
    const tokens = await this.getAccessToken(munchkinId, clientId, clientSecret)

    // Store connection
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'marketo',
        access_token: encrypt(JSON.stringify({
          munchkinId,
          clientId,
          clientSecret,
        })),
        external_id: munchkinId,
        external_name: `Marketo (${munchkinId})`,
        metadata: {
          munchkinId,
          baseUrl: `https://${munchkinId}.mktorest.com`,
        },
        expires_at: new Date(tokens.expiresAt).toISOString(),
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'marketo',
      isConnected: true,
      externalId: munchkinId,
      externalName: `Marketo (${munchkinId})`,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'marketo')
  }

  async deployPage(html: string, metadata: PageMetadata): Promise<DeployResult> {
    const client = await this.getClient(metadata.workspaceId)
    if (!client) {
      return { success: false, externalId: '', error: 'Marketo not connected' }
    }

    try {
      // First, create a landing page template
      const templateResponse = await fetch(`${client.baseUrl}/rest/asset/v1/landingPageTemplates.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          name: `${metadata.name} Template`,
          folder: JSON.stringify({ id: client.folderId, type: 'Folder' }),
          templateType: 'freeForm',
        }),
      })

      const templateResult = await templateResponse.json()
      if (!templateResult.success) {
        throw new Error(templateResult.errors?.[0]?.message || 'Failed to create template')
      }

      const templateId = templateResult.result[0].id

      // Update template content
      await fetch(`${client.baseUrl}/rest/asset/v1/landingPageTemplate/${templateId}/content.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          content: html,
        }),
      })

      // Create landing page from template
      const pageResponse = await fetch(`${client.baseUrl}/rest/asset/v1/landingPages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          name: metadata.name,
          folder: JSON.stringify({ id: client.folderId, type: 'Folder' }),
          template: templateId.toString(),
          title: metadata.seoTitle || metadata.name,
          description: metadata.seoDescription || '',
          urlPath: metadata.slug || metadata.name.toLowerCase().replace(/\s+/g, '-'),
        }),
      })

      const pageResult = await pageResponse.json()
      if (!pageResult.success) {
        throw new Error(pageResult.errors?.[0]?.message || 'Failed to create landing page')
      }

      const page = pageResult.result[0]

      return {
        success: true,
        externalId: page.id.toString(),
        url: page.url,
        metadata: {
          templateId,
          status: page.status,
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
      return { success: false, externalId: '', error: 'Marketo not connected' }
    }

    try {
      // Create form
      const formResponse = await fetch(`${client.baseUrl}/rest/asset/v1/forms.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          name: metadata.name,
          folder: JSON.stringify({ id: client.folderId, type: 'Folder' }),
          description: `Form created by Sako Composer for campaign ${metadata.campaignId}`,
        }),
      })

      const formResult = await formResponse.json()
      if (!formResult.success) {
        throw new Error(formResult.errors?.[0]?.message || 'Failed to create form')
      }

      const form = formResult.result[0]

      // Add fields to form
      for (const field of fields) {
        await fetch(`${client.baseUrl}/rest/asset/v1/form/${form.id}/fields.json`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client.accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            fieldId: this.getMarketoFieldId(field.name),
            label: field.label,
            required: field.required.toString(),
            fieldWidth: '100%',
          }),
        })
      }

      // Approve form
      await fetch(`${client.baseUrl}/rest/asset/v1/form/${form.id}/approveDraft.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
        },
      })

      return {
        success: true,
        externalId: form.id.toString(),
        url: `${client.baseUrl.replace('mktorest', 'app-ab')}/form/${form.id}`,
        metadata: {
          embedCode: form.embedCode,
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
      return { success: false, externalId: '', error: 'Marketo not connected' }
    }

    try {
      // Create email
      const emailResponse = await fetch(`${client.baseUrl}/rest/asset/v1/emails.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          name: content.subject,
          folder: JSON.stringify({ id: client.folderId, type: 'Folder' }),
          template: client.emailTemplateId?.toString() || '1', // Default template
          subject: content.subject,
          fromName: content.fromName || 'Marketing',
          fromEmail: content.fromEmail || 'marketing@example.com',
        }),
      })

      const emailResult = await emailResponse.json()
      if (!emailResult.success) {
        throw new Error(emailResult.errors?.[0]?.message || 'Failed to create email')
      }

      const email = emailResult.result[0]

      // Update email content
      await fetch(`${client.baseUrl}/rest/asset/v1/email/${email.id}/content.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            type: 'HTML',
            value: content.bodyHtml,
          },
        ]),
      })

      return {
        success: true,
        externalId: email.id.toString(),
        url: `${client.baseUrl.replace('mktorest', 'app-ab')}/email/${email.id}`,
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
      .eq('provider', 'marketo')
      .single()

    if (!deployment?.metadata?.formId && !deployment?.metadata?.pageId) return null

    const client = await this.getClient(deployment.workspace_id)
    if (!client) return null

    try {
      // Get landing page stats
      if (deployment.metadata.pageId) {
        const statsResponse = await fetch(
          `${client.baseUrl}/rest/asset/v1/landingPage/${deployment.metadata.pageId}/visitors.json`,
          {
            headers: { Authorization: `Bearer ${client.accessToken}` },
          }
        )

        if (statsResponse.ok) {
          const stats = await statsResponse.json()
          return {
            pageViews: stats.result?.totalVisitors || 0,
            formSubmissions: stats.result?.conversions || 0,
            conversionRate: stats.result?.conversionRate || 0,
          }
        }
      }

      return null
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
      .eq('provider', 'marketo')
      .single()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'marketo',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private async getAccessToken(munchkinId: string, clientId: string, clientSecret: string): Promise<MarketoTokens> {
    const baseUrl = `https://${munchkinId}.mktorest.com`
    
    const response = await fetch(
      `${baseUrl}/identity/oauth/token?grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
      { method: 'GET' }
    )

    if (!response.ok) {
      throw new Error('Failed to authenticate with Marketo')
    }

    const result = await response.json()
    
    return {
      accessToken: result.access_token,
      tokenType: result.token_type,
      expiresAt: Date.now() + (result.expires_in * 1000),
      scope: result.scope,
    }
  }

  private async getClient(workspaceId: string): Promise<{
    baseUrl: string
    accessToken: string
    folderId: number
    emailTemplateId?: number
  } | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken) return null

    try {
      const credentials = JSON.parse(decrypt(connection.accessToken))
      const tokens = await this.getAccessToken(
        credentials.munchkinId,
        credentials.clientId,
        credentials.clientSecret
      )

      return {
        baseUrl: `https://${credentials.munchkinId}.mktorest.com`,
        accessToken: tokens.accessToken,
        folderId: (connection.metadata?.folderId as number) || 1, // Default to root folder
        emailTemplateId: connection.metadata?.emailTemplateId as number | undefined,
      }
    } catch {
      return null
    }
  }

  private getMarketoFieldId(fieldName: string): string {
    // Map common field names to Marketo field IDs
    const mapping: Record<string, string> = {
      email: 'Email',
      firstname: 'FirstName',
      first_name: 'FirstName',
      lastName: 'LastName',
      last_name: 'LastName',
      company: 'Company',
      phone: 'Phone',
      website: 'Website',
    }
    return mapping[fieldName.toLowerCase()] || fieldName
  }
}
