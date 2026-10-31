import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'

export async function GET(request: NextRequest) {
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  const { data, error } = await supabase
    .from('workspace_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  const body = await request.json()
  
  const { data, error } = await supabase
    .from('workspace_settings')
    .update(body)
    .eq('workspace_id', workspaceId)
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}
