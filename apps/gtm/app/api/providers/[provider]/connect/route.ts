import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getProvider } from '@/lib/providers/registry'
import type { ProviderType } from '@/lib/providers/types'

/**
 * GET /api/providers/[provider]/connect
 * Initiate OAuth flow for a provider
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerType } = await params
    const { workspaceId } = await getWorkspaceContext(request)

    if (!workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate provider type
    const validProviders: ProviderType[] = [
      'hubspot', 'salesforce', 'marketo', 'activecampaign', 'mailchimp', 'klaviyo',
      'webflow', 'figma', 'framer', 'wordpress', 'shopify',
      'google-ads', 'meta-ads', 'linkedin-ads',
      'ga4', 'amplitude', 'mixpanel', 'segment',
      'slack', 'notion',
    ]

    if (!validProviders.includes(providerType as ProviderType)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    const provider = getProvider(providerType as ProviderType)

    // Build redirect URL
    const origin = request.nextUrl.origin
    const redirectUrl = `${origin}/api/providers/${providerType}/callback`

    // Get OAuth URL from provider
    const authUrl = provider.getAuthUrl(workspaceId, redirectUrl)

    // Redirect to OAuth
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Provider connect error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate connection' },
      { status: 500 }
    )
  }
}
