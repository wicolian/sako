/**
 * Experiments API
 * 
 * Endpoints for A/B testing and experiments.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  createExperiment,
  startExperiment,
  pauseExperiment,
  resumeExperiment,
  recordImpression,
  recordConversion,
  getVariantForVisitor,
  getExperimentResults,
  completeExperiment,
} from '@/lib/experiments/ab-runner'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const experimentId = searchParams.get('experimentId')
  const campaignId = searchParams.get('campaignId')
  const action = searchParams.get('action')

  if (experimentId) {
    if (action === 'results') {
      const results = await getExperimentResults(experimentId)
      return NextResponse.json({ results })
    }

    // Get experiment
    const { data: experiment, error } = await supabase
      .from('experiments')
      .select('*')
      .eq('id', experimentId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }

    return NextResponse.json({ experiment })
  }

  if (campaignId) {
    // Get experiments for campaign
    const { data: experiments } = await supabase
      .from('experiments')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })

    return NextResponse.json({ experiments: experiments || [] })
  }

  // Get all experiments for workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  }

  const { data: experiments } = await supabase
    .from('experiments')
    .select('*')
    .eq('workspace_id', member.workspace_id)
    .order('created_at', { ascending: false })

  return NextResponse.json({ experiments: experiments || [] })
}

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
    case 'create': {
      const { campaignId, name, description, hypothesis, variants, metrics, targetSampleSize, confidenceLevel } = body

      if (!campaignId || !name || !hypothesis || !variants || !metrics) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      const experiment = await createExperiment(member.workspace_id, campaignId, {
        name,
        description,
        hypothesis,
        variants,
        metrics,
        targetSampleSize,
        confidenceLevel,
      })

      return NextResponse.json({ experiment })
    }

    case 'start': {
      const { experimentId } = body
      if (!experimentId) {
        return NextResponse.json({ error: 'experimentId required' }, { status: 400 })
      }
      const success = await startExperiment(experimentId)
      return NextResponse.json({ success })
    }

    case 'pause': {
      const { experimentId } = body
      if (!experimentId) {
        return NextResponse.json({ error: 'experimentId required' }, { status: 400 })
      }
      const success = await pauseExperiment(experimentId)
      return NextResponse.json({ success })
    }

    case 'resume': {
      const { experimentId } = body
      if (!experimentId) {
        return NextResponse.json({ error: 'experimentId required' }, { status: 400 })
      }
      const success = await resumeExperiment(experimentId)
      return NextResponse.json({ success })
    }

    case 'complete': {
      const { experimentId } = body
      if (!experimentId) {
        return NextResponse.json({ error: 'experimentId required' }, { status: 400 })
      }
      const winnerId = await completeExperiment(experimentId)
      return NextResponse.json({ winnerId })
    }

    case 'impression': {
      const { experimentId, variantId, visitorId } = body
      if (!experimentId || !variantId || !visitorId) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      await recordImpression(experimentId, variantId, visitorId)
      return NextResponse.json({ success: true })
    }

    case 'conversion': {
      const { experimentId, variantId, visitorId, metricName, value } = body
      if (!experimentId || !variantId || !visitorId || !metricName) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }
      await recordConversion(experimentId, variantId, visitorId, metricName, value)
      return NextResponse.json({ success: true })
    }

    case 'getVariant': {
      const { experimentId, visitorId } = body
      if (!experimentId || !visitorId) {
        return NextResponse.json({ error: 'experimentId and visitorId required' }, { status: 400 })
      }
      const variant = await getVariantForVisitor(experimentId, visitorId)
      return NextResponse.json({ variant })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}
