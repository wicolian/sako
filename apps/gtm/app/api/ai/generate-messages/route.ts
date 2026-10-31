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

/**
 * Fetch performance data for the learning loop
 */
async function fetchPerformanceData(
  db: ReturnType<typeof createServiceClient>,
  campaignId: string,
  workspaceId: string
): Promise<PerformanceData | null> {
  try {
    // Get top performing messages from other campaigns
    const { data: topMessages } = await db
      .from('messages')
      .select('text, ctr')
      .eq('workspace_id', workspaceId)
      .order('ctr', { ascending: false })
      .limit(5)

    // Filter out null CTRs
    const messagesWithCtr = (topMessages || []) as Array<{ text: string; ctr: number | null }>
    const validMessages = messagesWithCtr.filter(m => m.ctr !== null) as Array<{ text: string; ctr: number }>

    // Get top performing angles
    const { data: topAngles } = await db
      .from('angles')
      .select('name, conversion_rate')
      .eq('workspace_id', workspaceId)
      .order('conversion_rate', { ascending: false })
      .limit(5)

    // Filter out null conversion rates
    const anglesWithRate = (topAngles || []) as Array<{ name: string; conversion_rate: number | null }>
    const validAngles = anglesWithRate.filter(a => a.conversion_rate !== null) as Array<{ name: string; conversion_rate: number }>

    if (!validMessages.length && !validAngles.length) return null

    return {
      topMessages: validMessages.map(m => ({ text: m.text, ctr: m.ctr || 0 })),
      topAngles: validAngles.map(a => ({ name: a.name, conversionRate: a.conversion_rate || 0 })),
      insights: [
        validMessages.length ? `Your audience responds well to: "${validMessages[0]?.text?.substring(0, 50)}..."` : '',
        validAngles.length ? `Best performing angle: ${validAngles[0]?.name}` : '',
      ].filter(Boolean),
    }
  } catch (error) {
    console.warn('Could not fetch performance data:', error)
    return null
  }
}
