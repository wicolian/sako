/**
 * Audit Logger
 * 
 * Centralized audit logging for ClaimsOS.
 * All changes to claims, evidence, policies, and approvals are tracked.
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { AuditAction, AuditEntityType } from '@/lib/supabase/types'

export interface AuditLogParams {
  workspaceId: string
  entityType: AuditEntityType
  entityId: string
  action: AuditAction
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  actorId?: string
}

/**
 * Log an audit event to the database
 * 
 * This function is designed to not throw errors - audit logging
 * should never break the main operation.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const supabase = createServiceClient()
    
    await supabase
      .from('audit_log')
      .insert({
        workspace_id: params.workspaceId,
        entity_type: params.entityType,
        entity_id: params.entityId,
        action: params.action,
        before_state: params.before || null,
        after_state: params.after || null,
        actor_id: params.actorId || null,
      })
  } catch (error) {
    // Log to console but don't throw - audit should never break operations
    console.error('Audit logging failed:', error)
  }
}

/**
 * Log a claim creation
 */
export async function logClaimCreated(
  workspaceId: string,
  claimId: string,
  claimData: Record<string, unknown>,
  actorId?: string
): Promise<void> {
  await logAudit({
    workspaceId,
    entityType: 'claim',
    entityId: claimId,
    action: 'create',
    after: claimData,
    actorId,
  })
}

/**
 * Log a claim update
 */
export async function logClaimUpdated(
  workspaceId: string,
  claimId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  actorId?: string
): Promise<void> {
  await logAudit({
    workspaceId,
    entityType: 'claim',
    entityId: claimId,
    action: 'update',
    before,
    after,
    actorId,
  })
}

/**
 * Log a claim approval
 */
export async function logClaimApproved(
  workspaceId: string,
  claimId: string,
  approvalData: Record<string, unknown>,
  actorId: string
): Promise<void> {
  await logAudit({
    workspaceId,
    entityType: 'claim',
    entityId: claimId,
    action: 'approve',
    after: approvalData,
    actorId,
  })
}

/**
 * Log a claim rejection
 */
export async function logClaimRejected(
  workspaceId: string,
  claimId: string,
  rejectionData: Record<string, unknown>,
  actorId: string
): Promise<void> {
  await logAudit({
    workspaceId,
    entityType: 'claim',
    entityId: claimId,
    action: 'reject',
    after: rejectionData,
    actorId,
  })
}

/**
 * Log evidence linking to a claim
 */
export async function logEvidenceLinked(
  workspaceId: string,
  claimId: string,
  evidenceId: string,
  actorId?: string
): Promise<void> {
  await logAudit({
    workspaceId,
    entityType: 'claim',
    entityId: claimId,
    action: 'link',
    after: { evidenceId },
    actorId,
  })
}

/**
 * Log evidence unlinking from a claim
 */
export async function logEvidenceUnlinked(
  workspaceId: string,
  claimId: string,
  evidenceId: string,
  actorId?: string
): Promise<void> {
  await logAudit({
    workspaceId,
    entityType: 'claim',
    entityId: claimId,
    action: 'unlink',
    before: { evidenceId },
    actorId,
  })
}

/**
 * Log policy update
 */
export async function logPolicyUpdated(
  workspaceId: string,
  policyId: string,
  version: number,
  changes: Record<string, unknown>,
  actorId?: string
): Promise<void> {
  await logAudit({
    workspaceId,
    entityType: 'policy',
    entityId: policyId,
    action: 'update',
    after: { version, ...changes },
    actorId,
  })
}

/**
 * Log claim pack export
 */
export async function logClaimPackExported(
  workspaceId: string,
  packId: string,
  packData: Record<string, unknown>,
  actorId?: string
): Promise<void> {
  await logAudit({
    workspaceId,
    entityType: 'claim_pack',
    entityId: packId,
    action: 'export',
    after: packData,
    actorId,
  })
}

/**
 * Get audit history for an entity
 */
export async function getAuditHistory(
  entityType: AuditEntityType,
  entityId: string,
  limit = 50
) {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Failed to fetch audit history:', error)
    return []
  }
  
  return data
}

/**
 * Get recent activity for a workspace
 */
export async function getWorkspaceActivity(
  workspaceId: string,
  limit = 100
) {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Failed to fetch workspace activity:', error)
    return []
  }
  
  return data
}
