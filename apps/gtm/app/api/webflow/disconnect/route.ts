import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceId, handleWorkspaceError } from '@/lib/workspace'

export async function POST(request: NextRequest) {
  try {
    const workspaceId = getWorkspaceId(request)
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('provider_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('provider_id', 'webflow')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
