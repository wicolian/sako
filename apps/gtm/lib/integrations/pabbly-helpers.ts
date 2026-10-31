/**
 * Pabbly Connect Integration Helpers
 * 
 * Webhook-based automation helpers for Pabbly Connect.
 */

import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

export interface PabblyWebhookPayload {
  event: string
  timestamp: string
  workspace_id: string
  data: Record<string, unknown>
}

export interface PabblyConnection {
  id: string
  workspace_id: string
  webhook_url: string
  events: string[]
  secret_key: string
  is_active: boolean
  created_at: string
  last_triggered_at: string | null
}

// Reuse the same events as Make.com for consistency
export const PABBLY_EVENTS = {
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

export type PabblyEvent = typeof PABBLY_EVENTS[keyof typeof PABBLY_EVENTS]

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
 * Register a Pabbly Connect webhook for a workspace
 */
export async function registerPabblyWebhook(
  workspaceId: string,
  webhookUrl: string,
  events: PabblyEvent[]
): Promise<PabblyConnection> {
  const supabase = createServiceClient()
  const secretKey = generateWebhookSecret()

  const { data, error } = await supabase
    .from('automation_webhooks')
    .upsert({
      workspace_id: workspaceId,
      provider: 'pabbly',
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

  return data as unknown as PabblyConnection
}

/**
 * Get Pabbly Connect webhook configuration for a workspace
 */
export async function getPabblyWebhook(
  workspaceId: string
): Promise<PabblyConnection | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('automation_webhooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'pabbly')
    .eq('is_active', true)
    .single()

  if (error || !data) return null

  return data as unknown as PabblyConnection
}

/**
 * Send webhook to Pabbly Connect
 */
export async function triggerPabblyWebhook(
  workspaceId: string,
  event: PabblyEvent,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const webhook = await getPabblyWebhook(workspaceId)

  if (!webhook) {
    return { success: false, error: 'No Pabbly Connect webhook configured' }
  }

  if (!webhook.events.includes(event)) {
    return { success: false, error: 'Event not subscribed' }
  }

  const payload: PabblyWebhookPayload = {
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
 * Deactivate Pabbly Connect webhook
 */
export async function deactivatePabblyWebhook(workspaceId: string): Promise<void> {
  const supabase = createServiceClient()

  await supabase
    .from('automation_webhooks')
    .update({ is_active: false })
    .eq('workspace_id', workspaceId)
    .eq('provider', 'pabbly')
}

/**
 * Test webhook connection
 */
export async function testPabblyWebhook(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const testPayload = {
      event: 'test.connection',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook from Sako',
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sako-Event': 'test.connection',
      },
      body: JSON.stringify(testPayload),
    })

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}

/**
 * Format event data for Pabbly workflows
 * Ensures data is in a flat structure that Pabbly can easily work with
 */
export function formatEventData(
  event: PabblyEvent,
  rawData: Record<string, unknown>
): Record<string, unknown> {
  const flattenObject = (
    obj: Record<string, unknown>,
    prefix = ''
  ): Record<string, unknown> => {
    const flattened: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, flattenObject(value as Record<string, unknown>, newKey))
      } else {
        flattened[newKey] = value
      }
    }

    return flattened
  }

  return {
    event_type: event,
    event_category: event.split('.')[0],
    event_action: event.split('.')[1],
    ...flattenObject(rawData),
  }
}
