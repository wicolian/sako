import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { TwitterProvider } from '@/lib/providers/twitter'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const provider = new TwitterProvider()
    await provider.disconnect(workspaceId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Twitter disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect Twitter/X' }, { status: 500 })
  }
}
