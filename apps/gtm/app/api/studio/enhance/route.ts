/**
 * Studio Enhance API Route
 * 
 * Enhances app instructions using AI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { enhanceInstructions } from '@/lib/studio/instruction-enhancer'
import type { AppInput } from '@/lib/studio/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { instructions, inputs, appCategory } = body as {
      instructions: string
      inputs: AppInput[]
      appCategory?: string
    }
    
    if (!instructions) {
      return NextResponse.json(
        { error: 'Instructions are required' },
        { status: 400 }
      )
    }
    
    const result = await enhanceInstructions({
      currentInstructions: instructions,
      inputs: inputs || [],
      appCategory,
    })
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to enhance instructions:', error)
    return NextResponse.json(
      { error: 'Failed to enhance instructions' },
      { status: 500 }
    )
  }
}
