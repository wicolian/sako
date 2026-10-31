import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/workspace'
import { Database } from '@/lib/supabase/types'

type HubspotConnectionRow = Database['public']['Tables']['hubspot_connections']['Row']

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
