/**
 * Compliance Gate
 *
 * Shared utility for enforcing claims compliance across all
 * export/deploy/publish routes. Returns blocking response when
 * high-risk claims are unresolved.
 *
 * Usage in any route:
 *   const blocked = await checkComplianceGate(assetDocumentId, workspaceId)
 *   if (blocked) return blocked
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { ClaimRef, ComplianceStatus } from '@/lib/assets/asset-document'

export interface ComplianceCheckResult {
  allowed: boolean
  status: ComplianceStatus
  blockedClaims: ClaimRef[]
  totalClaims: number
}

/**
 * Check if an asset document passes compliance for export/deploy/publish.
 * Returns null if allowed, or a NextResponse if blocked.
 */
export async function checkComplianceGate(
  assetDocumentId: string,
  workspaceId: string
): Promise<NextResponse | null> {
  const result = await evaluateCompliance(assetDocumentId, workspaceId)

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Compliance gate: Cannot proceed with unresolved high-risk claims',
        complianceStatus: result.status,
        blockedClaims: result.blockedClaims.map((c) => ({
          id: c.id,
          text: c.text,
          riskScore: c.riskScore,
          suggestedRewrite: c.suggestedRewrite,
        })),
        totalClaims: result.totalClaims,
        action: 'Fix claims, link evidence, accept rewrites, or use explicit override',
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Evaluate compliance status for an asset document.
 * Returns structured result (not HTTP response).
 */
export async function evaluateCompliance(
  assetDocumentId: string,
  workspaceId: string
): Promise<ComplianceCheckResult> {
  const supabase = createServiceClient()

  const { data: doc } = await supabase
    .from('asset_documents')
    .select('claims_json, compliance_status')
    .eq('id', assetDocumentId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!doc) {
    // No canonical document found — allow (legacy flow)
    return { allowed: true, status: 'clean', blockedClaims: [], totalClaims: 0 }
  }

  const claims = (doc.claims_json as ClaimRef[]) ?? []
  const status = (doc.compliance_status as ComplianceStatus) ?? 'clean'

  const blockedClaims = claims.filter(
    (c) => c.riskScore >= 70 && c.status !== 'verified' && c.status !== 'overridden'
  )

  return {
    allowed: blockedClaims.length === 0,
    status: blockedClaims.length > 0 ? 'blocked' : status,
    blockedClaims,
    totalClaims: claims.length,
  }
}

/**
 * Check compliance for a campaign (all its asset documents).
 * Returns null if all pass, or a blocking response.
 */
export async function checkCampaignComplianceGate(
  campaignId: string,
  workspaceId: string
): Promise<NextResponse | null> {
  const supabase = createServiceClient()

  const { data: docs } = await supabase
    .from('asset_documents')
    .select('id, claims_json, compliance_status, asset_type, title')
    .eq('campaign_id', campaignId)
    .eq('workspace_id', workspaceId)

  if (!docs?.length) return null // No canonical docs — allow

  const allBlocked: Array<{ assetId: string; type: string; title: string; claims: ClaimRef[] }> = []

  for (const doc of docs) {
    const claims = (doc.claims_json as ClaimRef[]) ?? []
    const blocked = claims.filter(
      (c) => c.riskScore >= 70 && c.status !== 'verified' && c.status !== 'overridden'
    )

    if (blocked.length > 0) {
      allBlocked.push({
        assetId: doc.id,
        type: doc.asset_type,
        title: doc.title ?? doc.asset_type,
        claims: blocked,
      })
    }
  }

  if (allBlocked.length > 0) {
    return NextResponse.json(
      {
        error: `Compliance gate: ${allBlocked.length} asset(s) have unresolved high-risk claims`,
        blockedAssets: allBlocked.map((a) => ({
          assetId: a.assetId,
          type: a.type,
          title: a.title,
          claimCount: a.claims.length,
        })),
        action: 'Fix claims in each asset before deploying the campaign',
      },
      { status: 403 }
    )
  }

  return null
}

/**
 * Check compliance for a launch kit deployment.
 *
 * Launch kits currently store compliance summary in launch_kits.compliance JSON.
 * If blocked claims exist in the summary, deployment/export is blocked.
 */
export async function checkKitComplianceGate(
  kitId: string,
  workspaceId: string
): Promise<NextResponse | null> {
  const supabase = createServiceClient()

  const { data: kit } = await supabase
    .from('launch_kits')
    .select('id, compliance')
    .eq('id', kitId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!kit) return null

  const compliance = (kit.compliance ?? {}) as Record<string, unknown>
  const blockedRaw = compliance.blocked
  const blocked =
    typeof blockedRaw === 'number'
      ? blockedRaw
      : typeof blockedRaw === 'string'
        ? Number.parseInt(blockedRaw, 10) || 0
        : 0

  if (blocked <= 0) return null

  return NextResponse.json(
    {
      error: 'Compliance gate: Launch kit contains unresolved high-risk claims',
      blockedClaims: blocked,
      action: 'Resolve blocked claims before deploying this kit',
    },
    { status: 403 }
  )
}

/**
 * Record an audited compliance override.
 */
export async function recordComplianceOverride(
  assetDocumentId: string,
  workspaceId: string,
  userId: string,
  reason: string,
  claimIds: string[]
): Promise<void> {
  const supabase = createServiceClient()

  // Update claim statuses to overridden
  const { data: doc } = await supabase
    .from('asset_documents')
    .select('claims_json')
    .eq('id', assetDocumentId)
    .single()

  if (doc) {
    const claims = (doc.claims_json as ClaimRef[]) ?? []
    const updatedClaims = claims.map((c) =>
      claimIds.includes(c.id)
        ? { ...c, status: 'overridden' as const }
        : c
    )

    await supabase
      .from('asset_documents')
      .update({
        claims_json: updatedClaims,
        compliance_status: 'warning', // Downgrade from blocked to warning
      })
      .eq('id', assetDocumentId)
  }

  // Record audit event
  await supabase.from('design_quality_events').insert({
    workspace_id: workspaceId,
    asset_document_id: assetDocumentId,
    event_type: 'exported',
    edit_diff: {
      override: true,
      userId,
      reason,
      claimIds,
      overriddenAt: new Date().toISOString(),
    },
  })
}
