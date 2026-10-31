/**
 * POST /api/assets/[id]/override
 *
 * Explicit audited compliance override.
 * Requires admin/reviewer role and mandatory reason.
 * Records full audit trail.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId, getUserId } from '@/lib/workspace'
import { recordComplianceOverride } from '@/lib/claims/compliance-gate'

const OverrideSchema = z.object({
  reason: z.string().min(10, 'Override reason must be at least 10 characters'),
  claimIds: z.array(z.string().uuid()).min(1, 'At least one claim ID required'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = getWorkspaceId(request)
  const userId = getUserId(request)
  const { id: assetId } = await params

  // Role check: only admin/reviewer can override
  const userRole = request.headers.get('x-user-role')
  if (userRole !== 'admin' && userRole !== 'reviewer') {
    return NextResponse.json(
      { error: 'Only admin or reviewer roles can override compliance blocks' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const input = OverrideSchema.parse(body)

    await recordComplianceOverride(
      assetId,
      workspaceId,
      userId,
      input.reason,
      input.claimIds
    )

    return NextResponse.json({
      success: true,
      message: 'Override recorded. Claims marked as overridden.',
      audit: {
        overriddenBy: userId,
        reason: input.reason,
        claimCount: input.claimIds.length,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('[assets/override] Error:', error)
    return NextResponse.json({ error: 'Override failed' }, { status: 500 })
  }
}
