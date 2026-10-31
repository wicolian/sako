/**
 * Subscription API Routes
 * 
 * GET  - Get current subscription
 * POST - Update subscription (upgrade/downgrade)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionManager } from '@/lib/billing/subscription-manager'

export async function GET() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's default workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  }

  try {
    const subscription = await SubscriptionManager.getSubscription(membership.workspace_id)
    return NextResponse.json({ subscription })
  } catch (error) {
    console.error('Get subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to get subscription' },
      { status: 500 }
    )
  }
}
