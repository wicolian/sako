import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceContext } from '@/lib/workspace'

const CSP_HEADER = [
  "default-src 'none'",
  'sandbox',
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src data: https:",
  "font-src data:",
  "connect-src 'none'",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "navigate-to 'none'",
].join('; ')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const supabase = createServiceClient()

  try {
    const { workspaceId } = getWorkspaceContext(request)
    const { id: taskId } = await params

    const { data: task, error: taskError } = await supabase
      .from('sako_tasks')
      .select('id, workspace_id, snapshot_id')
      .eq('id', taskId)
      .single()

    if (taskError || !task || task.workspace_id !== workspaceId) {
      return new Response('Task not found', { status: 404 })
    }

    const { data: taskSnapshot } = await supabase
      .from('task_composer_snapshots')
      .select('html_content')
      .eq('task_id', taskId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    let html = taskSnapshot?.html_content as string | null | undefined

    if (!html && task.snapshot_id) {
      const { data: composerSnapshot } = await supabase
        .from('composer_snapshots')
        .select('html_content')
        .eq('id', task.snapshot_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle()

      html = composerSnapshot?.html_content as string | null | undefined
    }

    if (!html) {
      return new Response('Snapshot not found', { status: 404 })
    }

    const wrappedHtml = html.includes('<!doctype') || html.includes('<!DOCTYPE')
      ? html
      : `<!doctype html><html><head><meta charset="UTF-8" /></head><body>${html}</body></html>`

    return new Response(wrappedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': CSP_HEADER,
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cache-Control': 'private, max-age=600',
      },
    })
  } catch (error) {
    console.error('Failed to render task composer snapshot:', error)

    if (error instanceof Error && error.name === 'WorkspaceError') {
      return new Response('Unauthorized', { status: 401 })
    }

    return new Response('Failed to render snapshot', { status: 500 })
  }
}
