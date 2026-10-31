/**
 * Claims API (Jan 2026 - Fixed)
 * 
 * List and manage marketing claims across campaigns.
 * Uses proper junction table for evidence relationships.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { linkClaimToCampaign, listCampaignClaims } from '@/lib/claims/claim-lineage'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const workspaceId = membership.workspace_id
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaign_id') || searchParams.get('campaignId')
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '100')

    if (campaignId) {
      const campaignClaims = await listCampaignClaims(workspaceId, campaignId)
      const stats = {
        total: campaignClaims.length,
        approved: campaignClaims.filter((c) => c.status === 'approved').length,
        needsProof: campaignClaims.filter((c) => c.status === 'needs_proof').length,
        blocked: campaignClaims.filter((c) => c.status === 'blocked').length,
        draft: campaignClaims.filter((c) => c.status === 'draft').length,
        readyReview: campaignClaims.filter((c) => c.status === 'ready_review').length,
        avgRisk: campaignClaims.length > 0
          ? Math.round(campaignClaims.reduce((acc, claim) => acc + Number(claim.riskScore || 0), 0) / campaignClaims.length)
          : 0,
      }

      return NextResponse.json({
        claims: campaignClaims,
        stats,
      })
    }

    // Get claims from dedicated claims table (preferred) or messages table
    let query = supabase
      .from('claims')
      .select(`
        id,
        text,
        original_text,
        claim_type,
        category,
        risk_score,
        status,
        reason_codes,
        required_evidence_tier,
        suggested_rewrites,
        policy_version,
        created_by,
        approved_by,
        approved_at,
        created_at,
        updated_at
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }
    
    const { data: claims, error } = await query
    
    if (error) {
      throw new Error(`Failed to fetch claims: ${error.message}`)
    }

    // Get evidence links for these claims
    const claimIds = (claims || []).map(c => c.id)
    let evidenceMap: Record<string, any[]> = {}
    
    if (claimIds.length > 0) {
      const { data: evidenceLinks } = await supabase
        .from('claim_evidence_links')
        .select(`
          claim_id,
          evidence:evidence_id(id, title, type, tier, url)
        `)
        .in('claim_id', claimIds)
      
      // Group evidence by claim
      for (const link of evidenceLinks || []) {
        if (!evidenceMap[link.claim_id]) {
          evidenceMap[link.claim_id] = []
        }
        if (link.evidence) {
          evidenceMap[link.claim_id].push(link.evidence)
        }
      }
    }
    
    // Transform to expected format
    const transformedClaims = (claims || []).map(claim => ({
      id: claim.id,
      text: claim.text,
      originalText: claim.original_text,
      type: claim.claim_type || 'soft',
      category: claim.category || 'generic',
      status: claim.status || 'draft',
      riskScore: claim.risk_score || 0,
      reasonCodes: claim.reason_codes || [],
      requiredEvidenceTier: claim.required_evidence_tier,
      suggestedRewrites: claim.suggested_rewrites || [],
      evidence: evidenceMap[claim.id] || [],
      lastValidated: claim.approved_at 
        ? formatRelativeTime(new Date(claim.approved_at))
        : 'Never',
      createdAt: claim.created_at,
      updatedAt: claim.updated_at,
    }))
    
    // Calculate stats
    const stats = {
      total: transformedClaims.length,
      approved: transformedClaims.filter(c => c.status === 'approved').length,
      needsProof: transformedClaims.filter(c => c.status === 'needs_proof').length,
      blocked: transformedClaims.filter(c => c.status === 'blocked').length,
      draft: transformedClaims.filter(c => c.status === 'draft').length,
      readyReview: transformedClaims.filter(c => c.status === 'ready_review').length,
      avgRisk: transformedClaims.length > 0 
        ? Math.round(transformedClaims.reduce((acc, c) => acc + c.riskScore, 0) / transformedClaims.length)
        : 0,
    }
    
    return NextResponse.json({
      claims: transformedClaims,
      stats,
    })
    
  } catch (error) {
    console.error('Claims API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch claims' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const workspaceId = membership.workspace_id
    const { content, claim_type, category, campaign_id, source } = body

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    const serviceSupabase = createServiceClient()
    const { data: claim, error } = await serviceSupabase
      .from('claims')
      .insert({
        workspace_id: workspaceId,
        text: content,
        original_text: content,
        claim_type: claim_type || 'soft',
        category: category || 'generic',
        status: 'draft',
        risk_score: 50,
        reason_codes: [],
        suggested_rewrites: [],
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (campaign_id && typeof campaign_id === 'string') {
      await linkClaimToCampaign({
        workspaceId,
        campaignId: campaign_id,
        claimId: claim.id,
        source: source === 'import' ? 'import' : 'manual',
      })
    }

    return NextResponse.json({ claim }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create claim' },
      { status: 500 }
    )
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
