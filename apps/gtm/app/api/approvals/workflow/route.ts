/**
 * Approval Workflow API
 * 
 * Endpoints for configurable approval workflows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  getApprovalTemplate,
  getDefaultApprovalTemplate,
  getWorkspaceApprovalTemplates,
  createApprovalInstance,
  recordApprovalDecision,
  getCampaignApprovalStatus,
  cancelApprovalWorkflow,
  getPendingApprovalsForUser,
} from '@/lib/workflows/approval-engine'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  }

  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')
  const campaignId = searchParams.get('campaignId')
  const templateId = searchParams.get('templateId')

  if (action === 'pending') {
    const userRoles = [member.role]
    const pending = await getPendingApprovalsForUser(member.workspace_id, user.id, userRoles)
    return NextResponse.json({ pending })
  }

  if (action === 'templates') {
    const templates = await getWorkspaceApprovalTemplates(member.workspace_id)
    return NextResponse.json({ templates })
  }

  if (templateId) {
    const template = await getApprovalTemplate(templateId)
    return NextResponse.json({ template })
  }

  if (campaignId) {
    const status = await getCampaignApprovalStatus(campaignId)
    return NextResponse.json({ status })
  }

  // Get default template
  const defaultTemplate = await getDefaultApprovalTemplate(member.workspace_id)
  return NextResponse.json({ defaultTemplate })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  }

  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'submit': {
      const { templateId, campaignId, contentType, contentId, contentSnapshot, notes } = body

      if (!contentType) {
        return NextResponse.json({ error: 'contentType required' }, { status: 400 })
      }

      const instance = await createApprovalInstance({
        workspaceId: member.workspace_id,
        templateId,
        campaignId,
        contentType,
        contentId,
        contentSnapshot,
        submittedBy: user.id,
        submissionNotes: notes,
      })

      return NextResponse.json({ instance })
    }

    case 'decide': {
      const { instanceId, stageIndex, decision, notes, requestedChanges } = body

      if (!instanceId || stageIndex === undefined || !decision) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      const result = await recordApprovalDecision({
        instanceId,
        stageIndex,
        decision,
        decisionBy: user.id,
        decisionNotes: notes,
        requestedChanges,
      })

      return NextResponse.json(result)
    }

    case 'cancel': {
      const { instanceId, reason } = body

      if (!instanceId) {
        return NextResponse.json({ error: 'instanceId required' }, { status: 400 })
      }

      const success = await cancelApprovalWorkflow(instanceId, reason)
      return NextResponse.json({ success })
    }

    case 'createTemplate': {
      const { name, description, stages, conditions, isDefault } = body

      if (!name || !stages || stages.length === 0) {
        return NextResponse.json({ error: 'name and stages required' }, { status: 400 })
      }

      const { data: template, error } = await supabase
        .from('approval_templates')
        .insert({
          workspace_id: member.workspace_id,
          name,
          description,
          stages,
          conditions,
          is_default: isDefault || false,
          is_active: true,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ template })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
