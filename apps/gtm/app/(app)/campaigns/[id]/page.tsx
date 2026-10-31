import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getWorkspaceFromHeaders } from '@/lib/workspace'
import type { ClaimData } from '@/components/campaigns/compliance-sidebar'
import { CampaignDetail } from './campaign-detail'

function mapClaimStatusToRiskLevel(status: string, riskScore: number): ClaimData['riskLevel'] {
  if (status === 'approved') return 'safe'
  if (status === 'needs_proof') return 'needs_evidence'
  if (status === 'blocked' || status === 'rejected') return 'blocked'
  if (riskScore >= 35) return 'risky'
  return 'needs_evidence'
}

interface LinkedClaimRow {
  claim: Array<{
    id: string
    text: string
    category: string
    status: string
    risk_score: number
    suggested_rewrites: unknown
  }> | null
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const workspace = await getWorkspaceFromHeaders()

  let workspaceId = workspace?.workspaceId ?? null

  if (!workspaceId) {
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id

    if (userId) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId)
        .maybeSingle()

      workspaceId = membership?.workspace_id ?? null
    }
  }

  let campaign = null

  if (workspaceId) {
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    campaign = data
  }

  if (!campaign) {
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    campaign = data
    workspaceId = campaign?.workspace_id ?? workspaceId
  }
  
  if (!campaign) {
    notFound()
  }

  const [messagesRes, anglesRes, blocksRes, flowRes] = await Promise.all([
    supabase.from('messages').select('*').eq('campaign_id', id),
    supabase.from('angles').select('*').eq('campaign_id', id).order('rank'),
    supabase.from('page_blocks').select('*').eq('campaign_id', id).order('order'),
    supabase.from('followup_flows').select('*').eq('campaign_id', id).single(),
  ])
  const { data: linkedClaims } = await supabase
    .from('campaign_claim_links')
    .select(`
      claim:claim_id (
        id,
        text,
        category,
        status,
        risk_score,
        suggested_rewrites
      )
    `)
    .eq('workspace_id', workspaceId ?? '')
    .eq('campaign_id', id)

  const claims: ClaimData[] = Array.from(
    new Map(
      ((linkedClaims ?? []) as LinkedClaimRow[])
        .map((row) => row.claim?.[0] ?? null)
        .filter((claim): claim is NonNullable<LinkedClaimRow['claim']>[number] => Boolean(claim))
        .map((claim) => [
          claim.id,
          {
            id: claim.id,
            text: claim.text,
            category: claim.category,
            riskLevel: mapClaimStatusToRiskLevel(claim.status, claim.risk_score),
            evidenceStatus:
              claim.status === 'approved'
                ? 'Evidence accepted'
                : claim.status === 'needs_proof'
                  ? 'Needs supporting evidence'
                  : 'Validation required',
            suggestedRewrite:
              Array.isArray(claim.suggested_rewrites) && typeof claim.suggested_rewrites[0] === 'string'
                ? claim.suggested_rewrites[0]
                : undefined,
          } satisfies ClaimData,
        ])
    ).values()
  )
  
  return (
    <CampaignDetail
      campaign={campaign}
      messages={messagesRes.data || []}
      angles={anglesRes.data || []}
      pageBlocks={blocksRes.data || []}
      followupFlow={flowRes.data}
      claims={claims}
    />
  )
}
