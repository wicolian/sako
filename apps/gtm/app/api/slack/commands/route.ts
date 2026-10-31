/**
 * Slack Commands API
 * 
 * Handles Slack slash commands for the /sako command.
 * 
 * Usage:
 * - /sako request "Create a landing page for our Q1 campaign"
 * - /sako status <request-id>
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createRequest } from '@/lib/requests/request-manager'
import type { AssetType } from '@/lib/requests/request-types'

export async function POST(request: NextRequest) {
  // Verify Slack signature
  const signature = request.headers.get('x-slack-signature')
  const timestamp = request.headers.get('x-slack-request-timestamp')
  
  if (!verifySlackSignature(await request.clone().text(), signature, timestamp)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  const formData = await request.formData()
  const command = formData.get('command') as string
  const text = formData.get('text') as string
  const userId = formData.get('user_id') as string
  const teamId = formData.get('team_id') as string
  const channelId = formData.get('channel_id') as string
  
  if (command !== '/sako') {
    return NextResponse.json({ text: 'Unknown command' })
  }
  
  // Parse the subcommand
  const parts = text.trim().split(' ')
  const subcommand = parts[0]?.toLowerCase()
  const args = parts.slice(1).join(' ')
  
  try {
    switch (subcommand) {
      case 'request':
        return handleRequestCommand(teamId, userId, channelId, args)
      case 'status':
        return handleStatusCommand(args)
      case 'help':
      default:
        return handleHelpCommand()
    }
  } catch (error) {
    console.error('Slack command error:', error)
    return NextResponse.json({
      response_type: 'ephemeral',
      text: `Error: ${error instanceof Error ? error.message : 'Command failed'}`,
    })
  }
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleRequestCommand(
  teamId: string,
  userId: string,
  channelId: string,
  args: string
): Promise<NextResponse> {
  if (!args.trim()) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Usage: `/sako request "Your request description"`\n\nExample: `/sako request "Create a landing page for our new AI feature launch"`',
    })
  }
  
  // Extract quoted description
  const match = args.match(/"([^"]+)"/) || args.match(/'([^']+)'/)
  const description = match ? match[1] : args
  
  // Detect asset type from description
  const assetType = detectAssetType(description)
  
  // Get workspace from Slack team
  const supabase = createServiceClient()
  const { data: connection } = await supabase
    .from('provider_connections')
    .select('workspace_id')
    .eq('provider', 'slack')
    .eq('external_id', teamId)
    .single()
  
  if (!connection) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Slack is not connected to a Sako workspace. Please connect your workspace first.',
    })
  }
  
  // Get or create user
  const { data: user } = await supabase
    .from('slack_users')
    .select('user_id')
    .eq('slack_user_id', userId)
    .single()
  
  const internalUserId = user?.user_id || 'system'
  
  // Create the request
  const newRequest = await createRequest(connection.workspace_id, internalUserId, {
    assetType,
    title: description.slice(0, 100),
    brief: {
      context: description,
    },
    source: 'slack',
    sourceMetadata: {
      slackTeamId: teamId,
      slackChannelId: channelId,
      slackUserId: userId,
    },
  })
  
  return NextResponse.json({
    response_type: 'in_channel',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*New Request Created* :sparkles:\n\n>${description}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Request ID: \`${newRequest.id.slice(0, 8)}\` • Type: ${assetType.replace('_', ' ')} • Status: New`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View in Sako',
              emoji: true,
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/requests/${newRequest.id}`,
            action_id: 'view_request',
          },
        ],
      },
    ],
  })
}

async function handleStatusCommand(args: string): Promise<NextResponse> {
  const requestId = args.trim()
  
  if (!requestId) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Usage: `/sako status <request-id>`\n\nExample: `/sako status abc12345`',
    })
  }
  
  const supabase = createServiceClient()
  
  // Find request by partial ID
  const { data: requests } = await supabase
    .from('requests')
    .select('id, title, status, asset_type, created_at, updated_at')
    .ilike('id', `${requestId}%`)
    .limit(1)
  
  if (!requests?.length) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: `No request found with ID starting with \`${requestId}\``,
    })
  }
  
  const req = requests[0]
  
  return NextResponse.json({
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Request Status*\n\n*${req.title}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Status:*\n${req.status.replace('_', ' ')}`,
          },
          {
            type: 'mrkdwn',
            text: `*Type:*\n${req.asset_type.replace('_', ' ')}`,
          },
          {
            type: 'mrkdwn',
            text: `*Created:*\n${new Date(req.created_at).toLocaleDateString()}`,
          },
          {
            type: 'mrkdwn',
            text: `*Updated:*\n${new Date(req.updated_at).toLocaleDateString()}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details',
              emoji: true,
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/requests/${req.id}`,
            action_id: 'view_request',
          },
        ],
      },
    ],
  })
}

function handleHelpCommand(): NextResponse {
  return NextResponse.json({
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Sako Composer - Slack Commands*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '`/sako request "description"` - Create a new asset request\n`/sako status <id>` - Check request status\n`/sako help` - Show this help message',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Examples:*\n• `/sako request "Create a landing page for our summer sale"`\n• `/sako request "Need 3 ad variants for LinkedIn"`\n• `/sako status abc123`',
        },
      },
    ],
  })
}

// ============================================================================
// Helpers
// ============================================================================

function verifySlackSignature(
  body: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  // Skip verification in development
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!signingSecret || !signature || !timestamp) {
    return false
  }
  
  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false
  }
  
  // Compute signature
  const crypto = require('crypto')
  const baseString = `v0:${timestamp}:${body}`
  const expectedSignature = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(baseString)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

function detectAssetType(description: string): AssetType {
  const lower = description.toLowerCase()
  
  if (lower.includes('landing page') || lower.includes('page')) {
    return 'landing_page'
  }
  if (lower.includes('ad') || lower.includes('banner') || lower.includes('creative')) {
    return 'ads'
  }
  if (lower.includes('email') || lower.includes('newsletter')) {
    return 'emails'
  }
  if (lower.includes('deck') || lower.includes('presentation') || lower.includes('slides')) {
    return 'deck'
  }
  if (lower.includes('social') || lower.includes('post') || lower.includes('linkedin') || lower.includes('twitter')) {
    return 'social'
  }
  
  return 'other'
}
