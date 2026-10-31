/**
 * Refund Request API
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SubscriptionManager } from '@/lib/billing/subscription-manager'
import { z } from 'zod'

const refundSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason (at least 10 characters)'),
})

// Check refund eligibility
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
    const eligibility = await SubscriptionManager.checkRefundEligibility(
      membership.workspace_id
    )

    return NextResponse.json(eligibility)
  } catch (error) {
    console.error('Check refund eligibility error:', error)
    return NextResponse.json(
      { error: 'Failed to check refund eligibility' },
      { status: 500 }
    )
  }
}

// Request refund
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

  // Only owners can request refunds
  if (membership.role !== 'owner') {
    return NextResponse.json(
      { error: 'Only workspace owners can request refunds' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const parsed = refundSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    )
  }

  try {
    const result = await SubscriptionManager.requestRefund(
      membership.workspace_id,
      parsed.data.reason
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Request refund error:', error)
    return NextResponse.json(
      { error: 'Failed to process refund request' },
      { status: 500 }
    )
  }
}
