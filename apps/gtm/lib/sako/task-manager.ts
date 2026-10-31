/**
 * Sako Task Manager - Fixed Implementation
 * 
 * Core service for managing Sako design escalation tasks.
 * 
 * Fixes applied:
 * - Proper error handling with detailed messages
 * - External API sync is best-effort (non-blocking)
 * - Feedback events recorded for learning loop
 * - Status mapping consistency
 * - Observability logging
 */

import { createServiceClient } from '@/lib/supabase/service';
import { usageMetering } from '@/lib/enterprise/usage-metering';

function getSupabase() {
  return createServiceClient();
}

// ============================================================================
// Types
// ============================================================================

export type TaskType = 'design_refinement' | 'full_redesign' | 'copywriting' | 'brand_refresh';
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'review' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SakoTask {
  id: string;
  composerCampaignId: string;
  workspaceId: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  brief: string;
  html?: string;
  attachments?: string[];
  assignedTo?: string;
  estimatedDelivery?: Date;
  deliverables?: Array<{ id?: string; name?: string; type: string; url: string; thumbnailUrl?: string }>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskRequest {
  campaignId: string;
  workspaceId: string;
  type: TaskType;
  title: string;
  reason: string;
  brief: string;
  currentHtml?: string;
  brandId?: string;
  priority?: TaskPriority;
  idempotencyKey?: string;
  createdBy?: string;
}

export interface TransitionTaskStatusRequest {
  taskId: string;
  status: TaskStatus;
  actorId: string;
  assignedTo?: string;
  deliverables?: Array<{ type: string; url: string }>;
  notes?: string;
  revisionRequested?: boolean;
  outcome?: 'accepted' | 'rejected';
}

export interface TaskWebhookPayload {
  taskId: string;
  externalId: string;
  status?: TaskStatus;
  event?: string;
  timestamp?: string;
  data?: {
    status?: string;
    previousStatus?: string;
    deliverable?: { id?: string; name?: string; type?: string; url?: string; thumbnailUrl?: string };
  };
  assignedTo?: { name: string; avatar?: string };
  estimatedDelivery?: string;
  deliverables?: Array<{ type: string; url: string }>;
  message?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const SAKO_V1_API_URL = process.env.SAKO_V1_API_URL;
const SAKO_V1_API_KEY = process.env.SAKO_V1_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ============================================================================
// Observability
// ============================================================================

function logTaskEvent(
  event: string,
  context: { taskId?: string; campaignId?: string; workspaceId?: string; [key: string]: unknown }
) {
  console.log(JSON.stringify({
    event: `sako.task.${event}`,
    timestamp: new Date().toISOString(),
    ...context,
  }));
}

// ============================================================================
// API Client (Best-effort external sync)
// ============================================================================

async function sakoFetch(path: string, options: RequestInit = {}): Promise<Response | null> {
  if (!SAKO_V1_API_KEY || !SAKO_V1_API_URL) {
    return null; // External sync disabled
  }

  try {
    return fetch(`${SAKO_V1_API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SAKO_V1_API_KEY}`,
        'X-Source': 'sako-composer',
        ...options.headers,
      },
    });
  } catch (error) {
    console.warn('Sako V1 API call failed:', error);
    return null;
  }
}

// ============================================================================
// Task Creation
// ============================================================================

/**
 * Create a task in Sako for human designers
 * 
 * Features:
 * - Stores task locally (primary source of truth)
 * - Best-effort sync to external Sako V1 API
 * - Records feedback event for learning loop
 * - Returns consistent task object
 */
export async function createSakoTask(request: CreateTaskRequest): Promise<SakoTask> {
  const startTime = Date.now();
  
  logTaskEvent('create_start', {
    campaignId: request.campaignId,
    workspaceId: request.workspaceId,
    type: request.type,
    priority: request.priority,
  });

  try {
    if (request.idempotencyKey) {
      const { data: existingTask } = await getSupabase()
        .from('sako_tasks')
        .select('*')
        .eq('workspace_id', request.workspaceId)
        .eq('campaign_id', request.campaignId)
        .eq('idempotency_key', request.idempotencyKey)
        .maybeSingle()

      if (existingTask) {
        return {
          id: existingTask.id,
          composerCampaignId: request.campaignId,
          workspaceId: request.workspaceId,
          type: request.type,
          status: (existingTask.status || 'pending') as TaskStatus,
          priority: (existingTask.priority || request.priority || 'normal') as TaskPriority,
          title: existingTask.title || request.title,
          brief: existingTask.brief || request.brief,
          html: existingTask.current_html || request.currentHtml,
          metadata: existingTask.metadata as Record<string, unknown> | undefined,
          createdAt: new Date(existingTask.created_at || Date.now()),
          updatedAt: new Date(existingTask.updated_at || Date.now()),
        }
      }
    }

    // 1. Store task locally first (primary source of truth)
    const { data: localTask, error: localError } = await getSupabase()
      .from('sako_tasks')
      .insert({
        campaign_id: request.campaignId,
        workspace_id: request.workspaceId,
        type: request.type,
        title: request.title,
        status: 'pending',
        priority: request.priority || 'normal',
        brief: request.brief,
        reason: request.reason,
        current_html: request.currentHtml,
        brand_id: request.brandId,
        idempotency_key: request.idempotencyKey,
        metadata: {
          createdVia: 'composer',
          externalSync: !!SAKO_V1_API_KEY,
          createdBy: request.createdBy,
        },
      })
      .select()
      .single();

    if (localError) {
      logTaskEvent('create_error', {
        campaignId: request.campaignId,
        error: localError.message,
      });
      throw new Error(`Failed to create local task: ${localError.message}`);
    }

    if (!localTask) {
      throw new Error('Failed to create local task: empty insert response')
    }

    logTaskEvent('create_success', {
      taskId: localTask.id,
      campaignId: request.campaignId,
      workspaceId: request.workspaceId,
      duration_ms: Date.now() - startTime,
    });

    // 2. Best-effort sync to external Sako V1 API (non-blocking)
    // This is optional - the task is already created locally
    syncToExternalApi(localTask.id, request).catch(error => {
      console.warn('External API sync failed (non-critical):', error);
    });

    // 3. Record feedback event
    await recordFeedbackEvent({
      workspaceId: request.workspaceId,
      campaignId: request.campaignId,
      taskId: localTask.id,
      eventType: 'task_created',
      metadata: {
        type: request.type,
        priority: request.priority,
        hasHtml: !!request.currentHtml,
      },
    });

    if (request.createdBy) {
      await usageMetering.trackUsage(request.workspaceId, request.createdBy, 'sako_task', {
        eventSubtype: request.type,
        units: 1,
        metadata: {
          taskId: localTask.id,
          priority: request.priority || 'normal',
        },
      });
    }

    // 4. Send notification (best-effort)
    notifyTaskCreated(localTask).catch(console.error);

    return {
      id: localTask.id,
      composerCampaignId: request.campaignId,
      workspaceId: request.workspaceId,
      type: request.type,
      status: 'pending',
      priority: request.priority || 'normal',
      title: request.title,
      brief: request.brief,
      html: request.currentHtml,
      metadata: localTask.metadata,
      createdAt: new Date(localTask.created_at),
      updatedAt: new Date(localTask.updated_at),
    };
  } catch (error) {
    logTaskEvent('create_error', {
      campaignId: request.campaignId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Best-effort sync to external Sako V1 API
 * Non-blocking - failures don't affect local task
 */
async function syncToExternalApi(localTaskId: string, request: CreateTaskRequest): Promise<void> {
  const response = await sakoFetch('/composer/tasks/escalate', {
    method: 'POST',
    body: JSON.stringify({
      title: request.title,
      html: request.currentHtml || '',
      externalId: localTaskId,
      type: request.type,
      brief: request.brief,
      reason: request.reason,
      priority: request.priority || 'normal',
      workspaceId: request.workspaceId,
      campaignId: request.campaignId,
      brandId: request.brandId,
      webhookUrl: `${APP_URL}/api/sako/webhook`,
    }),
  });

  if (response?.ok) {
    const sakoResponse = await response.json();
    
    // Update local task with external ID
    await getSupabase()
      .from('sako_tasks')
      .update({
        sako_v1_id: sakoResponse.id,
        estimated_delivery: sakoResponse.estimatedDelivery,
        metadata: {
          ...request,
          sakoV1Id: sakoResponse.id,
          syncedAt: new Date().toISOString(),
        },
      })
      .eq('id', localTaskId);

    logTaskEvent('external_sync_success', {
      taskId: localTaskId,
      externalId: sakoResponse.id,
    });
  } else {
    const errorText = response ? await response.text() : 'No response';
    logTaskEvent('external_sync_failed', {
      taskId: localTaskId,
      error: errorText,
    });
  }
}

// ============================================================================
// Task Status
// ============================================================================

/**
 * Get task status from local DB, optionally refresh from external API
 */
export async function getTaskStatus(taskId: string, refresh = false): Promise<SakoTask | null> {
  const { data: task, error } = await getSupabase()
    .from('sako_tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  if (error || !task) {
    return null;
  }

  // Optionally refresh from external API (best-effort)
  if (refresh && task.sako_v1_id && SAKO_V1_API_KEY) {
    try {
      const response = await sakoFetch(`/composer/tasks/${task.sako_v1_id}`);

      if (response?.ok) {
        const sakoTask = await response.json();
        const newStatus = mapExternalStatus(sakoTask.status);

        // Update local status if changed
        if (newStatus !== task.status) {
          await getSupabase()
            .from('sako_tasks')
            .update({
              status: newStatus,
              assigned_to: sakoTask.assignedTo?.name,
              estimated_delivery: sakoTask.estimatedDelivery,
              deliverables: sakoTask.deliverables,
              updated_at: new Date().toISOString(),
            })
            .eq('id', taskId);

          // Record status change feedback event
          await recordFeedbackEvent({
            workspaceId: task.workspace_id,
            campaignId: task.campaign_id,
            taskId: task.id,
            eventType: `task_${newStatus}` as any,
            metadata: {
              previousStatus: task.status,
              source: 'external_sync',
            },
          });

          task.status = newStatus;
          task.assigned_to = sakoTask.assignedTo?.name;
        }
      }
    } catch (error) {
      console.warn('External refresh failed:', error);
      // Use local data if API fails
    }
  }

  return {
    id: task.id,
    composerCampaignId: task.campaign_id,
    workspaceId: task.workspace_id,
    type: task.type,
    status: task.status,
    priority: task.priority,
    title: task.title,
    brief: task.brief,
    html: task.current_html,
    assignedTo: task.assigned_to,
    estimatedDelivery: task.estimated_delivery ? new Date(task.estimated_delivery) : undefined,
    deliverables: task.deliverables,
    metadata: task.metadata,
    createdAt: new Date(task.created_at),
    updatedAt: new Date(task.updated_at),
  };
}

/**
 * Map external API status to internal status
 */
function mapExternalStatus(externalStatus: string): TaskStatus {
  const mapping: Record<string, TaskStatus> = {
    'QUEUED': 'pending',
    'PENDING': 'pending',
    'ASSIGNED': 'assigned',
    'IN_PROGRESS': 'in_progress',
    'IN_REVIEW': 'review',
    'REVIEW': 'review',
    'CHANGES_REQUESTED': 'review',
    'APPROVED': 'completed',
    'COMPLETED': 'completed',
    'CANCELLED': 'cancelled',
    'CANCELED': 'cancelled',
  };
  
  const mapped = mapping[externalStatus?.toUpperCase()];
  if (!mapped) {
    console.warn(`Unknown external status: ${externalStatus}, defaulting to 'pending'`);
    return 'pending';
  }
  return mapped;
}

/**
 * Get all tasks for a campaign
 */
export async function getTasksForCampaign(campaignId: string): Promise<SakoTask[]> {
  const { data: tasks, error } = await getSupabase()
    .from('sako_tasks')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error || !tasks) {
    return [];
  }

  return tasks.map((task) => ({
    id: task.id,
    composerCampaignId: task.campaign_id,
    workspaceId: task.workspace_id,
    type: task.type,
    status: task.status,
    priority: task.priority,
    title: task.title,
    brief: task.brief,
    html: task.current_html,
    assignedTo: task.assigned_to,
    estimatedDelivery: task.estimated_delivery ? new Date(task.estimated_delivery) : undefined,
    deliverables: task.deliverables,
    metadata: task.metadata,
    createdAt: new Date(task.created_at),
    updatedAt: new Date(task.updated_at),
  }));
}

/**
 * Get all tasks for a workspace
 */
export async function getTasksForWorkspace(workspaceId: string): Promise<SakoTask[]> {
  const { data: tasks, error } = await getSupabase()
    .from('sako_tasks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !tasks) {
    return [];
  }

  return tasks.map((task) => ({
    id: task.id,
    composerCampaignId: task.campaign_id,
    workspaceId: task.workspace_id,
    type: task.type,
    status: task.status,
    priority: task.priority,
    title: task.title,
    brief: task.brief,
    assignedTo: task.assigned_to,
    estimatedDelivery: task.estimated_delivery ? new Date(task.estimated_delivery) : undefined,
    deliverables: task.deliverables,
    metadata: task.metadata,
    createdAt: new Date(task.created_at),
    updatedAt: new Date(task.updated_at),
  }));
}

// ============================================================================
// Task Actions
// ============================================================================

function mapStatusToFeedbackEvent(status: TaskStatus, revisionRequested = false): string {
  if (revisionRequested) return 'task_revision_requested'

  const events: Record<TaskStatus, string> = {
    pending: 'task_created',
    assigned: 'task_assigned',
    in_progress: 'task_in_progress',
    review: 'task_in_review',
    completed: 'task_completed',
    cancelled: 'task_cancelled',
  }

  return events[status]
}

export async function transitionTaskStatus(
  request: TransitionTaskStatusRequest
): Promise<SakoTask | null> {
  const { data: task, error: fetchError } = await getSupabase()
    .from('sako_tasks')
    .select('*')
    .eq('id', request.taskId)
    .single()

  if (fetchError || !task) {
    return null
  }

  const previousStatus = task.status as TaskStatus
  const now = new Date().toISOString()

  const { error: updateError } = await getSupabase()
    .from('sako_tasks')
    .update({
      status: request.status,
      assigned_to: request.assignedTo ?? task.assigned_to,
      deliverables: request.deliverables ?? task.deliverables,
      feedback: request.notes || task.feedback,
      updated_at: now,
      metadata: {
        ...(task.metadata || {}),
        lastStatusChange: {
          from: previousStatus,
          to: request.status,
          actorId: request.actorId,
          at: now,
        },
      },
    })
    .eq('id', request.taskId)

  if (updateError) {
    throw new Error(`Failed to transition task: ${updateError.message}`)
  }

  const cycleTimeSeconds =
    request.status === 'completed'
      ? Math.max(
          0,
          Math.floor((Date.now() - new Date(task.created_at).getTime()) / 1000)
        )
      : undefined

  await recordFeedbackEvent({
    workspaceId: task.workspace_id,
    campaignId: task.campaign_id,
    taskId: request.taskId,
    eventType: mapStatusToFeedbackEvent(request.status, request.revisionRequested),
    metadata: {
      previousStatus,
      notes: request.notes,
      cycleTimeSeconds,
      revisionRequested: request.revisionRequested,
      actorId: request.actorId,
    },
  })

  if (request.outcome && (request.status === 'completed' || request.outcome === 'rejected')) {
    await recordFeedbackEvent({
      workspaceId: task.workspace_id,
      campaignId: task.campaign_id,
      taskId: request.taskId,
      eventType: request.outcome === 'accepted' ? 'task_accepted' : 'task_rejected',
      metadata: {
        cycleTimeSeconds,
        notes: request.notes,
        actorId: request.actorId,
      },
    })
  }

  return getTaskStatus(request.taskId)
}

/**
 * Cancel a pending task
 */
export async function cancelTask(taskId: string): Promise<boolean> {
  const result = await getSupabase()
    .from('sako_tasks')
    .select('sako_v1_id, status, workspace_id, campaign_id')
    .eq('id', taskId)
    .single();
  const task = result?.data

  if (!task || task.status === 'completed') {
    return false;
  }

  // Cancel in external API if synced (best-effort)
  if (task.sako_v1_id && SAKO_V1_API_KEY) {
    try {
      await sakoFetch(`/composer/tasks/${task.sako_v1_id}/cancel`, {
        method: 'POST',
      });
    } catch {
      // Continue even if API fails
    }
  }

  // Update local status
  await getSupabase()
    .from('sako_tasks')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  await recordFeedbackEvent({
    workspaceId: task.workspace_id,
    campaignId: task.campaign_id,
    taskId,
    eventType: 'task_cancelled',
    metadata: {
      actorId: 'system',
      notes: 'Cancelled via API',
    },
  })

  logTaskEvent('cancelled', {
    taskId,
    workspaceId: task.workspace_id,
  });

  return true;
}

// ============================================================================
// Webhook Handler
// ============================================================================

/**
 * Handle webhook from external system when task status changes
 */
export async function handleSakoWebhook(payload: TaskWebhookPayload): Promise<boolean> {
  const resolvedStatus = payload.status || (typeof payload.data?.status === 'string' ? payload.data.status : undefined)
  const resolvedDeliverables =
    payload.deliverables ||
    (payload.data?.deliverable?.type && payload.data?.deliverable?.url
      ? [
          {
            id: payload.data.deliverable.id,
            name: payload.data.deliverable.name,
            type: payload.data.deliverable.type,
            url: payload.data.deliverable.url,
            thumbnailUrl: payload.data.deliverable.thumbnailUrl,
          },
        ]
      : undefined)

  if (!resolvedStatus && !resolvedDeliverables?.length) {
    console.error('Webhook payload missing status')
    return false
  }

  logTaskEvent('webhook_received', {
    taskId: payload.taskId,
    externalId: payload.externalId,
    status: resolvedStatus || 'unknown',
  });

  // Update local task
  const { data: existingTask, error: fetchError } = await getSupabase()
    .from('sako_tasks')
    .select('id, workspace_id, campaign_id, status, campaign: campaigns!inner(workspace_id)')
    .eq('id', payload.externalId)
    .single();

  if (fetchError || !existingTask) {
    console.error('Failed to find task for webhook:', fetchError);
    return false;
  }

  // Map status from external format when available, otherwise keep current
  const newStatus = resolvedStatus ? mapExternalStatus(resolvedStatus) : existingTask.status;

  const { error } = await getSupabase()
    .from('sako_tasks')
    .update({
      status: newStatus,
      assigned_to: payload.assignedTo?.name,
      estimated_delivery: payload.estimatedDelivery,
      deliverables: resolvedDeliverables,
      updated_at: new Date().toISOString(),
      metadata: {
        lastWebhookAt: new Date().toISOString(),
        lastStatusChange: {
          from: existingTask.status,
          to: newStatus,
        },
      },
    })
    .eq('id', payload.externalId);

  if (error) {
    console.error('Failed to update task from webhook:', error);
    return false;
  }

  // Record feedback event
  await recordFeedbackEvent({
    workspaceId: existingTask.workspace_id,
    campaignId: existingTask.campaign_id,
    taskId: payload.externalId,
    eventType: `task_${newStatus}` as any,
    metadata: {
      previousStatus: existingTask.status,
      source: 'webhook',
    },
  });

  // Notify user of status change
  await notifyTaskUpdated(payload.externalId, newStatus, payload.message);

  // If completed, store deliverables as campaign assets
  if (newStatus === 'completed' && resolvedDeliverables?.length) {
    for (const deliverable of resolvedDeliverables) {
      await getSupabase().from('campaign_assets').insert({
        campaign_id: existingTask.campaign_id,
        workspace_id: existingTask.workspace_id,
        asset_type: deliverable.type,
        asset_name: deliverable.type,
        asset_url: deliverable.url,
        source: 'sako',
        metadata: {
          sakoTaskId: payload.taskId,
        },
      });
    }
  }

  logTaskEvent('webhook_processed', {
    taskId: payload.externalId,
    status: newStatus,
  });

  return true;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Record feedback event for learning loop
 */
async function recordFeedbackEvent(params: {
  workspaceId: string;
  campaignId: string;
  taskId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await getSupabase().rpc('record_composer_feedback', {
      p_workspace_id: params.workspaceId,
      p_campaign_id: params.campaignId,
      p_sako_task_id: params.taskId,
      p_event_type: params.eventType,
      p_metadata: params.metadata || {},
    });
  } catch (error) {
    // Non-critical - don't fail the main operation
    console.warn('Failed to record feedback event:', error);
  }
}

/**
 * Check if Sako V1 API is available
 */
export async function checkSakoConnection(): Promise<boolean> {
  if (!SAKO_V1_API_URL) {
    return false;
  }
  
  try {
    const response = await fetch(`${SAKO_V1_API_URL}/health`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get estimated delivery based on priority
 */
export function getEstimatedDelivery(priority: TaskPriority): Date {
  const now = new Date();
  const deliveryDays = {
    low: 5,
    normal: 2,
    high: 1,
    urgent: 0.5,
  };

  const days = deliveryDays[priority];
  now.setDate(now.getDate() + days);
  return now;
}

// ============================================================================
// Notifications (TODO: integrate with notification system)
// ============================================================================

async function notifyTaskCreated(task: { id: string; type: string; priority: string; title: string }) {
  console.log(`[Sako] Task created: ${task.id} - "${task.title}" (${task.type}, ${task.priority})`);
  // TODO: Send email, Slack notification, or in-app notification
}

async function notifyTaskUpdated(taskId: string, status: string, message?: string) {
  console.log(`[Sako] Task ${taskId} updated to: ${status}`, message || '');
  // TODO: Send notification to user
}
