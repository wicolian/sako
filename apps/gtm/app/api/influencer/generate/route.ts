/**
 * Influencer Content Generation API
 * 
 * Generate UGC-style videos, reels, carousels, and stories.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateUGCContent,
  UGCGenerationInput,
} from '@/lib/assets/influencer-generator'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as UGCGenerationInput

    // Validate required fields
    if (!body.productName || !body.format || !body.platform) {
      return NextResponse.json(
        { error: 'Missing required fields: productName, format, platform' },
        { status: 400 }
      )
    }

    // Generate the UGC content
    const result = await generateUGCContent(body)

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/influencer/generate error:', error)
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    )
  }
}
