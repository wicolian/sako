import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'

export async function GET(request: NextRequest) {
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  const body = await request.json()
  
  const { data, error } = await supabase
    .from('evidence')
    .insert({
      workspace_id: workspaceId,
      title: body.title,
      type: body.type,
      content: body.content,
      url: body.url,
      tier: body.tier || 'C',
      source_type: body.source_type,
    })
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}
