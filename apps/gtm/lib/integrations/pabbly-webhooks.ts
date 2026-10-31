/**
 * Pabbly Connect Webhook Integration
 * 
 * Enables workflow automation between Sako and business tools:
 * - Same event triggers as Make.com
 * - Pabbly-specific payload formatting
 */

import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

// ============================================================================
// Types
// ============================================================================

export interface PabblyWebhook {
  id: string
  workspace_id: string
  webhook_url: string
  event_type: PabblyEventType
  secret_key: string
  is_active: boolean
  metadata?: Record<string, unknown>
  last_triggered_at?: string
  created_at: string
  updated_at: string
}

export type PabblyEventType =
  | 'campaign.created'
  | 'campaign.updated'
  | 'campaign.published'
  | 'claim.validated'
  | 'content.generated'
  | 'approval.required'

export interface PabblyWebhookPayload {
  trigger: PabblyEventType
  timestamp: number
  workspace: {
    id: string
    name?: string
  }
  payload: Record<string, unknown>
}

// ============================================================================
// Pabbly Webhook Manager
// ============================================================================

export class PabblyWebhookManager {
  /**
   * Register a new Pabbly webhook
   */
  static async registerWebhook(
    workspaceId: string,
    webhookUrl: string,
    eventType: PabblyEventType,
    metadata?: Record<string, unknown>
  ): Promise<PabblyWebhook> {
    const supabase = createServiceClient()
    
    const secretKey = crypto.randomBytes(32).toString('hex')
    
    const { data, error } = await supabase
      .from('pabbly_webhooks')
      .insert({
        workspace_id: workspaceId,
        webhook_url: webhookUrl,
        event_type: eventType,
        secret_key: secretKey,
        is_active: true,
        metadata,
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to register Pabbly webhook: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Get all Pabbly webhooks for a workspace
   */
  static async getWebhooks(workspaceId: string): Promise<PabblyWebhook[]> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('pabbly_webhooks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
    
    if (error) {
      throw new Error(`Failed to get Pabbly webhooks: ${error.message}`)
    }
    
    return data || []
  }
  
  /**
   * Update webhook
   */
  static async updateWebhook(
    webhookId: string,
    updates: Partial<Pick<PabblyWebhook, 'webhook_url' | 'is_active' | 'metadata'>>
  ): Promise<PabblyWebhook> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('pabbly_webhooks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', webhookId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to update Pabbly webhook: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Delete webhook
   */
  static async deleteWebhook(webhookId: string): Promise<void> {
    const supabase = createServiceClient()
    
    const { error } = await supabase
      .from('pabbly_webhooks')
      .delete()
      .eq('id', webhookId)
    
    if (error) {
      throw new Error(`Failed to delete Pabbly webhook: ${error.message}`)
    }
  }
  
  /**
   * Fire a webhook event to Pabbly
   */
  static async fireEvent(
    workspaceId: string,
    eventType: PabblyEventType,
    payload: Record<string, unknown>
  ): Promise<{ success: number; failed: number }> {
    const supabase = createServiceClient()
    
    // Get workspace name for payload
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()
    
    // Get all active webhooks for this event type
    const { data: webhooks } = await supabase
      .from('pabbly_webhooks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('event_type', eventType)
      .eq('is_active', true)
    
    if (!webhooks || webhooks.length === 0) {
      return { success: 0, failed: 0 }
    }
    
    let success = 0
    let failed = 0
    
    for (const webhook of webhooks) {
      try {
        const timestamp = Date.now()
        
        const webhookPayload: PabblyWebhookPayload = {
          trigger: eventType,
          timestamp,
          workspace: {
            id: workspaceId,
            name: workspace?.name,
          },
          payload,
        }
        
        // Create signature
        const signature = crypto
          .createHmac('sha256', webhook.secret_key)
          .update(JSON.stringify(webhookPayload))
          .digest('hex')
        
        const response = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sako-Signature': signature,
            'X-Sako-Event': eventType,
          },
          body: JSON.stringify(webhookPayload),
        })
        
        if (response.ok) {
          success++
          
          await supabase
            .from('pabbly_webhooks')
            .update({ last_triggered_at: new Date().toISOString() })
            .eq('id', webhook.id)
        } else {
          failed++
          console.error(`Pabbly webhook failed: ${response.status}`)
        }
      } catch (error) {
        failed++
        console.error('Pabbly webhook error:', error)
      }
    }
    
    return { success, failed }
  }
}

// ============================================================================
// Event Triggers
// ============================================================================

export async function triggerPabblyCampaignCreated(
  workspaceId: string,
  campaign: {
    id: string
    name: string
    goal?: string
    audience?: string
  }
): Promise<void> {
  await PabblyWebhookManager.fireEvent(workspaceId, 'campaign.created', {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    campaign_goal: campaign.goal,
    target_audience: campaign.audience,
  })
}

export async function triggerPabblyCampaignUpdated(
  workspaceId: string,
  campaign: {
    id: string
    name: string
  },
  updatedFields: string[]
): Promise<void> {
  await PabblyWebhookManager.fireEvent(workspaceId, 'campaign.updated', {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    updated_fields: updatedFields,
  })
}

export async function triggerPabblyCampaignPublished(
  workspaceId: string,
  campaign: {
    id: string
    name: string
  },
  publishedTo: string[],
  urls: string[]
): Promise<void> {
  await PabblyWebhookManager.fireEvent(workspaceId, 'campaign.published', {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    published_to: publishedTo,
    urls,
  })
}

export async function triggerPabblyClaimValidated(
  workspaceId: string,
  claim: {
    id: string
    text: string
    status: string
    score: number
  }
): Promise<void> {
  await PabblyWebhookManager.fireEvent(workspaceId, 'claim.validated', {
    claim_id: claim.id,
    claim_text: claim.text,
    validation_status: claim.status,
    confidence_score: claim.score,
  })
}

export async function triggerPabblyContentGenerated(
  workspaceId: string,
  content: {
    id: string
    type: string
    name: string
    campaign_id?: string
  }
): Promise<void> {
  await PabblyWebhookManager.fireEvent(workspaceId, 'content.generated', {
    content_id: content.id,
    content_type: content.type,
    content_name: content.name,
    campaign_id: content.campaign_id,
  })
}

export async function triggerPabblyApprovalRequired(
  workspaceId: string,
  approval: {
    id: string
    type: string
    item_name: string
    requester: string
  }
): Promise<void> {
  await PabblyWebhookManager.fireEvent(workspaceId, 'approval.required', {
    approval_id: approval.id,
    approval_type: approval.type,
    item_name: approval.item_name,
    requested_by: approval.requester,
  })
}

// ============================================================================
// Available Triggers Documentation
// ============================================================================

export const PABBLY_TRIGGERS = [
  {
    id: 'campaign.created',
    name: 'New Campaign Created',
    description: 'Fires when a new marketing campaign is created in Sako',
    fields: ['campaign_id', 'campaign_name', 'campaign_goal', 'target_audience'],
  },
  {
    id: 'campaign.updated',
    name: 'Campaign Updated',
    description: 'Fires when an existing campaign is modified',
    fields: ['campaign_id', 'campaign_name', 'updated_fields'],
  },
  {
    id: 'campaign.published',
    name: 'Campaign Published',
    description: 'Fires when a campaign is published to channels',
    fields: ['campaign_id', 'campaign_name', 'published_to', 'urls'],
  },
  {
    id: 'claim.validated',
    name: 'Claim Validated',
    description: 'Fires when a marketing claim goes through ClaimsOS validation',
    fields: ['claim_id', 'claim_text', 'validation_status', 'confidence_score'],
  },
  {
    id: 'content.generated',
    name: 'Content Generated',
    description: 'Fires when AI generates new content',
    fields: ['content_id', 'content_type', 'content_name', 'campaign_id'],
  },
  {
    id: 'approval.required',
    name: 'Approval Required',
    description: 'Fires when content requires human approval',
    fields: ['approval_id', 'approval_type', 'item_name', 'requested_by'],
  },
]
