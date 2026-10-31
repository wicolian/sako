/**
 * Sako Task Status API Route
 * 
 * GET /api/sako/status?taskId=xxx&refresh=true
 * 
 * Returns task status with optional refresh from external Sako V1 API.
 * Properly validates workspace membership for multi-tenant isolation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceContext } from '@/lib/workspace'
import { getTaskStatus } from '@/lib/sako/client'

interface StatusResponse {
  task?: {
    id: string
    status: string
    priority: string
    title: string
    assignedTo?: string
    estimatedDelivery?: string
    deliverables?: unknown[]
    createdAt: string
    updatedAt: string
  }
  error?: string
}

export async function GET(request: NextRequest): Promise<NextResponse<StatusResponse>> {
  const supabase = createServiceClient()

  try {
    // Get workspace context for authorization
    const { workspaceId } = await getWorkspaceContext(request)

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const refresh = searchParams.get('refresh') === 'true'

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId is required' },
        { status: 400 }
      )
    }

    // First, verify this task belongs to the user's workspace
    const { data: taskCheck, error: checkError } = await supabase
      .from('sako_tasks')
      .select('workspace_id')
      .eq('id', taskId)
      .single()

    if (checkError || !taskCheck) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Multi-tenant isolation check
    if (taskCheck.workspace_id !== workspaceId) {
      console.warn(`[Auth] Workspace mismatch: user ${workspaceId} tried to access task from ${taskCheck.workspace_id}`)
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 } // Return 404 (not 403) to avoid leaking existence
      )
    }

    // Get task status (with optional external refresh)
    const task = await getTaskStatus(taskId, refresh)

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Log access for observability
    console.log(JSON.stringify({
      event: 'sako.status.get',
      taskId,
      workspaceId,
      refresh,
      timestamp: new Date().toISOString(),
    }))

    return NextResponse.json({
      task: {
        id: task.id,
        status: task.status,
        priority: task.priority,
        title: task.title,
        assignedTo: task.assignedTo,
        estimatedDelivery: task.estimatedDelivery?.toISOString(),
        deliverables: task.deliverables,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Sako status error:', error)
    
    if (error instanceof Error && error.name === 'WorkspaceError') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to get task status' },
      { status: 500 }
    )
  }
}
