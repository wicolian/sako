import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Database } from '@/lib/supabase/types'

type FollowupFlowRow = Database['public']['Tables']['followup_flows']['Row']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaignId')
  
  if (!campaignId) {
    return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 })
  }
  
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('followup_flows')
    .select('*')
    .eq('campaign_id', campaignId)
    .maybeSingle()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // If no flow exists, return null (not an error)
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const body = await request.json()
  
  const { data, error } = await supabase
    .from('followup_flows')
    .insert({
      campaign_id: body.campaign_id,
      angle_id: body.angle_id,
      graph_json: body.graph_json || { nodes: [], edges: [] },
    })
    .select()
    .maybeSingle()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}
