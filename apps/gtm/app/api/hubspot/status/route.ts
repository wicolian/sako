import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId } from '@/lib/workspace'
import { Database } from '@/lib/supabase/types'

type HubspotConnectionRow = Database['public']['Tables']['hubspot_connections']['Row']

export async function GET(request: NextRequest) {
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceId(request)

  const { data: connection } = await supabase
    .from('hubspot_connections')
    .select('portal_id, expires_at, scopes')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    portal_id: connection.portal_id,
    expires_at: connection.expires_at,
    scopes: connection.scopes,
  })
}
