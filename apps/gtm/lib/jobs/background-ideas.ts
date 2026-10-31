/**
 * Background Ideas Generation Job (Phase 2.5)
 * 
 * Scheduled Trigger.dev job that generates content ideas while users sleep.
 * "Holo works while you sleep"
 * 
 * Features:
 * - Daily 3 AM UTC scheduled generation
 * - 10-20 ideas per workspace
 * - 7-day idea expiration
 * - Badge notifications for fresh ideas
 * - Escalating retry strategy
 */

import { schedules, task } from '@trigger.dev/sdk/v3'
import { createServiceClient } from '@/lib/supabase/service'
import { generateContentIdeas, cleanupExpiredIdeas } from '@/lib/ai/content-ideas-generator'
import type { ContentIdea } from '@/lib/ai/content-ideas-generator'
import { getBrandContext } from '@/lib/ai/brand-context'

interface BackgroundIdeasPayload {
  workspaceId: string
  brandId?: string
  count?: number
  source?: 'background' | 'manual'
}

// Retry intervals: 60s, 5min, 15min
const RETRY_INTERVALS = [60_000, 300_000, 900_000]

function getAttemptNumber(ctx: { attempt: { number?: number } | number }): number {
  if (typeof ctx.attempt === 'number') return ctx.attempt
  return ctx.attempt.number ?? 1
}

/**
 * Scheduled job to generate content ideas daily at 3 AM UTC
 * Generates 10-20 ideas based on active campaigns
 */
export const backgroundIdeasSchedule = schedules.task({
  id: 'background-ideas-generation',
  cron: '0 3 * * *', // 3 AM UTC daily
  run: async () => {
    const supabase = createServiceClient()
    
    console.log('[Background Ideas] Starting scheduled generation run at', new Date().toISOString())

    // Get all active workspaces with active subscriptions
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select(`
        id,
        name,
        settings,
        subscriptions!inner (
          status,
          plan_id
        )
      `)
      .eq('subscriptions.status', 'active')

    if (error) {
      console.error('[Background Ideas] Failed to fetch workspaces:', error)
      return { success: false, error: error.message }
    }

    if (!workspaces || workspaces.length === 0) {
      console.log('[Background Ideas] No active workspaces found')
      return { success: true, processed: 0 }
    }

    console.log(`[Background Ideas] Found ${workspaces.length} active workspaces`)

    let processed = 0
    let failed = 0
    const results: Array<{ workspaceId: string; ideas: number; error?: string }> = []

    for (const workspace of workspaces) {
      try {
        // Check if workspace has background generation enabled
        const settings = (workspace.settings || {}) as Record<string, unknown>
        if (settings.background_ideas_enabled === false) {
          console.log(`[Background Ideas] Skipping ${workspace.name} - disabled`)
          continue
        }

        // First, clean up expired ideas (> 7 days old)
        const cleanedUp = await cleanupExpiredIdeas(workspace.id)
        if (cleanedUp > 0) {
          console.log(`[Background Ideas] Cleaned up ${cleanedUp} expired ideas for ${workspace.name}`)
        }

        // Get the primary brand for this workspace
        const { data: brand } = await supabase
          .from('brands')
          .select('id, name, industry, tone')
          .eq('workspace_id', workspace.id)
          .eq('is_default', true)
          .single()

        if (!brand) {
          console.log(`[Background Ideas] Skipping ${workspace.name} - no brand`)
          continue
        }

        // Count active campaigns to determine idea count
        const { count: activeCampaigns } = await supabase
          .from('campaigns')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .in('status', ['draft', 'ready', 'live'])

        // Generate 10-20 ideas based on campaign count
        const baseCount = 10
        const campaignBonus = Math.min((activeCampaigns || 0) * 2, 10)
        const ideasCount = baseCount + campaignBonus
        
        console.log(`[Background Ideas] Generating ${ideasCount} ideas for ${workspace.name} (${activeCampaigns} active campaigns)`)
        
        const ideas = await generateContentIdeas({
          workspaceId: workspace.id,
          brandContext: {
            name: brand.name,
            industry: brand.industry,
            tone: brand.tone,
          },
        }, ideasCount)

        console.log(`[Background Ideas] Generated ${ideas.length} ideas for ${workspace.name}`)
        
        // Store notification for badge
        await supabase.from('notifications').insert({
          workspace_id: workspace.id,
          type: 'new_ideas',
          title: 'Fresh ideas ready!',
          message: `${ideas.length} new content ideas generated overnight`,
          metadata: { count: ideas.length, generatedAt: new Date().toISOString() },
          is_read: false,
        })

        processed++
        results.push({ workspaceId: workspace.id, ideas: ideas.length })

      } catch (err) {
        console.error(`[Background Ideas] Failed for workspace ${workspace.id}:`, err)
        failed++
        results.push({ workspaceId: workspace.id, ideas: 0, error: (err as Error).message })
      }
    }

    console.log(`[Background Ideas] Completed. Processed: ${processed}, Failed: ${failed}`)

    return {
      success: true,
      processed,
      failed,
      total: workspaces.length,
      results,
      completedAt: new Date().toISOString(),
    }
  },
})

/**
 * On-demand task to generate ideas for a specific workspace
 * Escalating retry: 60s -> 5min -> 15min
 */
export const generateIdeasTask = task({
  id: 'generate-ideas-on-demand',
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: RETRY_INTERVALS[0],
    maxTimeoutInMs: RETRY_INTERVALS[2],
    factor: 5, // Escalating factor
  },
  run: async (payload: BackgroundIdeasPayload, { ctx }) => {
    const { workspaceId, brandId, count = 15, source = 'manual' } = payload
    const supabase = createServiceClient()
    const attemptNumber = getAttemptNumber(ctx as { attempt: { number?: number } | number })

    console.log(
      `[Generate Ideas ${ctx.run.id}] Starting for workspace ${workspaceId}, attempt ${attemptNumber}`
    )

    try {
      // Get brand context if brandId provided
      let brandContext
      if (brandId) {
        const { data: brand } = await supabase
          .from('brands')
          .select('name, industry, tone, target_audience')
          .eq('id', brandId)
          .single()
        
        if (brand) {
          brandContext = {
            name: brand.name,
            industry: brand.industry,
            tone: brand.tone,
            targetAudience: brand.target_audience,
          }
        }
      }

      const ideas = await generateContentIdeas({
        workspaceId,
        brandContext,
      }, count)

      console.log(`[Generate Ideas ${ctx.run.id}] Generated ${ideas.length} ideas`)

      // Create notification for user
      if (source === 'manual') {
        await supabase.from('notifications').insert({
          workspace_id: workspaceId,
          type: 'ideas_ready',
          title: 'Ideas generated!',
          message: `${ideas.length} new content ideas are ready for review`,
          metadata: { count: ideas.length, source },
          is_read: false,
        })
      }

      return {
        success: true,
        ideasGenerated: ideas.length,
        source,
        attempt: attemptNumber,
      }
    } catch (error) {
      console.error(`[Generate Ideas ${ctx.run.id}] Failed on attempt ${attemptNumber}:`, error)
      
      // Log retry attempt
      if (attemptNumber < 3) {
        const nextRetry = RETRY_INTERVALS[attemptNumber] / 1000
        console.log(`[Generate Ideas ${ctx.run.id}] Will retry in ${nextRetry}s`)
      }
      
      throw error
    }
  },
})

/**
 * Task to generate variations of an existing idea
 */
export const generateVariationsTask = task({
  id: 'generate-idea-variations',
  run: async (payload: { ideaId: string; count?: number }, { ctx }) => {
    const { ideaId, count = 3 } = payload
    const supabase = createServiceClient()

    console.log(`[Variations ${ctx.run.id}] Generating ${count} variations for idea ${ideaId}`)

    // Get the original idea
    const { data: originalIdea, error } = await supabase
      .from('content_ideas')
      .select('*')
      .eq('id', ideaId)
      .single()

    if (error || !originalIdea) {
      throw new Error(`Idea not found: ${ideaId}`)
    }

    // Generate variations using the content ideas generator
    const { generateIdeaVariations } = await import('@/lib/ai/content-ideas-generator')
    const variations = await generateIdeaVariations(originalIdea as ContentIdea, count)

    console.log(`[Variations ${ctx.run.id}] Generated ${variations.length} variations`)

    return {
      success: true,
      variationsGenerated: variations.length,
    }
  },
})

/**
 * Task to clean up old skipped ideas (> 30 days)
 */
export const cleanupOldIdeasTask = task({
  id: 'cleanup-old-ideas',
  run: async () => {
    const supabase = createServiceClient()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data, error } = await supabase
      .from('content_ideas')
      .delete()
      .eq('status', 'skipped')
      .lt('reviewed_at', thirtyDaysAgo.toISOString())
      .select('id')

    if (error) {
      throw error
    }

    return {
      success: true,
      deletedCount: data?.length || 0,
    }
  },
})

/**
 * Helper to trigger idea generation for a workspace
 */
export async function triggerIdeaGeneration(
  workspaceId: string,
  options?: {
    brandId?: string
    count?: number
  }
): Promise<{ success: boolean; runId?: string; error?: string }> {
  try {
    const run = await generateIdeasTask.trigger({
      workspaceId,
      brandId: options?.brandId,
      count: options?.count || 15,
    })

    return {
      success: true,
      runId: run.id,
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}
