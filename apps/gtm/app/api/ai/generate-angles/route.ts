import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateAngles, fetchPerformanceForFeedback, type Evidence } from '@/lib/ai/ai-sdk-client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId } = body

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
      workspace_id: string 
    } | null

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get workspace settings
    let industry: string | undefined
    const { data: settingsData } = await supabase
      .from('workspace_settings')
      .select('industry')
      .eq('workspace_id', campaign.workspace_id)
      .single()

    if (settingsData) {
      industry = (settingsData as { industry?: string }).industry
    }

    // Get evidence - this is crucial for grounding trustScores
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

    // Generate angles with evidence context AND performance feedback
    const generated = await generateAngles(
      campaign.audience || '',
      campaign.goal || '',
      campaign.offer || '',
      messageTexts,
      {
        evidence: evidence || undefined,
        industry,
        performance: performanceData, // 🔄 THE LEARNING LOOP
      }
    )

    // Delete existing angles
    await supabase
      .from('angles')
      .delete()
      .eq('campaign_id', campaignId)

    // Insert new angles with evidence citations
    const anglesToInsert = generated.angles.map((angle, index) => ({
      campaign_id: campaignId,
      name: angle.name,
      description: angle.description,
      rationale: angle.rationale,
      trust_score: angle.trustScore,
      evidence_cited: angle.evidenceCited || [],
      rank: index + 1,
    }))

    const { data, error } = await supabase
      .from('angles')
      .insert(anglesToInsert as Record<string, unknown>[])
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      angles: data,
      usedPerformanceFeedback: !!performanceData,
    })
  } catch (error) {
    console.error('Failed to generate angles:', error)
    return NextResponse.json(
      { error: 'Failed to generate angles' },
      { status: 500 }
    )
  }
}
