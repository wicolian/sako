/**
 * Research Agent API
 * 
 * Endpoints for competitive research and market analysis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  researchAgentTools,
  runResearchAgent,
  storeResearchFindings,
} from '@/lib/agents/research-agent'

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
    case 'analyzeCompetitors': {
      const { industry, competitors, ourProduct, focusAreas } = body

      if (!industry || !competitors || !ourProduct) {
        return NextResponse.json({ error: 'industry, competitors, and ourProduct required' }, { status: 400 })
      }

      const result = await researchAgentTools.analyze_competitors.execute({
        industry,
        competitors,
        ourProduct,
        focusAreas,
      })

      return NextResponse.json({ result })
    }

    case 'researchTrends': {
      const { industry, timeframe, specificTopics } = body

      if (!industry) {
        return NextResponse.json({ error: 'industry required' }, { status: 400 })
      }

      const result = await researchAgentTools.research_trends.execute({
        industry,
        timeframe: timeframe || '1_year',
        specificTopics,
      })

      return NextResponse.json({ result })
    }

    case 'researchAudience': {
      const { productDescription, industry, currentAudience, geographies } = body

      if (!productDescription || !industry) {
        return NextResponse.json({ error: 'productDescription and industry required' }, { status: 400 })
      }

      const result = await researchAgentTools.research_audience.execute({
        productDescription,
        industry,
        currentAudience,
        geographies,
      })

      return NextResponse.json({ result })
    }

    case 'validateClaim': {
      const { claim, industry } = body

      if (!claim || !industry) {
        return NextResponse.json({ error: 'claim and industry required' }, { status: 400 })
      }

      const result = await researchAgentTools.validate_claim_with_research.execute({
        claim,
        industry,
      })

      return NextResponse.json({ result })
    }

    case 'generateBattleCard': {
      const { competitor, ourProduct, ourStrengths } = body

      if (!competitor || !ourProduct || !ourStrengths) {
        return NextResponse.json({ error: 'competitor, ourProduct, and ourStrengths required' }, { status: 400 })
      }

      const result = await researchAgentTools.generate_battle_card.execute({
        competitor,
        ourProduct,
        ourStrengths,
      })

      return NextResponse.json({ result })
    }

    case 'comprehensive': {
      const { type, industry, productDescription, competitors, additionalContext } = body

      if (!industry || !productDescription) {
        return NextResponse.json({ error: 'industry and productDescription required' }, { status: 400 })
      }

      const result = await runResearchAgent({
        type: type || 'comprehensive',
        industry,
        productDescription,
        competitors,
        additionalContext,
      })

      return NextResponse.json({ result })
    }

    case 'saveFindings': {
      const { findings } = body

      if (!findings || !Array.isArray(findings)) {
        return NextResponse.json({ error: 'findings array required' }, { status: 400 })
      }

      const ids = await storeResearchFindings(member.workspace_id, findings)
      return NextResponse.json({ savedIds: ids })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
