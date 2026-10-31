/**
 * Branded Email HTML Generator
 *
 * Generates email-safe HTML (table-based for client compatibility)
 * with brand token injection.
 *
 * Types: welcome, nurture, launch announcement, newsletter
 */

import { generateObject } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { detectAdjectiveStacks, detectSlop, extractNewClaims } from '@/lib/ai/anti-slop'
import { buildEmailSequencePrompt } from '@/lib/ai/prompts-v2'
import type { BrandMemoryTokens } from '@/lib/templates/brand-assembler'
import { createAssetDocument, type AssetDocument, type ContentBlock } from './asset-document'

// ============================================================================
// Types
// ============================================================================

export type EmailType = 'welcome' | 'nurture' | 'launch' | 'newsletter' | 'follow_up'

export interface EmailGenerationRequest {
  workspaceId: string
  brandId: string
  campaignId?: string
  type: EmailType
  subject: string
  brief: string
  audience?: string
  brand: BrandMemoryTokens
  preheader?: string
}

// ============================================================================
// AI Schema
// ============================================================================

const EmailContentSchema = z.object({
  subject: z.string(),
  preheader: z.string(),
  sections: z.array(
    z.object({
      type: z.enum(['header', 'body', 'cta', 'testimonial', 'footer', 'divider', 'image']),
      content: z.string(),
      ctaText: z.string().optional(),
      ctaUrl: z.string().optional(),
    })
  ),
  claims: z.array(z.string()).describe('Marketing claims needing validation'),
})

type EmailContent = z.infer<typeof EmailContentSchema>

// ============================================================================
// Main generator
// ============================================================================

export async function generateHtmlEmail(
  request: EmailGenerationRequest
): Promise<AssetDocument> {
  // 1. Generate email content via AI
  const { object: emailContent } = await generateObject({
    model: MODELS.CREATIVE,
    schema: EmailContentSchema,
    system: buildEmailSequencePrompt({
      audience: request.audience,
      brandVoice: `Brand palette: ${request.brand.colors.map((color) => `${color.role}=${color.value}`).join(', ')}
Fonts: ${request.brand.fonts.map((font) => `${font.role}=${font.family}`).join(', ')}`,
    }),
    prompt: `Create a ${request.type} email.
Subject: ${request.subject}
Brief: ${request.brief}
${request.audience ? `Audience: ${request.audience}` : ''}

Requirements:
- Professional ${request.type} email tone
- Clear structure: header, body content, CTA
- Keep paragraphs short (2-3 sentences)
- Include one clear call-to-action
- Flag any marketing claims
- Subject should be compelling (50 chars max)
- Preheader should complement the subject
- Keep the email under 150 words
- Mark any new factual assertion with [NEW_CLAIM]`,
  })

  // 2. Build email-safe HTML
  const typedEmailContent = emailContent as EmailContent
  const html = buildEmailHtml(typedEmailContent, request.brand, request.type)

  // 3. Build content blocks
  const blocks: ContentBlock[] = typedEmailContent.sections.map((section) => ({
    id: crypto.randomUUID(),
    type: section.type === 'cta' ? 'cta' as const : section.type === 'header' ? 'headline' as const : 'body' as const,
    content: section.content,
  }))

  const textForChecks = [
    typedEmailContent.subject,
    typedEmailContent.preheader,
    ...typedEmailContent.sections.map((section) => section.content),
  ].join('\n')
  const fabricatedClaims = extractNewClaims(textForChecks)
  const slopViolations = [
    ...detectSlop(textForChecks),
    ...detectAdjectiveStacks(textForChecks).map((stack) => ({
      phrase: stack,
      location: textForChecks.indexOf(stack),
      fix: 'Rewrite the adjective stack with one concrete descriptor',
      severity: 'hard' as const,
    })),
  ]

  // 4. Create AssetDocument
  return createAssetDocument({
    workspaceId: request.workspaceId,
    brandId: request.brandId,
    campaignId: request.campaignId,
    type: 'email',
    html,
    blocks,
    designTokens: {
      colors: {
        primary: request.brand.colors.find((c) => c.role === 'primary')?.value ?? '#1f2937',
        secondary: request.brand.colors.find((c) => c.role === 'secondary')?.value ?? '#475569',
        background: '#ffffff',
        text: '#1f2937',
      },
      typography: {
        heading: request.brand.fonts.find((f) => f.role === 'heading')?.family ?? 'Georgia',
        body: request.brand.fonts.find((f) => f.role === 'body')?.family ?? 'system-ui',
        sizes: { h1: '28px', h2: '22px', body: '16px' },
      },
      spacing: { base: 8, scale: [8, 16, 24, 32] },
    },
    dimensions: { width: 600, height: 0 }, // Email width, height is dynamic
    claims: [
      ...(typedEmailContent.claims ?? []).map((text) => ({
        id: crypto.randomUUID(),
        text,
        riskScore: fabricatedClaims.includes(text) ? 65 : 0,
        riskLevel: fabricatedClaims.includes(text) ? 'high' as const : 'low' as const,
        status: 'unverified' as const,
        evidenceIds: [],
        suggestedRewrite: fabricatedClaims.includes(text) ? 'Validate this AI-generated claim against approved evidence before sending.' : undefined,
      })),
      ...slopViolations.map((violation) => ({
        id: crypto.randomUUID(),
        text: `Slop detector: ${violation.phrase}`,
        riskScore: violation.severity === 'hard' ? 55 : 35,
        riskLevel: violation.severity === 'hard' ? 'medium' as const : 'low' as const,
        status: 'unverified' as const,
        evidenceIds: [],
        suggestedRewrite: violation.fix,
      })),
    ],
    title: typedEmailContent.subject,
    description: typedEmailContent.preheader,
  })
}

// ============================================================================
// Email-safe HTML builder (table-based)
// ============================================================================

function buildEmailHtml(
  content: EmailContent,
  brand: BrandMemoryTokens,
  emailType: EmailType
): string {
  const primary = brand.colors.find((c) => c.role === 'primary')?.value ?? '#1f2937'
  const bg = emailType === 'welcome' ? '#fcfcfd' : '#ffffff'
  const textColor = '#1f2937'
  const lightBg = '#f9fafb'
  const headingFont = brand.fonts.find((f) => f.role === 'heading')?.family ?? 'Georgia'
  const bodyFont = brand.fonts.find((f) => f.role === 'body')?.family ?? 'system-ui'
  const radius = emailType === 'welcome' ? '14px' : emailType === 'launch' ? '18px' : '8px'
  const templateStyle = emailType === 'welcome'
    ? 'near-plain'
    : emailType === 'launch' || emailType === 'newsletter'
    ? 'announcement'
    : 'nurture'

  const renderBody = (sectionContent: string): string =>
    sectionContent
      .split('\n')
      .filter(Boolean)
      .map((paragraph) => `<p style="margin:0 0 16px 0;">${esc(paragraph)}</p>`)
      .join('')

  const sectionsHtml = content.sections
    .map((section) => {
      switch (section.type) {
        case 'header':
          if (templateStyle === 'near-plain') {
            return `<tr><td style="padding:12px 0 20px;">
  <div style="width:48px;height:3px;background:${primary};margin-bottom:18px;"></div>
  <h1 style="margin:0;font-size:28px;font-weight:700;line-height:1.2;color:${textColor};font-family:'${headingFont}',Arial,sans-serif;">${esc(section.content)}</h1>
</td></tr>`
          }

          return `<tr><td style="padding:${templateStyle === 'announcement' ? '40px 40px 34px' : '30px 32px'};background:${templateStyle === 'announcement' ? '#f3f4f6' : primary};color:${templateStyle === 'announcement' ? textColor : '#ffffff'};">
  <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.78;margin-bottom:10px;">${templateStyle === 'announcement' ? 'Launch update' : 'Brand update'}</div>
  <h1 style="margin:0;font-size:${templateStyle === 'announcement' ? '30px' : '24px'};font-weight:700;font-family:'${headingFont}',Arial,sans-serif;">${esc(section.content)}</h1>
</td></tr>`

        case 'body':
          return `<tr><td style="padding:${templateStyle === 'near-plain' ? '0 0 20px' : '24px 40px'};color:${textColor};font-size:16px;line-height:1.7;font-family:'${bodyFont}',Arial,sans-serif;">
  ${renderBody(section.content)}
</td></tr>`

        case 'cta':
          if (templateStyle === 'near-plain') {
            return `<tr><td style="padding:4px 0 24px;">
  <a href="${section.ctaUrl ?? '#'}" style="color:${primary};text-decoration:underline;font-size:16px;font-weight:600;font-family:'${bodyFont}',Arial,sans-serif;">
    ${esc(section.ctaText ?? section.content)}
  </a>
</td></tr>`
          }

          return `<tr><td style="padding:16px 40px 32px;">
  <table cellpadding="0" cellspacing="0"><tr><td style="padding:14px 32px;background:${primary};border-radius:${radius};">
    <a href="${section.ctaUrl ?? '#'}" style="color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;font-family:'${bodyFont}',Arial,sans-serif;display:inline-block;">
      ${esc(section.ctaText ?? section.content)}
    </a>
  </td></tr></table>
</td></tr>`

        case 'testimonial':
          return `<tr><td style="padding:24px 40px;">
  <table cellpadding="0" cellspacing="0" style="background:${lightBg};border-radius:${radius};width:100%;border-left:4px solid ${primary};"><tr><td style="padding:24px;">
    <p style="font-size:16px;font-style:italic;color:${textColor};margin:0;line-height:1.6;">"${esc(section.content)}"</p>
  </td></tr></table>
</td></tr>`

        case 'divider':
          return `<tr><td style="padding:8px 40px;">
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
</td></tr>`

        case 'footer':
          return `<tr><td style="padding:24px 40px;background:${lightBg};font-size:12px;color:#9ca3af;text-align:center;font-family:'${bodyFont}',Arial,sans-serif;">
  ${esc(section.content)}
</td></tr>`

        default:
          return `<tr><td style="padding:24px 40px;color:${textColor};font-size:16px;line-height:1.6;">
  ${esc(section.content)}
</td></tr>`
      }
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<title>${esc(content.subject)}</title>
<!--[if !mso]><!-->
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--<![endif]-->
<style type="text/css">
  body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; }
  img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
  @media (prefers-color-scheme: dark) {
    body, table { background: #0b1020 !important; }
    .email-shell { background: #11172a !important; }
    .email-copy { color: #e5e7eb !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${templateStyle === 'near-plain' ? '#ffffff' : '#f4f4f5'};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${templateStyle === 'near-plain' ? '#ffffff' : '#f4f4f5'};">
<tr><td align="center" style="padding:${templateStyle === 'near-plain' ? '24px 20px' : '40px 20px'};">
  <table width="600" cellpadding="0" cellspacing="0" class="email-shell" style="background:${bg};border-radius:${templateStyle === 'near-plain' ? '0' : radius};overflow:hidden;box-shadow:${templateStyle === 'near-plain' ? 'none' : '0 1px 3px rgba(0,0,0,0.1)'};">
    ${sectionsHtml}
    <tr><td class="email-copy" style="padding:${templateStyle === 'near-plain' ? '8px 0 0' : '8px 40px 28px'};font-size:13px;color:#6b7280;font-family:'${bodyFont}',Arial,sans-serif;">
      ${(templateStyle === 'near-plain' ? 'Sent by a person-shaped workflow.' : 'Signature: Growth team, not a template blast.')}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
