import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getProvider } from '@/lib/providers/registry'
import type { ProviderType } from '@/lib/providers/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerType } = await params
    const { workspaceId } = getWorkspaceContext(request)

    await getProvider(providerType as ProviderType).disconnect(workspaceId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Provider disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect provider' }, { status: 500 })
  }
}
