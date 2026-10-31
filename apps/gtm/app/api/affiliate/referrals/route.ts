/**
 * Affiliate Referrals API Route
 * 
 * Get referrals for current affiliate.
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
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    
    const result = await AffiliateManager.getReferrals(affiliate.id, {
      status: status || undefined,
      limit,
      offset,
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to get referrals:', error)
    return NextResponse.json(
      { error: 'Failed to get referrals' },
      { status: 500 }
    )
  }
}
