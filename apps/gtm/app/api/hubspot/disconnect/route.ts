import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/workspace'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceId(request)

  const { error } = await supabase
    .from('hubspot_connections')
    .delete()
    .eq('workspace_id', workspaceId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
