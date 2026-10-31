/**
 * Review Queue API
 *
 * GET /api/review-queue - Normalized list of campaigns/assets pending human review
 *
 * Returns workspace-scoped approval requests that are in 'pending' status,
 * enriched with campaign name, current stage info, and reviewer assignment.
 * This is the canonical read endpoint for the /reviews UI.
 *
 * Decision submission stays on PATCH /api/approvals with { action, requestId, comment }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { ApprovalStage, ApprovalStageStatus } from '@/lib/workflows/approval-templates'

export interface ReviewQueueItem {
  /** Approval request ID — pass as requestId when submitting a decision */
  requestId: string
  campaignId: string
  campaignName: string
  campaignStatus: string
  /** Stage the item is currently awaiting review at */
  currentStage: {
    index: number
    name: string
    instructions: string | undefined
    requiredApprovers: number
    approverRoles: string[]
    approvalsReceived: number
    escalationHours: number | undefined
    startedAt: string | undefined
  }
  totalStages: number
  overallStatus: 'pending' | 'approved' | 'rejected' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Fetch pending approval requests for this workspace via their campaign
    const { data: requests, error } = await supabase
      .from('approval_requests')
      .select(
        `
        id,
        campaign_id,
        current_stage_index,
        status,
        stages,
        created_at,
        updated_at,
        approval_templates!inner(stages, workspace_id),
        campaigns!inner(name, status, workspace_id)
      `
      )
      .eq('status', 'pending')
      .eq('campaigns.workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Review queue fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch review queue' }, { status: 500 })
    }

    const items: ReviewQueueItem[] = (requests ?? []).map((row) => {
      const stageStatuses = row.stages as ApprovalStageStatus[]
      const templateStages = (row.approval_templates as unknown as { stages: ApprovalStage[] }).stages
      const stageIndex = row.current_stage_index as number
      const currentStageStatus = stageStatuses[stageIndex]
      const currentTemplateStage = templateStages[stageIndex]
      const campaign = row.campaigns as unknown as { name: string; status: string }

      const approvalsReceived = (currentStageStatus?.approvals ?? []).filter(
        (a) => a.action === 'approve'
      ).length

      return {
        requestId: row.id as string,
        campaignId: row.campaign_id as string,
        campaignName: campaign.name,
        campaignStatus: campaign.status,
        currentStage: {
          index: stageIndex,
          name: currentTemplateStage?.name ?? `Stage ${stageIndex + 1}`,
          instructions: currentTemplateStage?.instructions,
          requiredApprovers: currentTemplateStage?.requiredApprovers ?? 1,
          approverRoles: currentTemplateStage?.approverRoles ?? [],
          approvalsReceived,
          escalationHours: currentTemplateStage?.escalationHours,
          startedAt: currentStageStatus?.startedAt,
        },
        totalStages: templateStages.length,
        overallStatus: row.status as ReviewQueueItem['overallStatus'],
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }
    })

    return NextResponse.json({ items, total: items.length })
  } catch (error) {
    console.error('Review queue error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
