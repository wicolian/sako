import { generateStructuredOutput, streamTextContent } from '@/lib/ai/ai-sdk-client'
import { z } from 'zod'
import type { Campaign } from '@/lib/supabase/types'
import { getWorkspaceSettings } from '@/lib/workspace'
import type { BrandContext } from '@/lib/ai/brand-context'
import type { DesignArchetype } from '@/lib/design/archetype-selector'
import type { GenerationPlan } from '@/lib/planning/types'
import { buildPlanPromptContext, buildVisualTastePrompt } from '@/lib/planning/generation-plan'

// Email Sequence Generation
const EmailSequenceSchema = z.object({
  subject: z.string(),
  preheader: z.string(),
  body_html: z.string(),
  cta_text: z.string(),
  cta_url: z.string().describe('CTA link URL - use "#" or landing page URL'),
  delay_days: z.number(),
  email_type: z.enum(['welcome', 'nurture', 'value', 'social_proof', 'urgency', 'closing']),
})

const EmailCampaignSchema = z.object({
  campaign_name: z.string(),
  emails: z.array(EmailSequenceSchema),
})

export async function generateEmailSequence(
  campaign: Campaign,
  workspaceId: string,
  options?: {
    sequenceLength?: number
    includeABVariants?: boolean
    plan?: GenerationPlan
    brandContext?: BrandContext
    designArchetype?: DesignArchetype
    improvementContext?: string
  }
): Promise<z.infer<typeof EmailCampaignSchema>> {
  const workspaceSettings = await getWorkspaceSettings(workspaceId)
  const sequenceLength = options?.sequenceLength || 5
  const planContext = options?.plan ? buildPlanPromptContext(options.plan) : ''
  const visualTastePrompt = options?.plan ? buildVisualTastePrompt(options.plan) : ''

  const prompt = `
You are an expert email marketing strategist. Generate a ${sequenceLength}-email nurture sequence for this campaign.

Campaign Details:
- Name: ${campaign.name}
- Audience: ${campaign.audience}
- Goal: ${campaign.goal}
- Offer: ${campaign.offer}
- CTA: ${campaign.cta}

Brand Guidelines:
- Voice: ${workspaceSettings.brand_voice || 'professional, friendly'}
- Forbidden Phrases: ${workspaceSettings.forbidden_phrases?.join(', ') || 'none'}
${planContext ? `\n${planContext}\n` : ''}
${visualTastePrompt ? `\n${visualTastePrompt}\n` : ''}
${options?.improvementContext ? `\n${options.improvementContext}\n` : ''}

Generate a sequence that:
1. Opens with a strong welcome/hook email
2. Provides value in the middle emails (tips, case studies, insights)
3. Includes social proof (testimonials, results)
4. Creates urgency in later emails
5. Closes with a compelling final offer
6. Reflects the selected decision stage and actor, not a generic nurture sequence

Each email should have:
- A compelling subject line (under 50 chars)
- A preheader that complements the subject
- HTML body content (use simple formatting)
- A clear CTA
- Appropriate delay from previous email (in days)
`

  return generateStructuredOutput({ prompt, schema: EmailCampaignSchema })
}

// Ad Variants Generation
const AdVariantSchema = z.object({
  platform: z.enum(['linkedin', 'meta', 'google', 'tiktok']),
  ad_type: z.enum(['single_image', 'carousel', 'video_script', 'text']),
  headline: z.string(),
  primary_text: z.string(),
  description: z.string().optional(),
  cta_type: z.string(),
  image_prompt: z.string().describe('A prompt for AI image generation'),
  targeting_notes: z.string().describe('Suggested audience targeting'),
})

const AdCampaignSchema = z.object({
  campaign_name: z.string(),
  variants: z.array(AdVariantSchema),
})

export async function generateAdVariants(
  campaign: Campaign,
  workspaceId: string,
  platforms: Array<'linkedin' | 'meta' | 'google' | 'tiktok'> = ['linkedin', 'meta']
): Promise<z.infer<typeof AdCampaignSchema>> {
  const workspaceSettings = await getWorkspaceSettings(workspaceId)

  const prompt = `
You are an expert paid media strategist. Generate ad variants for these platforms: ${platforms.join(', ')}.

Campaign Details:
- Name: ${campaign.name}
- Audience: ${campaign.audience}
- Goal: ${campaign.goal}
- Offer: ${campaign.offer}
- CTA: ${campaign.cta}

Brand Guidelines:
- Voice: ${workspaceSettings.brand_voice || 'professional, engaging'}
- Forbidden Phrases: ${workspaceSettings.forbidden_phrases?.join(', ') || 'none'}

For each platform, generate 2-3 variants optimized for that platform's best practices:

LinkedIn:
- Professional tone, B2B focused
- Headlines under 70 chars
- Primary text under 150 chars

Meta (Facebook/Instagram):
- More casual, scroll-stopping hooks
- Emojis acceptable
- Headlines under 40 chars

Google:
- Search intent focused
- Clear value proposition
- Headlines under 30 chars

TikTok:
- Native, authentic feel
- Trend-aware language
- Video script style

Include image prompts that can be used with AI image generators.
`

  return generateStructuredOutput({ prompt, schema: AdCampaignSchema })
}

// Sales Collateral Generation
const SalesOnePagerSchema = z.object({
  title: z.string(),
  tagline: z.string(),
  problem_statement: z.string(),
  solution_overview: z.string(),
  key_features: z.array(z.object({
    title: z.string(),
    description: z.string(),
  })),
  proof_points: z.array(z.string()),
  pricing_overview: z.string().optional(),
  call_to_action: z.string(),
  contact_info: z.string().optional(),
})

export async function generateSalesOnePager(
  campaign: Campaign,
  workspaceId: string
): Promise<z.infer<typeof SalesOnePagerSchema>> {
  const workspaceSettings = await getWorkspaceSettings(workspaceId)

  const prompt = `
You are an expert sales enablement strategist. Create a one-page sales sheet for this campaign.

Campaign Details:
- Name: ${campaign.name}
- Audience: ${campaign.audience}
- Goal: ${campaign.goal}
- Offer: ${campaign.offer}
- CTA: ${campaign.cta}

Brand Guidelines:
- Voice: ${workspaceSettings.brand_voice || 'professional, confident'}

The one-pager should be compelling enough for a sales rep to leave behind after a meeting.
Include:
1. An attention-grabbing title and tagline
2. Clear problem statement the audience faces
3. Solution overview
4. 3-4 key features with benefits
5. Proof points (stats, testimonials, logos)
6. Pricing overview (if applicable)
7. Strong call to action
`

  return generateStructuredOutput({ prompt, schema: SalesOnePagerSchema })
}

// SDR Talk Track
const TalkTrackSchema = z.object({
  opener: z.string().describe('Opening line to grab attention'),
  discovery_questions: z.array(z.string()),
  pain_point_statements: z.array(z.string()),
  value_propositions: z.array(z.object({
    claim: z.string(),
    proof: z.string(),
  })),
  objection_handlers: z.array(z.object({
    objection: z.string(),
    response: z.string(),
  })),
  closing_statements: z.array(z.string()),
  next_step_options: z.array(z.string()),
})

export async function generateTalkTrack(
  campaign: Campaign,
  workspaceId: string
): Promise<z.infer<typeof TalkTrackSchema>> {
  const workspaceSettings = await getWorkspaceSettings(workspaceId)

  const prompt = `
You are an expert sales trainer. Create a talk track for SDRs to use when calling prospects.

Campaign Details:
- Name: ${campaign.name}
- Audience: ${campaign.audience}
- Goal: ${campaign.goal}
- Offer: ${campaign.offer}
- CTA: ${campaign.cta}

Brand Guidelines:
- Voice: ${workspaceSettings.brand_voice || 'conversational, not pushy'}

Create a natural-sounding talk track that includes:
1. A pattern-interrupt opener
2. 3-4 discovery questions to qualify the prospect
3. Pain point statements that resonate
4. Value propositions with proof points
5. Common objection handlers
6. Multiple closing statement options
7. Next step suggestions

Make it conversational, not robotic. SDRs should be able to use this naturally.
`

  return generateStructuredOutput({ prompt, schema: TalkTrackSchema })
}
