/**
 * Approval Workflows API
 * 
 * GET /api/approvals - Get approval templates
 * POST /api/approvals - Create approval request or template
 * PATCH /api/approvals - Update approval (submit action)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  getApprovalTemplates,
  createApprovalTemplate,
  updateApprovalTemplate,
  deleteApprovalTemplate,
  createApprovalRequest,
  getApprovalRequest,
  submitApproval,
  selectTemplateForCampaign,
  DEFAULT_TEMPLATES,
} from '@/lib/workflows/approval-templates'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    // If campaignId provided, get approval request for that campaign
    if (campaignId) {
      const request = await getApprovalRequest(campaignId)
      return NextResponse.json({
        success: true,
        request,
      })
    }

    // Otherwise, get all templates
    const templates = await getApprovalTemplates(membership.workspace_id)

    // If no templates exist, return defaults as suggestions
    const suggestedTemplates = templates.length === 0 ? DEFAULT_TEMPLATES : []

    return NextResponse.json({
      success: true,
      templates,
      suggestedTemplates,
    })
  } catch (error) {
    console.error('Error fetching approvals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const body = await request.json()
    const { action } = body

    // Create approval request for a campaign
    if (action === 'create_request') {
      const { campaignId, templateId, category, riskScore } = body

      if (!campaignId) {
        return NextResponse.json(
          { error: 'campaignId is required' },
          { status: 400 }
        )
      }

      // Select template if not provided
      let selectedTemplateId = templateId
      if (!selectedTemplateId) {
        const template = await selectTemplateForCampaign(
          membership.workspace_id,
          category,
          riskScore
        )
        if (!template) {
          return NextResponse.json(
            { error: 'No approval template found' },
            { status: 404 }
          )
        }
        selectedTemplateId = template.id
      }

      const approvalRequest = await createApprovalRequest(campaignId, selectedTemplateId)

      if (!approvalRequest) {
        return NextResponse.json(
          { error: 'Failed to create approval request' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        request: approvalRequest,
      })
    }

    // Create new template
    if (action === 'create_template') {
      if (membership.role !== 'owner' && membership.role !== 'admin') {
        return NextResponse.json(
          { error: 'Only admins can create approval templates' },
          { status: 403 }
        )
      }

      const { name, description, stages, applicableCategories, riskScoreThreshold, isDefault } = body

      if (!name || !stages || stages.length === 0) {
        return NextResponse.json(
          { error: 'name and stages are required' },
          { status: 400 }
        )
      }

      const template = await createApprovalTemplate(membership.workspace_id, {
        name,
        description: description || '',
        isDefault: isDefault || false,
        stages,
        applicableCategories: applicableCategories || [],
        riskScoreThreshold,
      })

      if (!template) {
        return NextResponse.json(
          { error: 'Failed to create template' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        template,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error creating approval:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    const userName = profile?.full_name || user.email || 'Unknown'

    const body = await request.json()
    const { action, requestId, templateId } = body

    // Submit approval action
    if (action === 'approve' || action === 'reject' || action === 'request_changes') {
      if (!requestId) {
        return NextResponse.json(
          { error: 'requestId is required' },
          { status: 400 }
        )
      }

      const success = await submitApproval(
        requestId,
        user.id,
        userName,
        action,
        body.comment
      )

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to submit approval' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }

    // Update template
    if (action === 'update_template') {
      if (!templateId) {
        return NextResponse.json(
          { error: 'templateId is required' },
          { status: 400 }
        )
      }

      const success = await updateApprovalTemplate(templateId, {
        name: body.name,
        description: body.description,
        stages: body.stages,
        applicableCategories: body.applicableCategories,
        riskScoreThreshold: body.riskScoreThreshold,
        isDefault: body.isDefault,
      })

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update template' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error updating approval:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permission
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only admins can delete templates' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      )
    }

    const success = await deleteApprovalTemplate(templateId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
