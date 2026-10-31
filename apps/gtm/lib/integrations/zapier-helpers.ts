/**
 * Zapier Integration Helpers (Phase 4.2)
 * 
 * Webhook triggers and actions for Zapier integration.
 */

import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

export interface ZapierWebhook {
  id: string
  workspace_id: string
  name: string
  url: string
  secret: string
  event_types: string[]
  is_active: boolean
  created_at: string
  last_triggered_at?: string
  trigger_count: number
}

export interface ZapierEvent {
  event: string
  timestamp: string
  workspace_id: string
  data: Record<string, unknown>
}

// Available Zapier trigger events
export const ZAPIER_EVENTS = {
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_UPDATED: 'campaign.updated',
  CAMPAIGN_PUBLISHED: 'campaign.published',
  CAMPAIGN_APPROVED: 'campaign.approved',
  CAMPAIGN_REJECTED: 'campaign.rejected',
  ASSET_GENERATED: 'asset.generated',
  CLAIM_VALIDATED: 'claim.validated',
  CLAIM_FLAGGED: 'claim.flagged',
  IDEA_CREATED: 'idea.created',
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_COMPLETED: 'approval.completed',
} as const

export type ZapierEventType = typeof ZAPIER_EVENTS[keyof typeof ZAPIER_EVENTS]

/**
 * Register a new Zapier webhook
 */
export async function registerZapierWebhook(
  workspaceId: string,
  params: {
    name: string
    url: string
    eventTypes: ZapierEventType[]
  }
): Promise<ZapierWebhook | null> {
  const supabase = createServiceClient()

  // Generate secret for signature verification
  const secret = crypto.randomBytes(32).toString('hex')

  const { data, error } = await supabase
    .from('zapier_webhooks')
    .insert({
      workspace_id: workspaceId,
      name: params.name,
      url: params.url,
      secret,
      event_types: params.eventTypes,
      is_active: true,
      trigger_count: 0,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to register Zapier webhook:', error)
    return null
  }

  return data as ZapierWebhook
}

/**
 * Unregister a Zapier webhook
 */
export async function unregisterZapierWebhook(webhookId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('zapier_webhooks')
    .delete()
    .eq('id', webhookId)

  return !error
}

/**
 * Get webhooks for a workspace
 */
export async function getWorkspaceWebhooks(workspaceId: string): Promise<ZapierWebhook[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('zapier_webhooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to get webhooks:', error)
    return []
  }

  return data as ZapierWebhook[]
}

/**
 * Fire an event to all subscribed webhooks
 */
export async function fireZapierEvent(
  workspaceId: string,
  eventType: ZapierEventType,
  data: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  const supabase = createServiceClient()

  // Get active webhooks subscribed to this event
  const { data: webhooks } = await supabase
    .from('zapier_webhooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .contains('event_types', [eventType])

  if (!webhooks || webhooks.length === 0) {
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0

  const event: ZapierEvent = {
    event: eventType,
    timestamp: new Date().toISOString(),
    workspace_id: workspaceId,
    data,
  }

  for (const webhook of webhooks) {
    try {
      // Generate signature
      const signature = generateWebhookSignature(event, webhook.secret)

      // Send webhook
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sako-Signature': signature,
          'X-Sako-Event': eventType,
        },
        body: JSON.stringify(event),
      })

      if (response.ok) {
        sent++
        // Update trigger count
        await supabase
          .from('zapier_webhooks')
          .update({
            last_triggered_at: new Date().toISOString(),
            trigger_count: webhook.trigger_count + 1,
          })
          .eq('id', webhook.id)
      } else {
        failed++
        console.error(`Webhook ${webhook.id} failed: ${response.status}`)
      }
    } catch (error) {
      failed++
      console.error(`Webhook ${webhook.id} error:`, error)
    }
  }

  // Log the event
  await supabase.from('zapier_event_log').insert({
    workspace_id: workspaceId,
    event_type: eventType,
    payload: data,
    webhooks_triggered: sent,
    webhooks_failed: failed,
    created_at: new Date().toISOString(),
  })

  return { sent, failed }
}

/**
 * Generate HMAC signature for webhook verification
 */
function generateWebhookSignature(payload: unknown, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: unknown,
  signature: string,
  secret: string
): boolean {
  const expected = generateWebhookSignature(payload, secret)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

/**
 * Handle incoming Zapier action
 */
export async function handleZapierAction(
  workspaceId: string,
  action: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const supabase = createServiceClient()

  try {
    switch (action) {
      case 'create_campaign': {
        const { data: campaign, error } = await supabase
          .from('campaigns')
          .insert({
            workspace_id: workspaceId,
            name: data.name as string,
            audience: data.audience as string,
            goal: data.goal as string,
            status: 'draft',
          })
          .select()
          .single()

        if (error) throw error
        return { success: true, result: campaign }
      }

      case 'validate_claim': {
        // Would call the claim validation service
        return { success: true, result: { validated: true } }
      }

      case 'generate_content': {
        // Would trigger content generation
        return { success: true, result: { queued: true } }
      }

      case 'update_campaign_status': {
        const { error } = await supabase
          .from('campaigns')
          .update({ status: data.status as string })
          .eq('id', data.campaign_id as string)
          .eq('workspace_id', workspaceId)

        if (error) throw error
        return { success: true }
      }

      default:
        return { success: false, error: `Unknown action: ${action}` }
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Get available triggers for Zapier app
 */
export function getAvailableTriggers(): Array<{
  key: string
  name: string
  description: string
  sample: Record<string, unknown>
}> {
  return [
    {
      key: ZAPIER_EVENTS.CAMPAIGN_CREATED,
      name: 'Campaign Created',
      description: 'Triggers when a new campaign is created',
      sample: {
        id: 'campaign_123',
        name: 'Spring Sale Campaign',
        audience: 'SMB tech buyers',
        goal: 'Generate leads',
        status: 'draft',
        created_at: '2024-01-15T10:30:00Z',
      },
    },
    {
      key: ZAPIER_EVENTS.CAMPAIGN_PUBLISHED,
      name: 'Campaign Published',
      description: 'Triggers when a campaign is published',
      sample: {
        id: 'campaign_123',
        name: 'Spring Sale Campaign',
        published_at: '2024-01-15T14:00:00Z',
        published_to: ['webflow'],
      },
    },
    {
      key: ZAPIER_EVENTS.CLAIM_FLAGGED,
      name: 'Claim Flagged',
      description: 'Triggers when a marketing claim is flagged for review',
      sample: {
        id: 'claim_456',
        text: '#1 rated in the industry',
        risk_level: 'high',
        reason: 'Unsubstantiated superlative claim',
      },
    },
    {
      key: ZAPIER_EVENTS.APPROVAL_REQUESTED,
      name: 'Approval Requested',
      description: 'Triggers when content is submitted for approval',
      sample: {
        id: 'approval_789',
        campaign_id: 'campaign_123',
        stage: 'Legal Review',
        submitted_by: 'user@example.com',
      },
    },
  ]
}

/**
 * Get available actions for Zapier app
 */
export function getAvailableActions(): Array<{
  key: string
  name: string
  description: string
  inputFields: Array<{ key: string; label: string; type: string; required: boolean }>
}> {
  return [
    {
      key: 'create_campaign',
      name: 'Create Campaign',
      description: 'Create a new marketing campaign',
      inputFields: [
        { key: 'name', label: 'Campaign Name', type: 'string', required: true },
        { key: 'audience', label: 'Target Audience', type: 'string', required: true },
        { key: 'goal', label: 'Campaign Goal', type: 'string', required: true },
      ],
    },
    {
      key: 'validate_claim',
      name: 'Validate Marketing Claim',
      description: 'Check a marketing claim for compliance',
      inputFields: [
        { key: 'claim_text', label: 'Claim Text', type: 'text', required: true },
        { key: 'industry', label: 'Industry', type: 'string', required: false },
      ],
    },
    {
      key: 'generate_content',
      name: 'Generate Content',
      description: 'Generate marketing content with AI',
      inputFields: [
        { key: 'content_type', label: 'Content Type', type: 'string', required: true },
        { key: 'topic', label: 'Topic', type: 'string', required: true },
        { key: 'tone', label: 'Tone', type: 'string', required: false },
      ],
    },
  ]
}
