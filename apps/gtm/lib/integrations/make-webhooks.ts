/**
 * Make.com (Integromat) Webhook Integration
 * 
 * Enables visual automation workflows with Sako:
 * - Campaign created/updated triggers
 * - Claim validation webhooks
 * - Asset generation actions
 */

import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

// ============================================================================
// Types
// ============================================================================

export interface MakeWebhook {
  id: string
  workspace_id: string
  webhook_url: string
  event_type: MakeEventType
  secret_key: string
  is_active: boolean
  last_triggered_at?: string
  created_at: string
  updated_at: string
}

export type MakeEventType =
  | 'campaign.created'
  | 'campaign.updated'
  | 'campaign.published'
  | 'claim.flagged'
  | 'claim.approved'
  | 'asset.generated'
  | 'approval.requested'
  | 'approval.completed'

export interface MakeWebhookPayload {
  event: MakeEventType
  timestamp: string
  workspace_id: string
  data: Record<string, unknown>
  signature: string
}

// ============================================================================
// Make.com Webhook Manager
// ============================================================================

export class MakeWebhookManager {
  /**
   * Register a new Make.com webhook
   */
  static async registerWebhook(
    workspaceId: string,
    webhookUrl: string,
    eventType: MakeEventType
  ): Promise<MakeWebhook> {
    const supabase = createServiceClient()
    
    // Generate a secret key for signature verification
    const secretKey = crypto.randomBytes(32).toString('hex')
    
    const { data, error } = await supabase
      .from('make_webhooks')
      .insert({
        workspace_id: workspaceId,
        webhook_url: webhookUrl,
        event_type: eventType,
        secret_key: secretKey,
        is_active: true,
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`Failed to register webhook: ${error.message}`)
    }
    
    return data
  }
  
  /**
   * Get all webhooks for a workspace
   */
  static async getWebhooks(workspaceId: string): Promise<MakeWebhook[]> {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('make_webhooks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
    
    if (error) {
      throw new Error(`Failed to get webhooks: ${error.message}`)
    }
    
    return data || []
  }
  
  /**
   * Delete a webhook
   */
  static async deleteWebhook(webhookId: string): Promise<void> {
    const supabase = createServiceClient()
    
    const { error } = await supabase
      .from('make_webhooks')
      .delete()
      .eq('id', webhookId)
    
    if (error) {
      throw new Error(`Failed to delete webhook: ${error.message}`)
    }
  }
  
  /**
   * Fire a webhook event
   */
  static async fireEvent(
    workspaceId: string,
    eventType: MakeEventType,
    data: Record<string, unknown>
  ): Promise<{ success: number; failed: number }> {
    const supabase = createServiceClient()
    
    // Get all active webhooks for this event type
    const { data: webhooks } = await supabase
      .from('make_webhooks')
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
        const timestamp = new Date().toISOString()
        const signature = this.generateSignature(
          webhook.secret_key,
          timestamp,
          data
        )
        
        const payload: MakeWebhookPayload = {
          event: eventType,
          timestamp,
          workspace_id: workspaceId,
          data,
          signature,
        }
        
        const response = await fetch(webhook.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sako-Signature': signature,
            'X-Sako-Timestamp': timestamp,
          },
          body: JSON.stringify(payload),
        })
        
        if (response.ok) {
          success++
          
          // Update last triggered timestamp
          await supabase
            .from('make_webhooks')
            .update({ last_triggered_at: timestamp })
            .eq('id', webhook.id)
        } else {
          failed++
          console.error(`Make webhook failed: ${response.status} ${response.statusText}`)
        }
      } catch (error) {
        failed++
        console.error('Make webhook error:', error)
      }
    }
    
    return { success, failed }
  }
  
  /**
   * Generate HMAC signature for webhook payload
   */
  static generateSignature(
    secretKey: string,
    timestamp: string,
    data: Record<string, unknown>
  ): string {
    const payload = `${timestamp}.${JSON.stringify(data)}`
    return crypto
      .createHmac('sha256', secretKey)
      .update(payload)
      .digest('hex')
  }
  
  /**
   * Verify incoming webhook signature
   */
  static verifySignature(
    signature: string,
    timestamp: string,
    data: Record<string, unknown>,
    secretKey: string
  ): boolean {
    const expectedSignature = this.generateSignature(secretKey, timestamp, data)
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    } catch {
      return false
    }
  }
}

// ============================================================================
// Event Trigger Functions
// ============================================================================

/**
 * Trigger campaign created event
 */
export async function triggerCampaignCreated(
  workspaceId: string,
  campaign: Record<string, unknown>
): Promise<void> {
  await MakeWebhookManager.fireEvent(workspaceId, 'campaign.created', {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    campaign_status: campaign.status,
    created_at: campaign.created_at,
  })
}

/**
 * Trigger campaign updated event
 */
export async function triggerCampaignUpdated(
  workspaceId: string,
  campaign: Record<string, unknown>,
  changes: string[]
): Promise<void> {
  await MakeWebhookManager.fireEvent(workspaceId, 'campaign.updated', {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    changes,
    updated_at: new Date().toISOString(),
  })
}

/**
 * Trigger campaign published event
 */
export async function triggerCampaignPublished(
  workspaceId: string,
  campaign: Record<string, unknown>,
  publishedUrls: string[]
): Promise<void> {
  await MakeWebhookManager.fireEvent(workspaceId, 'campaign.published', {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    published_urls: publishedUrls,
    published_at: new Date().toISOString(),
  })
}

/**
 * Trigger claim flagged event
 */
export async function triggerClaimFlagged(
  workspaceId: string,
  claim: Record<string, unknown>,
  issues: string[]
): Promise<void> {
  await MakeWebhookManager.fireEvent(workspaceId, 'claim.flagged', {
    claim_id: claim.id,
    claim_text: claim.claim_text,
    status: claim.status,
    issues,
    flagged_at: new Date().toISOString(),
  })
}

/**
 * Trigger claim approved event
 */
export async function triggerClaimApproved(
  workspaceId: string,
  claim: Record<string, unknown>,
  approvedBy: string
): Promise<void> {
  await MakeWebhookManager.fireEvent(workspaceId, 'claim.approved', {
    claim_id: claim.id,
    claim_text: claim.claim_text,
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
  })
}

/**
 * Trigger asset generated event
 */
export async function triggerAssetGenerated(
  workspaceId: string,
  asset: Record<string, unknown>
): Promise<void> {
  await MakeWebhookManager.fireEvent(workspaceId, 'asset.generated', {
    asset_id: asset.id,
    asset_type: asset.type,
    asset_name: asset.name,
    campaign_id: asset.campaign_id,
    generated_at: new Date().toISOString(),
  })
}

// ============================================================================
// Available Triggers and Actions
// ============================================================================

export const MAKE_TRIGGERS = [
  {
    id: 'campaign.created',
    name: 'Campaign Created',
    description: 'Triggers when a new campaign is created',
    sampleData: {
      campaign_id: 'uuid',
      campaign_name: 'Product Launch',
      campaign_status: 'draft',
      created_at: '2026-01-15T10:00:00Z',
    },
  },
  {
    id: 'campaign.updated',
    name: 'Campaign Updated',
    description: 'Triggers when a campaign is modified',
    sampleData: {
      campaign_id: 'uuid',
      campaign_name: 'Product Launch',
      changes: ['name', 'audience'],
      updated_at: '2026-01-15T11:00:00Z',
    },
  },
  {
    id: 'campaign.published',
    name: 'Campaign Published',
    description: 'Triggers when a campaign is published',
    sampleData: {
      campaign_id: 'uuid',
      campaign_name: 'Product Launch',
      published_urls: ['https://example.com/landing'],
      published_at: '2026-01-15T12:00:00Z',
    },
  },
  {
    id: 'claim.flagged',
    name: 'Claim Flagged',
    description: 'Triggers when a marketing claim fails validation',
    sampleData: {
      claim_id: 'uuid',
      claim_text: 'Best in class performance',
      status: 'flagged',
      issues: ['Superlative without evidence'],
      flagged_at: '2026-01-15T10:30:00Z',
    },
  },
  {
    id: 'claim.approved',
    name: 'Claim Approved',
    description: 'Triggers when a claim is approved',
    sampleData: {
      claim_id: 'uuid',
      claim_text: 'Trusted by 1000+ companies',
      approved_by: 'user@example.com',
      approved_at: '2026-01-15T11:30:00Z',
    },
  },
  {
    id: 'asset.generated',
    name: 'Asset Generated',
    description: 'Triggers when a new asset is generated by AI',
    sampleData: {
      asset_id: 'uuid',
      asset_type: 'landing_page',
      asset_name: 'Homepage V2',
      campaign_id: 'uuid',
      generated_at: '2026-01-15T10:15:00Z',
    },
  },
]
