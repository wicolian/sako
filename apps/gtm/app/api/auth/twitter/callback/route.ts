import { NextRequest, NextResponse } from 'next/server'
import { parseTwitterAuthState, TwitterProvider } from '@/lib/providers/twitter'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/settings?tab=integrations&error=${encodeURIComponent(error)}`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/settings?tab=integrations&error=twitter_missing_code`
    )
  }

  try {
    const parsedState = parseTwitterAuthState(state)
    const provider = new TwitterProvider()
    await provider.handleOAuthCallback(code, parsedState.workspaceId, parsedState.codeVerifier)

    return NextResponse.redirect(
      `${request.nextUrl.origin}/settings?tab=integrations&connected=twitter`
    )
  } catch (callbackError) {
    console.error('Twitter callback error:', callbackError)
    return NextResponse.redirect(
      `${request.nextUrl.origin}/settings?tab=integrations&error=twitter_callback_failed`
    )
  }
}
