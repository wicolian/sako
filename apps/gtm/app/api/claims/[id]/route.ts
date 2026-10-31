import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getWorkspaceId } from '@/lib/workspace'

async function requireWorkspaceAccess(request: NextRequest) {
  const workspaceId = getWorkspaceId(request)
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      supabase,
      workspaceId,
    }
  }

  return { supabase, workspaceId }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireWorkspaceAccess(request)
    if ('errorResponse' in access) {
      return access.errorResponse
    }

    const { id } = await params
    const { supabase, workspaceId } = access

    const { data, error } = await supabase
      .from('claims')
      .select(`
        *,
        claim_evidence_links (
          id,
          evidence_id,
          relevance_note,
          evidence:evidence_id (
            id,
            title,
            type,
            tier,
            content,
            url
          )
        ),
        approvals (
          id,
          reviewer_id,
          decision,
          comment,
          policy_version,
          created_at
        )
      `)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
      }
      console.error('Error fetching claim:', error)
      return NextResponse.json({ error: 'Failed to fetch claim' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in claim GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireWorkspaceAccess(request)
    if ('errorResponse' in access) {
      return access.errorResponse
    }

    const { id } = await params
    const { supabase, workspaceId } = access
    const body = await request.json()

    const allowedFields = [
      'text',
      'claim_type',
      'category',
      'status',
      'risk_score',
      'reason_codes',
      'required_evidence_tier',
      'suggested_rewrites',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    if (body.text) {
      const { data: existing } = await supabase
        .from('claims')
        .select('text, original_text')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .single()

      if (existing && !existing.original_text) {
        updates.original_text = existing.text
      }
    }

    const { data, error } = await supabase
      .from('claims')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating claim:', error)
      return NextResponse.json({ error: 'Failed to update claim' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in claim PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireWorkspaceAccess(request)
    if ('errorResponse' in access) {
      return access.errorResponse
    }

    const { id } = await params
    const { supabase, workspaceId } = access

    const { error } = await supabase
      .from('claims')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) {
      console.error('Error deleting claim:', error)
      return NextResponse.json({ error: 'Failed to delete claim' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in claim DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
