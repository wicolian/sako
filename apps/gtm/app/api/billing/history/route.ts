/**
 * Billing History API
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
    const history = await SubscriptionManager.getBillingHistory(membership.workspace_id)
    return NextResponse.json({ history })
  } catch (error) {
    console.error('Get billing history error:', error)
    return NextResponse.json(
      { error: 'Failed to get billing history' },
      { status: 500 }
    )
  }
}
