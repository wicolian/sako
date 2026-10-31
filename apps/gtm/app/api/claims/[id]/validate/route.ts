import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { validateSingleClaim } from '@/lib/claims/validation-graph'
import { generateCompliantRewrites } from '@/lib/ai/ai-sdk-client'
import { parsePolicyFromDatabase } from '@/lib/claims/rules-engine'
import { getWorkspaceId } from '@/lib/workspace'

// POST /api/claims/[id]/validate - Run validation on a claim
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()
    const body = await request.json()
    const { generateRewrites = false } = body
    
    // Get the claim
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select(`
        *,
        claim_evidence_links (
          evidence:evidence_id (
            id,
            tier
          )
        )
      `)
      .eq('id', id)
      .single()
    
    if (claimError || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }
    
    const workspaceId = getWorkspaceId(request)
    
    // Get current policy
    const { data: policy } = await supabase
      .from('policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false })
      .limit(1)
      .single()
    
    if (!policy) {
      return NextResponse.json({ error: 'No policy found' }, { status: 400 })
    }
    
    // Build policy config with proper typing and defaults
    const policyConfig = parsePolicyFromDatabase(policy)
    
    // Check evidence
    const evidenceLinks = claim.claim_evidence_links as Array<{ evidence: { id: string; tier: string } }>
    const hasEvidence = evidenceLinks && evidenceLinks.length > 0
    const bestTier = hasEvidence
      ? evidenceLinks.reduce((best, link) => {
          const tier = link.evidence?.tier
          if (tier === 'A') return 'A'
          if (tier === 'B' && best !== 'A') return 'B'
          return best || 'C'
        }, '' as 'A' | 'B' | 'C' | '')
      : undefined
    
    // Run validation
    const result = await validateSingleClaim(claim.text, policyConfig, {
      hasEvidence,
      evidenceTier: bestTier as 'A' | 'B' | 'C' | undefined,
    })
    
    // Generate rewrites if requested and claim is blocked/needs proof
    let rewrites = null
    if (generateRewrites && (result.status === 'blocked' || result.status === 'needs_proof')) {
      const rewriteResult = await generateCompliantRewrites(
        [{
          text: claim.text,
          reasonCode: result.reasonCodes.join(', '),
          category: claim.category,
        }],
        {
          mode: policyConfig.mode,
          forbiddenTerms: policyConfig.forbiddenTerms.map(t => t.term),
        }
      )
      rewrites = rewriteResult.rewrites.map(r => ({
        original: r.original,
        rewrittenClaim: r.rewritten,
        reasoning: r.reasoning,
      }))
    }
    
    // Map validation status to claim status
    let newStatus = claim.status
    if (result.status === 'blocked') {
      newStatus = 'blocked'
    } else if (result.status === 'needs_proof') {
      newStatus = 'needs_proof'
    } else if (claim.claim_type === 'hard') {
      newStatus = 'ready_review'
    } else {
      newStatus = 'approved'
    }
    
    // Update claim with validation results
    const { data: updatedClaim, error: updateError } = await supabase
      .from('claims')
      .update({
        status: newStatus,
        risk_score: result.riskScore,
        reason_codes: result.reasonCodes,
        required_evidence_tier: result.requiredEvidenceTier,
        suggested_rewrites: rewrites?.map(r => r.rewrittenClaim) || claim.suggested_rewrites,
        policy_version: policy.version,
      })
      .eq('id', id)
      .select()
      .single()
    
    if (updateError) {
      console.error('Error updating claim:', updateError)
      return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 })
    }
    
    return NextResponse.json({
      claim: updatedClaim,
      validation: result,
      rewrites,
    })
  } catch (error) {
    console.error('Error in claim validate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
