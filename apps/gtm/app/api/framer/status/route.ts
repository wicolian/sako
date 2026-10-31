import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const supabase = createServiceClient()

    const { data: connection } = await supabase
      .from('provider_connections')
      .select('metadata, expires_at')
      .eq('workspace_id', workspaceId)
      .eq('provider_id', 'framer')
      .single()

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      user: connection.metadata,
      expiresAt: connection.expires_at,
    })
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
