/**
 * Remix Chain API
 * 
 * Get the attribution chain for a remixed template.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRemixChain, getRemixStats } from '@/lib/templates/remix-tracker'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')
    const includeStats = searchParams.get('stats') === 'true'

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      )
    }

    const chain = await getRemixChain(templateId)

    if (includeStats) {
      const stats = await getRemixStats(templateId)
      return NextResponse.json({ chain, stats })
    }

    return NextResponse.json({ chain })
  } catch (error) {
    console.error('GET /api/marketplace/remix-chain error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch remix chain' },
      { status: 500 }
    )
  }
}
