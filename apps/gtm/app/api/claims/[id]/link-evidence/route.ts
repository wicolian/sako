import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function requireWorkspaceMembership() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      supabase,
    }
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return {
      errorResponse: NextResponse.json({ error: 'Workspace not found' }, { status: 404 }),
      supabase,
    }
  }

  return { supabase, workspaceId: membership.workspace_id, userId: user.id }
}

// POST /api/claims/[id]/link-evidence - Link evidence to a claim
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: claimId } = await params
    const access = await requireWorkspaceMembership()
    if ('errorResponse' in access) {
      return access.errorResponse
    }

    const { supabase, workspaceId, userId } = access
    const body = await request.json()
    
    const { evidenceId, relevanceNote } = body
    
    if (!evidenceId) {
      return NextResponse.json({ error: 'Evidence ID is required' }, { status: 400 })
    }
    
    // Verify claim exists
    const { data: claim } = await supabase
      .from('claims')
      .select('id')
      .eq('id', claimId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }
    
    // Verify evidence exists
    const { data: evidence } = await supabase
      .from('evidence')
      .select('id')
      .eq('id', evidenceId)
      .eq('workspace_id', workspaceId)
      .single()
    
    if (!evidence) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
    }
    
    // Create link
    const { data: link, error } = await supabase
      .from('claim_evidence_links')
      .insert({
        claim_id: claimId,
        evidence_id: evidenceId,
        relevance_note: relevanceNote,
        created_by: userId,
      })
      .select()
      .single()
    
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Evidence already linked' }, { status: 400 })
      }
      console.error('Error linking evidence:', error)
      return NextResponse.json({ error: 'Failed to link evidence' }, { status: 500 })
    }
    
    return NextResponse.json(link)
  } catch (error) {
    console.error('Error in link-evidence POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/claims/[id]/link-evidence - Unlink evidence from a claim
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: claimId } = await params
    const access = await requireWorkspaceMembership()
    if ('errorResponse' in access) {
      return access.errorResponse
    }

    const { supabase, workspaceId } = access
    const { searchParams } = new URL(request.url)
    
    const evidenceId = searchParams.get('evidenceId')
    
    if (!evidenceId) {
      return NextResponse.json({ error: 'Evidence ID is required' }, { status: 400 })
    }

    const { data: claim } = await supabase
      .from('claims')
      .select('id')
      .eq('id', claimId)
      .eq('workspace_id', workspaceId)
      .single()

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('claim_evidence_links')
      .delete()
      .eq('claim_id', claimId)
      .eq('evidence_id', evidenceId)

    if (error) {
      console.error('Error unlinking evidence:', error)
      return NextResponse.json({ error: 'Failed to unlink evidence' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in link-evidence DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
