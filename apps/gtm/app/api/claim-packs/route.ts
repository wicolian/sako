import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { nanoid } from 'nanoid'
import { getWorkspaceId } from '@/lib/workspace'
import { Database } from '@/lib/supabase/types'

type ClaimPackRow = Database['public']['Tables']['claim_packs']['Row']
type ClaimRow = Database['public']['Tables']['claims']['Row']

// GET /api/claim-packs - List all claim packs
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const workspaceId = getWorkspaceId(request)
    
    const { data, error } = await supabase
      .from('claim_packs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching claim packs:', error)
      return NextResponse.json({ error: 'Failed to fetch claim packs' }, { status: 500 })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in claim-packs GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/claim-packs - Create a new claim pack
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body = await request.json()
    const workspaceId = getWorkspaceId(request)
    
    const {
      name,
      description,
      claimIds,
      exportFormat = 'json',
      generateShareLink = false,
      expiresInDays = 7,
    } = body
    
    if (!name) {
      return NextResponse.json({ error: 'Pack name is required' }, { status: 400 })
    }
    
    if (!claimIds || !Array.isArray(claimIds) || claimIds.length === 0) {
      return NextResponse.json({ error: 'At least one claim ID is required' }, { status: 400 })
    }
    
    // Verify claims exist and are approved
    const { data: claims, error: claimsError } = await supabase
      .from('claims')
      .select('id, text, claim_type, category, status')
      .eq('workspace_id', workspaceId)
      .in('id', claimIds)
    
    if (claimsError) {
      console.error('Error verifying claims:', claimsError)
      return NextResponse.json({ error: 'Failed to verify claims' }, { status: 500 })
    }
    
    if (!claims || claims.length !== claimIds.length) {
      return NextResponse.json({ error: 'Some claims not found' }, { status: 400 })
    }
    
    // Check for non-approved claims
    const nonApproved = claims.filter(c => c.status !== 'approved')
    if (nonApproved.length > 0) {
      return NextResponse.json({ 
        error: 'Some claims are not approved',
        nonApprovedClaims: nonApproved.map(c => ({ id: c.id, status: c.status })),
      }, { status: 400 })
    }
    
    // Generate share token if requested
    const shareToken = generateShareLink ? nanoid(16) : null
    const expiresAt = generateShareLink 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null
    
    const { data: pack, error } = await supabase
      .from('claim_packs')
      .insert({
        workspace_id: workspaceId,
        name,
        description,
        claim_ids: claimIds,
        export_format: exportFormat,
        share_token: shareToken,
        expires_at: expiresAt,
      })
      .select()
      .maybeSingle()
    
    if (error) {
      console.error('Error creating claim pack:', error)
      return NextResponse.json({ error: 'Failed to create claim pack' }, { status: 500 })
    }
    
    // Include claims in response
    const response = {
      ...pack,
      claims,
      shareUrl: shareToken ? `/share/${shareToken}` : null,
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in claim-packs POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
