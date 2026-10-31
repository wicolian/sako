import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { createSakoTask, getTasksForCampaign, getTasksForWorkspace } from '@/lib/sako/task-manager'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/sako/tasks
 * List tasks for a campaign
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceContext(request)
    const supabase = createServiceClient()
    const campaignId = request.nextUrl.searchParams.get('campaignId')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!campaignId) {
      const tasks = await getTasksForWorkspace(workspaceId)
      return NextResponse.json({ tasks })
    }

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const tasks = await getTasksForCampaign(campaignId)

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('Failed to list tasks:', error)
    return NextResponse.json(
      { error: 'Failed to list tasks' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sako/tasks
 * Create a new Sako task (escalation)
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId, userId } = await getWorkspaceContext(request)
    const supabase = createServiceClient()

    if (!workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { campaignId, type, title, reason, brief, currentHtml, brandId, priority } = body

    if (!campaignId || !type || !brief || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: campaignId, type, title, brief' },
        { status: 400 }
      )
    }

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const task = await createSakoTask({
      campaignId,
      workspaceId,
      type,
      title,
      reason: reason || 'Escalation requested',
      brief,
      currentHtml,
      brandId,
      priority,
      createdBy: userId,
    })

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Failed to create task:', error)
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    )
  }
}
