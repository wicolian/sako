import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback, handleWorkspaceError } from '@/lib/workspace'
import { isMissingLaunchKitsTableError } from '@/lib/kit/launch-kit-store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let workspaceId: string
  try {
    workspaceId = getWorkspaceIdWithFallback(request)
  } catch (err) {
    return handleWorkspaceError(err)
  }

  const { id } = await params
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('launch_kits')
    .select('id, campaign_id, status')
    .eq('campaign_id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    if (isMissingLaunchKitsTableError(error.message)) {
      return NextResponse.json({ kit: null }, { status: 200 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ kit: data })
}
