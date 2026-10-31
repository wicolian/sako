import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { message_id, evidence_id, note } = body

  if (!message_id || !evidence_id) {
    return NextResponse.json(
      { error: 'Missing message_id or evidence_id' },
      { status: 400 }
    )
  }

  // Check if link already exists
  const { data: existing } = await supabase
    .from('message_evidence')
    .select('id')
    .eq('message_id', message_id)
    .eq('evidence_id', evidence_id)
    .single()

  if (existing) {
    return NextResponse.json({ 
      success: true, 
      message: 'Already linked',
      id: existing.id 
    })
  }

  // Create link
  const { data, error } = await supabase
    .from('message_evidence')
    .insert({
      message_id,
      evidence_id,
      note: note || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update message status if it was needs_evidence
  await supabase
    .from('messages')
    .update({ status: 'approved' })
    .eq('id', message_id)
    .eq('status', 'needs_evidence')

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { message_id, evidence_id } = body

  if (!message_id || !evidence_id) {
    return NextResponse.json(
      { error: 'Missing message_id or evidence_id' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('message_evidence')
    .delete()
    .eq('message_id', message_id)
    .eq('evidence_id', evidence_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Check if message still has evidence, if not revert to needs_evidence
  const { data: remaining } = await supabase
    .from('message_evidence')
    .select('id')
    .eq('message_id', message_id)

  if (!remaining || remaining.length === 0) {
    // Check if message has risk tags that require evidence
    const { data: message } = await supabase
      .from('messages')
      .select('risk_tags')
      .eq('id', message_id)
      .single()

    if (message?.risk_tags && message.risk_tags.length > 0) {
      await supabase
        .from('messages')
        .update({ status: 'needs_evidence' })
        .eq('id', message_id)
    }
  }

  return NextResponse.json({ success: true })
}
