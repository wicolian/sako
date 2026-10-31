import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateAndPersistCampaignMessages } from '@/lib/ai/generate-campaign-messages'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaignId } = body

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Missing campaign ID' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const { messages, usedPerformanceFeedback } =
      await generateAndPersistCampaignMessages(campaignId, supabase)

    return NextResponse.json({
      messages,
      usedPerformanceFeedback,
    })
  } catch (error) {
    console.error('Failed to generate messages:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate messages' },
      { status: 500 }
    )
  }
}
