/**
 * Zapier Integration API
 * 
 * Endpoints for Zapier webhooks and actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { auth } from '@clerk/nextjs/server'
import {
  registerZapierWebhook,
  unregisterZapierWebhook,
  getWorkspaceWebhooks,
  handleZapierAction,
  verifyWebhookSignature,
  getAvailableTriggers,
  getAvailableActions,
  ZAPIER_EVENTS,
} from '@/lib/integrations/zapier-helpers'

export async function GET(request: NextRequest) {
  const supabase = await createServiceClient()
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  }

  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action')

  if (action === 'triggers') {
    const triggers = getAvailableTriggers()
    return NextResponse.json({ triggers })
  }

  if (action === 'actions') {
    const actions = getAvailableActions()
    return NextResponse.json({ actions })
  }

  if (action === 'events') {
    return NextResponse.json({ events: ZAPIER_EVENTS })
  }

  // Get webhooks
  const webhooks = await getWorkspaceWebhooks(member.workspace_id)
  return NextResponse.json({ webhooks })
}

export async function POST(request: NextRequest) {
  const supabase = await createServiceClient()
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get workspace
  const { data: member } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  }

  const body = await request.json()
  const { action } = body

  switch (action) {
    case 'register': {
      const { name, url, eventTypes } = body

      if (!name || !url || !eventTypes || eventTypes.length === 0) {
        return NextResponse.json({ error: 'name, url, and eventTypes required' }, { status: 400 })
      }

      const webhook = await registerZapierWebhook(member.workspace_id, {
        name,
        url,
        eventTypes,
      })

      return NextResponse.json({ webhook })
    }

    case 'unregister': {
      const { webhookId } = body

      if (!webhookId) {
        return NextResponse.json({ error: 'webhookId required' }, { status: 400 })
      }

      const success = await unregisterZapierWebhook(webhookId)
      return NextResponse.json({ success })
    }

    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
}

// Incoming webhook handler for Zapier actions
export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { workspaceId, action, data, apiKey } = body

  // Verify API key
  const supabase = await createServiceClient()
  const { data: keyRecord } = await supabase
    .from('api_keys')
    .select('workspace_id')
    .eq('key_hash', apiKey) // Would need proper hashing
    .maybeSingle()

  if (!keyRecord || keyRecord.workspace_id !== workspaceId) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
  }

  if (!action || !data) {
    return NextResponse.json({ error: 'action and data required' }, { status: 400 })
  }

  const result = await handleZapierAction(workspaceId, action, data)
  return NextResponse.json(result)
}
