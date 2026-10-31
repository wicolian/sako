import { NextRequest, NextResponse } from 'next/server'
import { generateObject } from '@/lib/ai/langsmith-ai'
import { z } from 'zod'
import { getModel } from '@/lib/ai/model-router'
import { createServiceClient } from '@/lib/supabase/service'
import { getBrandContext } from '@/lib/ai/brand-context'
import type { WebsiteSection, SectionType, SectionContent, SectionStyles } from '@/lib/website/ai-designer'

const RequestSchema = z.object({
  type: z.enum([
    'hero', 'features', 'testimonials', 'pricing', 'faq', 'cta',
    'about', 'team', 'contact', 'gallery', 'stats', 'logos',
    'comparison', 'timeline', 'blog', 'custom'
  ]),
  designId: z.string().optional(),
  brandId: z.string().optional(),
  prompt: z.string().optional(),
})

const ContentSchema = z.object({
  headline: z.string().optional(),
  subheadline: z.string().optional(),
  description: z.string().optional(),
  items: z.array(z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string().optional(),
  })).optional(),
  cta: z.object({
    text: z.string(),
    link: z.string(),
    variant: z.enum(['primary', 'secondary', 'outline']),
  }).optional(),
  secondaryCta: z.object({
    text: z.string(),
    link: z.string(),
  }).optional(),
})

const StylesSchema = z.object({
  layout: z.enum(['centered', 'split', 'grid', 'list', 'cards']),
  alignment: z.enum(['left', 'center', 'right']),
  background: z.enum(['white', 'light', 'dark', 'gradient', 'image']),
  spacing: z.enum(['compact', 'normal', 'spacious']),
  columns: z.number().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, designId, brandId, prompt } = RequestSchema.parse(body)

    // Get brand context if available
    let brandContext = ''
    if (brandId) {
      const supabase = createServiceClient()
      const { data: brand } = await supabase
        .from('brands')
        .select('name, voice, colors')
        .eq('id', brandId)
        .single()
      
      if (brand) {
        brandContext = `Brand: ${brand.name}\nVoice: ${JSON.stringify(brand.voice)}\nColors: ${JSON.stringify(brand.colors)}`
      }
    }

    const model = await getModel('anthropic/claude-sonnet-4.6')

    const sectionGuidelines = getSectionGuidelines(type)

    const { object } = await generateObject({
      model,
      schema: z.object({
        content: ContentSchema,
        styles: StylesSchema,
      }),
      prompt: `Generate content and styles for a ${type} section of a landing page.

${brandContext ? `BRAND CONTEXT:\n${brandContext}\n` : ''}
${prompt ? `USER REQUEST:\n${prompt}\n` : ''}

SECTION TYPE: ${type}
${sectionGuidelines}

Generate:
1. Content appropriate for this section type (headlines, descriptions, items if applicable)
2. Style settings that work well for this type of section

Requirements:
- Headlines should be attention-grabbing and concise (max 10 words)
- Subheadlines should expand on the headline (max 25 words)
- For items (features, testimonials, etc.), provide 3-6 items
- Use relevant icons from common emoji set for feature icons
- CTAs should use action verbs
- Choose styles that match the section purpose`,
    })

    const result = object as { content: SectionContent; styles: SectionStyles }
    
    const section: WebsiteSection = {
      id: crypto.randomUUID(),
      type,
      order: 0,
      content: result.content,
      styles: result.styles,
    }

    return NextResponse.json(section)
  } catch (error) {
    console.error('Section generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate section' },
      { status: 500 }
    )
  }
}

function getSectionGuidelines(type: SectionType): string {
  const guidelines: Record<SectionType, string> = {
    hero: `HERO SECTION:
- Strong value proposition headline
- Supporting subheadline that explains the benefit
- Primary CTA (action-oriented)
- Optional secondary CTA
- Use centered or split layout
- Spacious padding for impact`,

    features: `FEATURES SECTION:
- Headline introducing the features
- 3-6 feature items with icons
- Each feature needs title and short description
- Use grid or cards layout
- 3 columns typical`,

    testimonials: `TESTIMONIALS SECTION:
- Headline like "What our customers say"
- 3-4 customer quotes
- Include customer name as title
- Quote as description
- Use cards layout`,

    pricing: `PRICING SECTION:
- Headline introducing pricing
- 2-4 pricing tier items
- Each tier: name as title, price/description
- Highlight middle tier typically
- Include CTA to sign up`,

    faq: `FAQ SECTION:
- Headline like "Frequently Asked Questions"
- 5-8 Q&A items
- Question as title
- Answer as description
- Use list layout`,

    cta: `CTA SECTION:
- Strong action-oriented headline
- Brief supporting text
- Prominent CTA button
- Use centered layout
- Consider gradient or colored background`,

    about: `ABOUT SECTION:
- Company story headline
- Description of mission/values
- Use centered or split layout`,

    team: `TEAM SECTION:
- Headline introducing the team
- 3-6 team member items
- Name as title, role as description
- Use grid layout`,

    contact: `CONTACT SECTION:
- Headline inviting contact
- Contact information items
- CTA to contact form
- Use split layout`,

    gallery: `GALLERY SECTION:
- Optional headline
- 6-12 placeholder items for images
- Use grid layout`,

    stats: `STATS SECTION:
- Optional headline
- 3-4 impressive statistics
- Number as title, label as description
- Use centered grid layout`,

    logos: `LOGOS SECTION:
- Small headline like "Trusted by" or "Featured in"
- 4-8 company name items
- Use centered layout with light styling`,

    comparison: `COMPARISON SECTION:
- Headline comparing options
- Feature comparison items
- Use grid or cards layout`,

    timeline: `TIMELINE SECTION:
- Headline for the timeline
- Chronological event items
- Use list layout`,

    blog: `BLOG SECTION:
- Headline like "Latest from our blog"
- 3-6 article preview items
- Title and excerpt as description
- Use cards layout`,

    custom: `CUSTOM SECTION:
- Flexible content based on purpose
- Headline and description
- Appropriate layout for content`,
  }

  return guidelines[type]
}
