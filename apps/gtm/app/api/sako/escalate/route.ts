import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireWorkspaceEntitlement } from '@/lib/billing/entitlements'
import {
  createSakoTask,
  type TaskPriority,
  type TaskType,
} from '@/lib/sako/client'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceContext } from '@/lib/workspace'

const SendSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    composerDocumentId: z.string().uuid().optional(),
    versionId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    reason: z.string().trim().min(1).max(5000).optional(),
    notes: z.string().trim().max(5000).optional(),
    additionalNotes: z.string().trim().max(5000).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent', 'rush']).optional(),
    taskType: z
      .enum(['design_refinement', 'full_redesign', 'copywriting', 'brand_refresh'])
      .optional(),
    idempotencyKey: z.string().trim().min(8).max(255).optional(),
    versionLabel: z.string().trim().max(80).optional(),
  })
  .refine((value) => value.campaignId || value.composerDocumentId, {
    message: 'campaignId or composerDocumentId is required',
  })

interface SendLogContext {
  workspaceId: string
  userId: string
  campaignId?: string
  composerDocumentId?: string
  composerVersionId?: string
  idempotencyKey?: string
  taskId?: string
  sendId?: string
  error?: string
  durationMs?: number
}

interface ComposerDocumentRecord {
  id: string
  workspace_id: string
  campaign_id?: string | null
  title: string
  asset_type: 'landing' | 'deck' | 'social' | 'email' | 'other'
}

interface ComposerVersionRecord {
  id: string
  document_id: string
  workspace_id: string
  version_number: number
  version_label?: string | null
  snapshot_html?: string | null
  snapshot_json: Record<string, unknown>
}

interface CampaignVersionRow {
  id: string
  version_number: number
  snapshot: Record<string, unknown>
}

function toCampaignVersionRow(value: unknown): CampaignVersionRow | null {
  if (!value || typeof value !== 'object') return null

  const row = value as Record<string, unknown>
  if (
    typeof row.id !== 'string' ||
    typeof row.version_number !== 'number' ||
    !row.snapshot ||
    typeof row.snapshot !== 'object'
  ) {
    return null
  }

  return {
    id: row.id,
    version_number: row.version_number,
    snapshot: row.snapshot as Record<string, unknown>,
  }
}

function logSend(event: 'send_attempt' | 'send_success' | 'send_failure', context: SendLogContext) {
  const metric =
    event === 'send_attempt'
      ? { sends_total: 1 }
      : event === 'send_failure'
      ? { sends_failed_total: 1 }
      : { sends_success_total: 1 }

  console.log(
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...metric,
      send_latency_ms: context.durationMs,
      ...context,
    })
  )
}

export function deriveComposerSendIdempotencyKey(params: {
  workspaceId: string
  composerDocumentId: string
  composerVersionId: string
  explicitKey?: string
}): string {
  if (params.explicitKey?.trim()) {
    return params.explicitKey.trim()
  }

  return createHash('sha256')
    .update(`${params.workspaceId}:${params.composerDocumentId}:${params.composerVersionId}`)
    .digest('hex')
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizePriority(priority: z.infer<typeof SendSchema>['priority']): TaskPriority {
  if (priority === 'rush') return 'high'
  if (priority === 'low' || priority === 'high' || priority === 'urgent') return priority
  return 'normal'
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

async function resolveWorkspacePlan(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string
) {
  const gate = await requireWorkspaceEntitlement(workspaceId, 'sakoEscalation', {
    message: 'Send to Sako requires an active Growth or Enterprise plan.',
  })

  return {
    allowed: gate.ok,
    planId: gate.entitlements.planId,
    subscriptionStatus: gate.entitlements.subscriptionStatus,
    reason: gate.ok ? undefined : gate.message,
  }
}

function generateSnapshotHtml(payload: {
  campaignName: string
  heroHeadline?: string
  heroSubheadline?: string
  blocks: Array<{ type: string; props: Record<string, unknown> }>
}): string {
  const sections = payload.blocks
    .map((block) => {
      const props = block.props || {}
      if (block.type === 'hero') {
        const headline = String(props.headline || payload.heroHeadline || payload.campaignName)
        const subheadline = String(props.subheadline || payload.heroSubheadline || '')

        return `<section class="hero"><h1>${escapeHtml(headline)}</h1><p>${escapeHtml(
          subheadline
        )}</p></section>`
      }

      if (block.type === 'text') {
        return `<section class="text"><p>${escapeHtml(String(props.content || ''))}</p></section>`
      }

      if (block.type === 'image' && typeof props.src === 'string') {
        const alt = typeof props.alt === 'string' ? props.alt : ''
        return `<section class="image"><img src="${escapeHtml(props.src)}" alt="${escapeHtml(
          alt
        )}" /></section>`
      }

      return `<section class="block"><h2>${escapeHtml(block.type)}</h2><pre>${escapeHtml(
        JSON.stringify(props, null, 2)
      )}</pre></section>`
    })
    .join('\n')

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(payload.campaignName)}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 24px; color: #0f172a; }
      .hero { padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px; }
      h1 { margin: 0 0 8px; font-size: 32px; }
      p { margin: 0; color: #475569; }
      .block, .text, .image { margin-bottom: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; }
      img { max-width: 100%; height: auto; border-radius: 8px; }
      pre { white-space: pre-wrap; margin: 0; font-size: 12px; }
    </style>
  </head>
  <body>${sections}</body>
</html>`
}

async function resolveCampaign(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  campaignId?: string
): Promise<{
  id: string
  workspace_id: string
  name: string
  brand_id?: string | null
  audience?: string | null
  goal?: string | null
  offer?: string | null
  cta?: string | null
  current_version?: number | null
  version?: number | null
} | null> {
  if (!campaignId) return null

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, workspace_id, name, brand_id, audience, goal, offer, cta, current_version, version')
    .eq('id', campaignId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !campaign) {
    return null
  }

  return campaign
}

async function resolveComposerDocument(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    workspaceId: string
    userId: string
    composerDocumentId?: string
    campaign?: Awaited<ReturnType<typeof resolveCampaign>>
    title?: string
  }
): Promise<ComposerDocumentRecord> {
  if (params.composerDocumentId) {
    const { data: existing, error } = await supabase
      .from('composer_documents')
      .select('*')
      .eq('id', params.composerDocumentId)
      .eq('workspace_id', params.workspaceId)
      .single()

    if (error) {
      throw new Error(`Failed to load composer document: ${error.message}`)
    }

    if (!existing) {
      throw new Error('Composer document not found')
    }

    return existing as ComposerDocumentRecord
  }

  if (!params.campaign) {
    throw new Error('Campaign not found')
  }

  const { data: existing } = await supabase
    .from('composer_documents')
    .select('*')
    .eq('workspace_id', params.workspaceId)
    .eq('campaign_id', params.campaign.id)
    .maybeSingle()

  if (existing) {
    return existing as ComposerDocumentRecord
  }

  const { data: created, error: createError } = await supabase
    .from('composer_documents')
    .insert({
      workspace_id: params.workspaceId,
      campaign_id: params.campaign.id,
      title: params.title || params.campaign.name,
      asset_type: 'landing',
      metadata: {
        source: 'campaign',
      },
      created_by: params.userId,
    })
    .select('*')
    .single()

  if (createError || !created) {
    throw new Error(`Failed to create composer document: ${createError?.message}`)
  }

  return created as ComposerDocumentRecord
}

async function resolveComposerVersion(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    workspaceId: string
    userId: string
    document: ComposerDocumentRecord
    campaign: Awaited<ReturnType<typeof resolveCampaign>>
    versionId?: string
    versionLabel?: string
  }
): Promise<ComposerVersionRecord> {
  if (params.versionId) {
    const { data: existingVersion, error: existingVersionError } = await supabase
      .from('composer_document_versions')
      .select('*')
      .eq('id', params.versionId)
      .eq('workspace_id', params.workspaceId)
      .eq('document_id', params.document.id)
      .maybeSingle()

    if (existingVersionError) {
      throw new Error(`Failed to load composer document version: ${existingVersionError.message}`)
    }

    if (existingVersion) {
      return existingVersion as ComposerVersionRecord
    }
  }

  const { data: blocks } = params.campaign
    ? await supabase
        .from('page_blocks')
        .select('type, props, order')
        .eq('campaign_id', params.campaign.id)
        .order('order', { ascending: true })
    : { data: [] }

  let campaignVersionRow: CampaignVersionRow | null = null

  if (params.campaign) {
    if (params.versionId) {
      const { data: byId } = await supabase
        .from('campaign_versions')
        .select('id, version_number, snapshot')
        .eq('id', params.versionId)
        .eq('campaign_id', params.campaign.id)
        .maybeSingle()
      campaignVersionRow = toCampaignVersionRow(byId as unknown)
    }

    if (!campaignVersionRow) {
      const selectedVersionNumber = params.campaign.current_version || params.campaign.version
      const { data: byNumber } = await supabase
        .from('campaign_versions')
        .select('id, version_number, snapshot')
        .eq('campaign_id', params.campaign.id)
        .eq('version_number', selectedVersionNumber || 1)
        .maybeSingle()

      campaignVersionRow = toCampaignVersionRow(byNumber as unknown)
    }

    if (!campaignVersionRow) {
      const { data: latest } = await supabase
        .from('campaign_versions')
        .select('id, version_number, snapshot')
        .eq('campaign_id', params.campaign.id)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      campaignVersionRow = toCampaignVersionRow(latest as unknown)
    }
  }

  if (campaignVersionRow) {
    const { data: existingMapped } = await supabase
      .from('composer_document_versions')
      .select('*')
      .eq('document_id', params.document.id)
      .eq('source_campaign_version_id', campaignVersionRow.id)
      .maybeSingle()

    if (existingMapped) {
      return existingMapped as ComposerVersionRecord
    }
  }

  const { data: latestComposerVersion } = await supabase
    .from('composer_document_versions')
    .select('version_number')
    .eq('document_id', params.document.id)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersionNumber = (latestComposerVersion?.version_number || 0) + 1

  const campaignSnapshot = (campaignVersionRow?.snapshot || {}) as Record<string, unknown>

  const campaignName =
    params.campaign?.name ||
    (typeof campaignSnapshot.name === 'string'
      ? campaignSnapshot.name
      : params.document.title)

  const snapshotBlocks = (blocks || []).map((block) => ({
    type: String(block.type),
    props: (block.props || {}) as Record<string, unknown>,
  }))

  const snapshotJson: Record<string, unknown> = {
    campaign: campaignVersionRow?.snapshot || params.campaign,
    blocks: snapshotBlocks,
    generatedAt: new Date().toISOString(),
  }

  const snapshotHtml = generateSnapshotHtml({
    campaignName,
    heroHeadline:
      typeof campaignSnapshot.offer === 'string'
        ? campaignSnapshot.offer
        : params.campaign?.offer || undefined,
    heroSubheadline:
      typeof campaignSnapshot.goal === 'string'
        ? campaignSnapshot.goal
        : params.campaign?.goal || undefined,
    blocks: snapshotBlocks,
  })

  const { data: createdVersion, error: createVersionError } = await supabase
    .from('composer_document_versions')
    .insert({
      workspace_id: params.workspaceId,
      document_id: params.document.id,
      version_number: nextVersionNumber,
      version_label:
        params.versionLabel ||
        (campaignVersionRow ? `v${campaignVersionRow.version_number}` : `v${nextVersionNumber}`),
      source_campaign_version_id: campaignVersionRow?.id || null,
      snapshot_html: snapshotHtml,
      snapshot_json: snapshotJson,
      metadata: {
        campaignId: params.campaign?.id,
      },
      created_by: params.userId,
    })
    .select('*')
    .single()

  if (createVersionError || !createdVersion) {
    throw new Error(`Failed to create composer document version: ${createVersionError?.message}`)
  }

  return createdVersion as ComposerVersionRecord
}

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('does not exist') ||
    lower.includes('relation') ||
    lower.includes('composer_documents') ||
    lower.includes('composer_sends') ||
    lower.includes('task_composer_snapshots')
  )
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  const supabase = createServiceClient()

  let sendId: string | undefined
  let logContext: SendLogContext | undefined

  try {
    const { workspaceId, userId } = getWorkspaceContext(request)
    const payload = SendSchema.parse(await request.json())

    logContext = {
      workspaceId,
      userId,
      campaignId: payload.campaignId,
      composerDocumentId: payload.composerDocumentId,
    }

    logSend('send_attempt', logContext)

    const plan = await resolveWorkspacePlan(supabase, workspaceId)
    if (!plan.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: plan.reason || 'Your plan does not allow Send to Sako',
          planId: plan.planId,
          subscriptionStatus: plan.subscriptionStatus,
        },
        { status: 403 }
      )
    }

    let campaign = await resolveCampaign(supabase, workspaceId, payload.campaignId)
    if (payload.campaignId && !campaign) {
      return NextResponse.json(
        { success: false, message: 'Campaign not found or access denied' },
        { status: 404 }
      )
    }

    const document = await resolveComposerDocument(supabase, {
      workspaceId,
      userId,
      composerDocumentId: payload.composerDocumentId,
      campaign,
      title: payload.title,
    })

    if (!campaign && document.campaign_id) {
      campaign = await resolveCampaign(supabase, workspaceId, document.campaign_id)
    }

    if (!campaign) {
      return NextResponse.json(
        {
          success: false,
          message: 'Send to Sako currently requires a campaign-backed composer document',
        },
        { status: 400 }
      )
    }

    const version = await resolveComposerVersion(supabase, {
      workspaceId,
      userId,
      document,
      campaign,
      versionId: payload.versionId,
      versionLabel: payload.versionLabel,
    })

    const idempotencyKey = deriveComposerSendIdempotencyKey({
      workspaceId,
      composerDocumentId: document.id,
      composerVersionId: version.id,
      explicitKey: payload.idempotencyKey,
    })

    logContext = {
      ...logContext,
      composerDocumentId: document.id,
      composerVersionId: version.id,
      idempotencyKey,
    }

    const { data: existingSend } = await supabase
      .from('composer_sends')
      .select('id, task_id, status, created_at')
      .eq('workspace_id', workspaceId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existingSend?.task_id) {
      const durationMs = Date.now() - startedAt
      logSend('send_success', {
        ...logContext,
        sendId: existingSend.id,
        taskId: existingSend.task_id,
        durationMs,
      })

      return NextResponse.json({
        success: true,
        isDuplicate: true,
        sendId: existingSend.id,
        taskId: existingSend.task_id,
        taskUrlClient: `/sako/tasks/${existingSend.task_id}`,
        taskUrlStudio: `/studio/tasks/${existingSend.task_id}`,
        message: 'This version was already sent to Sako',
      })
    }

    const reason = payload.reason || payload.notes || payload.additionalNotes || 'Composer handoff'
    const priority = normalizePriority(payload.priority)
    const taskType = (payload.taskType || 'design_refinement') as TaskType

    const { data: sendRow, error: sendInsertError } = await supabase
      .from('composer_sends')
      .insert({
        workspace_id: workspaceId,
        document_id: document.id,
        version_id: version.id,
        idempotency_key: idempotencyKey,
        status: 'processing',
        metadata: {
          campaignId: campaign?.id,
          taskType,
          priority,
        },
        created_by: userId,
      })
      .select('id')
      .single()

    if (sendInsertError) {
      const duplicateRace =
        sendInsertError.code === '23505' || sendInsertError.message.toLowerCase().includes('duplicate')

      if (duplicateRace) {
        const { data: raced } = await supabase
          .from('composer_sends')
          .select('id, task_id')
          .eq('workspace_id', workspaceId)
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle()

        if (raced?.task_id) {
          return NextResponse.json({
            success: true,
            isDuplicate: true,
            sendId: raced.id,
            taskId: raced.task_id,
            taskUrlClient: `/sako/tasks/${raced.task_id}`,
            taskUrlStudio: `/studio/tasks/${raced.task_id}`,
            message: 'This version was already sent to Sako',
          })
        }
      }

      throw new Error(`Failed to create send record: ${sendInsertError.message}`)
    }

    sendId = sendRow.id

    const snapshotHtml = version.snapshot_html || '<!doctype html><html><body><p>No snapshot</p></body></html>'
    const snapshotJson = version.snapshot_json || {}

    const { data: composerSnapshot, error: composerSnapshotError } = await supabase
      .from('composer_snapshots')
      .insert({
        workspace_id: workspaceId,
        campaign_id: campaign.id,
        version_number: version.version_number,
        version_label: version.version_label,
        html_content: snapshotHtml,
        json_content: snapshotJson,
        asset_type: document.asset_type,
        metadata: {
          composerDocumentId: document.id,
          composerVersionId: version.id,
          sendId,
        },
        created_by: userId,
      })
      .select('id')
      .single()

    if (composerSnapshotError || !composerSnapshot) {
      throw new Error(`Failed to create composer snapshot: ${composerSnapshotError?.message}`)
    }

    const task = await createSakoTask({
      campaignId: campaign.id,
      workspaceId,
      type: taskType,
      title: payload.title || `Send to Sako: ${document.title}`,
      reason,
      brief: [
        `Composer document: ${document.title}`,
        `Version: ${version.version_label || `v${version.version_number}`}`,
        `Asset type: ${document.asset_type}`,
        payload.additionalNotes ? `Notes: ${payload.additionalNotes}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      currentHtml: snapshotHtml,
      brandId: campaign?.brand_id || undefined,
      priority,
      idempotencyKey,
      createdBy: userId,
    })

    await Promise.all([
      supabase
        .from('sako_tasks')
        .update({
          source: 'composer',
          asset_type: document.asset_type,
          snapshot_id: composerSnapshot.id,
          idempotency_key: idempotencyKey,
          metadata: {
            composerDocumentId: document.id,
            composerVersionId: version.id,
            sendId,
            sentAt: new Date().toISOString(),
            sentBy: userId,
          },
        })
        .eq('id', task.id),
      supabase
        .from('task_composer_snapshots')
        .insert({
          workspace_id: workspaceId,
          task_id: task.id,
          document_id: document.id,
          version_id: version.id,
          html_content: snapshotHtml,
          json_content: snapshotJson,
          metadata: {
            composerSnapshotId: composerSnapshot.id,
            source: 'send_to_sako',
          },
        }),
      supabase
        .from('composer_sends')
        .update({
          task_id: task.id,
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sendId),
      (async () => {
        try {
          await supabase.from('escalations').insert({
            workspace_id: workspaceId,
            campaign_id: campaign.id,
            sako_task_id: task.id,
            idempotency_key: idempotencyKey,
            reason,
            priority,
            status: 'completed',
            created_by: userId,
            completed_at: new Date().toISOString(),
          })
        } catch {
          // Best effort audit trail; do not fail send flow.
        }
      })(),
    ])

    const durationMs = Date.now() - startedAt

    logSend('send_success', {
      ...logContext,
      sendId,
      taskId: task.id,
      durationMs,
    })

    return NextResponse.json({
      success: true,
      sendId,
      taskId: task.id,
      snapshotId: composerSnapshot.id,
      status: task.status,
      taskUrlClient: `/sako/tasks/${task.id}`,
      taskUrlStudio: `/studio/tasks/${task.id}`,
      estimatedDelivery: task.estimatedDelivery?.toISOString(),
    })
  } catch (error) {
    const durationMs = Date.now() - startedAt
    const message = extractErrorMessage(error)

    if (sendId) {
      await supabase
        .from('composer_sends')
        .update({
          status: 'failed',
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sendId)
    }

    logSend('send_failure', {
      ...(logContext || { workspaceId: 'unknown', userId: 'unknown' }),
      sendId,
      error: message,
      durationMs,
    })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: error.issues[0]?.message || 'Invalid request payload',
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.name === 'WorkspaceError') {
      return NextResponse.json(
        {
          success: false,
          message: error.message || 'Unauthorized',
        },
        { status: 401 }
      )
    }

    if (isMissingRelationError(message)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Send to Sako database tables are missing. Apply migrations 067 and 068 and retry.',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    )
  }
}
