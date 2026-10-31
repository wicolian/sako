/**
 * Slack OAuth Callback
 * 
 * Handle the OAuth redirect from Slack.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  exchangeSlackCode,
  saveSlackConnection,
} from '@/lib/integrations/slack'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const settingsUrl = `${origin}/settings/integrations`

  // Handle OAuth error
  if (error) {
    const errorUrl = new URL(settingsUrl)
    errorUrl.searchParams.set('slack_error', error)
    return NextResponse.redirect(errorUrl)
  }

  if (!code || !state) {
    const errorUrl = new URL(settingsUrl)
    errorUrl.searchParams.set('slack_error', 'missing_params')
    return NextResponse.redirect(errorUrl)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const loginUrl = new URL('/login', origin)
      loginUrl.searchParams.set('redirect', settingsUrl)
      return NextResponse.redirect(loginUrl)
    }

    // Decode and verify state
    let stateData: { workspaceId: string; userId: string; timestamp: number }
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    } catch {
      const errorUrl = new URL(settingsUrl)
      errorUrl.searchParams.set('slack_error', 'invalid_state')
      return NextResponse.redirect(errorUrl)
    }

    // Verify state belongs to current user
    if (stateData.userId !== user.id) {
      const errorUrl = new URL(settingsUrl)
      errorUrl.searchParams.set('slack_error', 'state_mismatch')
      return NextResponse.redirect(errorUrl)
    }

    // Check timestamp (expire after 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      const errorUrl = new URL(settingsUrl)
      errorUrl.searchParams.set('slack_error', 'state_expired')
      return NextResponse.redirect(errorUrl)
    }

    // Exchange code for token
    const redirectUri = `${origin}/api/integrations/slack/callback`
    const token = await exchangeSlackCode(code, redirectUri)

    // Save connection
    await saveSlackConnection(stateData.workspaceId, token)

    // Redirect to settings with success
    const successUrl = new URL(settingsUrl)
    successUrl.searchParams.set('slack_connected', 'true')
    successUrl.searchParams.set('slack_team', token.team.name)
    return NextResponse.redirect(successUrl)
  } catch (err) {
    console.error('Slack OAuth callback error:', err)
    const errorUrl = new URL(settingsUrl)
    errorUrl.searchParams.set('slack_error', 'exchange_failed')
    return NextResponse.redirect(errorUrl)
  }
}
