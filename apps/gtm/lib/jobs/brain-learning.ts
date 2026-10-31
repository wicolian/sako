import { schedules } from '@trigger.dev/sdk/v3'
import { createServiceClient } from '@/lib/supabase/service'
import { updateFactConfidences } from '@/lib/brain/learning'

export const brainLearningTask = schedules.task({
  id: 'brain-learning',
  cron: '0 2 * * *',
  run: async (_payload, { ctx }) => {
    const supabase = createServiceClient()

    const { data: workspaces, error } = await supabase
      .from('campaign_fact_citations')
      .select('workspace_id')

    if (error) {
      throw new Error(`Failed to load workspaces for brain learning: ${error.message}`)
    }

    const workspaceIds = [...new Set((workspaces || []).map((row) => row.workspace_id))]
    const results: Array<{
      workspaceId: string
      updated: number
      reviewed: number
      workspaceAverage: number
    }> = []

    for (const workspaceId of workspaceIds) {
      const result = await updateFactConfidences(workspaceId)
      results.push({ workspaceId, ...result })
    }

    console.log(`[Job ${ctx.run.id}] Brain learning processed ${results.length} workspaces`)

    return {
      processed: results.length,
      results,
    }
  },
})
