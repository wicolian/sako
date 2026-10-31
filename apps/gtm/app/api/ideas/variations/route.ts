/**
 * Generate Idea Variations API
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamText } from '@/lib/ai/langsmith-ai'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { z } from 'zod'

const variationsSchema = z.object({
  content: z.string().min(1),
  type: z.string().optional().default('content'),
  count: z.number().optional().default(5),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = variationsSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { content, type, count } = parsed.data

  try {
    const result = await streamText({
      model: MODELS.CREATIVE,
      system: `You are a creative content strategist. Generate ${count} unique variations of the given content.

Each variation should:
- Maintain the core message and intent
- Use different angles, tones, or approaches
- Be distinct from other variations
- Be suitable for ${type} content

Format your response as a JSON array of strings, each string being one variation.`,
      prompt: `Generate ${count} variations of this content:\n\n${content}`,
    })

    const text = await result.text

    // Parse the JSON response
    let variations: string[] = []
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        variations = JSON.parse(jsonMatch[0])
      }
    } catch {
      // If JSON parsing fails, split by numbered list
      variations = text
        .split(/\d+\.\s+/)
        .filter((v: string) => v.trim().length > 0)
        .slice(0, count)
    }

    return NextResponse.json({ variations })
  } catch (error) {
    console.error('Generate variations error:', error)
    return NextResponse.json(
      { error: 'Failed to generate variations' },
      { status: 500 }
    )
  }
}
