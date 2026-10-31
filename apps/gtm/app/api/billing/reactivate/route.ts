/**
 * Reactivate Subscription API
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionManager } from '@/lib/billing/subscription-manager'

export async function POST() {
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

  // Only owners can reactivate
  if (membership.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only workspace owners can reactivate subscriptions' },
      { status: 403 }
    )
  }

  try {
    const subscription = await SubscriptionManager.reactivateSubscription(
      membership.workspace_id
    )

    return NextResponse.json({
      subscription,
      message: 'Subscription reactivated successfully',
    })
  } catch (error) {
    console.error('Reactivate subscription error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reactivate subscription' },
      { status: 500 }
    )
  }
}
