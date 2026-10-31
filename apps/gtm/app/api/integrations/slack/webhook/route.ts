/**
 * Slack Webhook Handler
 * 
 * Handle incoming events from Slack.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySlackSignature } from '@/lib/integrations/slack'

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    
    // Verify Slack signature
    const signature = request.headers.get('x-slack-signature')
    const timestamp = request.headers.get('x-slack-request-timestamp')

    if (!signature || !timestamp) {
      return NextResponse.json(
        { error: 'Missing signature headers' },
        { status: 401 }
      )
    }

    // Check timestamp to prevent replay attacks (5 minutes)
    const timestampNum = parseInt(timestamp)
    if (Math.abs(Date.now() / 1000 - timestampNum) > 300) {
      return NextResponse.json(
        { error: 'Request timestamp expired' },
        { status: 401 }
      )
    }

    // Verify signature
    const isValid = verifySlackSignature(signature, timestamp, rawBody)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse the body
    const body = JSON.parse(rawBody)

    // Handle URL verification challenge
    if (body.type === 'url_verification') {
      return NextResponse.json({ challenge: body.challenge })
    }

    // Handle events
    if (body.type === 'event_callback') {
      const event = body.event

      switch (event.type) {
        case 'app_home_opened':
          // User opened app home - could show dashboard
          console.log('App home opened by:', event.user)
          break

        case 'message':
          // Direct message to bot
          if (event.channel_type === 'im' && !event.bot_id) {
            // Handle DM conversation
            console.log('DM received:', event.text)
          }
          break

        case 'app_mention':
          // Bot was mentioned in a channel
          console.log('Bot mentioned:', event.text)
          break

        default:
          console.log('Unhandled event type:', event.type)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/integrations/slack/webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
