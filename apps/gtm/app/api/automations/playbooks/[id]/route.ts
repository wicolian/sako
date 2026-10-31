import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspaceId } from '@/lib/workspace'
import { createServiceClient } from '@/lib/supabase/service'

const UpdateSchema = z.object({
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  name: z.string().min(1).max(120).optional(),
  schedule: z.string().min(5).max(120).optional(),
  timezone: z.string().min(2).max(120).optional(),
  config: z.record(z.unknown()).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = getWorkspaceId(request)
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  try {
    const body = await request.json()
    const input = UpdateSchema.parse(body)

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (input.status) updateData.status = input.status
    if (input.name) updateData.name = input.name
    if (input.schedule) updateData.schedule = input.schedule
    if (input.timezone) updateData.timezone = input.timezone
    if (input.config) updateData.config = input.config

    if (input.status === 'active') {
      updateData.next_run_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('automation_rules')
      .update(updateData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
    }

    return NextResponse.json({ rule: data })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid payload', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update automation' }, { status: 500 })
  }
}
