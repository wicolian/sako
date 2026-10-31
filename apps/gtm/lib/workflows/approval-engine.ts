/**
 * Approval Workflow Engine (Phase 3.4)
 * 
 * Configurabimport { Database } from '@/lib/supabase/types'

type CampaignRow = Database['public']['Tables']['campaigns']['Row']
le approval workflows for enterprise governance.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface ApprovalStage {
  name: string
  approvers: string[] // 'role:legal', 'user:uuid', 'team:marketing'
  required_approvals: number
  timeout_hours?: number
  can_skip?: boolean
  auto_approve_conditions?: Record<string, unknown>
}

export interface ApprovalTemplate {
  id: string
  workspace_id: string
  name: string
  description?: string
  stages: ApprovalStage[]
  conditions?: Record<string, unknown>
  auto_escalation?: {
    after_hours: number
    escalate_to: string
    reminder_hours: number[]
  }
  notifications?: {
    on_submit: boolean
    on_approve: boolean
    on_reject: boolean
    channels: string[]
  }
  is_default: boolean
  is_active: boolean
}

export interface ApprovalInstance {
  id: string
  template_id?: string
  campaign_id?: string
  workspace_id: string
  content_type: string
  content_id?: string
  content_snapshot?: Record<string, unknown>
  current_stage: number
  stages_config: ApprovalStage[]
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled' | 'expired'
  submitted_by?: string
  submission_notes?: string
  started_at: string
  completed_at?: string
  expires_at?: string
}

export interface ApprovalDecision {
  id: string
  instance_id: string
  stage_index: number
  decision: 'approved' | 'rejected' | 'request_changes' | 'skipped'
  decision_by?: string
  decision_notes?: string
  requested_changes?: string
  decided_at: string
}

/**
 * Get approval template by ID
 */
export async function getApprovalTemplate(templateId: string): Promise<ApprovalTemplate | null> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('approval_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as ApprovalTemplate
}

/**
 * Get default approval template for a workspace
 */
export async function getDefaultApprovalTemplate(workspaceId: string): Promise<ApprovalTemplate | null> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('approval_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_default', true)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as ApprovalTemplate
}

/**
 * Get all approval templates for a workspace
 */
export async function getWorkspaceApprovalTemplates(workspaceId: string): Promise<ApprovalTemplate[]> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('approval_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Failed to fetch approval templates:', error)
    return []
  }

  return (data || []) as ApprovalTemplate[]
}

/**
 * Create a new approval instance
 */
export async function createApprovalInstance(params: {
  workspaceId: string
  templateId?: string
  campaignId?: string
  contentType: string
  contentId?: string
  contentSnapshot?: Record<string, unknown>
  submittedBy: string
  submissionNotes?: string
}): Promise<ApprovalInstance | null> {
  const supabase = createServiceClient()

  // Get template if specified, otherwise use default
  let stagesConfig: ApprovalStage[]
  
  if (params.templateId) {
    const template = await getApprovalTemplate(params.templateId)
    if (!template) {
      throw new Error('Approval template not found')
    }
    stagesConfig = template.stages
  } else {
    const defaultTemplate = await getDefaultApprovalTemplate(params.workspaceId)
    if (defaultTemplate) {
      stagesConfig = defaultTemplate.stages
    } else {
      // No template - create a simple single-stage approval
      stagesConfig = [{
        name: 'Review',
        approvers: ['role:admin'],
        required_approvals: 1,
      }]
    }
  }

  const { data, error } = await supabase
    .from('approval_instances')
    .insert({
      workspace_id: params.workspaceId,
      template_id: params.templateId,
      campaign_id: params.campaignId,
      content_type: params.contentType,
      content_id: params.contentId,
      content_snapshot: params.contentSnapshot,
      current_stage: 0,
      stages_config: stagesConfig,
      status: 'in_progress',
      submitted_by: params.submittedBy,
      submission_notes: params.submissionNotes,
      started_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Failed to create approval instance:', error)
    return null
  }

  // Update campaign approval status if this is for a campaign
  if (params.campaignId) {
    await supabase
      .from('campaigns')
      .update({ approval_status: 'pending' })
      .eq('id', params.campaignId)
  }

  return data as ApprovalInstance
}

/**
 * Record an approval decision
 */
export async function recordApprovalDecision(params: {
  instanceId: string
  stageIndex: number
  decision: 'approved' | 'rejected' | 'request_changes' | 'skipped'
  decisionBy: string
  decisionNotes?: string
  requestedChanges?: string
}): Promise<{ success: boolean; nextAction?: string; error?: string }> {
  const supabase = createServiceClient()

  // Get the instance
  const { data: instance, error: fetchError } = await supabase
    .from('approval_instances')
    .select('*')
    .eq('id', params.instanceId)
    .maybeSingle()

  if (fetchError || !instance) {
    return { success: false, error: 'Approval instance not found' }
  }

  // Record the decision
  const { error: decisionError } = await supabase
    .from('approval_decisions')
    .insert({
      instance_id: params.instanceId,
      stage_index: params.stageIndex,
      decision: params.decision,
      decision_by: params.decisionBy,
      decision_notes: params.decisionNotes,
      requested_changes: params.requestedChanges,
      decided_at: new Date().toISOString(),
    })

  if (decisionError) {
    return { success: false, error: 'Failed to record decision' }
  }

  // Determine next action based on decision
  const stages = instance.stages_config as ApprovalStage[]
  const currentStage = stages[params.stageIndex]

  if (params.decision === 'rejected') {
    // Rejection ends the workflow
    await supabase
      .from('approval_instances')
      .update({
        status: 'rejected',
        completed_at: new Date().toISOString(),
      })
      .eq('id', params.instanceId)

    // Update campaign status
    if (instance.campaign_id) {
      await supabase
        .from('campaigns')
        .update({ approval_status: 'rejected' })
        .eq('id', instance.campaign_id)
    }

    return { success: true, nextAction: 'workflow_rejected' }
  }

  if (params.decision === 'request_changes') {
    // Request changes pauses the workflow
    await supabase
      .from('approval_instances')
      .update({ status: 'pending' })
      .eq('id', params.instanceId)

    return { success: true, nextAction: 'changes_requested' }
  }

  // Check if we have enough approvals for this stage
  const { data: stageDecisions } = await supabase
    .from('approval_decisions')
    .select('*')
    .eq('instance_id', params.instanceId)
    .eq('stage_index', params.stageIndex)
    .eq('decision', 'approved')

  const approvalCount = stageDecisions?.length || 0

  if (approvalCount >= currentStage.required_approvals) {
    // Stage complete - move to next stage or finish
    if (params.stageIndex + 1 >= stages.length) {
      // All stages complete - workflow approved
      await supabase
        .from('approval_instances')
        .update({
          status: 'approved',
          completed_at: new Date().toISOString(),
        })
        .eq('id', params.instanceId)

      // Update campaign status
      if (instance.campaign_id) {
        await supabase
          .from('campaigns')
          .update({ approval_status: 'approved' })
          .eq('id', instance.campaign_id)
      }

      return { success: true, nextAction: 'workflow_approved' }
    } else {
      // Move to next stage
      await supabase
        .from('approval_instances')
        .update({ current_stage: params.stageIndex + 1 })
        .eq('id', params.instanceId)

      return { success: true, nextAction: 'stage_advanced' }
    }
  }

  return { success: true, nextAction: 'awaiting_more_approvals' }
}

/**
 * Get approval status for a campaign
 */
export async function getCampaignApprovalStatus(campaignId: string): Promise<{
  hasApproval: boolean
  instance?: ApprovalInstance
  decisions?: ApprovalDecision[]
  pendingApprovers?: string[]
}> {
  const supabase = createServiceClient()

  // Get the latest approval instance for this campaign
  const { data: instance } = await supabase
    .from('approval_instances')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!instance) {
    return { hasApproval: false }
  }

  // Get all decisions for this instance
  const { data: decisions } = await supabase
    .from('approval_decisions')
    .select('*')
    .eq('instance_id', instance.id)
    .order('decided_at')

  // Determine pending approvers for current stage
  const stages = instance.stages_config as ApprovalStage[]
  const currentStage = stages[instance.current_stage]
  const pendingApprovers = currentStage?.approvers || []

  return {
    hasApproval: true,
    instance: instance as ApprovalInstance,
    decisions: (decisions || []) as ApprovalDecision[],
    pendingApprovers,
  }
}

/**
 * Cancel an approval workflow
 */
export async function cancelApprovalWorkflow(instanceId: string, reason?: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { data: instance } = await supabase
    .from('approval_instances')
    .select('campaign_id')
    .eq('id', instanceId)
    .maybeSingle()

  const { error } = await supabase
    .from('approval_instances')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', instanceId)

  if (error) {
    console.error('Failed to cancel approval workflow:', error)
    return false
  }

  // Update campaign status
  if (instance?.campaign_id) {
    await supabase
      .from('campaigns')
      .update({ approval_status: 'not_required' })
      .eq('id', instance.campaign_id)
  }

  return true
}

/**
 * Get pending approvals for a user
 */
export async function getPendingApprovalsForUser(
  workspaceId: string,
  userId: string,
  userRoles: string[] = []
): Promise<ApprovalInstance[]> {
  const supabase = createServiceClient()

  // Get all in-progress approval instances
  const { data: instances } = await supabase
    .from('approval_instances')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('status', ['pending', 'in_progress'])
    .order('started_at', { ascending: false })

  if (!instances) {
    return []
  }

  // Filter to instances where user is an approver at current stage
  const userApproverPatterns = [
    `user:${userId}`,
    ...userRoles.map(role => `role:${role}`),
  ]

  return instances.filter(instance => {
    const stages = instance.stages_config as ApprovalStage[]
    const currentStage = stages[instance.current_stage]
    
    return currentStage?.approvers.some(approver =>
      userApproverPatterns.some(pattern => approver === pattern)
    )
  }) as ApprovalInstance[]
}
