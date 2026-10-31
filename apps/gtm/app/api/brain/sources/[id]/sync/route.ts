import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'
import { syncBrainSource } from '@/lib/brain/service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId, userId } = getWorkspaceContext(request)
    const { id } = await params
    const result = await syncBrainSource(workspaceId, id, { createdBy: userId })
    return NextResponse.json(result)
  } catch (error) {
    try {
      return handleWorkspaceError(error)
    } catch {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to sync source' }, { status: 500 })
    }
  }
}
