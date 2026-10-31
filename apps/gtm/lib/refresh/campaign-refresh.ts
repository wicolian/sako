/**
 * Campaign Refresh Workflow (Jan 2026)
 * 
 * One-click campaign refresh that:
 * 1. Re-researches evidence
 * 2. Updates stale statistics
 * 3. Re-validates claims
 * 4. Regenerates copy if needed
 * 5. Creates diff preview for approval
 */

import { createServiceClient } from '@/lib/supabase/service';
import { generateObject } from '@/lib/ai/langsmith-ai';
import { MODELS, quickClaimCheck } from '@/lib/ai/ai-sdk-client';
import { z } from 'zod';

// Inline evidence search function (simplified)
async function searchEvidence(query: string, workspaceId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('evidence')
    .select('*')
    .eq('workspace_id', workspaceId)
    .textSearch('content', query)
    .limit(10);
  return data || [];
}

// Use quickClaimCheck as validateClaim
const validateClaim = quickClaimCheck;

export interface RefreshOptions {
  refreshEvidence?: boolean;
  refreshClaims?: boolean;
  refreshCopy?: boolean;
  refreshAssets?: boolean;
  autoApprove?: boolean;
}

export interface RefreshResult {
  id: string;
  campaignId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  changes: RefreshChange[];
  summary: RefreshSummary;
  error?: string;
}

export interface RefreshChange {
  id: string;
  type: 'evidence' | 'claim' | 'copy' | 'asset';
  action: 'added' | 'updated' | 'removed' | 'unchanged';
  entityId: string;
  entityType: string;
  before?: any;
  after?: any;
  reason?: string;
  approved?: boolean;
}

export interface RefreshSummary {
  evidenceUpdated: number;
  evidenceAdded: number;
  evidenceRemoved: number;
  claimsRevalidated: number;
  claimsStatusChanged: number;
  copyUpdated: number;
  assetsRegenerated: number;
  totalChanges: number;
}

/**
 * Start a campaign refresh
 */
export async function startCampaignRefresh(
  campaignId: string,
  workspaceId: string,
  options: RefreshOptions = {}
): Promise<RefreshResult> {
  const supabase = createServiceClient();
  const refreshId = `refresh-${Date.now()}`;
  
  const {
    refreshEvidence = true,
    refreshClaims = true,
    refreshCopy = false,
    refreshAssets = false,
    autoApprove = false,
  } = options;
  
  // Create refresh record
  const result: RefreshResult = {
    id: refreshId,
    campaignId,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    changes: [],
    summary: {
      evidenceUpdated: 0,
      evidenceAdded: 0,
      evidenceRemoved: 0,
      claimsRevalidated: 0,
      claimsStatusChanged: 0,
      copyUpdated: 0,
      assetsRegenerated: 0,
      totalChanges: 0,
    },
  };
  
  try {
    // Save initial refresh record
    await supabase.from('campaign_refreshes').insert({
      id: refreshId,
      campaign_id: campaignId,
      workspace_id: workspaceId,
      status: 'in_progress',
      options,
      started_at: result.startedAt,
    });
    
    // Step 1: Refresh Evidence
    if (refreshEvidence) {
      const evidenceChanges = await refreshCampaignEvidence(campaignId, workspaceId);
      result.changes.push(...evidenceChanges);
      result.summary.evidenceUpdated = evidenceChanges.filter(c => c.action === 'updated').length;
      result.summary.evidenceAdded = evidenceChanges.filter(c => c.action === 'added').length;
      result.summary.evidenceRemoved = evidenceChanges.filter(c => c.action === 'removed').length;
    }
    
    // Step 2: Re-validate Claims
    if (refreshClaims) {
      const claimChanges = await revalidateCampaignClaims(campaignId, workspaceId);
      result.changes.push(...claimChanges);
      result.summary.claimsRevalidated = claimChanges.length;
      result.summary.claimsStatusChanged = claimChanges.filter(c => c.action === 'updated').length;
    }
    
    // Step 3: Refresh Copy (if statistics changed)
    if (refreshCopy) {
      const copyChanges = await refreshCampaignCopy(campaignId, workspaceId);
      result.changes.push(...copyChanges);
      result.summary.copyUpdated = copyChanges.filter(c => c.action === 'updated').length;
    }
    
    // Step 4: Regenerate Assets (if needed)
    if (refreshAssets) {
      const assetChanges = await regenerateCampaignAssets(campaignId, workspaceId);
      result.changes.push(...assetChanges);
      result.summary.assetsRegenerated = assetChanges.filter(c => c.action === 'updated').length;
    }
    
    // Calculate total changes
    result.summary.totalChanges = result.changes.filter(c => c.action !== 'unchanged').length;
    
    // Auto-approve if requested
    if (autoApprove) {
      for (const change of result.changes) {
        change.approved = true;
      }
      await applyRefreshChanges(result, workspaceId);
    }
    
    // Update refresh record
    result.status = 'completed';
    result.completedAt = new Date().toISOString();
    
    await supabase.from('campaign_refreshes').update({
      status: 'completed',
      completed_at: result.completedAt,
      changes: result.changes,
      summary: result.summary,
    }).eq('id', refreshId);
    
    return result;
  } catch (error: any) {
    result.status = 'failed';
    result.error = error.message;
    
    await supabase.from('campaign_refreshes').update({
      status: 'failed',
      error: error.message,
    }).eq('id', refreshId);
    
    throw error;
  }
}

/**
 * Refresh evidence for a campaign
 */
async function refreshCampaignEvidence(
  campaignId: string,
  workspaceId: string
): Promise<RefreshChange[]> {
  const supabase = createServiceClient();
  const changes: RefreshChange[] = [];
  
  // Get all claims with their evidence
  const { data: claims } = await supabase
    .from('messages')
    .select(`
      id,
      text,
      message_evidence (
        evidence_id,
        evidence (
          id,
          title,
          type,
          url,
          created_at,
          data
        )
      )
    `)
    .eq('campaign_id', campaignId);
  
  for (const claim of claims || []) {
    // Search for new/updated evidence
    const searchResults = await searchEvidence(claim.text, workspaceId);
    
    // Compare with existing evidence
    const existingIds = new Set(
      claim.message_evidence?.map((me: any) => me.evidence_id) || []
    );
    
    for (const result of searchResults) {
      if (!existingIds.has(result.id)) {
        // New evidence found
        changes.push({
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: 'evidence',
          action: 'added',
          entityId: result.id,
          entityType: result.type,
          after: result,
          reason: `New ${result.type} evidence found for claim`,
        });
      } else {
        // Check if existing evidence needs update
        const existing = claim.message_evidence?.find(
          (me: any) => me.evidence_id === result.id
        )?.evidence;
        
        if (existing && hasEvidenceChanged(existing, result)) {
          changes.push({
            id: `ev-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'evidence',
            action: 'updated',
            entityId: result.id,
            entityType: result.type,
            before: existing,
            after: result,
            reason: 'Evidence data has been updated',
          });
        }
      }
    }
    
    // Check for stale evidence that should be removed
    for (const me of claim.message_evidence || []) {
      // Handle Supabase's nested relation - could be array or object
      const evidenceData = (me as any).evidence;
      const evidence = Array.isArray(evidenceData) ? evidenceData[0] : evidenceData;
      if (evidence && isEvidenceStale(evidence)) {
        changes.push({
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: 'evidence',
          action: 'removed',
          entityId: evidence.id,
          entityType: evidence.type,
          before: evidence,
          reason: 'Evidence is stale or link is broken',
        });
      }
    }
  }
  
  return changes;
}

/**
 * Re-validate all claims in a campaign
 */
async function revalidateCampaignClaims(
  campaignId: string,
  workspaceId: string
): Promise<RefreshChange[]> {
  const supabase = createServiceClient();
  const changes: RefreshChange[] = [];
  
  // Get all claims
  const { data: claims } = await supabase
    .from('messages')
    .select('*')
    .eq('campaign_id', campaignId);
  
  for (const claim of claims || []) {
    const previousStatus = claim.status;
    
    // Re-validate the claim
    const validation = await validateClaim(claim.text);
    
    if (validation.riskLevel !== previousStatus) {
      changes.push({
        id: `cl-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'claim',
        action: 'updated',
        entityId: claim.id,
        entityType: 'claim',
        before: { status: previousStatus, riskScore: claim.risk_score },
        after: { status: validation.riskLevel, riskScore: validation.riskLevel === 'high' ? 0.8 : validation.riskLevel === 'medium' ? 0.5 : 0.2 },
        reason: `Claim status changed from ${previousStatus} to ${validation.riskLevel}`,
      });
    } else {
      changes.push({
        id: `cl-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'claim',
        action: 'unchanged',
        entityId: claim.id,
        entityType: 'claim',
        before: { status: previousStatus },
        after: { status: validation.riskLevel },
      });
    }
  }
  
  return changes;
}

/**
 * Refresh copy that contains outdated statistics
 */
async function refreshCampaignCopy(
  campaignId: string,
  workspaceId: string
): Promise<RefreshChange[]> {
  const supabase = createServiceClient();
  const changes: RefreshChange[] = [];
  
  // Get campaign assets with copy
  const { data: assets } = await supabase
    .from('campaign_assets')
    .select('*')
    .eq('campaign_id', campaignId)
    .in('type', ['landing-page', 'email-sequence', 'social-post']);
  
  for (const asset of assets || []) {
    const content = asset.content;
    if (!content) continue;
    
    // Check for outdated statistics in copy
    const outdatedStats = findOutdatedStatistics(content);
    
    if (outdatedStats.length > 0) {
      // Generate updated copy
      const updatedContent = await updateCopyStatistics(content, outdatedStats);
      
      changes.push({
        id: `cp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: 'copy',
        action: 'updated',
        entityId: asset.id,
        entityType: asset.type,
        before: content,
        after: updatedContent,
        reason: `Updated ${outdatedStats.length} outdated statistics`,
      });
    }
  }
  
  return changes;
}

/**
 * Regenerate campaign assets
 */
async function regenerateCampaignAssets(
  campaignId: string,
  workspaceId: string
): Promise<RefreshChange[]> {
  // This would trigger asset regeneration
  // For now, return empty array - actual implementation would call asset generators
  return [];
}

/**
 * Apply approved refresh changes
 */
export async function applyRefreshChanges(
  refresh: RefreshResult,
  workspaceId: string
): Promise<void> {
  const supabase = createServiceClient();
  
  for (const change of refresh.changes) {
    if (!change.approved) continue;
    
    switch (change.type) {
      case 'evidence':
        if (change.action === 'added') {
          // Link new evidence to claim
          await supabase.from('message_evidence').insert({
            message_id: change.entityId,
            evidence_id: change.after.id,
            workspace_id: workspaceId,
          });
        } else if (change.action === 'updated') {
          // Update evidence record
          await supabase.from('evidence').update({
            data: change.after.data,
            updated_at: new Date().toISOString(),
          }).eq('id', change.entityId);
        } else if (change.action === 'removed') {
          // Remove evidence link
          await supabase.from('message_evidence')
            .delete()
            .eq('evidence_id', change.entityId);
        }
        break;
        
      case 'claim':
        if (change.action === 'updated') {
          await supabase.from('messages').update({
            status: change.after.status,
            risk_score: change.after.riskScore,
            updated_at: new Date().toISOString(),
          }).eq('id', change.entityId);
        }
        break;
        
      case 'copy':
        if (change.action === 'updated') {
          await supabase.from('campaign_assets').update({
            content: change.after,
            updated_at: new Date().toISOString(),
          }).eq('id', change.entityId);
        }
        break;
    }
  }
  
  // Update refresh record
  await supabase.from('campaign_refreshes').update({
    applied_at: new Date().toISOString(),
    changes: refresh.changes,
  }).eq('id', refresh.id);
}

/**
 * Get refresh history for a campaign
 */
export async function getRefreshHistory(
  campaignId: string,
  limit = 10
): Promise<RefreshResult[]> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('campaign_refreshes')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('started_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    throw new Error(`Failed to fetch refresh history: ${error.message}`);
  }
  
  return (data || []).map((r: any) => ({
    id: r.id,
    campaignId: r.campaign_id,
    status: r.status,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    changes: r.changes || [],
    summary: r.summary || {
      evidenceUpdated: 0,
      evidenceAdded: 0,
      evidenceRemoved: 0,
      claimsRevalidated: 0,
      claimsStatusChanged: 0,
      copyUpdated: 0,
      assetsRegenerated: 0,
      totalChanges: 0,
    },
    error: r.error,
  }));
}

// Helper functions

function hasEvidenceChanged(existing: any, updated: any): boolean {
  // Compare key fields
  if (existing.data?.value !== updated.data?.value) return true;
  if (existing.data?.date !== updated.data?.date) return true;
  return false;
}

function isEvidenceStale(evidence: any): boolean {
  const createdAt = new Date(evidence.created_at);
  const ageInDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return ageInDays > 180; // 6 months
}

function findOutdatedStatistics(content: any): string[] {
  const outdated: string[] = [];
  const contentStr = JSON.stringify(content);
  
  // Look for year references that are outdated
  const currentYear = new Date().getFullYear();
  const yearPattern = /\b(20\d{2})\b/g;
  let match;
  
  while ((match = yearPattern.exec(contentStr)) !== null) {
    const year = parseInt(match[1]);
    if (year < currentYear - 1) {
      outdated.push(`Year ${year} is outdated`);
    }
  }
  
  // Look for percentage claims that might be stale
  const percentPattern = /(\d+)%/g;
  // This is simplified - real implementation would check against evidence
  
  return outdated;
}

async function updateCopyStatistics(content: any, outdatedStats: string[]): Promise<any> {
  // Use AI to update statistics while preserving structure
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: z.object({
      updatedContent: z.any(),
    }),
    prompt: `Update the following content to fix outdated statistics.
    
Outdated items:
${outdatedStats.join('\n')}

Original content:
${JSON.stringify(content, null, 2)}

Return the updated content with current statistics. Maintain the exact same structure.`,
  });
  
  return (object as any).updatedContent || content;
}
