/**
 * Studio Suggestions API Route
 * 
 * Generates AI-powered suggestions for input fields.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generateSuggestedResponses } from '@/lib/studio/instruction-enhancer'
import type { AppInput } from '@/lib/studio/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { input, context, count } = body as {
      input: AppInput
      context?: string
      count?: number
    }
    
    if (!input) {
      return NextResponse.json(
        { error: 'Input is required' },
        { status: 400 }
      )
    }
    
    const suggestions = await generateSuggestedResponses({
      input,
      context,
      count: count || 5,
    })
    
    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Failed to generate suggestions:', error)
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    )
  }
}
