import { NextRequest, NextResponse } from 'next/server'
import { approveBrainSnapshot } from '@/lib/brain/service'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const { id } = await params
    const snapshot = await approveBrainSnapshot(workspaceId, id)
    return NextResponse.json({ snapshot })
  } catch (error) {
    try {
      return handleWorkspaceError(error)
    } catch {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to approve snapshot' }, { status: 500 })
    }
  }
}
