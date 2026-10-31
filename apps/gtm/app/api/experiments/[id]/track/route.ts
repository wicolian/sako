/**
 * Experiment Event Tracking API
 * 
 * POST /api/experiments/[id]/track - Track experiment events
 * 
 * This endpoint is called from the client-side tracking script
 * embedded in deployed landing pages.
 */

import { NextRequest, NextResponse } from 'next/server'
import { abTesting, generateVisitorId } from '@/lib/experiments/ab-testing'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Parse body
    const body = await request.json()
    const {
      visitorId,
      variantId,
      eventType,
      eventName,
      isConversion,
      conversionValue,
      timeOnPageMs,
      scrollDepthPercent,
      elementId,
      elementType,
      metadata,
    } = body

    // Validate required fields
    if (!variantId || !eventType) {
      return NextResponse.json(
        { error: 'variantId and eventType are required' },
        { status: 400 }
      )
    }

    // Verify experiment exists and is running
    const experiment = await abTesting.getExperiment(id)
    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }

    if (experiment.status !== 'running') {
      // Don't error, just don't track
      return NextResponse.json({ tracked: false, reason: 'experiment_not_running' })
    }

    // Get or generate visitor ID
    const actualVisitorId = visitorId || generateVisitorId(request)

    // Track the event
    await abTesting.trackEvent({
      experimentId: id,
      variantId,
      eventType,
      eventName,
      isConversion,
      conversionValue,
      timeOnPageMs,
      scrollDepthPercent,
      elementId,
      elementType,
      metadata: {
        ...metadata,
        visitorId: actualVisitorId,
        userAgent: request.headers.get('user-agent'),
      },
    })

    return NextResponse.json({ tracked: true })
  } catch (error) {
    console.error('Track event error:', error)
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 })
  }
}

// GET for variant assignment (used by tracking script)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const visitorId = request.nextUrl.searchParams.get('visitorId') || generateVisitorId(request)

    const experiment = await abTesting.getExperiment(id)
    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
    }

    if (experiment.status !== 'running') {
      return NextResponse.json({ active: false })
    }

    const variant = await abTesting.getVariantForVisitor(id, visitorId)
    if (!variant) {
      return NextResponse.json({ active: false })
    }

    return NextResponse.json({
      active: true,
      variantId: variant.id,
      variantName: variant.name,
      isControl: variant.isControl,
      contentChanges: variant.contentChanges,
      visitorId,
    })
  } catch (error) {
    console.error('Get variant error:', error)
    return NextResponse.json({ error: 'Failed to get variant' }, { status: 500 })
  }
}
