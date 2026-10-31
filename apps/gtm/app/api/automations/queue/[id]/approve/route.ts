import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback, getUserIdWithFallback } from '@/lib/workspace'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = getWorkspaceIdWithFallback(request)
  const userId = getUserIdWithFallback(request)
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('scheduled_content')
    .update({
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .in('status', ['pending_review', 'rejected'])
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
  }

  return NextResponse.json({ item: data })
}
