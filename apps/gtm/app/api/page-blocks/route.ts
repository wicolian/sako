import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaignId')
  
  if (!campaignId) {
    return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
  }
  
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('page_blocks')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('order', { ascending: true })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const body = await request.json()
  
  const { data, error } = await supabase
    .from('page_blocks')
    .insert({
      campaign_id: body.campaignId,
      type: body.type,
      order: body.order || 0,
      props: body.props || {},
    })
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}
