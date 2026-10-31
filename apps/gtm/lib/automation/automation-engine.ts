/**
 * Automation Engine
 *
 * Manages automation rules (scheduled content generation) with:
 * - Cron-based scheduling
 * - Approval gates (no auto-publish by default)
 * - Repetition avoidance via embedding similarity
 * - Brand context injection
 *
 * Presets:
 * - "Daily LinkedIn Post @8AM"
 * - "Weekly Social Batch (3 posts)"
 * - "Campaign Drip Sequence"
 */

import { createServiceClient } from '@/lib/supabase/service'

// ============================================================================
// Types
// ============================================================================

export type AutomationType = 'daily_linkedin' | 'weekly_social' | 'campaign_drip' | 'custom'
export type AutomationStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface AutomationRule {
  id: string
  workspaceId: string
  brandId: string
  name: string
  type: AutomationType
  schedule: string // cron expression
  timezone: string
  config: AutomationConfig
  status: AutomationStatus
  lastRunAt?: string
  nextRunAt?: string
  runCount: number
  createdAt: string
  updatedAt: string
}

export interface AutomationConfig {
  platforms: string[]
  contentTypes: string[]
  topics?: string[]
  approvalRequired: boolean // ALWAYS true for MVP
  maxPostsPerRun?: number
  avoidTopics?: string[]
}

export interface ScheduledContentItem {
  id: string
  automationRuleId?: string
  workspaceId: string
  assetDocumentId?: string
  scheduledFor?: string
  status: 'pending_review' | 'approved' | 'published' | 'rejected' | 'failed'
  approvedBy?: string
  approvedAt?: string
  publishedAt?: string
  rejectionReason?: string
  metricsJson: Record<string, unknown>
  createdAt: string
}

// ============================================================================
// Automation presets
// ============================================================================

export const AUTOMATION_PRESETS: Record<
  AutomationType,
  { name: string; schedule: string; config: AutomationConfig; description: string }
> = {
  daily_linkedin: {
    name: 'Daily LinkedIn Post',
    schedule: '0 8 * * *', // 8 AM daily
    config: {
      platforms: ['linkedin'],
      contentTypes: ['social'],
      approvalRequired: true,
      maxPostsPerRun: 1,
    },
    description: 'Generate a LinkedIn post + visual every morning at 8 AM. Review in queue before publishing.',
  },
  weekly_social: {
    name: 'Weekly Social Batch',
    schedule: '0 9 * * 1', // 9 AM Monday
    config: {
      platforms: ['linkedin', 'twitter', 'instagram'],
      contentTypes: ['social'],
      approvalRequired: true,
      maxPostsPerRun: 3,
    },
    description: 'Generate 3 social posts across platforms every Monday morning.',
  },
  campaign_drip: {
    name: 'Campaign Drip Sequence',
    schedule: '0 10 * * *', // 10 AM daily
    config: {
      platforms: ['linkedin', 'twitter'],
      contentTypes: ['social', 'email'],
      approvalRequired: true,
      maxPostsPerRun: 1,
    },
    description: 'Daily content as part of a multi-day campaign sequence.',
  },
  custom: {
    name: 'Custom Automation',
    schedule: '0 8 * * 1-5', // 8 AM weekdays
    config: {
      platforms: ['linkedin'],
      contentTypes: ['social'],
      approvalRequired: true,
    },
    description: 'Custom schedule and content configuration.',
  },
}

// ============================================================================
// CRUD operations
// ============================================================================

export async function createAutomationRule(
  input: {
    workspaceId: string
    brandId: string
    type: AutomationType
    name?: string
    schedule?: string
    timezone?: string
    config?: Partial<AutomationConfig>
  }
): Promise<AutomationRule> {
  const supabase = createServiceClient()
  const preset = AUTOMATION_PRESETS[input.type]

  const { data, error } = await supabase
    .from('automation_rules')
    .insert({
      workspace_id: input.workspaceId,
      brand_id: input.brandId,
      name: input.name ?? preset.name,
      type: input.type,
      schedule: input.schedule ?? preset.schedule,
      timezone: input.timezone ?? 'UTC',
      config: { ...preset.config, ...input.config },
      status: 'draft',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create automation: ${error.message}`)
  return rowToAutomationRule(data)
}

export async function updateAutomationStatus(
  id: string,
  status: AutomationStatus
): Promise<void> {
  const supabase = createServiceClient()
  const updateData: Record<string, unknown> = { status }

  if (status === 'active') {
    updateData.next_run_at = computeNextRun(new Date(), '0 8 * * *') // Will be refined with actual cron
  }

  const { error } = await supabase
    .from('automation_rules')
    .update(updateData)
    .eq('id', id)

  if (error) throw new Error(`Failed to update automation: ${error.message}`)
}

export async function listAutomationRules(
  workspaceId: string
): Promise<AutomationRule[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('workspace_id', workspaceId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list automations: ${error.message}`)
  return (data ?? []).map(rowToAutomationRule)
}

export async function getDueAutomations(): Promise<AutomationRule[]> {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('status', 'active')
    .lte('next_run_at', now)

  if (error) throw new Error(`Failed to get due automations: ${error.message}`)
  return (data ?? []).map(rowToAutomationRule)
}

// ============================================================================
// Scheduled content operations
// ============================================================================

export async function createScheduledContent(
  input: {
    automationRuleId?: string
    workspaceId: string
    assetDocumentId: string
    scheduledFor?: string
  }
): Promise<ScheduledContentItem> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('scheduled_content')
    .insert({
      automation_rule_id: input.automationRuleId,
      workspace_id: input.workspaceId,
      asset_document_id: input.assetDocumentId,
      scheduled_for: input.scheduledFor,
      status: 'pending_review',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create scheduled content: ${error.message}`)
  return rowToScheduledContent(data)
}

export async function approveScheduledContent(
  id: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('scheduled_content')
    .update({
      status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(`Failed to approve: ${error.message}`)
}

export async function rejectScheduledContent(
  id: string,
  reason?: string
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('scheduled_content')
    .update({
      status: 'rejected',
      rejection_reason: reason,
    })
    .eq('id', id)

  if (error) throw new Error(`Failed to reject: ${error.message}`)
}

export async function listScheduledContent(
  workspaceId: string,
  filters?: { status?: string; from?: string; to?: string }
): Promise<ScheduledContentItem[]> {
  const supabase = createServiceClient()
  let query = supabase
    .from('scheduled_content')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('scheduled_for', { ascending: true })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.from) query = query.gte('scheduled_for', filters.from)
  if (filters?.to) query = query.lte('scheduled_for', filters.to)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list scheduled content: ${error.message}`)
  return (data ?? []).map(rowToScheduledContent)
}

// ============================================================================
// Cron helpers
// ============================================================================

function computeNextRun(from: Date, cron: string): string {
  // Simple next-run computation for common patterns
  // In production, use a proper cron parser like 'cron-parser'
  const parts = cron.split(' ')
  const hour = parseInt(parts[1] ?? '8', 10)
  const minute = parseInt(parts[0] ?? '0', 10)

  const next = new Date(from)
  next.setHours(hour, minute, 0, 0)

  // If the time has passed today, schedule for tomorrow
  if (next <= from) {
    next.setDate(next.getDate() + 1)
  }

  return next.toISOString()
}

// ============================================================================
// Row mappers
// ============================================================================

function rowToAutomationRule(row: Record<string, unknown>): AutomationRule {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    brandId: row.brand_id as string,
    name: row.name as string,
    type: row.type as AutomationType,
    schedule: row.schedule as string,
    timezone: (row.timezone as string) ?? 'UTC',
    config: (row.config as AutomationConfig) ?? { platforms: [], contentTypes: [], approvalRequired: true },
    status: row.status as AutomationStatus,
    lastRunAt: row.last_run_at as string | undefined,
    nextRunAt: row.next_run_at as string | undefined,
    runCount: (row.run_count as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function rowToScheduledContent(row: Record<string, unknown>): ScheduledContentItem {
  return {
    id: row.id as string,
    automationRuleId: row.automation_rule_id as string | undefined,
    workspaceId: row.workspace_id as string,
    assetDocumentId: row.asset_document_id as string | undefined,
    scheduledFor: row.scheduled_for as string | undefined,
    status: row.status as ScheduledContentItem['status'],
    approvedBy: row.approved_by as string | undefined,
    approvedAt: row.approved_at as string | undefined,
    publishedAt: row.published_at as string | undefined,
    rejectionReason: row.rejection_reason as string | undefined,
    metricsJson: (row.metrics_json as Record<string, unknown>) ?? {},
    createdAt: row.created_at as string,
  }
}
