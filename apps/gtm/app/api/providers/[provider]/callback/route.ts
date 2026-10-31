import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/providers/registry'
import type { ProviderType } from '@/lib/providers/types'
import { parseTwitterAuthState, TwitterProvider } from '@/lib/providers/twitter'

/**
 * GET /api/providers/[provider]/callback
 * Handle OAuth callback from provider
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerType } = await params
    const searchParams = request.nextUrl.searchParams

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      const errorDescription = searchParams.get('error_description') || 'Authorization failed'
      return NextResponse.redirect(
        `${request.nextUrl.origin}/settings?tab=integrations&error=${encodeURIComponent(errorDescription)}`
      )
    }

    if (!code) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/settings?tab=integrations&error=missing_code`
      )
    }

    // Parse workspace ID from state
    let workspaceId: string
    let codeVerifier: string | undefined
    try {
      if (providerType === 'twitter' && state) {
        const stateData = parseTwitterAuthState(state)
        workspaceId = stateData.workspaceId
        codeVerifier = stateData.codeVerifier
      } else {
        const stateData = JSON.parse(atob(state || ''))
        workspaceId = stateData.workspaceId
      }
    } catch {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/settings?tab=integrations&error=invalid_state`
      )
    }

    // Get provider and handle callback
    if (providerType === 'twitter') {
      const provider = getProvider('twitter') as TwitterProvider
      await provider.handleOAuthCallback(code, workspaceId, codeVerifier)
    } else {
      const provider = getProvider(providerType as ProviderType)
      await provider.handleOAuthCallback(code, workspaceId)
    }

    // Redirect to settings with success
    return NextResponse.redirect(
      `${request.nextUrl.origin}/settings?tab=integrations&connected=${providerType}`
    )
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(
      `${request.nextUrl.origin}/settings?tab=integrations&error=connection_failed`
    )
  }
}
