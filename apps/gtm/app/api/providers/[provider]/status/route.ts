import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getProvider } from '@/lib/providers/registry'
import type { ProviderType } from '@/lib/providers/types'

/**
 * GET /api/providers/[provider]/status
 * Check connection status for a provider
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

    const provider = getProvider(providerType as ProviderType)
    const isConnected = await provider.isConnected(workspaceId)

    return NextResponse.json({
      provider: providerType,
      connected: isConnected,
      name: provider.name,
      capabilities: provider.capabilities,
    })
  } catch (error) {
    console.error('Provider status error:', error)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/providers/[provider]/status
 * Disconnect a provider
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerType } = await params
    const { workspaceId } = await getWorkspaceContext(request)

    if (!workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const provider = getProvider(providerType as ProviderType)
    await provider.disconnect(workspaceId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Provider disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
