/**
 * Regenerate Idea with Feedback API
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamText } from '@/lib/ai/langsmith-ai'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { z } from 'zod'

const regenerateSchema = z.object({
  originalContent: z.string().min(1),
  feedback: z.string().min(1),
  type: z.string().optional().default('content'),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const parsed = regenerateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { originalContent, feedback, type } = parsed.data

  try {
    const result = await streamText({
      model: MODELS.CREATIVE,
      system: `You are a creative content strategist. Regenerate the given content based on user feedback.

Guidelines:
- Incorporate the user's feedback fully
- Maintain the original intent while making requested changes
- Produce high-quality ${type} content
- Only return the new content, no explanations`,
      prompt: `Original content:
${originalContent}

User feedback:
${feedback}

Please regenerate the content incorporating this feedback.`,
    })

    const newContent = await result.text

    return NextResponse.json({ content: newContent.trim() })
  } catch (error) {
    console.error('Regenerate content error:', error)
    return NextResponse.json(
      { error: 'Failed to regenerate content' },
      { status: 500 }
    )
  }
}
