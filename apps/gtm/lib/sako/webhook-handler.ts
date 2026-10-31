/**
 * Sako Webhook Handler - Fixed Implementation
 * 
 * Handles incoming webhooks from external Sako V1 for task status updates,
 * deliverable uploads, and assignment notifications.
 * 
 * Fixes applied:
 * - Status mapping (uppercase external -> lowercase internal)
 * - Correct column names matching database schema
 * - Proper error handling
 * - Observability logging
 */

import { createServiceClient } from '@/lib/supabase/service'
import { SlackProvider } from '@/lib/providers/slack'
import * as crypto from 'crypto'

// ============================================================================
// Types
// ============================================================================

/**
 * External status from Sako V1 (uppercase)
 */
export type ExternalTaskStatus = 
  | 'QUEUED'
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CANCELED'

/**
 * Internal status (lowercase, matches database constraint)
 */
export type InternalTaskStatus = 
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'cancelled'

export interface SakoWebhookPayload {
  event: 'task.status_changed' | 'task.assigned' | 'task.deliverable_added' | 'task.comment_added'
  taskId: string
  externalId: string // The local task ID (UUID)
  timestamp: string
  data: {
    status?: ExternalTaskStatus
    previousStatus?: ExternalTaskStatus
    assignedTo?: {
      id: string
      name: string
      email: string
    }
    deliverable?: {
      id: string
      name: string
      type: string
      url: string
      thumbnailUrl?: string
    }
    comment?: {
      id: string
      authorName: string
      text: string
      createdAt: string
    }
  }
}

export interface WebhookVerificationResult {
  valid: boolean
  error?: string
}

// ============================================================================
// Status Mapping
// ============================================================================

/**
 * Map external uppercase status to internal lowercase status
 */
function mapExternalStatus(externalStatus: ExternalTaskStatus | string): InternalTaskStatus {
  const mapping: Record<string, InternalTaskStatus> = {
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
  }
  
  const mapped = mapping[externalStatus?.toUpperCase()]
  if (!mapped) {
    console.warn(`[Webhook] Unknown external status: ${externalStatus}, defaulting to 'pending'`)
    return 'pending'
  }
  return mapped
}

/**
 * Map internal status to campaign status
 */
function mapToCampaignStatus(internalStatus: InternalTaskStatus): string | null {
  const mapping: Record<InternalTaskStatus, string | null> = {
    'pending': null, // Don't change campaign status
    'assigned': 'in_review',
    'in_progress': 'in_review',
    'review': 'in_review',
    'completed': 'completed',
    'cancelled': 'cancelled',
  }
  return mapping[internalStatus]
}

// ============================================================================
// Webhook Handler Class
// ============================================================================

class SakoWebhookHandler {
  private _supabase: ReturnType<typeof createServiceClient> | null = null
  private slackProvider = new SlackProvider()
  
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createServiceClient()
    }
    return this._supabase
  }

  /**
   * Verify webhook signature
   */
  verifySignature(
    payload: string,
    signature: string,
    timestamp: string
  ): WebhookVerificationResult {
    const secret = process.env.SAKO_WEBHOOK_SECRET

    if (!secret) {
      console.warn('[Webhook] SAKO_WEBHOOK_SECRET not configured')
      // In dev, allow unverified webhooks
      if (process.env.NODE_ENV === 'development') {
        return { valid: true }
      }
      return { valid: false, error: 'Webhook secret not configured' }
    }

    // Check timestamp to prevent replay attacks (5 minute window)
    const webhookTime = parseInt(timestamp, 10)
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - webhookTime) > 300) {
      return { valid: false, error: 'Webhook timestamp expired' }
    }

    // Calculate expected signature
    const signaturePayload = `${timestamp}.${payload}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex')

    // Compare signatures (timing-safe)
    const providedSig = signature.replace('sha256=', '')
    try {
      if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSig))) {
        return { valid: false, error: 'Invalid signature' }
      }
    } catch {
      return { valid: false, error: 'Signature comparison failed' }
    }

    return { valid: true }
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(payload: SakoWebhookPayload): Promise<void> {
    console.log(JSON.stringify({
      event: 'sako.webhook.received',
      type: payload.event,
      taskId: payload.taskId,
      externalId: payload.externalId,
      timestamp: payload.timestamp,
    }))

    switch (payload.event) {
      case 'task.status_changed':
        await this.handleStatusChange(payload)
        break
      case 'task.assigned':
        await this.handleAssignment(payload)
        break
      case 'task.deliverable_added':
        await this.handleDeliverable(payload)
        break
      case 'task.comment_added':
        await this.handleComment(payload)
        break
      default:
        console.warn(`[Webhook] Unknown event type: ${payload.event}`)
    }
  }

  /**
   * Handle task status change
   */
  private async handleStatusChange(payload: SakoWebhookPayload): Promise<void> {
    const { externalId, data } = payload

    if (!data.status) {
      console.warn('[Webhook] Status change event missing status')
      return
    }

    // Map external status to internal
    const internalStatus = mapExternalStatus(data.status)
    const previousInternalStatus = data.previousStatus ? mapExternalStatus(data.previousStatus) : undefined

    // Get current task data
    const { data: task, error: fetchError } = await this.supabase
      .from('sako_tasks')
      .select('id, workspace_id, campaign_id, status, metadata')
      .eq('id', externalId)
      .single()

    if (fetchError || !task) {
      console.error('[Webhook] Task not found:', externalId, fetchError)
      return
    }

    // Update task with new status
    const updatedMetadata = {
      ...task.metadata,
      lastStatusChange: {
        from: previousInternalStatus || task.status,
        to: internalStatus,
        at: payload.timestamp,
        source: 'webhook',
      },
    }

    const { error: updateError } = await this.supabase
      .from('sako_tasks')
      .update({
        status: internalStatus,
        updated_at: new Date().toISOString(),
        metadata: updatedMetadata,
      })
      .eq('id', externalId)

    if (updateError) {
      console.error('[Webhook] Failed to update task status:', updateError)
      return
    }

    // Record feedback event
    await this.recordFeedbackEvent({
      workspaceId: task.workspace_id,
      campaignId: task.campaign_id,
      taskId: externalId,
      eventType: `task_${internalStatus}` as any,
      metadata: {
        previousStatus: previousInternalStatus,
        webhookTaskId: payload.taskId,
      },
    })

    // Update campaign status if needed
    const campaignStatus = mapToCampaignStatus(internalStatus)
    if (campaignStatus) {
      await this.supabase
        .from('campaigns')
        .update({ status: campaignStatus })
        .eq('id', task.campaign_id)
    }

    // Send notification
    await this.sendNotification(task.workspace_id, {
      type: 'status_change',
      campaignId: task.campaign_id,
      status: internalStatus,
      previousStatus: previousInternalStatus,
    })

    console.log(JSON.stringify({
      event: 'sako.webhook.status_updated',
      taskId: externalId,
      from: previousInternalStatus,
      to: internalStatus,
    }))
  }

  /**
   * Handle task assignment
   */
  private async handleAssignment(payload: SakoWebhookPayload): Promise<void> {
    const { externalId, data } = payload

    if (!data.assignedTo) {
      console.warn('[Webhook] Assignment event missing assignee')
      return
    }

    // Update task with assignee info
    const { data: task, error } = await this.supabase
      .from('sako_tasks')
      .update({
        status: 'assigned',
        assigned_to: data.assignedTo.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', externalId)
      .select('workspace_id, campaign_id, metadata')
      .single()

    if (error || !task) {
      console.error('[Webhook] Failed to update assignment:', error)
      return
    }

    // Record feedback event
    await this.recordFeedbackEvent({
      workspaceId: task.workspace_id,
      campaignId: task.campaign_id,
      taskId: externalId,
      eventType: 'task_assigned',
      metadata: {
        assignedTo: data.assignedTo,
      },
    })

    // Send notification
    await this.sendNotification(task.workspace_id, {
      type: 'assignment',
      campaignId: task.campaign_id,
      assignedTo: data.assignedTo.name,
    })
  }

  /**
   * Handle deliverable upload
   */
  private async handleDeliverable(payload: SakoWebhookPayload): Promise<void> {
    const { externalId, data } = payload

    if (!data.deliverable) {
      console.warn('[Webhook] Deliverable event missing deliverable')
      return
    }

    // Get current task
    const { data: task, error: fetchError } = await this.supabase
      .from('sako_tasks')
      .select('id, workspace_id, campaign_id, deliverables')
      .eq('id', externalId)
      .single()

    if (fetchError || !task) {
      console.error('[Webhook] Task not found for deliverable:', externalId)
      return
    }

    // Append deliverable
    const existingDeliverables = task.deliverables || []
    const newDeliverable = {
      id: data.deliverable.id,
      name: data.deliverable.name,
      type: data.deliverable.type,
      url: data.deliverable.url,
      thumbnailUrl: data.deliverable.thumbnailUrl,
      addedAt: payload.timestamp,
    }
    const newDeliverables = [...existingDeliverables, newDeliverable]

    // Update task
    const { error: updateError } = await this.supabase
      .from('sako_tasks')
      .update({
        deliverables: newDeliverables,
        updated_at: new Date().toISOString(),
      })
      .eq('id', externalId)

    if (updateError) {
      console.error('[Webhook] Failed to update deliverables:', updateError)
      return
    }

    // Also add to campaign assets if it's a design file
    if (['html', 'image', 'figma', 'pdf', 'video'].includes(data.deliverable.type)) {
      await this.supabase.from('campaign_assets').insert({
        campaign_id: task.campaign_id,
        workspace_id: task.workspace_id,
        asset_type: data.deliverable.type,
        asset_name: data.deliverable.name,
        asset_url: data.deliverable.url,
        thumbnail_url: data.deliverable.thumbnailUrl,
        source: 'sako',
        metadata: {
          sakoTaskId: payload.taskId,
          sakoDeliverableId: data.deliverable.id,
        },
      })
    }

    // Record feedback event
    await this.recordFeedbackEvent({
      workspaceId: task.workspace_id,
      campaignId: task.campaign_id,
      taskId: externalId,
      eventType: 'deliverable_uploaded',
      metadata: {
        deliverable: newDeliverable,
      },
    })

    // Send notification
    await this.sendNotification(task.workspace_id, {
      type: 'deliverable',
      campaignId: task.campaign_id,
      deliverableName: data.deliverable.name,
      deliverableUrl: data.deliverable.url,
    })
  }

  /**
   * Handle comment added
   */
  private async handleComment(payload: SakoWebhookPayload): Promise<void> {
    const { externalId, data } = payload

    if (!data.comment) {
      console.warn('[Webhook] Comment event missing comment')
      return
    }

    // Get current task
    const { data: task, error: fetchError } = await this.supabase
      .from('sako_tasks')
      .select('id, workspace_id, campaign_id, metadata')
      .eq('id', externalId)
      .single()

    if (fetchError || !task) {
      console.error('[Webhook] Task not found for comment:', externalId)
      return
    }

    // Get existing comments from metadata
    const existingComments = (task.metadata?.comments as any[]) || []
    const newComment = {
      id: data.comment.id,
      author: data.comment.authorName,
      text: data.comment.text,
      createdAt: data.comment.createdAt,
      source: 'webhook',
    }

    // Update metadata with new comment
    const { error: updateError } = await this.supabase
      .from('sako_tasks')
      .update({
        metadata: {
          ...task.metadata,
          comments: [...existingComments, newComment],
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', externalId)

    if (updateError) {
      console.error('[Webhook] Failed to add comment:', updateError)
    }
  }

  /**
   * Record feedback event for learning loop
   */
  private async recordFeedbackEvent(params: {
    workspaceId: string
    campaignId: string
    taskId: string
    eventType: string
    metadata?: Record<string, unknown>
  }): Promise<void> {
    try {
      await this.supabase.rpc('record_composer_feedback', {
        p_workspace_id: params.workspaceId,
        p_campaign_id: params.campaignId,
        p_sako_task_id: params.taskId,
        p_event_type: params.eventType,
        p_metadata: params.metadata || {},
      })
    } catch (error) {
      // Non-critical - don't fail the webhook
      console.warn('[Webhook] Failed to record feedback:', error)
    }
  }

  /**
   * Send Slack notification (best-effort)
   */
  private async sendNotification(
    workspaceId: string,
    notification: {
      type: 'status_change' | 'assignment' | 'deliverable'
      campaignId: string
      status?: string
      previousStatus?: string
      assignedTo?: string
      deliverableName?: string
      deliverableUrl?: string
    }
  ): Promise<void> {
    try {
      const isConnected = await this.slackProvider.isConnected(workspaceId)
      if (!isConnected) return

      // Get campaign name
      const { data: campaign } = await this.supabase
        .from('campaigns')
        .select('name')
        .eq('id', notification.campaignId)
        .single()

      const campaignName = campaign?.name || 'Unknown Campaign'

      // Get default channel
      const { data: connection } = await this.supabase
        .from('provider_connections')
        .select('metadata')
        .eq('workspace_id', workspaceId)
        .eq('provider', 'slack')
        .maybeSingle()

      const channel = connection?.metadata?.defaultChannel
      if (!channel) return

      await this.slackProvider.notifySakoTaskUpdate(workspaceId, channel, {
        campaignName,
        status: notification.status || '',
        assignedTo: notification.assignedTo,
        deliverables: notification.deliverableUrl
          ? [notification.deliverableName || 'New deliverable']
          : undefined,
      })
    } catch (error) {
      // Non-critical - don't fail the webhook
      console.warn('[Webhook] Failed to send notification:', error)
    }
  }
}

// Singleton instance
export const sakoWebhookHandler = new SakoWebhookHandler()

// ============================================================================
// Reference Implementation for Sako V1 (to be added to external service)
// ============================================================================

export const SAKO_V1_WEBHOOK_SENDER_REFERENCE = `
// Add this to sako-v1/services/api/src/task/task.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSenderService {
  private readonly logger = new Logger(WebhookSenderService.name);

  constructor(private configService: ConfigService) {}

  async sendWebhook(
    webhookUrl: string,
    event: string,
    data: Record<string, any>
  ): Promise<void> {
    const payload = JSON.stringify({
      event,
      taskId: data.taskId,
      externalId: data.externalId,
      timestamp: new Date().toISOString(),
      data,
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const secret = this.configService.get('WEBHOOK_SECRET');
    
    // Create signature
    const signaturePayload = \`\${timestamp}.\${payload}\`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sako-Signature': \`sha256=\${signature}\`,
          'X-Sako-Timestamp': timestamp,
        },
        body: payload,
      });

      if (!response.ok) {
        this.logger.warn(\`Webhook failed: \${response.status}\`);
      }
    } catch (error) {
      this.logger.error('Webhook send failed:', error);
    }
  }
}
`;
