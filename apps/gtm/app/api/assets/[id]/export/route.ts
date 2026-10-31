/**
 * POST /api/assets/[id]/export
 *
 * Single gated export path for all formats: png/jpg/pdf/html/zip/figma.
 * Enforces compliance gate before any export.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/workspace'
import { getAssetDocument } from '@/lib/assets/asset-document-adapter'
import { checkComplianceGate } from '@/lib/claims/compliance-gate'
import { exportAssetDocument } from '@/lib/export/asset-bundler'
import { createServiceClient } from '@/lib/supabase/service'
import { incrementUsage } from '@/lib/billing/usage'
import { requireWorkspaceEntitlement } from '@/lib/billing/entitlements'

const ExportSchema = z.object({
  format: z.enum(['png', 'jpg', 'pdf', 'html', 'zip', 'figma']),
  scale: z.number().min(0.5).max(3).default(1),
  override: z.object({
    reason: z.string().min(5),
    claimIds: z.array(z.string()),
  }).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = getWorkspaceId(request)
  const userId = request.headers.get('x-user-id') ?? ''
  const { id } = await params

  try {
    const body = await request.json()
    const input = ExportSchema.parse(body)

    const gate = await requireWorkspaceEntitlement(workspaceId, 'assetExport', {
      message: 'Asset export requires an active paid plan.',
    })
    if (!gate.ok) {
      return NextResponse.json(
        { error: gate.message, planId: gate.entitlements.planId },
        { status: 403 }
      )
    }

    // Compliance gate — block if high-risk claims unresolved
    const blocked = await checkComplianceGate(id, workspaceId)

    if (blocked && !input.override) {
      return blocked
    }

    // If override provided, record it in audit trail
    if (blocked && input.override) {
      const { recordComplianceOverride } = await import('@/lib/claims/compliance-gate')
      await recordComplianceOverride(
        id,
        workspaceId,
        userId,
        input.override.reason,
        input.override.claimIds
      )
    }

    // Fetch asset document
    const doc = await getAssetDocument(id)
    if (!doc || doc.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Handle Figma export separately
    if (input.format === 'figma') {
      const { exportToFigma } = await import('@/lib/html/export')
      const figmaData = await exportToFigma(doc.html, '', {
        name: doc.title ?? 'Composer Asset',
        width: doc.dimensions?.width ?? 1200,
        height: doc.dimensions?.height ?? 627,
      })
      await incrementUsage(workspaceId, 'deployments')
      return NextResponse.json({ figmaData, success: true })
    }

    // Export to requested format
    const exportFormat = input.format === 'zip' ? 'zip' : input.format
    const result = await exportAssetDocument(
      {
        html: doc.html,
        title: doc.title,
        type: doc.type,
        dimensions: doc.dimensions,
      },
      exportFormat as 'png' | 'jpg' | 'pdf' | 'html' | 'zip'
    )

    // Record export event for learning (non-critical)
    try {
      const supabase = createServiceClient()
      await supabase.from('design_quality_events').insert({
        workspace_id: workspaceId,
        asset_document_id: id,
        event_type: 'exported',
        edit_diff: { format: input.format, exportedAt: new Date().toISOString() },
      })
    } catch { /* non-critical */ }

    await incrementUsage(workspaceId, 'deployments')

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Length': String(result.buffer.length),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    console.error('[assets/export] Error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
