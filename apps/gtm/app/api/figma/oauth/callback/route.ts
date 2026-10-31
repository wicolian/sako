import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { encrypt } from '@/lib/encryption'
import { Database } from '@/lib/supabase/types'

type ProviderConnectionRow = Database['public']['Tables']['provider_connections']['Row']

const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET
const FIGMA_REDIRECT_URI = process.env.FIGMA_REDIRECT_URI || 'http://localhost:3000/api/figma/oauth/callback'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const stateParam = searchParams.get('state')

  if (error || !code) {
    return NextResponse.redirect(new URL('/settings?error=figma_oauth_failed', request.url))
  }

  if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/settings?error=figma_not_configured', request.url))
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
    const tokenResponse = await fetch('https://www.figma.com/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: FIGMA_CLIENT_ID,
        client_secret: FIGMA_CLIENT_SECRET,
        redirect_uri: FIGMA_REDIRECT_URI,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text())
      return NextResponse.redirect(new URL('/settings?error=figma_token_failed', request.url))
    }

    const tokens = await tokenResponse.json()

    // Get user info
    const userResponse = await fetch('https://api.figma.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
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
        provider_id: 'figma',
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        metadata: {
          user_id: userInfo.id,
          email: userInfo.email,
          handle: userInfo.handle,
          img_url: userInfo.img_url,
        },
      }, { onConflict: 'workspace_id,provider_id' })

    if (dbError) {
      console.error('Failed to save Figma connection:', dbError)
      return NextResponse.redirect(new URL('/settings?error=figma_save_failed', request.url))
    }

    return NextResponse.redirect(new URL('/settings?success=figma_connected', request.url))
  } catch (err) {
    console.error('Figma OAuth callback error:', err)
    return NextResponse.redirect(new URL('/settings?error=figma_oauth_failed', request.url))
  }
}
