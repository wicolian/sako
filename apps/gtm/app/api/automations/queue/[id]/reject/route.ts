import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'

const RejectSchema = z.object({
  reason: z.string().max(500).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = getWorkspaceIdWithFallback(request)
  const { id } = await params
  const supabase = createServiceClient()

  let reason: string | undefined
  try {
    const payload = await request.json()
    reason = RejectSchema.parse(payload).reason
  } catch {
    reason = undefined
  }

  const { data, error } = await supabase
    .from('scheduled_content')
    .update({
      status: 'rejected',
      rejection_reason: reason,
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .in('status', ['pending_review', 'approved'])
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
  }

  return NextResponse.json({ item: data })
}
