/**
 * Individual Experiment API
 * 
 * GET /api/experiments/[id] - Get experiment details
 * PATCH /api/experiments/[id] - Update experiment
 * DELETE /api/experiments/[id] - Delete experiment
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/supabase/auth-server'
import { abTesting } from '@/lib/experiments/ab-testing'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const experiment = await abTesting.getExperiment(id)
    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }

    const variants = await abTesting.getVariants(id)
    const metrics = await abTesting.getMetrics(id)
    
    // Calculate results if experiment has enough data
    let results = null
    if (experiment.status === 'running' || experiment.status === 'completed') {
      results = await abTesting.calculateResults(id)
    }

    return NextResponse.json({
      experiment: {
        ...experiment,
        variants,
        metrics,
        results,
      },
    })
  } catch (error) {
    console.error('Get experiment error:', error)
    return NextResponse.json({ error: 'Failed to get experiment' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, winnerVariantId } = body

    const experiment = await abTesting.getExperiment(id)
    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }

    switch (action) {
      case 'start':
        if (experiment.status !== 'draft') {
          return NextResponse.json(
            { error: 'Can only start experiments in draft status' },
            { status: 400 }
          )
        }
        await abTesting.startExperiment(id)
        break

      case 'pause':
        if (experiment.status !== 'running') {
          return NextResponse.json(
            { error: 'Can only pause running experiments' },
            { status: 400 }
          )
        }
        await abTesting.pauseExperiment(id)
        break

      case 'resume':
        if (experiment.status !== 'paused') {
          return NextResponse.json(
            { error: 'Can only resume paused experiments' },
            { status: 400 }
          )
        }
        await abTesting.startExperiment(id)
        break

      case 'end':
        if (!['running', 'paused'].includes(experiment.status)) {
          return NextResponse.json(
            { error: 'Can only end running or paused experiments' },
            { status: 400 }
          )
        }
        await abTesting.endExperiment(id, winnerVariantId)
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const updatedExperiment = await abTesting.getExperiment(id)
    const variants = await abTesting.getVariants(id)

    return NextResponse.json({
      experiment: {
        ...updatedExperiment,
        variants,
      },
    })
  } catch (error) {
    console.error('Update experiment error:', error)
    return NextResponse.json({ error: 'Failed to update experiment' }, { status: 500 })
  }
}
