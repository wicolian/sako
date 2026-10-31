/**
 * Affiliate Payouts API Route
 * 
 * Get payout history for current affiliate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AffiliateManager } from '@/lib/affiliate/affiliate-manager'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const affiliate = await AffiliateManager.getByUserId(user.id)
    
    if (!affiliate) {
      return NextResponse.json(
        { error: 'Affiliate account not found' },
        { status: 404 }
      )
    }
    
    const payouts = await AffiliateManager.getPayouts(affiliate.id)
    
    return NextResponse.json(payouts)
  } catch (error) {
    console.error('Failed to get payouts:', error)
    return NextResponse.json(
      { error: 'Failed to get payouts' },
      { status: 500 }
    )
  }
}
