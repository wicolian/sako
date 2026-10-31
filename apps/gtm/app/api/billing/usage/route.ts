import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId, handleWorkspaceError } from '@/lib/workspace'
import { getUsageSummary } from '@/lib/billing/usage'

export async function GET(request: NextRequest) {
  try {
    const workspaceId = getWorkspaceId(request)
    const usage = await getUsageSummary(workspaceId)
    return NextResponse.json(usage)
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
