export {
  MASTER_SYSTEM_PROMPT,
  buildAnglesPrompt as buildAnglesSystemPrompt,
  buildBrandExtractionSystemPrompt,
  buildClaimValidatorPrompt,
  buildClaimsExtractionSystemPrompt,
  buildCopywriterPrompt,
  buildCopywriterPrompt as buildMessagesSystemPrompt,
  buildEmailSequencePrompt,
  buildEvidenceResearchPrompt,
  buildLandingPagePrompt,
  buildSocialPrompt,
  estimateTrustScore,
  extractCitations,
  validateAgainstBannedPatterns,
  type Evidence,
  type PerformanceData,
  type PromptContext,
} from './prompts-v2'

import type { PromptContext } from './prompts-v2'

interface CampaignInput {
  audience: string
  goal: string
  offer: string
  cta?: string
  messages?: string[]
}

export function buildCampaignContext(campaign: CampaignInput): string {
  return `CAMPAIGN CONTEXT:
Target Audience: ${campaign.audience}
Campaign Goal: ${campaign.goal}
Offer: ${campaign.offer}
Primary CTA: ${campaign.cta || 'Not specified'}
${campaign.messages?.length ? `\nKey Messages:\n${campaign.messages.map(m => `- ${m}`).join('\n')}` : ''}`
}
