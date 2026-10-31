/**
 * Enhanced Slack Integration
 * 
 * Provides AI-powered Slack slash commands for:
 * - Content generation directly in Slack
 * - Claim validation
 * - Campaign status updates
 * - AI chat within channels
 */

import { createServiceClient } from '@/lib/supabase/service'
import { encrypt, decrypt } from '@/lib/encryption'
import { generateLandingPageContent, quickClaimCheck } from '@/lib/ai/ai-sdk-client'
import { getBrandContext } from '@/lib/ai/brand-context'

// ============================================================================
// Types
// ============================================================================

export interface SlackConnection {
  id: string
  workspace_id: string
  team_id: string
  team_name: string
  access_token_encrypted: string
  bot_user_id: string
  app_id: string
  incoming_webhook_url?: string
  incoming_webhook_channel?: string
  created_at: string
  updated_at: string
}

export interface SlackCommandPayload {
  token: string
  team_id: string
  team_domain: string
  channel_id: string
  channel_name: string
  user_id: string
  user_name: string
  command: string
  text: string
  response_url: string
  trigger_id: string
}

export interface SlackBlockMessage {
  blocks: SlackBlock[]
  response_type?: 'in_channel' | 'ephemeral'
  replace_original?: boolean
}

type SlackBlock = {
  type: 'section' | 'divider' | 'header' | 'context' | 'actions'
  text?: {
    type: 'mrkdwn' | 'plain_text'
    text: string
    emoji?: boolean
  }
  accessory?: unknown
  elements?: unknown[]
  block_id?: string
}

// ============================================================================
// Slack Client
// ============================================================================

export class SlackEnhancedClient {
  private accessToken: string
  private workspaceId: string
  
  constructor(accessToken: string, workspaceId: string) {
    this.accessToken = accessToken
    this.workspaceId = workspaceId
  }
  
  /**
   * Create client from workspace ID
   */
  static async fromWorkspace(workspaceId: string): Promise<SlackEnhancedClient | null> {
    const supabase = createServiceClient()
    
    const { data } = await supabase
      .from('slack_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()
    
    if (!data) return null
    
    return new SlackEnhancedClient(
      decrypt(data.access_token_encrypted),
      workspaceId
    )
  }
  
  /**
   * Create client from Slack team ID
   */
  static async fromTeamId(teamId: string): Promise<SlackEnhancedClient | null> {
    const supabase = createServiceClient()
    
    const { data } = await supabase
      .from('slack_connections')
      .select('*')
      .eq('team_id', teamId)
      .single()
    
    if (!data) return null
    
    return new SlackEnhancedClient(
      decrypt(data.access_token_encrypted),
      data.workspace_id
    )
  }
  
  /**
   * Post a message to a channel
   */
  async postMessage(channel: string, message: string | SlackBlockMessage): Promise<boolean> {
    try {
      const body = typeof message === 'string'
        ? { channel, text: message }
        : { channel, ...message }
      
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      
      const result = await response.json()
      return result.ok
    } catch (error) {
      console.error('Failed to post Slack message:', error)
      return false
    }
  }
  
  /**
   * Respond to a slash command
   */
  async respondToCommand(responseUrl: string, message: SlackBlockMessage): Promise<boolean> {
    try {
      const response = await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })
      
      return response.ok
    } catch (error) {
      console.error('Failed to respond to Slack command:', error)
      return false
    }
  }
  
  /**
   * Handle /sako-generate command
   */
  async handleGenerateCommand(payload: SlackCommandPayload): Promise<SlackBlockMessage> {
    const { text, user_name } = payload
    
    if (!text.trim()) {
      return {
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ Please provide a prompt. Usage: `/sako-generate <your content request>`',
            },
          },
        ],
      }
    }
    
    try {
      // Get brand context
      const brandContext = await getBrandContext(this.workspaceId)
      
      // Generate content
      const content = await generateLandingPageContent(
        `Create social media content about: ${text}`,
        brandContext ? JSON.stringify(brandContext) : undefined
      )
      
      return {
        response_type: 'in_channel',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '✨ AI Generated Content',
              emoji: true,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Requested by @${user_name}`,
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Headline:*\n${content.headline || 'Generated content'}`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Subheadline:*\n${content.subheadline || ''}`,
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Brand: ${brandContext?.name || 'Default'} | <https://app.sako.ai/campaigns|Open in Sako>`,
              },
            ],
          },
        ],
      }
    } catch (error) {
      console.error('Content generation failed:', error)
      return {
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ Content generation failed. Please try again.',
            },
          },
        ],
      }
    }
  }
  
  /**
   * Handle /sako-validate command
   */
  async handleValidateCommand(payload: SlackCommandPayload): Promise<SlackBlockMessage> {
    const { text, user_name } = payload
    
    if (!text.trim()) {
      return {
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ Please provide a claim to validate. Usage: `/sako-validate <marketing claim>`',
            },
          },
        ],
      }
    }
    
    try {
      const result = await quickClaimCheck(text)
      
      const statusEmoji = result.riskLevel === 'low' 
        ? '✅' 
        : result.riskLevel === 'medium' 
          ? '⚠️' 
          : '🔴'
      
      return {
        response_type: 'in_channel',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${statusEmoji} Claim Validation Result`,
              emoji: true,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Validated by @${user_name}`,
              },
            ],
          },
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Original Claim:*\n"${text}"`,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Risk Level:* ${result.riskLevel.toUpperCase()}\n*Requires Evidence:* ${result.requiresEvidence ? 'Yes' : 'No'}`,
            },
          },
          ...(result.issues.length > 0 ? [{
            type: 'section' as const,
            text: {
              type: 'mrkdwn' as const,
              text: `*Issues Found:*\n${result.issues.map(i => `• ${i}`).join('\n')}`,
            },
          }] : []),
          ...(result.suggestion ? [{
            type: 'section' as const,
            text: {
              type: 'mrkdwn' as const,
              text: `*Suggested Rewrite:*\n"${result.suggestion}"`,
            },
          }] : []),
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Powered by ClaimsOS | <https://app.sako.ai/claims|View in Sako>',
              },
            ],
          },
        ],
      }
    } catch (error) {
      console.error('Claim validation failed:', error)
      return {
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ Validation failed. Please try again.',
            },
          },
        ],
      }
    }
  }
  
  /**
   * Handle /sako-status command
   */
  async handleStatusCommand(payload: SlackCommandPayload): Promise<SlackBlockMessage> {
    try {
      const supabase = createServiceClient()
      
      // Get recent campaigns
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, name, status, created_at')
        .eq('workspace_id', this.workspaceId)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (!campaigns || campaigns.length === 0) {
        return {
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '📭 No campaigns found. Create your first campaign at <https://app.sako.ai/campaigns/new|app.sako.ai>',
              },
            },
          ],
        }
      }
      
      const campaignBlocks: SlackBlock[] = campaigns.map(c => ({
        type: 'section' as const,
        text: {
          type: 'mrkdwn' as const,
          text: `*${c.name}*\nStatus: ${c.status} | Created: ${new Date(c.created_at).toLocaleDateString()}`,
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View',
            emoji: true,
          },
          url: `https://app.sako.ai/campaigns/${c.id}`,
        },
      }))
      
      return {
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📊 Recent Campaigns',
              emoji: true,
            },
          },
          {
            type: 'divider',
          },
          ...campaignBlocks,
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '<https://app.sako.ai/campaigns|View all campaigns in Sako>',
              },
            ],
          },
        ],
      }
    } catch (error) {
      console.error('Failed to get status:', error)
      return {
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ Failed to get status. Please try again.',
            },
          },
        ],
      }
    }
  }
}

// ============================================================================
// OAuth Helpers
// ============================================================================

export function getSlackOAuthUrl(workspaceId: string, redirectUrl: string): string {
  const clientId = process.env.SLACK_CLIENT_ID
  const scopes = [
    'commands',
    'chat:write',
    'channels:read',
    'users:read',
    'incoming-webhook',
  ].join(',')
  const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')
  
  return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUrl)}&state=${state}`
}

export async function handleSlackOAuthCallback(
  code: string,
  workspaceId: string,
  redirectUri: string
): Promise<SlackConnection> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
    }),
  })
  
  const data = await response.json()
  
  if (!data.ok) {
    throw new Error(`Slack OAuth failed: ${data.error}`)
  }
  
  const supabase = createServiceClient()
  
  const { data: connection, error } = await supabase
    .from('slack_connections')
    .upsert({
      workspace_id: workspaceId,
      team_id: data.team.id,
      team_name: data.team.name,
      access_token_encrypted: encrypt(data.access_token),
      bot_user_id: data.bot_user_id,
      app_id: data.app_id,
      incoming_webhook_url: data.incoming_webhook?.url,
      incoming_webhook_channel: data.incoming_webhook?.channel,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id' })
    .select()
    .single()
  
  if (error) {
    throw new Error(`Failed to save Slack connection: ${error.message}`)
  }
  
  return connection
}

/**
 * Verify Slack request signature
 */
export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const crypto = require('crypto')
  const signingSecret = process.env.SLACK_SIGNING_SECRET!
  
  // Check timestamp is within 5 minutes
  const time = Math.floor(new Date().getTime() / 1000)
  if (Math.abs(time - parseInt(timestamp)) > 60 * 5) {
    return false
  }
  
  const sigBaseString = `v0:${timestamp}:${body}`
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(sigBaseString)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  )
}
