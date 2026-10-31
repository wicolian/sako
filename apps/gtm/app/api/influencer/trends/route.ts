/**
 * Influencer Trends API
 * 
 * Get trending formats, topics, and sounds for UGC content.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTrendSuggestions } from '@/lib/assets/influencer-generator'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { platform, niche } = body

    if (!platform || !niche) {
      return NextResponse.json(
        { error: 'Missing required fields: platform, niche' },
        { status: 400 }
      )
    }

    const trends = await getTrendSuggestions(platform, niche)

    return NextResponse.json(trends)
  } catch (error) {
    console.error('POST /api/influencer/trends error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    )
  }
}
