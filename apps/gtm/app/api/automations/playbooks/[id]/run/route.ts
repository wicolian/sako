import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserId, getWorkspaceId } from '@/lib/workspace'
import { createServiceClient } from '@/lib/supabase/service'

const RunSchema = z.object({
  runKey: z.string().min(4).max(120).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = getWorkspaceId(request)
  const userId = getUserId(request) ?? undefined
  if (!workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: rule, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !rule) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = RunSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid run request', details: parsed.error.flatten() }, { status: 400 })
  }

  const runKey = parsed.data.runKey ?? `manual:${id}:${new Date().toISOString().slice(0, 16)}`

  // Idempotent run record: if same run key was already queued, return it.
  let existingRun: Record<string, unknown> | null = null
  try {
    const { data } = await supabase
      .from('automation_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('automation_rule_id', id)
      .eq('run_key', runKey)
      .single()
    existingRun = (data as Record<string, unknown> | null) ?? null
  } catch {
    existingRun = null
  }

  if (existingRun) {
    return NextResponse.json({
      queued: true,
      ruleId: id,
      run: existingRun,
      idempotent: true,
    })
  }

  let runRecord: Record<string, unknown> | null = null
  try {
    const { data } = await supabase
      .from('automation_runs')
      .insert({
        workspace_id: workspaceId,
        automation_rule_id: id,
        run_key: runKey,
        triggered_by: userId,
        trigger_type: 'manual',
        status: 'queued',
        metadata: { source: 'playbook_run_api' },
      })
      .select('*')
      .single()
    runRecord = (data as Record<string, unknown> | null) ?? null
  } catch {
    // automation_runs migration may not be applied in all envs yet.
    runRecord = null
  }

  // Queue immediate execution by setting next_run_at now.
  const { error: updateError } = await supabase
    .from('automation_rules')
    .update({
      status: 'active',
      next_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to queue run' }, { status: 500 })
  }

  return NextResponse.json({
    queued: true,
    ruleId: id,
    run: runRecord,
    idempotent: false,
  })
}
