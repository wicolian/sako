/**
 * Kit Deployments API
 * 
 * List deployments for a kit.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'

/**
 * GET /api/kit/[id]/deployments
 * List deployments for a kit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: kitId } = await params
  const workspaceId = getWorkspaceIdWithFallback(request)
  const supabase = createServiceClient()
  
  const { data: deployments, error } = await supabase
    .from('kit_deployments')
    .select('*')
    .eq('kit_id', kitId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Failed to fetch deployments:', error)
    return NextResponse.json({ deployments: [] })
  }
  
  return NextResponse.json({
    deployments: deployments.map(d => ({
      id: d.id,
      provider: d.provider,
      url: d.url,
      createdAt: d.created_at,
    })),
  })
}
