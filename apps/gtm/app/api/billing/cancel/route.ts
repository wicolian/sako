/**
 * Cancel Subscription API
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionManager, type CancellationReason } from '@/lib/billing/subscription-manager'
import { z } from 'zod'

const cancelSchema = z.object({
  reason: z.enum([
    'too_expensive',
    'missing_features',
    'switched_competitor',
    'not_using',
    'temporary_pause',
    'other',
  ]),
  feedback: z.string().optional(),
  immediate: z.boolean().optional().default(false),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's default workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  }

  // Only owners can cancel
  if (membership.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only workspace owners can cancel subscriptions' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const parsed = cancelSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    )
  }

  try {
    const subscription = await SubscriptionManager.cancelSubscription(
      membership.workspace_id,
      {
        reason: parsed.data.reason as CancellationReason,
        feedback: parsed.data.feedback,
        immediate: parsed.data.immediate,
      }
    )

    return NextResponse.json({
      subscription,
      message: parsed.data.immediate
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at the end of the billing period',
    })
  } catch (error) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}
