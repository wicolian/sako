import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  fetchPerformanceForFeedback,
  generatePageBlocks,
  StructuredGenerationRoutingError,
  type Evidence,
} from '@/lib/ai/ai-sdk-client'
import { withAIContext, type WorkspaceOpenRouterSettings } from '@/lib/ai/context'
import type { ModelPreferences } from '@/lib/ai/openrouter'

async function loadWorkspaceAIContext(
  supabase: ReturnType<typeof createServiceClient>,
  workspaceId: string,
): Promise<{
  settings?: WorkspaceOpenRouterSettings
  modelPreferences?: ModelPreferences
}> {
  try {
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single()

    const settings = workspace?.settings as {
      openrouter?: WorkspaceOpenRouterSettings & { modelPreferences?: ModelPreferences }
    } | null
    const openrouter = settings?.openrouter
    return {
      settings: openrouter,
      modelPreferences: openrouter?.modelPreferences,
    }
  } catch {
    return {}
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId, pageGoal } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Missing campaign ID' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get campaign details
    const { data: campaignData, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    const campaign = campaignData as { 
      audience: string
      goal: string
      offer: string
      cta: string
      workspace_id: string 
    } | null

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get workspace settings
    let forbiddenPhrases: string[] = []
    let brandVoice: string | undefined

    const { data: settingsData } = await supabase
      .from('workspace_settings')
      .select('forbidden_phrases, brand_voice')
      .eq('workspace_id', campaign.workspace_id)
      .single()

    if (settingsData) {
      const settings = settingsData as { 
        forbidden_phrases?: string[]
        brand_voice?: string 
      }
      forbiddenPhrases = settings.forbidden_phrases || []
      brandVoice = settings.brand_voice
    }

    // Get evidence for social proof integration
    const { data: evidenceData } = await supabase
      .from('evidence')
      .select('title, content, source_type')
      .eq('workspace_id', campaign.workspace_id)

    const evidence = evidenceData as Evidence[] | null

    // Get existing messages
    const { data: messagesData } = await supabase
      .from('messages')
      .select('text')
      .eq('campaign_id', campaignId)

    const messages = messagesData as { text: string }[] | null
    const messageTexts = messages?.map((m) => m.text) || []

    // ==========================================================================
    // FEEDBACK LOOP: Fetch performance data from previous campaigns/iterations
    // ==========================================================================
    const performanceData = await fetchPerformanceForFeedback(campaignId, supabase)

    // Generate page blocks with full context AND performance feedback
    const aiContext = await loadWorkspaceAIContext(supabase, campaign.workspace_id)
    const generated = await withAIContext(
      {
        workspaceId: campaign.workspace_id,
        settings: aiContext.settings,
        modelPreferences: aiContext.modelPreferences,
      },
      () => generatePageBlocks(
        campaign.audience || '',
        campaign.goal || '',
        campaign.offer || '',
        campaign.cta || '',
        messageTexts,
        {
          forbiddenPhrases,
          brandVoice,
          evidence: evidence || undefined,
          pageGoal: pageGoal || 'lead-gen',
          performance: performanceData, // 🔄 THE LEARNING LOOP
        }
      )
    )

    // Delete existing blocks
    await supabase
      .from('page_blocks')
      .delete()
      .eq('campaign_id', campaignId)

    // Insert new blocks
    const blocksToInsert = generated.blocks.map((block, index) => ({
      campaign_id: campaignId,
      type: block.type,
      order: index,
      props: block,
    }))

    const { data, error } = await supabase
      .from('page_blocks')
      .insert(blocksToInsert as Record<string, unknown>[])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      blocks: data,
      usedPerformanceFeedback: !!performanceData,
    })
  } catch (error) {
    console.error('Failed to generate page:', error)
    if (error instanceof StructuredGenerationRoutingError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to generate page' },
      { status: 500 }
    )
  }
}
