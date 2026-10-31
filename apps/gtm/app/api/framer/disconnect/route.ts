import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext, handleWorkspaceError } from '@/lib/workspace'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = getWorkspaceContext(request)
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider_id', 'framer')

    if (error) {
      console.error('Failed to disconnect Framer:', error)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
