/**
 * Newsletter Generator (Holo-style)
 * 
 * Generates newsletters that are both written AND designed by AI.
 * Produces multiple design variants for A/B testing.
 * 
 * Features:
 * - 3 design variants per newsletter
 * - Subject line optimization
 * - CTA optimization
 * - Brand color palette integration
 * - Export to Klaviyo/Mailchimp format
 */

import { generateObject } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { MODELS } from '@/lib/ai/ai-sdk-client'
import { getBrandContext, type BrandContext } from '@/lib/ai/brand-context'

// ============================================================================
// Types
// ============================================================================

export type NewsletterDesignStyle = 'minimal' | 'bold' | 'classic'

export interface NewsletterSection {
  type: 'header' | 'hero' | 'content' | 'cta' | 'divider' | 'footer' | 'image' | 'columns'
  content: Record<string, unknown>
}

export interface NewsletterDesign {
  id: string
  style: NewsletterDesignStyle
  subject: string
  preheader: string
  sections: NewsletterSection[]
  colorScheme: {
    background: string
    text: string
    accent: string
    buttonBackground: string
    buttonText: string
  }
  typography: {
    headingFont: string
    bodyFont: string
    headingSize: string
    bodySize: string
  }
}

export interface Newsletter {
  id: string
  topic: string
  audience: string
  tone: string
  subjectLines: string[]
  preheaders: string[]
  content: {
    headline: string
    introduction: string
    mainContent: string[]
    bulletPoints?: string[]
    cta: {
      text: string
      url?: string
    }
    signoff: string
  }
  designs: NewsletterDesign[]
  claims: string[]
}

export interface NewsletterGeneratorOptions {
  topic: string
  audience?: string
  tone?: 'professional' | 'casual' | 'friendly' | 'urgent'
  goal?: 'engagement' | 'sales' | 'announcement' | 'educational'
  includeDesigns?: boolean
  designCount?: number
  ctaUrl?: string
  brandId?: string
}

// ============================================================================
// Schemas
// ============================================================================

const NewsletterContentSchema = z.object({
  headline: z.string().describe('Main headline for the newsletter'),
  introduction: z.string().describe('Opening paragraph that hooks the reader'),
  mainContent: z.array(z.string()).describe('Main body paragraphs (2-4)'),
  bulletPoints: z.array(z.string()).optional().describe('Key takeaways or list items'),
  ctaText: z.string().describe('Call to action button text'),
  signoff: z.string().describe('Closing line before signature'),
  subjectLines: z.array(z.string()).describe('3 subject line options (50 chars max each)'),
  preheaders: z.array(z.string()).describe('3 preheader options (90 chars max each)'),
  claims: z.array(z.string()).describe('Marketing claims made in the content'),
})

const NewsletterDesignSchema = z.object({
  style: z.enum(['minimal', 'bold', 'classic']).describe('Design style'),
  colorScheme: z.object({
    background: z.string().describe('Background color hex'),
    text: z.string().describe('Text color hex'),
    accent: z.string().describe('Accent color hex'),
    buttonBackground: z.string().describe('CTA button background hex'),
    buttonText: z.string().describe('CTA button text hex'),
  }),
  typography: z.object({
    headingFont: z.string().describe('Heading font family'),
    bodyFont: z.string().describe('Body font family'),
    headingSize: z.string().describe('Heading size (e.g., 32px)'),
    bodySize: z.string().describe('Body text size (e.g., 16px)'),
  }),
  layoutDescription: z.string().describe('Brief description of the layout'),
})

const NewsletterDesignsBatchSchema = z.object({
  designs: z.array(NewsletterDesignSchema),
})

// ============================================================================
// Generator Functions
// ============================================================================

/**
 * Generate a complete newsletter with multiple design variants
 */
export async function generateNewsletter(
  workspaceId: string,
  options: NewsletterGeneratorOptions
): Promise<Newsletter> {
  const {
    topic,
    audience = 'subscribers',
    tone = 'professional',
    goal = 'engagement',
    includeDesigns = true,
    designCount = 3,
    ctaUrl,
    brandId,
  } = options

  const brandContext = await getBrandContext(workspaceId, brandId)

  // Generate content
  const { object: rawContent } = await generateObject({
    model: MODELS.CREATIVE,
    schema: NewsletterContentSchema,
    prompt: `Generate a newsletter about: ${topic}

TARGET AUDIENCE: ${audience}
TONE: ${tone}
GOAL: ${goal}

${brandContext ? `
BRAND CONTEXT:
- Brand Name: ${brandContext.name}
- Voice: ${brandContext.voice?.tone || 'professional'}
- Personality: ${brandContext.voice?.attributes?.join(', ') || 'trustworthy'}
` : ''}

NEWSLETTER REQUIREMENTS:
1. Subject lines: Create 3 options (max 50 chars each)
   - Option 1: Curiosity-driven
   - Option 2: Benefit-focused
   - Option 3: Urgency/FOMO

2. Preheaders: Create 3 options (max 90 chars each)
   - Should complement, not repeat, the subject line
   - Add context or tease the content

3. Content structure:
   - Headline: Bold, attention-grabbing
   - Introduction: 2-3 sentences that hook and preview value
   - Main content: 2-4 paragraphs of valuable content
   - Bullet points (optional): Key takeaways
   - CTA: Clear, action-oriented

4. Writing guidelines:
   - Use "you" and "your" to make it personal
   - Keep paragraphs short (2-3 sentences max)
   - Include one clear call-to-action
   - End with a warm, on-brand signoff

Generate compelling newsletter content that drives ${goal}.`,
  })
  const content = rawContent as z.infer<typeof NewsletterContentSchema>

  // Generate design variants
  let designs: NewsletterDesign[] = []

  if (includeDesigns) {
    const { object: designsResult } = await generateObject({
      model: MODELS.CREATIVE,
      schema: NewsletterDesignsBatchSchema,
      prompt: `Generate ${designCount} newsletter design variants.

${brandContext ? `
BRAND COLORS:
- Primary: ${brandContext.colors?.primary || '#000000'}
- Secondary: ${brandContext.colors?.secondary || '#666666'}
- Accent: ${brandContext.colors?.accent || '#007AFF'}
` : ''}

DESIGN REQUIREMENTS:
Generate exactly ${designCount} distinct design styles:

1. MINIMAL: Clean, lots of whitespace, single-column, modern
2. BOLD: High contrast, colorful accents, impactful typography
3. CLASSIC: Traditional newsletter layout, professional, timeless

For each design, provide:
- Color scheme that works with the brand colors
- Typography choices (use web-safe or Google Fonts)
- Layout description

EMAIL-SAFE REQUIREMENTS:
- Use web-safe fonts or common Google Fonts
- Ensure high contrast for readability
- Colors should work in both light and dark email clients`,
    })

    const designsRes = designsResult as { designs: Array<{ style: NewsletterDesignStyle; colorScheme: NewsletterDesign['colorScheme']; typography: NewsletterDesign['typography'] }> }
    designs = designsRes.designs.map((design, idx) => ({
      id: `design-${design.style}-${Date.now()}-${idx}`,
      style: design.style,
      subject: content.subjectLines[idx % content.subjectLines.length],
      preheader: content.preheaders[idx % content.preheaders.length],
      sections: buildSections(content, design.style),
      colorScheme: design.colorScheme,
      typography: design.typography,
    }))
  }

  return {
    id: `newsletter-${Date.now()}`,
    topic,
    audience,
    tone,
    subjectLines: content.subjectLines,
    preheaders: content.preheaders,
    content: {
      headline: content.headline,
      introduction: content.introduction,
      mainContent: content.mainContent,
      bulletPoints: content.bulletPoints ?? [],
      cta: {
        text: content.ctaText,
        url: ctaUrl || '#',
      },
      signoff: content.signoff,
    },
    designs,
    claims: content.claims ?? [],
  }
}

/**
 * Build newsletter sections based on content and style
 */
function buildSections(
  content: z.infer<typeof NewsletterContentSchema>,
  style: NewsletterDesignStyle
): NewsletterSection[] {
  const sections: NewsletterSection[] = []

  // Header
  sections.push({
    type: 'header',
    content: {
      logoPosition: style === 'minimal' ? 'left' : 'center',
    },
  })

  // Hero
  sections.push({
    type: 'hero',
    content: {
      headline: content.headline,
      showImage: style !== 'minimal',
    },
  })

  // Introduction
  sections.push({
    type: 'content',
    content: {
      text: content.introduction,
      alignment: style === 'classic' ? 'left' : 'center',
    },
  })

  // Main content
  for (const paragraph of content.mainContent) {
    sections.push({
      type: 'content',
      content: {
        text: paragraph,
        alignment: 'left',
      },
    })
  }

  // Bullet points (if any)
  if (content.bulletPoints && content.bulletPoints.length > 0) {
    sections.push({
      type: 'content',
      content: {
        type: 'list',
        items: content.bulletPoints,
      },
    })
  }

  // CTA
  sections.push({
    type: 'cta',
    content: {
      text: content.ctaText,
      style: style === 'bold' ? 'full-width' : 'inline',
    },
  })

  // Signoff
  sections.push({
    type: 'content',
    content: {
      text: content.signoff,
      alignment: 'left',
    },
  })

  // Footer
  sections.push({
    type: 'footer',
    content: {
      showSocial: style !== 'minimal',
      showUnsubscribe: true,
    },
  })

  return sections
}

/**
 * Export newsletter to HTML
 */
export function exportNewsletterToHtml(
  newsletter: Newsletter,
  designIndex: number = 0
): string {
  const design = newsletter.designs[designIndex]
  if (!design) {
    throw new Error(`Design index ${designIndex} not found`)
  }

  const { colorScheme, typography, sections } = design
  const { content } = newsletter

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${design.subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: ${colorScheme.background};
      font-family: ${typography.bodyFont}, Arial, sans-serif;
      font-size: ${typography.bodySize};
      color: ${colorScheme.text};
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      font-family: ${typography.headingFont}, Arial, sans-serif;
      font-size: ${typography.headingSize};
      color: ${colorScheme.text};
      margin-bottom: 20px;
    }
    p {
      margin-bottom: 16px;
    }
    .cta-button {
      display: inline-block;
      background-color: ${colorScheme.buttonBackground};
      color: ${colorScheme.buttonText};
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      margin: 20px 0;
    }
    ul {
      padding-left: 20px;
      margin-bottom: 16px;
    }
    li {
      margin-bottom: 8px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid ${colorScheme.accent}20;
      font-size: 12px;
      text-align: center;
      color: ${colorScheme.text}99;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${content.headline}</h1>
    <p>${content.introduction}</p>
    ${content.mainContent.map(p => `<p>${p}</p>`).join('\n    ')}
    ${content.bulletPoints ? `<ul>${content.bulletPoints.map(bp => `<li>${bp}</li>`).join('\n      ')}</ul>` : ''}
    <p style="text-align: center;">
      <a href="${content.cta.url || '#'}" class="cta-button">${content.cta.text}</a>
    </p>
    <p>${content.signoff}</p>
    <div class="footer">
      <p>You received this email because you subscribed to our newsletter.</p>
      <p><a href="#">Unsubscribe</a> | <a href="#">View in browser</a></p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Export newsletter to Klaviyo template format
 */
export function exportToKlaviyo(newsletter: Newsletter, designIndex: number = 0): {
  name: string
  html: string
  subject: string
  preheader: string
} {
  const design = newsletter.designs[designIndex]
  
  return {
    name: `Newsletter: ${newsletter.topic}`,
    html: exportNewsletterToHtml(newsletter, designIndex),
    subject: design?.subject || newsletter.subjectLines[0],
    preheader: design?.preheader || newsletter.preheaders[0],
  }
}

/**
 * Export newsletter to Mailchimp template format
 */
export function exportToMailchimp(newsletter: Newsletter, designIndex: number = 0): {
  name: string
  html: string
  subject_line: string
  preview_text: string
} {
  const design = newsletter.designs[designIndex]
  
  return {
    name: `Newsletter: ${newsletter.topic}`,
    html: exportNewsletterToHtml(newsletter, designIndex),
    subject_line: design?.subject || newsletter.subjectLines[0],
    preview_text: design?.preheader || newsletter.preheaders[0],
  }
}

/**
 * Generate subject line variations for A/B testing
 */
export async function generateSubjectLineVariations(
  topic: string,
  tone: string = 'professional',
  count: number = 5
): Promise<string[]> {
  const SubjectLinesSchema = z.object({
    subjectLines: z.array(z.string()).describe(`${count} subject line variations`),
  })

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: SubjectLinesSchema,
    prompt: `Generate ${count} email subject line variations for: ${topic}

TONE: ${tone}

SUBJECT LINE TYPES:
1. Curiosity: Create intrigue
2. Benefit: Lead with value
3. Urgency: Create FOMO
4. Question: Engage with a question
5. Personalization: Use "you/your"

REQUIREMENTS:
- Max 50 characters each
- No spam trigger words
- No ALL CAPS
- Include at least one with emoji option

Generate ${count} diverse, high-performing subject lines.`,
  })

  const result = object as { subjectLines: string[] }
  return result.subjectLines
}
