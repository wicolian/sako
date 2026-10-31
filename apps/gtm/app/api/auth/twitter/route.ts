import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { TwitterProvider } from '@/lib/providers/twitter'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const redirectUrl = process.env.TWITTER_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/twitter/callback`
    const provider = new TwitterProvider()

    return NextResponse.redirect(provider.getAuthUrl(workspaceId, redirectUrl))
  } catch (error) {
    console.error('Twitter connect error:', error)
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?tab=integrations&error=twitter_connect_failed`)
  }
}
