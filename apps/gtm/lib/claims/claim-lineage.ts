import { createServiceClient } from '@/lib/supabase/service'
import { computeComplianceStatus, type AssetDocument, type ClaimRef } from '@/lib/assets/asset-document'

interface StoredClaimRow {
  id: string
  text: string
  status: string
  risk_score: number | null
  category: string | null
  suggested_rewrites: unknown
}

interface CampaignClaimLinkRow {
  source: string
  asset_document_id: string | null
  message_id: string | null
  claim: StoredClaimRow[] | null
}

function toClaimRefStatus(status: string): ClaimRef['status'] {
  if (status === 'approved') return 'verified'
  if (status === 'blocked' || status === 'rejected') return 'blocked'
  return 'unverified'
}

function toRiskLevel(score: number): ClaimRef['riskLevel'] {
  if (score >= 85) return 'critical'
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function getRewrite(value: unknown): string | undefined {
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }
  return undefined
}

export async function syncAssetDocumentClaimLineage(doc: AssetDocument): Promise<AssetDocument> {
  if (!doc.campaignId || doc.claims.length === 0) {
    return doc
  }

  const supabase = createServiceClient()
  const uniqueTexts = Array.from(
    new Set(
      doc.claims
        .map((claim) => claim.text.trim())
        .filter((text): text is string => text.length > 0)
    )
  )

  if (uniqueTexts.length === 0) {
    return doc
  }

  const { data: existingClaims } = await supabase
    .from('claims')
    .select('id, text, status, risk_score, category, suggested_rewrites')
    .eq('workspace_id', doc.workspaceId)
    .in('text', uniqueTexts)

  const claimsByText = new Map<string, StoredClaimRow>()
  for (const claim of (existingClaims ?? []) as StoredClaimRow[]) {
    claimsByText.set(claim.text, claim)
  }

  const missingTexts = uniqueTexts.filter((text) => !claimsByText.has(text))
  if (missingTexts.length > 0) {
    const claimDefaults = new Map(doc.claims.map((claim) => [claim.text.trim(), claim]))
    const { data: insertedClaims } = await supabase
      .from('claims')
      .insert(
        missingTexts.map((text) => {
          const sourceClaim = claimDefaults.get(text)
          return {
            workspace_id: doc.workspaceId,
            text,
            original_text: text,
            claim_type: 'unverified',
            category: 'generic',
            status: 'draft',
            risk_score: sourceClaim?.riskScore ?? 0,
            reason_codes: [`CAMPAIGN:${doc.campaignId}`, 'SOURCE:asset_document'],
            suggested_rewrites: sourceClaim?.suggestedRewrite ? [sourceClaim.suggestedRewrite] : [],
          }
        })
      )
      .select('id, text, status, risk_score, category, suggested_rewrites')

    for (const claim of (insertedClaims ?? []) as StoredClaimRow[]) {
      claimsByText.set(claim.text, claim)
    }
  }

  await supabase
    .from('campaign_claim_links')
    .delete()
    .eq('workspace_id', doc.workspaceId)
    .eq('asset_document_id', doc.id)

  const links = doc.claims
    .map((claim) => claimsByText.get(claim.text.trim()))
    .filter((claim): claim is StoredClaimRow => Boolean(claim))
    .map((claim) => ({
      workspace_id: doc.workspaceId,
      campaign_id: doc.campaignId!,
      claim_id: claim.id,
      asset_document_id: doc.id,
      source: 'asset_document',
    }))

  if (links.length > 0) {
    await supabase.from('campaign_claim_links').insert(links)
  }

  const canonicalClaims = doc.claims
    .map((claim) => {
      const stored = claimsByText.get(claim.text.trim())
      if (!stored) return claim
      const riskScore = stored.risk_score ?? claim.riskScore
      return {
        ...claim,
        id: stored.id,
        riskScore,
        riskLevel: toRiskLevel(riskScore),
        status: toClaimRefStatus(stored.status),
        suggestedRewrite: getRewrite(stored.suggested_rewrites) ?? claim.suggestedRewrite,
      }
    })

  const complianceStatus = computeComplianceStatus(canonicalClaims)

  await supabase
    .from('asset_documents')
    .update({
      claims_json: canonicalClaims,
      compliance_status: complianceStatus,
    })
    .eq('id', doc.id)
    .eq('workspace_id', doc.workspaceId)

  return {
    ...doc,
    claims: canonicalClaims,
    complianceStatus,
    updatedAt: new Date().toISOString(),
  }
}

export async function listCampaignClaims(workspaceId: string, campaignId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('campaign_claim_links')
    .select(`
      source,
      asset_document_id,
      message_id,
      claim:claim_id (
        id,
        text,
        status,
        risk_score,
        category,
        suggested_rewrites,
        required_evidence_tier,
        created_at,
        updated_at
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('campaign_id', campaignId)

  const deduped = new Map<string, Record<string, unknown>>()
  for (const row of ((data ?? []) as unknown as CampaignClaimLinkRow[])) {
    const claim = row.claim?.[0]
    if (!claim?.id) continue
    const current = deduped.get(claim.id)
    const sourceRefs = current?.sourceRefs
    const nextSourceRefs = Array.isArray(sourceRefs) ? sourceRefs : []
    nextSourceRefs.push({
      source: row.source,
      assetDocumentId: row.asset_document_id,
      messageId: row.message_id,
    })

    deduped.set(claim.id, {
      id: claim.id,
      text: claim.text,
      type: 'soft',
      category: claim.category ?? 'generic',
      status: claim.status,
      riskScore: claim.risk_score ?? 0,
      suggestedRewrites: claim.suggested_rewrites ?? [],
      requiredEvidenceTier: null,
      evidence: [],
      createdAt: null,
      updatedAt: null,
      sourceRefs: nextSourceRefs,
    })
  }

  return Array.from(deduped.values())
}

export async function linkClaimToCampaign(input: {
  workspaceId: string
  campaignId: string
  claimId: string
  source: 'manual' | 'import' | 'message'
  messageId?: string
}) {
  const supabase = createServiceClient()
  await supabase
    .from('campaign_claim_links')
    .delete()
    .eq('workspace_id', input.workspaceId)
    .eq('campaign_id', input.campaignId)
    .eq('claim_id', input.claimId)
    .eq('source', input.source)
    .is('asset_document_id', null)
    .is('message_id', input.messageId ?? null)

  await supabase.from('campaign_claim_links').insert({
    workspace_id: input.workspaceId,
    campaign_id: input.campaignId,
    claim_id: input.claimId,
    message_id: input.messageId ?? null,
    source: input.source,
  })
}
