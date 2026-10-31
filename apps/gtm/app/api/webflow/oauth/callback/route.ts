import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/encryption'

const WEBFLOW_CLIENT_ID = process.env.WEBFLOW_CLIENT_ID
const WEBFLOW_CLIENT_SECRET = process.env.WEBFLOW_CLIENT_SECRET
const WEBFLOW_REDIRECT_URI = process.env.WEBFLOW_REDIRECT_URI || 'http://localhost:3000/api/webflow/oauth/callback'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const stateParam = searchParams.get('state')

  if (error || !code) {
    return NextResponse.redirect(new URL('/settings?error=webflow_oauth_failed', request.url))
  }

  if (!WEBFLOW_CLIENT_ID || !WEBFLOW_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/settings?error=webflow_not_configured', request.url))
  }

  let workspaceId: string | null = null
  if (stateParam) {
    try {
      const state = JSON.parse(Buffer.from(stateParam, 'base64').toString('utf8'))
      workspaceId = state.workspaceId
    } catch (e) {
      console.error('Failed to parse state parameter:', e)
    }
  }

  if (!workspaceId) {
    return NextResponse.redirect(new URL('/settings?error=missing_workspace_id', request.url))
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://api.webflow.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: WEBFLOW_CLIENT_ID,
        client_secret: WEBFLOW_CLIENT_SECRET,
        redirect_uri: WEBFLOW_REDIRECT_URI,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text())
      return NextResponse.redirect(new URL('/settings?error=webflow_token_failed', request.url))
    }

    const tokens = await tokenResponse.json()

    // Get user/site info
    const userResponse = await fetch('https://api.webflow.com/v2/user', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'accept': 'application/json',
      },
    })
    const userInfo = await userResponse.json()

    const supabase = createServiceClient()
    const encryptedAccessToken = encrypt(tokens.access_token)

    // Store in provider_connections table
    const { error: dbError } = await supabase
      .from('provider_connections')
      .upsert({
        workspace_id: workspaceId,
        provider_id: 'webflow',
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expires_at: tokens.expires_in 
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        metadata: {
          user_id: userInfo.id,
          email: userInfo.email,
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
        },
      }, { onConflict: 'workspace_id,provider_id' })

    if (dbError) {
      console.error('Failed to save Webflow connection:', dbError)
      return NextResponse.redirect(new URL('/settings?error=webflow_save_failed', request.url))
    }

    return NextResponse.redirect(new URL('/settings?success=webflow_connected', request.url))
  } catch (err) {
    console.error('Webflow OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?error=webflow_oauth_failed', request.url))
  }
}
