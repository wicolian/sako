/**
 * Slack Notification Provider
 * 
 * Sends notifications for campaign events, approvals, and alerts.
 * Supports channel selection and rich message formatting.
 */

import { encrypt, decrypt } from '@/lib/encryption'
import { createServiceClient } from '@/lib/supabase/service'
import type {
  DeploymentProvider,
  ProviderCapabilities,
  ProviderConnection,
  DeployResult,
} from './types'

interface SlackMessage {
  channel: string
  text: string
  blocks?: SlackBlock[]
  thread_ts?: string
  unfurl_links?: boolean
}

interface SlackBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  elements?: any[]
  accessory?: any
  fields?: { type: string; text: string }[]
  block_id?: string
}

export class SlackProvider implements DeploymentProvider {
  id = 'slack' as const
  name = 'Slack'
  icon = 'slack'
  description = 'Send campaign notifications and approval requests to Slack'

  capabilities: ProviderCapabilities = {
    deployPage: false,
    deployForm: false,
    deployEmail: false,
    deploySequence: false,
    getPerformance: false,
    biDirectionalSync: false,
    sendNotification: true,
  }

  async isConnected(workspaceId: string): Promise<boolean> {
    const connection = await this.getConnection(workspaceId)
    return !!connection?.accessToken
  }

  getAuthUrl(workspaceId: string, redirectUrl: string): string {
    const clientId = process.env.SLACK_CLIENT_ID
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
    const scopes = [
      'channels:read',
      'chat:write',
      'chat:write.public',
      'users:read',
      'files:write',
    ].join(',')

    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUrl)}&state=${state}`
  }

  async handleOAuthCallback(code: string, workspaceId: string): Promise<ProviderConnection> {
    const clientId = process.env.SLACK_CLIENT_ID
    const clientSecret = process.env.SLACK_CLIENT_SECRET
    const redirectUri = process.env.SLACK_REDIRECT_URI

    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri!,
      }),
    })

    const result = await tokenResponse.json()
    if (!result.ok) {
      throw new Error(`Slack OAuth failed: ${result.error}`)
    }

    // Store connection
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider: 'slack',
        access_token: encrypt(result.access_token),
        external_id: result.team.id,
        external_name: result.team.name,
        metadata: {
          teamId: result.team.id,
          teamName: result.team.name,
          botUserId: result.bot_user_id,
          scope: result.scope,
          defaultChannel: null,
        },
      }, { onConflict: 'workspace_id,provider' })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      workspaceId,
      provider: 'slack',
      isConnected: true,
      externalId: result.team.id,
      externalName: result.team.name,
    }
  }

  async disconnect(workspaceId: string): Promise<void> {
    const supabase = createServiceClient()
    await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider', 'slack')
  }

  // Slack doesn't deploy content, but we implement notification methods
  async deployPage(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Slack does not support page deployment' }
  }

  async deployForm(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Slack does not support form deployment' }
  }

  async deployEmail(): Promise<DeployResult> {
    return { success: false, externalId: '', error: 'Slack does not support email deployment' }
  }

  async getPerformance(): Promise<null> {
    return null
  }

  // ========================================
  // NOTIFICATION METHODS
  // ========================================

  /**
   * Send a simple text message
   */
  async sendMessage(workspaceId: string, channel: string, text: string): Promise<boolean> {
    const client = await this.getClient(workspaceId)
    if (!client) return false

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel, text }),
      })

      const result = await response.json()
      return result.ok
    } catch {
      return false
    }
  }

  /**
   * Send campaign created notification
   */
  async notifyCampaignCreated(
    workspaceId: string,
    channel: string,
    campaign: {
      id: string
      name: string
      createdBy: string
      url: string
    }
  ): Promise<boolean> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🚀 New Campaign Created', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Campaign:*\n${campaign.name}` },
          { type: 'mrkdwn', text: `*Created by:*\n${campaign.createdBy}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Campaign', emoji: true },
            url: campaign.url,
            style: 'primary',
          },
        ],
      },
    ]

    return this.sendBlocks(workspaceId, channel, blocks)
  }

  /**
   * Send campaign deployed notification
   */
  async notifyCampaignDeployed(
    workspaceId: string,
    channel: string,
    deployment: {
      campaignName: string
      provider: string
      url: string
      deployedBy: string
    }
  ): Promise<boolean> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '✅ Campaign Deployed', emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Campaign:*\n${deployment.campaignName}` },
          { type: 'mrkdwn', text: `*Provider:*\n${deployment.provider}` },
          { type: 'mrkdwn', text: `*Deployed by:*\n${deployment.deployedBy}` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'View Live Page', emoji: true },
            url: deployment.url,
          },
        ],
      },
    ]

    return this.sendBlocks(workspaceId, channel, blocks)
  }

  /**
   * Send approval request
   */
  async requestApproval(
    workspaceId: string,
    channel: string,
    request: {
      campaignId: string
      campaignName: string
      requestedBy: string
      previewUrl: string
      approvalUrl: string
    }
  ): Promise<boolean> {
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🔔 Approval Requested', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${request.requestedBy}* is requesting approval for *${request.campaignName}*`,
        },
      },
      {
        type: 'actions',
        block_id: `approval_${request.campaignId}`,
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Preview', emoji: true },
            url: request.previewUrl,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Approve', emoji: true },
            style: 'primary',
            action_id: 'approve_campaign',
            value: request.campaignId,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '❌ Reject', emoji: true },
            style: 'danger',
            action_id: 'reject_campaign',
            value: request.campaignId,
          },
        ],
      },
    ]

    return this.sendBlocks(workspaceId, channel, blocks)
  }

  /**
   * Send claim validation alert
   */
  async alertClaimValidation(
    workspaceId: string,
    channel: string,
    alert: {
      campaignName: string
      blockedClaims: { claim: string; reason: string }[]
      reviewUrl: string
    }
  ): Promise<boolean> {
    const claimsText = alert.blockedClaims
      .map((c) => `• _"${c.claim}"_ — ${c.reason}`)
      .join('\n')

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: '⚠️ Claims Need Review', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Campaign *${alert.campaignName}* has ${alert.blockedClaims.length} claims that need attention:\n\n${claimsText}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Review Claims', emoji: true },
            url: alert.reviewUrl,
            style: 'primary',
          },
        ],
      },
    ]

    return this.sendBlocks(workspaceId, channel, blocks)
  }

  /**
   * Send Sako task status update
   */
  async notifySakoTaskUpdate(
    workspaceId: string,
    channel: string,
    task: {
      campaignName: string
      status: string
      assignedTo?: string
      deliverables?: string[]
    }
  ): Promise<boolean> {
    const statusEmoji: Record<string, string> = {
      IN_PROGRESS: '🔄',
      COMPLETED: '✅',
      BLOCKED: '🚫',
      REVIEW: '👀',
    }

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji[task.status] || '📋'} Sako Task Update`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Campaign:*\n${task.campaignName}` },
          { type: 'mrkdwn', text: `*Status:*\n${task.status}` },
          ...(task.assignedTo
            ? [{ type: 'mrkdwn' as const, text: `*Assigned to:*\n${task.assignedTo}` }]
            : []),
        ],
      },
    ]

    if (task.deliverables?.length) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Deliverables:*\n${task.deliverables.map((d) => `• ${d}`).join('\n')}`,
        },
      })
    }

    return this.sendBlocks(workspaceId, channel, blocks)
  }

  /**
   * Get list of available channels
   */
  async getChannels(workspaceId: string): Promise<{ id: string; name: string }[]> {
    const client = await this.getClient(workspaceId)
    if (!client) return []

    try {
      const response = await fetch(
        'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=100',
        {
          headers: { Authorization: `Bearer ${client.accessToken}` },
        }
      )

      const result = await response.json()
      if (!result.ok) return []

      return result.channels.map((c: any) => ({
        id: c.id,
        name: c.name,
      }))
    } catch {
      return []
    }
  }

  /**
   * Set default notification channel
   */
  async setDefaultChannel(workspaceId: string, channelId: string): Promise<boolean> {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('provider_connections')
      .update({
        metadata: {
          defaultChannel: channelId,
        },
      })
      .eq('workspace_id', workspaceId)
      .eq('provider', 'slack')

    return !error
  }

  // Helper methods
  private async getConnection(workspaceId: string): Promise<ProviderConnection | null> {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'slack')
      .single()

    if (!data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: 'slack',
      isConnected: true,
      accessToken: data.access_token,
      externalId: data.external_id,
      metadata: data.metadata,
    }
  }

  private async getClient(workspaceId: string): Promise<{ accessToken: string } | null> {
    const connection = await this.getConnection(workspaceId)
    if (!connection?.accessToken) return null

    return {
      accessToken: decrypt(connection.accessToken),
    }
  }

  private async sendBlocks(
    workspaceId: string,
    channel: string,
    blocks: SlackBlock[]
  ): Promise<boolean> {
    const client = await this.getClient(workspaceId)
    if (!client) return false

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel,
          blocks,
          text: blocks[0]?.text?.text || 'Notification from Sako Composer',
        }),
      })

      const result = await response.json()
      return result.ok
    } catch {
      return false
    }
  }
}
