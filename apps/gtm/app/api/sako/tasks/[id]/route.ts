import { NextRequest, NextResponse } from 'next/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { getTaskStatus, cancelTask, transitionTaskStatus } from '@/lib/sako/task-manager'
import { z } from 'zod'

const TaskTransitionSchema = z.object({
  status: z.enum(['pending', 'assigned', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  notes: z.string().max(5000).optional(),
  assignedTo: z.string().max(200).optional(),
  revisionRequested: z.boolean().optional(),
  outcome: z.enum(['accepted', 'rejected']).optional(),
  deliverables: z
    .array(
      z.object({
        type: z.string().min(1),
        url: z.string().url(),
      })
    )
    .optional(),
}).refine((value) => !!value.status || !!value.outcome, {
  message: 'status or outcome is required',
})

/**
 * GET /api/sako/tasks/[id]
 * Get task details and status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceContext(request)

    if (!workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const task = await getTaskStatus(id)

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Verify task belongs to workspace
    if (task.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Failed to get task:', error)
    return NextResponse.json(
      { error: 'Failed to get task' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sako/tasks/[id]
 * Cancel a task
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId } = await getWorkspaceContext(request)

    if (!workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify task belongs to workspace
    const task = await getTaskStatus(id)
    if (!task || task.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const cancelled = await cancelTask(id)

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Cannot cancel this task' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to cancel task:', error)
    return NextResponse.json(
      { error: 'Failed to cancel task' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/sako/tasks/[id]
 * Transition task status (operator-only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { workspaceId, userId, role } = await getWorkspaceContext(request)

    if (!workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = TaskTransitionSchema.parse(await request.json())
    const operatorRoles = new Set(['admin', 'reviewer', 'owner', 'studio'])
    const isOperator = operatorRoles.has(String(role))

    const existingTask = await getTaskStatus(id)
    if (!existingTask || existingTask.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const statusForTransition = body.status
      ?? (body.outcome === 'accepted' ? 'completed' : body.outcome === 'rejected' ? 'review' : undefined)

    if (!statusForTransition) {
      return NextResponse.json({ error: 'Unable to resolve task status transition' }, { status: 400 })
    }

    if (!isOperator) {
      if (!body.outcome) {
        return NextResponse.json(
          { error: 'Only studio operators can transition task status directly' },
          { status: 403 }
        )
      }

      if (body.assignedTo || body.deliverables) {
        return NextResponse.json(
          { error: 'Client review cannot modify assignment or deliverables' },
          { status: 403 }
        )
      }
    }

    const updated = await transitionTaskStatus({
      taskId: id,
      status: statusForTransition,
      actorId: userId,
      notes: body.notes,
      assignedTo: isOperator ? body.assignedTo : undefined,
      deliverables: isOperator ? body.deliverables : undefined,
      revisionRequested: body.revisionRequested ?? body.outcome === 'rejected',
      outcome: body.outcome,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task: updated })
  } catch (error) {
    console.error('Failed to transition task:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || 'Invalid request payload' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to transition task' },
      { status: 500 }
    )
  }
}
