/**
 * Make.com Integration Helpers
 * 
 * Webhook-based automation helpers for Make.com (formerly Integromat).
 */

import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

export interface MakeWebhookPayload {
  event: string
  timestamp: string
  workspace_id: string
  data: Record<string, unknown>
}

export interface MakeConnection {
  id: string
  workspace_id: string
  webhook_url: string
  events: string[]
  secret_key: string
  is_active: boolean
  created_at: string
  last_triggered_at: string | null
}

// Events that can trigger Make.com webhooks
export const MAKE_EVENTS = {
  // Campaign events
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_UPDATED: 'campaign.updated',
  CAMPAIGN_PUBLISHED: 'campaign.published',
  CAMPAIGN_ARCHIVED: 'campaign.archived',
  
  // Content events
  CONTENT_GENERATED: 'content.generated',
  CONTENT_APPROVED: 'content.approved',
  CONTENT_REJECTED: 'content.rejected',
  
  // Claim events
  CLAIM_VALIDATED: 'claim.validated',
  CLAIM_FLAGGED: 'claim.flagged',
  
  // Health events
  HEALTH_ALERT: 'health.alert',
  HEALTH_RECOVERED: 'health.recovered',
  
  // Asset events
  ASSET_CREATED: 'asset.created',
  ASSET_UPDATED: 'asset.updated',
} as const

export type MakeEvent = typeof MAKE_EVENTS[keyof typeof MAKE_EVENTS]

/**
 * Generate webhook secret for signature verification
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Sign webhook payload
 */
export function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

/**
 * Verify webhook signature (for incoming webhooks from Make)
 */
export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = signPayload(payload, secret)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

/**
 * Register a Make.com webhook for a workspace
 */
export async function registerMakeWebhook(
  workspaceId: string,
  webhookUrl: string,
  events: MakeEvent[]
): Promise<MakeConnection> {
  const supabase = createServiceClient()
  const secretKey = generateWebhookSecret()

  const { data, error } = await supabase
    .from('automation_webhooks')
    .upsert({
      workspace_id: workspaceId,
      provider: 'make',
      webhook_url: webhookUrl,
      events,
      secret_key: secretKey,
      is_active: true,
    }, {
      onConflict: 'workspace_id,provider',
    })
    .select()
    .single()

  if (error) throw error

  return data as unknown as MakeConnection
}

/**
 * Get Make.com webhook configuration for a workspace
 */
export async function getMakeWebhook(
  workspaceId: string
): Promise<MakeConnection | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('automation_webhooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'make')
    .eq('is_active', true)
    .single()

  if (error || !data) return null

  return data as unknown as MakeConnection
}

/**
 * Send webhook to Make.com
 */
export async function triggerMakeWebhook(
  workspaceId: string,
  event: MakeEvent,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const webhook = await getMakeWebhook(workspaceId)

  if (!webhook) {
    return { success: false, error: 'No Make.com webhook configured' }
  }

  if (!webhook.events.includes(event)) {
    return { success: false, error: 'Event not subscribed' }
  }

  const payload: MakeWebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    workspace_id: workspaceId,
    data,
  }

  const payloadString = JSON.stringify(payload)
  const signature = signPayload(payloadString, webhook.secret_key)

  try {
    const response = await fetch(webhook.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sako-Signature': signature,
        'X-Sako-Event': event,
        'X-Sako-Timestamp': payload.timestamp,
      },
      body: payloadString,
    })

    // Update last triggered timestamp
    const supabase = createServiceClient()
    await supabase
      .from('automation_webhooks')
      .update({ last_triggered_at: new Date().toISOString() })
      .eq('id', webhook.id)

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Deactivate Make.com webhook
 */
export async function deactivateMakeWebhook(workspaceId: string): Promise<void> {
  const supabase = createServiceClient()

  await supabase
    .from('automation_webhooks')
    .update({ is_active: false })
    .eq('workspace_id', workspaceId)
    .eq('provider', 'make')
}

/**
 * Get webhook history/logs
 */
export async function getMakeWebhookLogs(
  workspaceId: string,
  limit: number = 50
): Promise<Array<{
  id: string
  event: string
  status: string
  created_at: string
}>> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('automation_webhook_logs')
    .select('id, event, status, created_at')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'make')
    .order('created_at', { ascending: false })
    .limit(limit)

  return data || []
}

/**
 * Format event data for Make.com scenarios
 */
export function formatEventData(
  event: MakeEvent,
  rawData: Record<string, unknown>
): Record<string, unknown> {
  // Ensure consistent field names for Make scenarios
  const baseFields = {
    event_type: event,
    event_category: event.split('.')[0],
    event_action: event.split('.')[1],
  }

  return {
    ...baseFields,
    ...rawData,
  }
}
