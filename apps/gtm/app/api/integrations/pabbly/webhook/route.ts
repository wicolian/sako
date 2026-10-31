/**
 * Pabbly Connect Webhook API
 * 
 * Register and manage Pabbly Connect webhooks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  registerPabblyWebhook,
  getPabblyWebhook,
  deactivatePabblyWebhook,
  testPabblyWebhook,
  PABBLY_EVENTS,
  type PabblyEvent,
} from '@/lib/integrations/pabbly-helpers'

/**
 * GET - Get current Pabbly Connect webhook configuration
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const webhook = await getPabblyWebhook(membership.workspace_id)

    return NextResponse.json({
      configured: !!webhook,
      webhook: webhook ? {
        events: webhook.events,
        is_active: webhook.is_active,
        last_triggered_at: webhook.last_triggered_at,
      } : null,
      available_events: Object.values(PABBLY_EVENTS),
    })
  } catch (error) {
    console.error('GET /api/integrations/pabbly/webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to get webhook configuration' },
      { status: 500 }
    )
  }
}

/**
 * POST - Register, update, or test Pabbly Connect webhook
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, webhook_url, events } = body as {
      action?: 'register' | 'test'
      webhook_url: string
      events?: PabblyEvent[]
    }

    if (!webhook_url) {
      return NextResponse.json(
        { error: 'webhook_url is required' },
        { status: 400 }
      )
    }

    // Handle test action
    if (action === 'test') {
      const result = await testPabblyWebhook(webhook_url)
      return NextResponse.json(result)
    }

    // Register webhook
    if (!events || events.length === 0) {
      return NextResponse.json(
        { error: 'At least one event must be selected' },
        { status: 400 }
      )
    }

    // Validate events
    const validEvents = Object.values(PABBLY_EVENTS)
    const invalidEvents = events.filter((e) => !validEvents.includes(e))
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid events: ${invalidEvents.join(', ')}` },
        { status: 400 }
      )
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const webhook = await registerPabblyWebhook(
      membership.workspace_id,
      webhook_url,
      events
    )

    return NextResponse.json({
      success: true,
      secret_key: webhook.secret_key,
      message: 'Webhook registered. Use the secret key to verify incoming webhooks.',
    })
  } catch (error) {
    console.error('POST /api/integrations/pabbly/webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Deactivate Pabbly Connect webhook
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    await deactivatePabblyWebhook(membership.workspace_id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/integrations/pabbly/webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to deactivate webhook' },
      { status: 500 }
    )
  }
}
