/**
 * Automation Scheduler (Trigger.dev v3)
 *
 * Hourly cron that checks for due automation rules and triggers
 * content generation for each. Runs as a Trigger.dev scheduled task.
 *
 * Flow:
 * 1. Query automation_rules WHERE status='active' AND next_run_at <= now
 * 2. For each due rule, trigger content-generator-job
 * 3. Update next_run_at based on cron schedule
 */

import { schedules, task } from '@trigger.dev/sdk/v3'
import { createServiceClient } from '@/lib/supabase/service'
import { generateEmbedding } from '@/lib/ai/ai-sdk-client'

// ============================================================================
// Scheduled check: runs every hour at :00
// ============================================================================

export const automationSchedulerTask = schedules.task({
  id: 'automation-scheduler',
  cron: '0 * * * *', // Every hour
  run: async () => {
    const supabase = createServiceClient()
    const now = new Date().toISOString()

    console.log(`[Automation Scheduler] Checking due rules at ${now}`)

    // Find all active rules that are due
    const { data: dueRules, error } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('status', 'active')
      .lte('next_run_at', now)

    if (error) {
      console.error('[Automation Scheduler] Failed to query rules:', error)
      return { success: false, error: error.message }
    }

    if (!dueRules?.length) {
      console.log('[Automation Scheduler] No due rules found')
      return { success: true, processed: 0 }
    }

    console.log(`[Automation Scheduler] Found ${dueRules.length} due rules`)

    let processed = 0
    let failed = 0

    for (const rule of dueRules) {
      try {
        // Trigger content generation for this rule
        await contentGeneratorTask.trigger({
          ruleId: rule.id,
          workspaceId: rule.workspace_id,
          brandId: rule.brand_id,
          type: rule.type,
          config: rule.config,
        })

        // Update the rule: set next_run_at and increment run_count
        const nextRun = computeNextRun(rule.schedule, rule.timezone ?? 'UTC')
        await supabase
          .from('automation_rules')
          .update({
            last_run_at: now,
            next_run_at: nextRun,
            run_count: (rule.run_count ?? 0) + 1,
          })
          .eq('id', rule.id)

        processed++
      } catch (err) {
        console.error(`[Automation Scheduler] Failed to process rule ${rule.id}:`, err)
        failed++
      }
    }

    console.log(`[Automation Scheduler] Done. Processed: ${processed}, Failed: ${failed}`)
    return { success: true, processed, failed }
  },
})

// ============================================================================
// Content Generator Task (triggered by scheduler)
// ============================================================================

interface ContentGeneratorPayload {
  ruleId: string
  workspaceId: string
  brandId: string
  type: string
  config: Record<string, unknown>
}

export const contentGeneratorTask = task({
  id: 'automation-content-generator',
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 30_000,
    maxTimeoutInMs: 300_000,
  },
  run: async (payload: ContentGeneratorPayload) => {
    const { ruleId, workspaceId, brandId, type, config } = payload
    const supabase = createServiceClient()

    console.log(`[Content Generator] Generating for rule ${ruleId} (type: ${type})`)

    // Determine what to generate based on rule type
    const platforms = (config.platforms as string[]) ?? ['linkedin']
    const maxPosts = (config.maxPostsPerRun as number) ?? 1

    try {
      // Import generators dynamically to avoid circular dependencies
      const { generateSocialPostDocuments } = await import('@/lib/assets/social-generator')
      const { getBrandContext } = await import('@/lib/ai/brand-context')

      // Get brand context for generation
      const brand = await getBrandContext(workspaceId, brandId)
      if (!brand) {
        throw new Error(`Brand ${brandId} not found for workspace ${workspaceId}`)
      }

      // Check recent posts for repetition avoidance
      const { data: recentPosts } = await supabase
        .from('asset_documents')
        .select('html, title')
        .eq('workspace_id', workspaceId)
        .eq('brand_id', brandId)
        .eq('asset_type', 'social')
        .order('created_at', { ascending: false })
        .limit(30)

      // Build topic avoidance context from recent posts
      const recentTopics = (recentPosts ?? [])
        .map((p) => (p.title ?? '').toLowerCase())
        .filter(Boolean)
      const avoidTopicsHint = recentTopics.length > 0
        ? `\n\nAVOID these recent topics (already posted):\n${recentTopics.slice(0, 10).map((t) => `- ${t}`).join('\n')}\nGenerate something distinctly different in angle and topic.`
        : ''

      // Build a campaign-shaped object for the generator
      const campaign = {
        id: ruleId,
        workspace_id: workspaceId,
        name: `Auto: ${type}`,
        status: 'active',
        audience: null,
        goal: 'engagement',
        offer: (brand.messaging?.keyMessages?.[0] ?? brand.name) + avoidTopicsHint,
        cta: 'Learn more',
        constraints: null,
        selected_angle_id: null,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as unknown as Parameters<typeof generateSocialPostDocuments>[0]

      // Generate social post documents with visual rendering
      const docs = await generateSocialPostDocuments(
        campaign,
        workspaceId,
        brandId,
        platforms as Array<'linkedin' | 'twitter' | 'facebook' | 'instagram' | 'tiktok'>,
        { variants: maxPosts },
        undefined // no campaignId for automation
      )

      const similarityThreshold = typeof config.similarityThreshold === 'number'
        ? config.similarityThreshold
        : 0.9
      const recentCorpus = (recentPosts ?? [])
        .map((p) => `${p.title ?? ''} ${extractText(p.html ?? '')}`.trim())
        .filter((text) => text.length > 10)
        .slice(0, 20)
      const recentEmbeddings = await getEmbeddingsSafe(recentCorpus)

      // Create scheduled_content entries (pending_review — never auto-publish)
      let createdCount = 0
      let skippedAsDuplicate = 0
      for (const doc of docs) {
        const docText = `${doc.title ?? ''} ${extractText(doc.html)}`.trim()
        const docEmbedding = (await getEmbeddingsSafe([docText]))[0]
        if (docEmbedding && recentEmbeddings.length > 0) {
          const maxSimilarity = Math.max(
            ...recentEmbeddings.map((embedding) => cosineSimilarity(docEmbedding, embedding))
          )
          if (maxSimilarity >= similarityThreshold) {
            skippedAsDuplicate++
            continue
          }
        }

        // Persist the asset document
        await supabase.from('asset_documents').upsert({
          id: doc.id,
          workspace_id: doc.workspaceId,
          brand_id: doc.brandId || null,
          asset_type: doc.type,
          channel: doc.channel ?? null,
          html: doc.html,
          blocks_json: doc.blocks,
          design_tokens: doc.designTokens,
          claims_json: doc.claims,
          evidence_json: doc.evidenceRefs,
          compliance_status: doc.complianceStatus,
          dimensions: doc.dimensions ?? null,
          rendered_image_url: doc.renderedImageUrl ?? null,
          render_variants: doc.renderVariants ?? [],
          revision: doc.revision,
          status: doc.status,
          title: doc.title ?? null,
          description: doc.description ?? null,
        })

        // Create scheduled content entry
        const scheduledFor = new Date()
        scheduledFor.setHours(scheduledFor.getHours() + 1) // Schedule 1 hour from now

        await supabase.from('scheduled_content').insert({
          automation_rule_id: ruleId,
          workspace_id: workspaceId,
          asset_document_id: doc.id,
          scheduled_for: scheduledFor.toISOString(),
          status: 'pending_review',
        })
        createdCount++
      }

      console.log(
        `[Content Generator] Created ${createdCount} items for rule ${ruleId} (skipped duplicates: ${skippedAsDuplicate})`
      )
      return { success: true, count: createdCount, skippedAsDuplicate }
    } catch (err) {
      console.error(`[Content Generator] Failed for rule ${ruleId}:`, err)
      throw err // Let Trigger.dev retry handle it
    }
  },
})

// ============================================================================
// Cron helpers
// ============================================================================

function computeNextRun(cronExpression: string, timezone: string): string {
  // Parse common cron patterns for next execution
  // In production, use a cron parser library like 'cron-parser'
  const parts = cronExpression.split(' ')
  const minute = parseInt(parts[0] ?? '0', 10)
  const hour = parseInt(parts[1] ?? '*', 10)
  const dayOfWeek = parts[4] ?? '*'

  const now = new Date()
  const next = new Date(now)

  if (!isNaN(hour)) {
    // Daily at specific hour
    next.setHours(hour, minute, 0, 0)
    if (next <= now) {
      next.setDate(next.getDate() + 1)
    }

    // Handle day-of-week restrictions (e.g., '1-5' for weekdays)
    if (dayOfWeek !== '*') {
      const allowedDays = parseDaysOfWeek(dayOfWeek)
      let attempts = 0
      while (!allowedDays.includes(next.getDay()) && attempts < 7) {
        next.setDate(next.getDate() + 1)
        attempts++
      }
    }
  } else {
    // Hourly — run next hour at specified minute
    next.setMinutes(minute, 0, 0)
    if (next <= now) {
      next.setHours(next.getHours() + 1)
    }
  }

  return next.toISOString()
}

function parseDaysOfWeek(daySpec: string): number[] {
  // Handle ranges like '1-5' (Mon-Fri) and lists like '1,3,5'
  const days: number[] = []

  for (const part of daySpec.split(',')) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number)
      for (let d = start; d <= end; d++) {
        days.push(d)
      }
    } else {
      days.push(parseInt(part, 10))
    }
  }

  return days
}

function extractText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)
}

async function getEmbeddingsSafe(texts: string[]): Promise<number[][]> {
  if (!texts.length) return []
  const embeddings = await Promise.all(
    texts.map(async (text) => {
      try {
        return await generateEmbedding(text)
      } catch {
        return null
      }
    })
  )
  return embeddings.filter((item): item is number[] => Array.isArray(item) && item.length > 0)
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < len; i++) {
    const av = a[i]
    const bv = b[i]
    dot += av * bv
    normA += av * av
    normB += bv * bv
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (!denom) return 0
  return dot / denom
}
