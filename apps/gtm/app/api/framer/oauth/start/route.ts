import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'

const FRAMER_CLIENT_ID = process.env.FRAMER_CLIENT_ID
const FRAMER_REDIRECT_URI = process.env.FRAMER_REDIRECT_URI || 'http://localhost:3000/api/framer/oauth/callback'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)

    if (!FRAMER_CLIENT_ID) {
      return NextResponse.redirect(new URL('/settings?error=framer_not_configured', request.url))
    }

    // Encode workspace ID in state for callback
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')

    const authUrl = new URL('https://framer.com/oauth/authorize')
    authUrl.searchParams.set('client_id', FRAMER_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', FRAMER_REDIRECT_URI)
    authUrl.searchParams.set('scope', 'projects:write')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('response_type', 'code')

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
