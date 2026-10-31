/**
 * Sako V1 Webhook Receiver
 * 
 * POST /api/sako/webhook
 * 
 * Receives status updates, deliverables, and comments from Sako V1.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sakoWebhookHandler, type SakoWebhookPayload } from '@/lib/sako/webhook-handler'

export async function POST(request: NextRequest) {
  try {
    // Get signature headers
    const signature = request.headers.get('x-sako-signature') || ''
    const timestamp = request.headers.get('x-sako-timestamp') || ''

    // Get raw body for signature verification
    const rawBody = await request.text()

    // Verify signature
    const verification = sakoWebhookHandler.verifySignature(rawBody, signature, timestamp)
    if (!verification.valid) {
      console.error('Webhook signature verification failed:', verification.error)
      return NextResponse.json(
        { error: 'Invalid signature', detail: verification.error },
        { status: 401 }
      )
    }

    // Parse payload
    let payload: SakoWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!payload.event || !payload.taskId || !payload.externalId) {
      return NextResponse.json(
        { error: 'Missing required fields: event, taskId, externalId' },
        { status: 400 }
      )
    }

    // Process synchronously for reliability in serverless/runtime environments
    await sakoWebhookHandler.handleWebhook(payload)

    return NextResponse.json({
      received: true,
      event: payload.event,
      taskId: payload.taskId,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Also support GET for webhook URL verification
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'sako-composer',
    version: '1.0',
    events: [
      'task.status_changed',
      'task.assigned',
      'task.deliverable_added',
      'task.comment_added',
    ],
  })
}
