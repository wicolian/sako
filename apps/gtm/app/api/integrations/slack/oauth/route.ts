/**
 * Slack OAuth API
 * 
 * Handle OAuth flow for Slack integration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getSlackOAuthUrl,
  exchangeSlackCode,
  saveSlackConnection,
} from '@/lib/integrations/slack'

/**
 * GET - Initiate OAuth flow (redirect to Slack)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: 'No workspace found' },
        { status: 404 }
      )
    }

    // Create state with workspace ID and CSRF token
    const state = Buffer.from(
      JSON.stringify({
        workspaceId: membership.workspace_id,
        userId: user.id,
        timestamp: Date.now(),
      })
    ).toString('base64')

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
    const redirectUri = `${origin}/api/integrations/slack/callback`
    const authUrl = getSlackOAuthUrl(state, redirectUri)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('GET /api/integrations/slack/oauth error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    )
  }
}

/**
 * POST - Exchange code for token (callback)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, state } = body

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing code or state' },
        { status: 400 }
      )
    }

    // Decode and verify state
    let stateData: { workspaceId: string; userId: string; timestamp: number }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch {
      return NextResponse.json(
        { error: 'Invalid state' },
        { status: 400 }
      )
    }

    // Verify state belongs to current user
    if (stateData.userId !== user.id) {
      return NextResponse.json(
        { error: 'State mismatch' },
        { status: 400 }
      )
    }

    // Check timestamp (expire after 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      return NextResponse.json(
        { error: 'State expired' },
        { status: 400 }
      )
    }

    // Exchange code for token
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
    const redirectUri = `${origin}/api/integrations/slack/callback`
    const token = await exchangeSlackCode(code, redirectUri)

    // Save connection
    await saveSlackConnection(stateData.workspaceId, token)

    return NextResponse.json({
      success: true,
      team: token.team,
      scopes: token.scope.split(','),
    })
  } catch (error) {
    console.error('POST /api/integrations/slack/oauth error:', error)
    return NextResponse.json(
      { error: 'Failed to complete OAuth' },
      { status: 500 }
    )
  }
}
