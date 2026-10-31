/**
 * Approval Workflow Templates (Phase 4.4)
 * 
 * Configurable multi-stage approval workflows for campaigns.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { sendApprovalReminderEmail } from '@/lib/email'

// ============================================================================
// Types
// ============================================================================

export type ApprovalRole = 'creator' | 'reviewer' | 'compliance' | 'legal' | 'manager' | 'executive'

export interface ApprovalStage {
  id: string
  name: string
  order: number
  requiredApprovers: number
  approverRoles: ApprovalRole[]
  autoAdvance: boolean
  escalationHours?: number
  instructions?: string
}

export interface ApprovalTemplate {
  id: string
  name: string
  description: string
  isDefault: boolean
  workspaceId: string
  stages: ApprovalStage[]
  applicableCategories: string[]
  riskScoreThreshold?: number // Apply if risk >= threshold
  createdAt: string
  updatedAt: string
}

export interface ApprovalRequest {
  id: string
  campaignId: string
  templateId: string
  currentStageIndex: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  stages: ApprovalStageStatus[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ApprovalStageStatus {
  stageId: string
  status: 'pending' | 'approved' | 'rejected' | 'skipped'
  approvals: ApprovalAction[]
  startedAt?: string
  completedAt?: string
}

export interface ApprovalAction {
  id: string
  userId: string
  userName: string
  action: 'approve' | 'reject' | 'request_changes'
  comment?: string
  timestamp: string
}

// ============================================================================
// Default Templates
// ============================================================================

export const DEFAULT_TEMPLATES: Omit<ApprovalTemplate, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Standard Review',
    description: 'Basic two-stage approval for standard campaigns',
    isDefault: true,
    stages: [
      {
        id: 'review',
        name: 'Content Review',
        order: 1,
        requiredApprovers: 1,
        approverRoles: ['reviewer', 'manager'],
        autoAdvance: true,
        escalationHours: 24,
        instructions: 'Review content for accuracy, tone, and brand alignment',
      },
      {
        id: 'approval',
        name: 'Final Approval',
        order: 2,
        requiredApprovers: 1,
        approverRoles: ['manager'],
        autoAdvance: false,
        escalationHours: 48,
        instructions: 'Final sign-off before publication',
      },
    ],
    applicableCategories: ['general', 'marketing'],
    riskScoreThreshold: undefined,
  },
  {
    name: 'Regulated Industry',
    description: 'Three-stage approval with compliance review for regulated industries',
    isDefault: false,
    stages: [
      {
        id: 'content_review',
        name: 'Content Review',
        order: 1,
        requiredApprovers: 1,
        approverRoles: ['reviewer'],
        autoAdvance: true,
        escalationHours: 24,
        instructions: 'Review for factual accuracy and brand guidelines',
      },
      {
        id: 'compliance_review',
        name: 'Compliance Review',
        order: 2,
        requiredApprovers: 1,
        approverRoles: ['compliance', 'legal'],
        autoAdvance: false,
        escalationHours: 48,
        instructions: 'Ensure all claims are substantiated and compliant with regulations',
      },
      {
        id: 'final_approval',
        name: 'Final Approval',
        order: 3,
        requiredApprovers: 1,
        approverRoles: ['manager', 'executive'],
        autoAdvance: false,
        escalationHours: 72,
        instructions: 'Final executive sign-off',
      },
    ],
    applicableCategories: ['healthcare', 'financial', 'pharma', 'regulated'],
    riskScoreThreshold: 50,
  },
  {
    name: 'Enterprise',
    description: 'Comprehensive four-stage workflow for high-stakes campaigns',
    isDefault: false,
    stages: [
      {
        id: 'draft_review',
        name: 'Draft Review',
        order: 1,
        requiredApprovers: 1,
        approverRoles: ['reviewer'],
        autoAdvance: true,
        escalationHours: 24,
      },
      {
        id: 'compliance',
        name: 'Compliance Check',
        order: 2,
        requiredApprovers: 1,
        approverRoles: ['compliance'],
        autoAdvance: false,
        escalationHours: 48,
      },
      {
        id: 'legal',
        name: 'Legal Review',
        order: 3,
        requiredApprovers: 1,
        approverRoles: ['legal'],
        autoAdvance: false,
        escalationHours: 72,
      },
      {
        id: 'executive',
        name: 'Executive Approval',
        order: 4,
        requiredApprovers: 2,
        approverRoles: ['executive'],
        autoAdvance: false,
        escalationHours: 96,
      },
    ],
    applicableCategories: ['enterprise', 'high_risk'],
    riskScoreThreshold: 70,
  },
]

// ============================================================================
// Template Management
// ============================================================================

/**
 * Get approval templates for a workspace
 */
export async function getApprovalTemplates(workspaceId: string): Promise<ApprovalTemplate[]> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('approval_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('is_default', { ascending: false })
    .order('name')
  
  if (error) {
    console.error('Failed to fetch approval templates:', error)
    return []
  }
  
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: row.is_default,
    workspaceId: row.workspace_id,
    stages: row.stages,
    applicableCategories: row.applicable_categories,
    riskScoreThreshold: row.risk_score_threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

/**
 * Create approval template
 */
export async function createApprovalTemplate(
  workspaceId: string,
  template: Omit<ApprovalTemplate, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>
): Promise<ApprovalTemplate | null> {
  const supabase = createServiceClient()
  
  // If setting as default, unset other defaults
  if (template.isDefault) {
    await supabase
      .from('approval_templates')
      .update({ is_default: false })
      .eq('workspace_id', workspaceId)
  }
  
  const { data, error } = await supabase
    .from('approval_templates')
    .insert({
      workspace_id: workspaceId,
      name: template.name,
      description: template.description,
      is_default: template.isDefault,
      stages: template.stages,
      applicable_categories: template.applicableCategories,
      risk_score_threshold: template.riskScoreThreshold,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Failed to create approval template:', error)
    return null
  }
  
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    isDefault: data.is_default,
    workspaceId: data.workspace_id,
    stages: data.stages,
    applicableCategories: data.applicable_categories,
    riskScoreThreshold: data.risk_score_threshold,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/**
 * Update approval template
 */
export async function updateApprovalTemplate(
  templateId: string,
  updates: Partial<Omit<ApprovalTemplate, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  const supabase = createServiceClient()
  
  const { error } = await supabase
    .from('approval_templates')
    .update({
      ...(updates.name && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.isDefault !== undefined && { is_default: updates.isDefault }),
      ...(updates.stages && { stages: updates.stages }),
      ...(updates.applicableCategories && { applicable_categories: updates.applicableCategories }),
      ...(updates.riskScoreThreshold !== undefined && { risk_score_threshold: updates.riskScoreThreshold }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
  
  return !error
}

/**
 * Delete approval template
 */
export async function deleteApprovalTemplate(templateId: string): Promise<boolean> {
  const supabase = createServiceClient()
  
  const { error } = await supabase
    .from('approval_templates')
    .delete()
    .eq('id', templateId)
  
  return !error
}

// ============================================================================
// Approval Request Management
// ============================================================================

/**
 * Select appropriate template based on campaign
 */
export async function selectTemplateForCampaign(
  workspaceId: string,
  category?: string,
  riskScore?: number
): Promise<ApprovalTemplate | null> {
  const templates = await getApprovalTemplates(workspaceId)
  
  if (templates.length === 0) return null
  
  // Find matching template by category and risk score
  for (const template of templates) {
    // Check risk score threshold
    if (template.riskScoreThreshold && riskScore !== undefined) {
      if (riskScore >= template.riskScoreThreshold) {
        return template
      }
    }
    
    // Check category match
    if (category && template.applicableCategories.includes(category)) {
      return template
    }
  }
  
  // Fall back to default template
  return templates.find(t => t.isDefault) || templates[0]
}

/**
 * Create approval request for a campaign
 */
export async function createApprovalRequest(
  campaignId: string,
  templateId: string
): Promise<ApprovalRequest | null> {
  const supabase = createServiceClient()
  
  // Get template
  const { data: template } = await supabase
    .from('approval_templates')
    .select('stages')
    .eq('id', templateId)
    .single()
  
  if (!template) return null
  
  const stages = (template.stages as ApprovalStage[]).map(stage => ({
    stageId: stage.id,
    status: 'pending' as const,
    approvals: [],
  }))
  
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      campaign_id: campaignId,
      template_id: templateId,
      current_stage_index: 0,
      status: 'pending',
      stages,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Failed to create approval request:', error)
    return null
  }
  
  return {
    id: data.id,
    campaignId: data.campaign_id,
    templateId: data.template_id,
    currentStageIndex: data.current_stage_index,
    status: data.status,
    stages: data.stages,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    completedAt: data.completed_at,
  }
}

/**
 * Get approval request for a campaign
 */
export async function getApprovalRequest(campaignId: string): Promise<ApprovalRequest | null> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (error || !data) return null
  
  return {
    id: data.id,
    campaignId: data.campaign_id,
    templateId: data.template_id,
    currentStageIndex: data.current_stage_index,
    status: data.status,
    stages: data.stages,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    completedAt: data.completed_at,
  }
}

/**
 * Submit approval action
 */
export async function submitApproval(
  requestId: string,
  userId: string,
  userName: string,
  action: 'approve' | 'reject' | 'request_changes',
  comment?: string
): Promise<boolean> {
  const supabase = createServiceClient()
  
  // Get current request
  const { data: request } = await supabase
    .from('approval_requests')
    .select('*, approval_templates!inner(stages, workspace_id)')
    .eq('id', requestId)
    .single()
  
  if (!request || request.status !== 'pending') return false
  
  const stages = request.stages as ApprovalStageStatus[]
  const templateStages = request.approval_templates.stages as ApprovalStage[]
  const currentStage = stages[request.current_stage_index]
  const templateStage = templateStages[request.current_stage_index]
  
  // Add approval action
  const approvalAction: ApprovalAction = {
    id: crypto.randomUUID(),
    userId,
    userName,
    action,
    comment,
    timestamp: new Date().toISOString(),
  }
  
  currentStage.approvals.push(approvalAction)
  
  // Check if stage is complete
  const approvalCount = currentStage.approvals.filter(a => a.action === 'approve').length
  const rejectionCount = currentStage.approvals.filter(a => a.action === 'reject').length
  
  if (rejectionCount > 0) {
    // Stage rejected
    currentStage.status = 'rejected'
    currentStage.completedAt = new Date().toISOString()
    
    await supabase
      .from('approval_requests')
      .update({
        status: 'rejected',
        stages,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
  } else if (approvalCount >= templateStage.requiredApprovers) {
    // Stage approved
    currentStage.status = 'approved'
    currentStage.completedAt = new Date().toISOString()
    
    // Check if this was the last stage
    if (request.current_stage_index === stages.length - 1) {
      // Workflow complete
      await supabase
        .from('approval_requests')
        .update({
          status: 'approved',
          stages,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
    } else {
      // Advance to next stage
      const nextIndex = request.current_stage_index + 1
      stages[nextIndex].startedAt = new Date().toISOString()
      
      await supabase
        .from('approval_requests')
        .update({
          current_stage_index: nextIndex,
          stages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      await notifyNextStageApprovers(
        request.approval_templates.workspace_id,
        request.campaign_id,
        templateStages[nextIndex]
      )
    }
  } else {
    // Just update stages with new approval
    await supabase
      .from('approval_requests')
      .update({
        stages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
  }
  
  return true
}

async function notifyNextStageApprovers(
  workspaceId: string,
  campaignId: string,
  stage: ApprovalStage
): Promise<void> {
  const supabase = createServiceClient()
  const workspaceRoles = mapApprovalRolesToWorkspaceRoles(stage.approverRoles)

  let memberQuery = supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', workspaceId)

  if (workspaceRoles.length > 0) {
    memberQuery = memberQuery.in('role', workspaceRoles)
  }

  const [{ data: members }, { data: campaign }] = await Promise.all([
    memberQuery,
    supabase
      .from('campaigns')
      .select('id, name')
      .eq('id', campaignId)
      .single(),
  ])

  const recipientIds = [...new Set((members || []).map((member) => member.user_id))]
  if (recipientIds.length === 0 || !campaign?.id) {
    return
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', recipientIds)

  const recipients = (profiles || []).filter((profile) => Boolean(profile.email))
  if (recipients.length === 0) {
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  await sendApprovalReminderEmail({
    to: recipients.map((recipient) => recipient.email),
    campaignName: campaign.name,
    stageName: stage.name,
    approverNames: recipients.map((recipient) => recipient.full_name || recipient.email),
    approvalUrl: `${appUrl}/campaigns/${campaign.id}`,
  })
}

function mapApprovalRolesToWorkspaceRoles(roles: ApprovalRole[]): string[] {
  const mapped = new Set<string>()

  for (const role of roles) {
    switch (role) {
      case 'reviewer':
        mapped.add('reviewer')
        mapped.add('admin')
        mapped.add('owner')
        break
      case 'manager':
      case 'executive':
      case 'legal':
      case 'compliance':
        mapped.add('admin')
        mapped.add('owner')
        break
      case 'creator':
        mapped.add('member')
        mapped.add('reviewer')
        mapped.add('admin')
        mapped.add('owner')
        break
    }
  }

  return [...mapped]
}

/**
 * Check for escalations (stages past their escalation time)
 */
export async function checkEscalations(workspaceId: string): Promise<{
  requestId: string
  campaignId: string
  stageName: string
  hoursOverdue: number
}[]> {
  const supabase = createServiceClient()
  
  const { data: requests } = await supabase
    .from('approval_requests')
    .select('*, approval_templates!inner(stages, workspace_id)')
    .eq('status', 'pending')
    .eq('approval_templates.workspace_id', workspaceId)
  
  if (!requests) return []
  
  const escalations: {
    requestId: string
    campaignId: string
    stageName: string
    hoursOverdue: number
  }[] = []
  
  for (const request of requests) {
    const stages = request.stages as ApprovalStageStatus[]
    const templateStages = request.approval_templates.stages as ApprovalStage[]
    const currentStage = stages[request.current_stage_index]
    const templateStage = templateStages[request.current_stage_index]
    
    if (currentStage.startedAt && templateStage.escalationHours) {
      const startTime = new Date(currentStage.startedAt).getTime()
      const now = Date.now()
      const hoursElapsed = (now - startTime) / (1000 * 60 * 60)
      
      if (hoursElapsed > templateStage.escalationHours) {
        escalations.push({
          requestId: request.id,
          campaignId: request.campaign_id,
          stageName: templateStage.name,
          hoursOverdue: Math.round(hoursElapsed - templateStage.escalationHours),
        })
      }
    }
  }
  
  return escalations
}
