import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId, handleWorkspaceError } from '@/lib/workspace'
import { Database } from '@/lib/supabase/types'

type ProviderConnectionRow = Database['public']['Tables']['provider_connections']['Row']

export async function GET(request: NextRequest) {
  try {
    const workspaceId = getWorkspaceId(request)
    const supabase = createServiceClient()

    const { data: connection } = await supabase
      .from('provider_connections')
      .select('metadata, expires_at, created_at')
      .eq('workspace_id', workspaceId)
      .eq('provider_id', 'webflow')
      .maybeSingle()

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      user_email: connection.metadata?.email,
      user_name: `${connection.metadata?.firstName || ''} ${connection.metadata?.lastName || ''}`.trim(),
      connected_at: connection.created_at,
    })
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
