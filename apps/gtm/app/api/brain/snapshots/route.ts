import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { approveBrainSnapshot, getBrainContext, listBrainSnapshots, resolveApprovedBrainSnapshot } from '@/lib/brain/service'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'

const ApproveSchema = z.object({
  snapshotId: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const snapshotId = request.nextUrl.searchParams.get('snapshotId')
    const brandId = request.nextUrl.searchParams.get('brandId') ?? undefined

    if (snapshotId) {
      const context = await getBrainContext(workspaceId, snapshotId)
      return NextResponse.json({ context })
    }

    const snapshots = await listBrainSnapshots(workspaceId, brandId)
    const approved = await resolveApprovedBrainSnapshot(workspaceId, brandId)
    return NextResponse.json({ snapshots, approvedSnapshot: approved })
  } catch (error) {
    try {
      return handleWorkspaceError(error)
    } catch {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load snapshots' }, { status: 500 })
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const body = ApproveSchema.parse(await request.json())
    const snapshot = await approveBrainSnapshot(workspaceId, body.snapshotId)
    return NextResponse.json({ snapshot })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid snapshot request', details: error.errors }, { status: 400 })
    }
    try {
      return handleWorkspaceError(error)
    } catch {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update snapshot' }, { status: 500 })
    }
  }
}
