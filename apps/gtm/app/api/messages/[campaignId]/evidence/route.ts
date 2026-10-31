import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params
  const supabase = createServiceClient()

  // Get all message IDs for this campaign
  const { data: messages } = await supabase
    .from('messages')
    .select('id')
    .eq('campaign_id', campaignId)

  if (!messages || messages.length === 0) {
    return NextResponse.json([])
  }

  const messageIds = messages.map((m) => m.id)

  // Get linked evidence
  const { data, error } = await supabase
    .from('message_evidence')
    .select(`
      id,
      message_id,
      evidence_id,
      note,
      evidence:evidence_id (
        id,
        title,
        type,
        content,
        url
      )
    `)
    .in('message_id', messageIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
