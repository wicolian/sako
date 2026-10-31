import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Database } from '@/lib/supabase/types'

type FollowupFlowRow = Database['public']['Tables']['followup_flows']['Row']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()
  
  const { data, error } = await supabase
    .from('followup_flows')
    .update({
      graph_json: body.graph_json,
      compiled_json: body.compiled_json,
    })
    .eq('id', id)
    .select()
    .maybeSingle()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}
