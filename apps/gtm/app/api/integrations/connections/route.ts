import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceId, handleWorkspaceError } from '@/lib/workspace'
import { getConnectedProviders } from '@/lib/providers/registry'

export async function GET(request: NextRequest): Promise<NextResponse | Response> {
  try {
    const workspaceId = getWorkspaceId(request)
    const connectedProviders = await getConnectedProviders(workspaceId)

    return NextResponse.json({ connectedIds: connectedProviders })
  } catch (error) {
    return handleWorkspaceError(error)
  }
}
