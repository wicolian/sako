/**
 * Predictions API
 * 
 * Endpoints for AI-powered performance predictions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  predictCampaignPerformance,
  getPredictionHistory,
  recordActualPerformance,
  getPredictionAccuracy,
  quickPredictionScore,
} from '@/lib/predictions/performance-predictor'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const campaignId = searchParams.get('campaignId')
  const action = searchParams.get('action')

  if (action === 'accuracy') {
    // Get workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'No workspace' }, { status: 400 })
    }

    const accuracy = await getPredictionAccuracy(member.workspace_id)
    return NextResponse.json({ accuracy })
  }

  if (campaignId) {
    if (action === 'history') {
      const history = await getPredictionHistory(campaignId)
      return NextResponse.json({ history })
    }

    // Get latest prediction or generate new one
    const history = await getPredictionHistory(campaignId)
    if (history.length > 0) {
      return NextResponse.json({ prediction: history[0] })
    }

    // Generate new prediction
    try {
      const prediction = await predictCampaignPerformance(campaignId)
      return NextResponse.json({ prediction })
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'predict': {
      const { campaignId } = body

      if (!campaignId) {
        return NextResponse.json({ error: 'campaignId required' }, { status: 400 })
      }

      try {
        const prediction = await predictCampaignPerformance(campaignId)
        return NextResponse.json({ prediction })
      } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 })
      }
    }

    case 'recordActual': {
      const { campaignId, metrics } = body

      if (!campaignId || !metrics) {
        return NextResponse.json({ error: 'campaignId and metrics required' }, { status: 400 })
      }

      await recordActualPerformance(campaignId, metrics)
      return NextResponse.json({ success: true })
    }

    case 'quickScore': {
      const { content, audience, goal } = body

      if (!content || !audience || !goal) {
        return NextResponse.json({ error: 'content, audience, and goal required' }, { status: 400 })
      }

      const result = await quickPredictionScore(content, audience, goal)
      return NextResponse.json({ result })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
