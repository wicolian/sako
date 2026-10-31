import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'

const WEBFLOW_CLIENT_ID = process.env.WEBFLOW_CLIENT_ID
const WEBFLOW_REDIRECT_URI = process.env.WEBFLOW_REDIRECT_URI || 'http://localhost:3000/api/webflow/oauth/callback'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)

    if (!WEBFLOW_CLIENT_ID) {
      return NextResponse.redirect(new URL('/settings?error=webflow_not_configured', request.url))
    }

    // Encode workspace ID in state for callback
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')

    const authUrl = new URL('https://webflow.com/oauth/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', WEBFLOW_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', WEBFLOW_REDIRECT_URI)
    authUrl.searchParams.set('scope', 'sites:read sites:write cms:read cms:write')
    authUrl.searchParams.set('state', state)

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
