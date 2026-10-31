import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'

const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID
const FIGMA_REDIRECT_URI = process.env.FIGMA_REDIRECT_URI || 'http://localhost:3000/api/figma/oauth/callback'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)

    if (!FIGMA_CLIENT_ID) {
      return NextResponse.redirect(new URL('/settings?error=figma_not_configured', request.url))
    }

    // Encode workspace ID in state for callback
    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64')

    const authUrl = new URL('https://www.figma.com/oauth')
    authUrl.searchParams.set('client_id', FIGMA_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', FIGMA_REDIRECT_URI)
    authUrl.searchParams.set('scope', 'files:read file_variables:read file_variables:write')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('response_type', 'code')

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
