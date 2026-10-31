/**
 * Slack Integration
 * 
 * OAuth, API client, and webhook handling for Slack.
 */

import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

// Slack API configuration
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET!

export interface SlackToken {
  access_token: string
  token_type: string
  scope: string
  bot_user_id: string
  app_id: string
  team: {
    id: string
    name: string
  }
  incoming_webhook?: {
    channel: string
    channel_id: string
    configuration_url: string
    url: string
  }
}

export interface SlackMessage {
  channel: string
  text: string
  blocks?: SlackBlock[]
  attachments?: SlackAttachment[]
  thread_ts?: string
  mrkdwn?: boolean
}

export interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
    emoji?: boolean
  }
  elements?: SlackBlockElement[]
  accessory?: SlackBlockElement
  block_id?: string
}

export interface SlackBlockElement {
  type: string
  text?: string | {
    type: string
    text: string
    emoji?: boolean
  }
  action_id?: string
  url?: string
  value?: string
  style?: string
}

export interface SlackAttachment {
  color?: string
  fallback?: string
  title?: string
  text?: string
  fields?: Array<{
    title: string
    value: string
    short?: boolean
  }>
  footer?: string
  ts?: number
}

/**
 * Generate OAuth authorization URL
 */
export function getSlackOAuthUrl(
  state: string,
  redirectUri: string
): string {
  const scopes = [
    'chat:write',
    'chat:write.public',
    'commands',
    'incoming-webhook',
    'users:read',
  ].join(',')

  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  })

  return `https://slack.com/oauth/v2/authorize?${params}`
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeSlackCode(
  code: string,
  redirectUri: string
): Promise<SlackToken> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  })

  const data = await response.json()

  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`)
  }

  return data as SlackToken
}

/**
 * Verify Slack request signature
 */
export function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  const baseString = `v0:${timestamp}:${body}`
  const hmac = crypto
    .createHmac('sha256', SLACK_SIGNING_SECRET)
    .update(baseString)
    .digest('hex')
  const expectedSignature = `v0=${hmac}`

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Send a message to Slack
 */
export async function sendSlackMessage(
  accessToken: string,
  message: SlackMessage
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: message.channel,
      text: message.text,
      blocks: message.blocks,
      attachments: message.attachments,
      thread_ts: message.thread_ts,
      mrkdwn: message.mrkdwn ?? true,
    }),
  })

  return response.json()
}

/**
 * Send a message via incoming webhook
 */
export async function sendSlackWebhook(
  webhookUrl: string,
  message: Omit<SlackMessage, 'channel'>
): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message.text,
        blocks: message.blocks,
        attachments: message.attachments,
      }),
    })

    return response.ok
  } catch {
    return false
  }
}

/**
 * Save Slack connection for a workspace
 */
export async function saveSlackConnection(
  workspaceId: string,
  slackToken: SlackToken
): Promise<void> {
  const supabase = createServiceClient()

  await supabase.from('provider_connections').upsert({
    workspace_id: workspaceId,
    provider: 'slack',
    is_connected: true,
    access_token: slackToken.access_token,
    refresh_token: null,
    token_expires_at: null, // Slack tokens don't expire
    metadata: {
      team_id: slackToken.team.id,
      team_name: slackToken.team.name,
      bot_user_id: slackToken.bot_user_id,
      app_id: slackToken.app_id,
      scopes: slackToken.scope,
      webhook: slackToken.incoming_webhook,
    },
    connected_at: new Date().toISOString(),
  }, {
    onConflict: 'workspace_id,provider',
  })
}

/**
 * Get Slack connection for a workspace
 */
export async function getSlackConnection(workspaceId: string): Promise<{
  access_token: string
  metadata: Record<string, unknown>
} | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('provider_connections')
    .select('access_token, metadata')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'slack')
    .eq('is_connected', true)
    .single()

  if (error || !data) return null

  return {
    access_token: data.access_token,
    metadata: data.metadata as Record<string, unknown>,
  }
}

/**
 * Disconnect Slack integration
 */
export async function disconnectSlack(workspaceId: string): Promise<void> {
  const supabase = createServiceClient()

  await supabase
    .from('provider_connections')
    .update({ is_connected: false })
    .eq('workspace_id', workspaceId)
    .eq('provider', 'slack')
}

/**
 * Build notification blocks for Slack
 */
export function buildNotificationBlocks(notification: {
  title: string
  description?: string
  type: 'info' | 'success' | 'warning' | 'error'
  actions?: Array<{ label: string; url?: string; action_id?: string }>
}): SlackBlock[] {
  const typeEmoji: Record<string, string> = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${typeEmoji[notification.type]} ${notification.title}`,
        emoji: true,
      },
    },
  ]

  if (notification.description) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: notification.description,
      },
    })
  }

  if (notification.actions && notification.actions.length > 0) {
    blocks.push({
      type: 'actions',
      elements: notification.actions.map((action) => ({
        type: action.url ? 'button' : 'button',
        text: {
          type: 'plain_text',
          text: action.label,
          emoji: true,
        },
        ...(action.url && { url: action.url }),
        ...(action.action_id && { action_id: action.action_id }),
      })),
    })
  }

  return blocks
}
