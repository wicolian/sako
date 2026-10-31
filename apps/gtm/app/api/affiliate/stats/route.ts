/**
 * Affiliate Stats API Route
 * 
 * Get dashboard statistics for current affiliate.
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
    
    const stats = await AffiliateManager.getDashboardStats(affiliate.id)
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Failed to get affiliate stats:', error)
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}
