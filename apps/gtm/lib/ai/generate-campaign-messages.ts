/**
 * Shared logic: generate AI key messages for a campaign and persist to DB.
 * Used by:
 * - POST /api/ai/generate-messages (manual "Generate Messages" button)
 * - POST /api/campaigns/[id]/generate (auto-generate after assets)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateMessages, fetchPerformanceForFeedback, type Evidence } from '@/lib/ai/ai-sdk-client'
import { detectSlop, detectAdjectiveStacks, extractNewClaims } from '@/lib/ai/anti-slop'
import { validateMessage } from '@/lib/ai/validators'
import { linkClaimToCampaign } from '@/lib/claims/claim-lineage'

export interface GenerateCampaignMessagesResult {
  messages: Record<string, unknown>[]
  usedPerformanceFeedback: boolean
  slopViolations: number
  fabricatedClaims: string[]
}

/**
 * Generate key messages (headline, supporting, CTAs, disclaimers) for a campaign
 * and insert them into the messages table. Replaces any existing messages.
 */
export async function generateAndPersistCampaignMessages(
  campaignId: string,
  supabase: SupabaseClient
): Promise<GenerateCampaignMessagesResult> {
  const { data: campaignData, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaignData) {
    throw new Error('Campaign not found')
  }

  const campaignRow = campaignData as {
    workspace_id: string
    audience: string
    goal: string
    offer: string
    cta: string
  }

  const { audience, goal, offer, cta } = campaignRow

  let forbiddenPhrases: string[] = []
  let brandVoice: string | undefined
  let industry: string | undefined

  const { data: settingsData } = await supabase
    .from('workspace_settings')
    .select('forbidden_phrases, brand_voice, industry')
    .eq('workspace_id', campaignRow.workspace_id)
    .single()

  const settings = settingsData as {
    forbidden_phrases: string[]
    brand_voice?: string
    industry?: string
  } | null

  if (settings) {
    forbiddenPhrases = settings.forbidden_phrases || []
    brandVoice = settings.brand_voice
    industry = settings.industry
  }

  const { data: evidenceData } = await supabase
    .from('evidence')
    .select('title, content, source_type')
    .eq('workspace_id', campaignRow.workspace_id)

  const evidence = evidenceData as Evidence[] | null
  const performanceData = await fetchPerformanceForFeedback(campaignId, supabase)

  const initialGenerated = await generateMessages(
    audience || '',
    goal || '',
    offer || '',
    cta || '',
    {
      forbiddenPhrases,
      brandVoice,
      industry,
      evidence: evidence || undefined,
      performance: performanceData,
    }
  )

  const brandAllowList = [
    brandVoice || '',
    offer || '',
    ...(evidence || []).map((item) => item.title),
  ].filter(Boolean)

  const initialTexts = [
    initialGenerated.headline,
    ...initialGenerated.supporting,
    ...initialGenerated.ctas,
    ...initialGenerated.disclaimers,
  ]
  const initialViolations = initialTexts.flatMap((text) => detectSlop(text, brandAllowList))

  const generated = initialViolations.filter((violation) => violation.severity === 'hard').length > 3
    ? await generateMessages(
        audience || '',
        goal || '',
        offer || '',
        cta || '',
        {
          forbiddenPhrases: [
            ...forbiddenPhrases,
            ...initialViolations.map((violation) => violation.phrase),
          ],
          brandVoice,
          industry,
          evidence: evidence || undefined,
          performance: performanceData,
        }
      )
    : initialGenerated

  await supabase.from('messages').delete().eq('campaign_id', campaignId)

  const messagesToInsert: Record<string, unknown>[] = []
  const allSlopViolations = new Set<string>()
  const fabricatedClaims = new Set<string>()

  const collectRiskTags = (text: string, baseRiskTags: string[]): string[] => {
    const slopViolations = detectSlop(text, brandAllowList)
    const adjectiveStacks = detectAdjectiveStacks(text)
    const newClaims = extractNewClaims(text)

    slopViolations.forEach((violation) => allSlopViolations.add(`slop:${violation.phrase}`))
    adjectiveStacks.forEach((stack) => allSlopViolations.add(`adjective_stack:${stack}`))
    newClaims.forEach((claim) => fabricatedClaims.add(claim))

    return [
      ...baseRiskTags,
      ...slopViolations.map((violation) => `slop:${violation.phrase}`),
      ...adjectiveStacks.map((stack) => `adjective_stack:${stack}`),
      ...newClaims.map((claim) => `new_claim:${claim}`),
    ]
  }

  const headlineValidation = validateMessage(generated.headline, forbiddenPhrases)
  messagesToInsert.push({
    campaign_id: campaignId,
    type: 'headline',
    text: generated.headline,
    status: headlineValidation.status,
    strength: headlineValidation.strength,
    risk_tags: collectRiskTags(generated.headline, headlineValidation.riskTags),
  })

  for (const text of generated.supporting) {
    const validation = validateMessage(text, forbiddenPhrases)
    messagesToInsert.push({
      campaign_id: campaignId,
      type: 'supporting',
      text,
      status: validation.status,
      strength: validation.strength,
      risk_tags: collectRiskTags(text, validation.riskTags),
    })
  }

  for (const text of generated.ctas) {
    const validation = validateMessage(text, forbiddenPhrases)
    messagesToInsert.push({
      campaign_id: campaignId,
      type: 'cta',
      text,
      status: validation.status,
      strength: validation.strength,
      risk_tags: collectRiskTags(text, validation.riskTags),
    })
  }

  for (const text of generated.disclaimers) {
    messagesToInsert.push({
      campaign_id: campaignId,
      type: 'disclaimer',
      text,
      status: 'approved',
      strength: 'soft',
      risk_tags: collectRiskTags(text, []),
    })
  }

  const { data, error } = await supabase
    .from('messages')
    .insert(messagesToInsert)
    .select()

  if (error) {
    throw new Error(error.message)
  }

  if (fabricatedClaims.size > 0) {
    const { data: existingClaims } = await supabase
      .from('claims')
      .select('text')
      .eq('workspace_id', campaignRow.workspace_id)
      .in('text', Array.from(fabricatedClaims))

    const existingTexts = new Set((existingClaims ?? []).map((claim) => claim.text))

    const fabricatedClaimRows = Array.from(fabricatedClaims)
      .filter((text) => !existingTexts.has(text))
      .map((text) => ({
        workspace_id: campaignRow.workspace_id,
        text,
        original_text: text,
        claim_type: 'unverified' as const,
        category: 'generic' as const,
        status: 'draft' as const,
        risk_score: 65,
        reason_codes: ['AI_GENERATED', `CAMPAIGN:${campaignId}`],
        suggested_rewrites: ['Validate this AI-generated claim against approved source material.'],
      }))

    if (fabricatedClaimRows.length > 0) {
      const { data: insertedClaims } = await supabase
        .from('claims')
        .insert(fabricatedClaimRows)
        .select('id')

      for (const claim of insertedClaims ?? []) {
        if (claim?.id) {
          await linkClaimToCampaign({
            workspaceId: campaignRow.workspace_id,
            campaignId,
            claimId: claim.id,
            source: 'message',
          })
        }
      }
    }
  }

  return {
    messages: (data as Record<string, unknown>[]) || [],
    usedPerformanceFeedback: !!performanceData,
    slopViolations: allSlopViolations.size,
    fabricatedClaims: Array.from(fabricatedClaims),
  }
}
