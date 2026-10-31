import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId, handleWorkspaceError } from '@/lib/workspace'

export async function GET(request: NextRequest) {
  try {
    const workspaceId = getWorkspaceId(request)
    const supabase = createServiceClient()

    const { data: connection } = await supabase
      .from('provider_connections')
      .select('metadata, expires_at, created_at')
      .eq('workspace_id', workspaceId)
      .eq('provider_id', 'figma')
      .single()

    if (!connection) {
      return NextResponse.json({ connected: false })
    }

    return NextResponse.json({
      connected: true,
      user_email: connection.metadata?.email,
      user_handle: connection.metadata?.handle,
      user_avatar: connection.metadata?.img_url,
      connected_at: connection.created_at,
    })
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
