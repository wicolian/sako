/**
 * Enhanced Human-in-the-Loop (HITL) System (Jan 2026)
 * 
 * Structured approval workflows forimport { Database } from '@/lib/supabase/types'

type WorkspaceMemberRow = Database['public']['Tables']['workspace_members']['Row']
 AI agent actions:
 * - Risk-based escalation
 * - Multi-approver support
 * - Expiration and auto-escalation
 * - Audit trail
 * - Notifications
 * 
 * 2026 Standard: Required for enterprise AI deployments
 */

import { createServiceClient } from '@/lib/supabase/service';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export type ApprovalType = 
  | 'claim_review'        // Review flagged marketing claims
  | 'deployment'          // Approve campaign deployment
  | 'high_value_action'   // Actions above cost threshold
  | 'policy_override'     // Override compliance policy
  | 'data_access';        // Access sensitive data

export type ApprovalStatus = 
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'expired' 
  | 'escalated';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ApprovalRequest {
  id: string;
  workspace_id: string;
  agent_run_id?: string;
  type: ApprovalType;
  risk_level: RiskLevel;
  title: string;
  description: string;
  context: {
    claims?: Array<{ text: string; risk: string; suggestion?: string }>;
    preview?: string;
    cost_estimate?: number;
    affected_items?: string[];
    agent_reasoning?: string;
  };
  required_approvers: string[];  // User IDs or roles
  min_approvals: number;
  approvals: Approval[];
  status: ApprovalStatus;
  created_by: string;
  created_at: string;
  expires_at: string;
  resolved_at?: string;
  metadata?: Record<string, unknown>;
}

export interface Approval {
  user_id: string;
  user_email: string;
  decision: 'approve' | 'reject';
  note?: string;
  timestamp: string;
}

export interface ApprovalPolicy {
  type: ApprovalType;
  risk_level: RiskLevel;
  required_role: 'member' | 'admin' | 'owner';
  min_approvals: number;
  expiration_hours: number;
  auto_escalate_hours?: number;
  notify_on_create: boolean;
  notify_on_decision: boolean;
}

// ============================================================================
// Default Policies
// ============================================================================

const DEFAULT_POLICIES: ApprovalPolicy[] = [
  {
    type: 'claim_review',
    risk_level: 'high',
    required_role: 'admin',
    min_approvals: 1,
    expiration_hours: 24,
    auto_escalate_hours: 12,
    notify_on_create: true,
    notify_on_decision: true,
  },
  {
    type: 'deployment',
    risk_level: 'medium',
    required_role: 'admin',
    min_approvals: 1,
    expiration_hours: 48,
    notify_on_create: true,
    notify_on_decision: true,
  },
  {
    type: 'high_value_action',
    risk_level: 'high',
    required_role: 'owner',
    min_approvals: 1,
    expiration_hours: 24,
    notify_on_create: true,
    notify_on_decision: true,
  },
  {
    type: 'policy_override',
    risk_level: 'critical',
    required_role: 'owner',
    min_approvals: 2,
    expiration_hours: 12,
    auto_escalate_hours: 6,
    notify_on_create: true,
    notify_on_decision: true,
  },
];

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Create an approval request
 */
export async function createApprovalRequest(
  params: {
    workspaceId: string;
    type: ApprovalType;
    riskLevel: RiskLevel;
    title: string;
    description: string;
    context: ApprovalRequest['context'];
    createdBy: string;
    agentRunId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<ApprovalRequest> {
  const supabase = createServiceClient();
  
  // Get policy for this type/risk combination
  const policy = getPolicy(params.type, params.riskLevel);
  
  // Get eligible approvers based on role
  const approvers = await getEligibleApprovers(
    params.workspaceId,
    policy.required_role
  );
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + policy.expiration_hours * 60 * 60 * 1000);
  
  const request: Omit<ApprovalRequest, 'approvals'> & { approvals: Approval[] } = {
    id: `apr-${uuidv4()}`,
    workspace_id: params.workspaceId,
    agent_run_id: params.agentRunId,
    type: params.type,
    risk_level: params.riskLevel,
    title: params.title,
    description: params.description,
    context: params.context,
    required_approvers: approvers.map(a => a.user_id),
    min_approvals: policy.min_approvals,
    approvals: [],
    status: 'pending',
    created_by: params.createdBy,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    metadata: params.metadata,
  };
  
  // Save to database
  const { error } = await supabase
    .from('approval_requests')
    .insert(request);
  
  if (error) {
    console.error('Failed to create approval request:', error);
    throw new Error(`Failed to create approval request: ${error.message}`);
  }
  
  // Send notifications
  if (policy.notify_on_create) {
    await notifyApprovers(request, 'created');
  }
  
  return request;
}

/**
 * Process an approval decision
 */
export async function processApprovalDecision(
  requestId: string,
  userId: string,
  userEmail: string,
  decision: 'approve' | 'reject',
  note?: string
): Promise<{
  request: ApprovalRequest;
  canProceed: boolean;
  message: string;
}> {
  const supabase = createServiceClient();
  
  // Get current request
  const { data: request, error: fetchError } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  
  if (fetchError || !request) {
    throw new Error('Approval request not found');
  }
  
  // Check if user is eligible
  if (!request.required_approvers.includes(userId)) {
    throw new Error('User not authorized to approve this request');
  }
  
  // Check if already decided by this user
  const existingApproval = request.approvals.find((a: Approval) => a.user_id === userId);
  if (existingApproval) {
    throw new Error('User has already submitted a decision');
  }
  
  // Check expiration
  if (new Date() > new Date(request.expires_at)) {
    await updateRequestStatus(requestId, 'expired');
    throw new Error('Approval request has expired');
  }
  
  // Add approval
  const approval: Approval = {
    user_id: userId,
    user_email: userEmail,
    decision,
    note,
    timestamp: new Date().toISOString(),
  };
  
  const updatedApprovals = [...request.approvals, approval];
  
  // Determine new status
  const approveCount = updatedApprovals.filter(a => a.decision === 'approve').length;
  const rejectCount = updatedApprovals.filter(a => a.decision === 'reject').length;
  
  let newStatus: ApprovalStatus = 'pending';
  let canProceed = false;
  let message = '';
  
  if (rejectCount > 0) {
    newStatus = 'rejected';
    message = `Request rejected by ${userEmail}${note ? `: ${note}` : ''}`;
  } else if (approveCount >= request.min_approvals) {
    newStatus = 'approved';
    canProceed = true;
    message = 'Request approved. Agent can proceed.';
  } else {
    message = `Approval recorded. ${request.min_approvals - approveCount} more approval(s) needed.`;
  }
  
  // Update request
  const { error: updateError } = await supabase
    .from('approval_requests')
    .update({
      approvals: updatedApprovals,
      status: newStatus,
      resolved_at: newStatus !== 'pending' ? new Date().toISOString() : null,
    })
    .eq('id', requestId);
  
  if (updateError) {
    throw new Error(`Failed to update approval: ${updateError.message}`);
  }
  
  // Get policy and notify
  const policy = getPolicy(request.type, request.risk_level);
  if (policy.notify_on_decision) {
    await notifyDecision(request, approval);
  }
  
  return {
    request: { ...request, approvals: updatedApprovals, status: newStatus },
    canProceed,
    message,
  };
}

/**
 * Get pending approval requests for a user
 */
export async function getPendingApprovals(
  workspaceId: string,
  userId: string
): Promise<ApprovalRequest[]> {
  const supabase = createServiceClient();
  
  const { data } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .contains('required_approvers', [userId])
    .order('created_at', { ascending: false });
  
  // Filter out requests user already approved
  return (data || []).filter(r => 
    !r.approvals.some((a: Approval) => a.user_id === userId)
  );
}

/**
 * Get approval request by ID
 */
export async function getApprovalRequest(requestId: string): Promise<ApprovalRequest | null> {
  const supabase = createServiceClient();
  
  const { data } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle();
  
  return data;
}

/**
 * Cancel an approval request
 */
export async function cancelApprovalRequest(
  requestId: string,
  cancelledBy: string,
  reason?: string
): Promise<void> {
  const supabase = createServiceClient();
  
  await supabase
    .from('approval_requests')
    .update({
      status: 'expired',
      resolved_at: new Date().toISOString(),
      metadata: { cancelled_by: cancelledBy, cancellation_reason: reason },
    })
    .eq('id', requestId)
    .eq('status', 'pending');
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPolicy(type: ApprovalType, riskLevel: RiskLevel): ApprovalPolicy {
  const policy = DEFAULT_POLICIES.find(
    p => p.type === type && p.risk_level === riskLevel
  );
  
  if (!policy) {
    // Default policy for unknown combinations
    return {
      type,
      risk_level: riskLevel,
      required_role: 'admin',
      min_approvals: 1,
      expiration_hours: 24,
      notify_on_create: true,
      notify_on_decision: true,
    };
  }
  
  return policy;
}

async function getEligibleApprovers(
  workspaceId: string,
  requiredRole: 'member' | 'admin' | 'owner'
): Promise<Array<{ user_id: string; email: string }>> {
  const supabase = createServiceClient();
  
  const roleHierarchy = { owner: 3, admin: 2, member: 1 };
  const minRoleLevel = roleHierarchy[requiredRole];
  
  const { data } = await supabase
    .from('workspace_members')
    .select('user_id, role, users:user_id(email)')
    .eq('workspace_id', workspaceId);
  
  if (!data) return [];
  
  return data
    .filter(m => roleHierarchy[m.role as keyof typeof roleHierarchy] >= minRoleLevel)
    .map(m => ({
      user_id: m.user_id,
      email: (m.users as any)?.email || '',
    }));
}

async function updateRequestStatus(
  requestId: string,
  status: ApprovalStatus
): Promise<void> {
  const supabase = createServiceClient();
  
  await supabase
    .from('approval_requests')
    .update({
      status,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', requestId);
}

async function notifyApprovers(
  request: ApprovalRequest,
  event: 'created' | 'reminder'
): Promise<void> {
  // In production, this would send emails/Slack notifications
  console.log(`[HITL] Notification: ${event} - ${request.title}`);
  console.log(`[HITL] Approvers: ${request.required_approvers.join(', ')}`);
}

async function notifyDecision(
  request: ApprovalRequest,
  approval: Approval
): Promise<void> {
  // In production, this would notify relevant parties
  console.log(`[HITL] Decision: ${approval.decision} by ${approval.user_email}`);
  console.log(`[HITL] Request: ${request.title}`);
}

// ============================================================================
// Auto-Escalation (Run as cron job)
// ============================================================================

/**
 * Check for requests that need escalation
 * Run this as a scheduled job (e.g., every hour)
 */
export async function processEscalations(): Promise<{
  escalated: number;
  expired: number;
}> {
  const supabase = createServiceClient();
  const now = new Date();
  
  // Get pending requests
  const { data: requests } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('status', 'pending');
  
  let escalated = 0;
  let expired = 0;
  
  for (const request of requests || []) {
    const policy = getPolicy(request.type, request.risk_level);
    const createdAt = new Date(request.created_at);
    const expiresAt = new Date(request.expires_at);
    
    // Check expiration
    if (now > expiresAt) {
      await updateRequestStatus(request.id, 'expired');
      expired++;
      continue;
    }
    
    // Check auto-escalation
    if (policy.auto_escalate_hours) {
      const escalateAt = new Date(
        createdAt.getTime() + policy.auto_escalate_hours * 60 * 60 * 1000
      );
      
      if (now > escalateAt && request.status === 'pending') {
        // Mark as escalated and notify owners
        await supabase
          .from('approval_requests')
          .update({ status: 'escalated' })
          .eq('id', request.id);
        
        escalated++;
      }
    }
  }
  
  return { escalated, expired };
}

// ============================================================================
// Integration with Agent System
// ============================================================================

/**
 * Create approval request from agent state
 * Use this in agent tools when human review is needed
 */
export async function requestAgentApproval(
  agentState: {
    workspaceId: string;
    agentRunId?: string;
    userId: string;
    blockedClaims?: Array<{ text: string; risk: string; suggestion?: string }>;
    preview?: string;
    costEstimate?: number;
  },
  type: ApprovalType = 'claim_review'
): Promise<{ approvalId: string; status: 'pending' }> {
  const riskLevel = determineRiskLevel(agentState.blockedClaims || []);
  
  const request = await createApprovalRequest({
    workspaceId: agentState.workspaceId,
    type,
    riskLevel,
    title: `Agent requests ${type.replace('_', ' ')}`,
    description: `AI agent requires human approval to proceed.`,
    context: {
      claims: agentState.blockedClaims,
      preview: agentState.preview,
      cost_estimate: agentState.costEstimate,
    },
    createdBy: agentState.userId,
    agentRunId: agentState.agentRunId,
  });
  
  return {
    approvalId: request.id,
    status: 'pending',
  };
}

function determineRiskLevel(
  claims: Array<{ text: string; risk: string }>
): RiskLevel {
  const highRiskCount = claims.filter(c => c.risk === 'high').length;
  
  if (highRiskCount >= 3) return 'critical';
  if (highRiskCount >= 1) return 'high';
  if (claims.length > 0) return 'medium';
  return 'low';
}
