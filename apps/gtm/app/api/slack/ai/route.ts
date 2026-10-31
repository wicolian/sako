/**
 * Slack AI Commands API Route
 * 
 * Handles slash commands from Slack:
 * - /sako-generate - Generate content
 * - /sako-validate - Validate a claim
 * - /sako-status - Get campaign status
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  SlackEnhancedClient,
  verifySlackSignature,
  type SlackCommandPayload,
} from '@/lib/providers/slack-enhanced'

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
    
    if (!verifySlackSignature(signature, timestamp, rawBody)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
    
    // Parse the command payload
    const formData = new URLSearchParams(rawBody)
    const payload: SlackCommandPayload = {
      token: formData.get('token') || '',
      team_id: formData.get('team_id') || '',
      team_domain: formData.get('team_domain') || '',
      channel_id: formData.get('channel_id') || '',
      channel_name: formData.get('channel_name') || '',
      user_id: formData.get('user_id') || '',
      user_name: formData.get('user_name') || '',
      command: formData.get('command') || '',
      text: formData.get('text') || '',
      response_url: formData.get('response_url') || '',
      trigger_id: formData.get('trigger_id') || '',
    }
    
    // Get Slack client for this team
    const client = await SlackEnhancedClient.fromTeamId(payload.team_id)
    
    if (!client) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: '❌ Sako is not connected to this Slack workspace. Please connect at app.sako.ai/settings/integrations',
      })
    }
    
    // Handle different commands
    let response
    
    switch (payload.command) {
      case '/sako-generate':
        // Respond immediately, then process async
        // This is required because Slack expects a response within 3 seconds
        setImmediate(async () => {
          const message = await client.handleGenerateCommand(payload)
          await client.respondToCommand(payload.response_url, message)
        })
        
        return NextResponse.json({
          response_type: 'ephemeral',
          text: '✨ Generating content... This may take a moment.',
        })
      
      case '/sako-validate':
        setImmediate(async () => {
          const message = await client.handleValidateCommand(payload)
          await client.respondToCommand(payload.response_url, message)
        })
        
        return NextResponse.json({
          response_type: 'ephemeral',
          text: '🔍 Validating claim... This may take a moment.',
        })
      
      case '/sako-status':
        response = await client.handleStatusCommand(payload)
        return NextResponse.json(response)
      
      default:
        return NextResponse.json({
          response_type: 'ephemeral',
          text: `Unknown command: ${payload.command}. Available commands: /sako-generate, /sako-validate, /sako-status`,
        })
    }
  } catch (error) {
    console.error('Slack command error:', error)
    return NextResponse.json({
      response_type: 'ephemeral',
      text: '❌ An error occurred. Please try again.',
    })
  }
}
