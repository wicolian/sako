/**
 * Slack Slash Commands Handler
 * 
 * Handle /sako commands from Slack.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { verifySlackSignature } from '@/lib/integrations/slack'
import {
  handleGenerateCommand,
  handleValidateCommand,
  handleStatusCommand,
  type SlackCommandContext,
} from '@/lib/integrations/slack-actions'

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    
    // Verify Slack signature
    const signature = request.headers.get('x-slack-signature')
    const timestamp = request.headers.get('x-slack-request-timestamp')

    if (!signature || !timestamp) {
      return new NextResponse('Missing signature', { status: 401 })
    }

    // Check timestamp (5 minutes)
    const timestampNum = parseInt(timestamp)
    if (Math.abs(Date.now() / 1000 - timestampNum) > 300) {
      return new NextResponse('Request expired', { status: 401 })
    }

    // Verify signature
    const isValid = verifySlackSignature(signature, timestamp, rawBody)
    if (!isValid) {
      return new NextResponse('Invalid signature', { status: 401 })
    }

    // Parse form data
    const params = new URLSearchParams(rawBody)
    const command = params.get('command')
    const text = params.get('text') || ''
    const teamId = params.get('team_id')
    const userId = params.get('user_id')
    const channelId = params.get('channel_id')
    const responseUrl = params.get('response_url')

    if (!teamId || !userId || !channelId || !responseUrl) {
      return new NextResponse('Missing required parameters', { status: 400 })
    }

    // Find workspace by Slack team ID
    const supabase = createServiceClient()
    const { data: connection } = await supabase
      .from('provider_connections')
      .select('workspace_id')
      .eq('provider', 'slack')
      .eq("metadata->>'team_id'", teamId)
      .eq('is_connected', true)
      .single()

    if (!connection) {
      return new NextResponse(
        JSON.stringify({
          response_type: 'ephemeral',
          text: '❌ Slack is not connected to a Sako workspace. Please connect via Settings → Integrations.',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const ctx: SlackCommandContext = {
      workspaceId: connection.workspace_id,
      userId,
      channelId,
      responseUrl,
    }

    // Parse subcommand and arguments
    const [subcommand, ...args] = text.trim().split(/\s+/)
    const argument = args.join(' ')

    // Acknowledge immediately (Slack requires response within 3 seconds)
    // Then process command asynchronously
    
    // Return immediate acknowledgment
    const immediateResponse = {
      response_type: 'ephemeral',
      text: '⏳ Processing your request...',
    }

    // Process command in background
    processCommandAsync(ctx, subcommand?.toLowerCase() || 'help', argument)

    return new NextResponse(JSON.stringify(immediateResponse), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('POST /api/integrations/slack/commands error:', error)
    return new NextResponse(
      JSON.stringify({
        response_type: 'ephemeral',
        text: '❌ An error occurred. Please try again.',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function processCommandAsync(
  ctx: SlackCommandContext,
  subcommand: string,
  argument: string
): Promise<void> {
  try {
    switch (subcommand) {
      case 'generate':
        if (!argument) {
          await sendDelayedResponse(ctx.responseUrl, {
            response_type: 'ephemeral',
            text: '❌ Please provide a brief. Usage: `/sako generate [your brief]`',
          })
          return
        }
        await handleGenerateCommand(ctx, argument)
        break

      case 'validate':
        if (!argument) {
          await sendDelayedResponse(ctx.responseUrl, {
            response_type: 'ephemeral',
            text: '❌ Please provide a claim to validate. Usage: `/sako validate [your claim]`',
          })
          return
        }
        await handleValidateCommand(ctx, argument)
        break

      case 'status':
        if (!argument) {
          await sendDelayedResponse(ctx.responseUrl, {
            response_type: 'ephemeral',
            text: '❌ Please provide a campaign name. Usage: `/sako status [campaign name]`',
          })
          return
        }
        await handleStatusCommand(ctx, argument)
        break

      case 'help':
      default:
        await sendDelayedResponse(ctx.responseUrl, {
          response_type: 'ephemeral',
          text: '',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '🚀 Sako Commands',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: [
                  '*Available commands:*',
                  '',
                  '`/sako generate [brief]` - Generate marketing content',
                  '`/sako validate [claim]` - Validate a marketing claim',
                  '`/sako status [campaign]` - Get campaign health status',
                  '`/sako help` - Show this help message',
                ].join('\n'),
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '💡 Tip: All generated content can be edited and refined in Sako',
                },
              ],
            },
          ],
        })
        break
    }
  } catch (error) {
    console.error('Error processing Slack command:', error)
    await sendDelayedResponse(ctx.responseUrl, {
      response_type: 'ephemeral',
      text: '❌ Sorry, something went wrong. Please try again.',
    })
  }
}

async function sendDelayedResponse(
  responseUrl: string,
  payload: Record<string, unknown>
): Promise<void> {
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
