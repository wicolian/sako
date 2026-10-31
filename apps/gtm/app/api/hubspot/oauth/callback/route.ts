import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/encryption'
import { getWorkspaceId } from '@/lib/workspace'
import { Database } from '@/lib/supabase/types'

type HubspotConnectionRow = Database['public']['Tables']['hubspot_connections']['Row']

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || 'http://localhost:3000/api/hubspot/oauth/callback'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/settings?error=oauth_failed', request.url))
  }

  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/settings?error=hubspot_not_configured', request.url))
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HUBSPOT_CLIENT_ID,
        client_secret: HUBSPOT_CLIENT_SECRET,
        redirect_uri: HUBSPOT_REDIRECT_URI,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text())
      return NextResponse.redirect(new URL('/settings?error=token_exchange_failed', request.url))
    }

    const tokens = await tokenResponse.json()

    // Get portal info
    const portalResponse = await fetch('https://api.hubapi.com/oauth/v1/access-tokens/' + tokens.access_token)
    const portalInfo = await portalResponse.json()

    const supabase = createServiceClient()
    const workspaceId = getWorkspaceId(request)

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokens.access_token)
    const encryptedRefreshToken = encrypt(tokens.refresh_token)

    // Upsert HubSpot connection with encrypted tokens
    const { error: dbError } = await supabase
      .from('hubspot_connections')
      .upsert({
        workspace_id: workspaceId,
        portal_id: portalInfo.hub_id.toString(),
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: portalInfo.scopes || [],
      })

    if (dbError) {
      console.error('Failed to save connection:', dbError)
      return NextResponse.redirect(new URL('/settings?error=save_failed', request.url))
    }

    return NextResponse.redirect(new URL('/settings?success=hubspot_connected', request.url))
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?error=oauth_failed', request.url))
  }
}
