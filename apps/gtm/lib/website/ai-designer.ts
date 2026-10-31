/**
 * AI Website Designer
 * 
 * Prompt-to-design website generation with:
 * - Natural language input
 * - Reference template selection
 * - Brand-aware styling
 * - Section-by-section generation
 */

import { generateObject, streamObject } from '@/lib/ai/langsmith-ai'
import { getModel } from '@/lib/ai/model-router'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { getBrandContext } from '@/lib/ai/brand-context'

// ============================================================================
// Types
// ============================================================================

export interface WebsiteSection {
  id: string
  type: SectionType
  order: number
  content: SectionContent
  styles: SectionStyles
}

export type SectionType = 
  | 'hero'
  | 'features'
  | 'testimonials'
  | 'pricing'
  | 'faq'
  | 'cta'
  | 'about'
  | 'team'
  | 'contact'
  | 'gallery'
  | 'stats'
  | 'logos'
  | 'comparison'
  | 'timeline'
  | 'blog'
  | 'custom'

export interface SectionContent {
  headline?: string
  subheadline?: string
  description?: string
  items?: Array<{
    title: string
    description: string
    icon?: string
    image?: string
    link?: string
  }>
  cta?: {
    text: string
    link: string
    variant: 'primary' | 'secondary' | 'outline'
  }
  secondaryCta?: {
    text: string
    link: string
  }
  media?: {
    type: 'image' | 'video' | 'illustration'
    url?: string
    alt?: string
    placeholder?: string
  }
  [key: string]: unknown
}

export interface SectionStyles {
  layout: 'centered' | 'split' | 'grid' | 'list' | 'cards'
  alignment: 'left' | 'center' | 'right'
  background: 'white' | 'light' | 'dark' | 'gradient' | 'image'
  spacing: 'compact' | 'normal' | 'spacious'
  columns?: number
  customClasses?: string
}

export interface WebsiteDesign {
  id: string
  workspace_id: string
  name: string
  description?: string
  brand_id?: string
  
  // Design
  sections: WebsiteSection[]
  globalStyles: GlobalStyles
  
  // Meta
  seoMeta: SEOMeta
  
  // Status
  status: 'draft' | 'published'
  published_url?: string
  
  created_at: string
  updated_at: string
}

export interface GlobalStyles {
  colorScheme: 'light' | 'dark' | 'auto'
  primaryColor: string
  secondaryColor?: string
  accentColor?: string
  fontHeading: string
  fontBody: string
  borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full'
  buttonStyle: 'solid' | 'outline' | 'ghost'
}

export interface SEOMeta {
  title: string
  description: string
  keywords?: string[]
  ogImage?: string
}

export interface GenerateWebsiteOptions {
  prompt: string
  referenceTemplates?: string[]
  brandId?: string
  style?: 'minimal' | 'bold' | 'classic' | 'modern' | 'playful'
  pages?: string[]
  includeContent?: boolean
}

// ============================================================================
// AI Designer
// ============================================================================

/**
 * Generate a website from a prompt
 */
export async function generateWebsite(
  workspaceId: string,
  options: GenerateWebsiteOptions
): Promise<WebsiteDesign> {
  const { prompt, referenceTemplates, brandId, style = 'modern', includeContent = true } = options

  // Get brand context if available
  const brandContext = brandId 
    ? await getBrandContext(workspaceId, brandId)
    : null

  // Get reference templates if specified
  let templateContext = ''
  if (referenceTemplates?.length) {
    templateContext = await getTemplateContext(referenceTemplates)
  }

  // Step 1: Generate site structure
  const brandContextString = brandContext ? JSON.stringify(brandContext) : null
  const structure = await generateSiteStructure(prompt, brandContextString, templateContext, style)

  // Step 2: Generate content for each section
  const sections: WebsiteSection[] = []
  
  for (let i = 0; i < structure.sections.length; i++) {
    const sectionSpec = structure.sections[i]
    const section = await generateSection(
      sectionSpec,
      prompt,
      brandContextString,
      style,
      includeContent
    )
    sections.push({
      ...section,
      order: i,
    })
  }

  // Step 3: Generate global styles
  const globalStyles = await generateGlobalStyles(brandContextString, style)

  // Step 4: Generate SEO meta
  const seoMeta = await generateSEOMeta(prompt, brandContextString)

  // Create the design
  const design: WebsiteDesign = {
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    name: structure.name,
    description: structure.description,
    brand_id: brandId,
    sections,
    globalStyles,
    seoMeta,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Save to database
  await saveDesign(design)

  return design
}

/**
 * Generate site structure from prompt
 */
async function generateSiteStructure(
  prompt: string,
  brandContext: string | null,
  templateContext: string,
  style: string
): Promise<{
  name: string
  description: string
  sections: Array<{ type: SectionType; purpose: string }>
}> {
  const model = await getModel('anthropic/claude-sonnet-4.6')

  const StructureSchema = z.object({
    name: z.string(),
    description: z.string(),
    sections: z.array(z.object({
      type: z.enum([
        'hero', 'features', 'testimonials', 'pricing', 'faq', 'cta',
        'about', 'team', 'contact', 'gallery', 'stats', 'logos',
        'comparison', 'timeline', 'blog', 'custom'
      ]),
      purpose: z.string(),
    })),
  })

  const { object } = await generateObject({
    model,
    schema: StructureSchema,
    prompt: `Design a website structure based on this request:

Request: ${prompt}

${brandContext ? `Brand Context:\n${brandContext}` : ''}
${templateContext ? `Reference Templates:\n${templateContext}` : ''}

Style preference: ${style}

Create a logical page structure with:
1. A clear name for the website
2. A brief description of its purpose
3. A list of sections in order (6-10 sections typically)

Each section should have:
- type: The section type from the available options
- purpose: What this section should accomplish

Choose sections that best serve the website's goals. Consider:
- Hero section to make a strong first impression
- Features/benefits to showcase value
- Social proof (testimonials, logos)
- Clear call-to-action
- FAQ if complex offering
- Contact/footer`,
  })

  return object as any
}

/**
 * Generate a single section
 */
async function generateSection(
  spec: { type: SectionType; purpose: string },
  sitePrompt: string,
  brandContext: string | null,
  style: string,
  includeContent: boolean
): Promise<WebsiteSection> {
  const model = await getModel('anthropic/claude-sonnet-4.6')

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

  const SectionSchema = z.object({
    content: ContentSchema,
    styles: StylesSchema,
  })

  const layoutGuidelines = getSectionLayoutGuidelines(spec.type)

  const { object } = await generateObject({
    model,
    schema: SectionSchema,
    prompt: `Generate content and styles for a ${spec.type} section.

Website context: ${sitePrompt}
Section purpose: ${spec.purpose}
${brandContext ? `Brand Context:\n${brandContext}` : ''}
Style: ${style}

${layoutGuidelines}

${includeContent ? 'Generate compelling, realistic content.' : 'Generate placeholder content that indicates what should go there.'}

Requirements:
- Headline should be attention-grabbing and concise
- Subheadline should expand on the headline
- Items should be specific and valuable
- CTAs should be action-oriented
- Choose layouts that fit the content type`,
  })

  return {
    id: crypto.randomUUID(),
    type: spec.type,
    order: 0,
    content: (object as any).content as SectionContent,
    styles: (object as any).styles,
  }
}

/**
 * Generate global styles
 */
async function generateGlobalStyles(
  brandContext: string | null,
  style: string
): Promise<GlobalStyles> {
  // Default styles based on style preference
  const stylePresets: Record<string, Partial<GlobalStyles>> = {
    minimal: {
      borderRadius: 'small',
      buttonStyle: 'outline',
    },
    bold: {
      borderRadius: 'medium',
      buttonStyle: 'solid',
    },
    classic: {
      borderRadius: 'none',
      buttonStyle: 'solid',
    },
    modern: {
      borderRadius: 'large',
      buttonStyle: 'solid',
    },
    playful: {
      borderRadius: 'full',
      buttonStyle: 'solid',
    },
  }

  return {
    colorScheme: 'light',
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    accentColor: '#f59e0b',
    fontHeading: 'Inter',
    fontBody: 'Inter',
    ...stylePresets[style],
    borderRadius: stylePresets[style]?.borderRadius || 'medium',
    buttonStyle: stylePresets[style]?.buttonStyle || 'solid',
  }
}

/**
 * Generate SEO meta
 */
async function generateSEOMeta(
  prompt: string,
  brandContext: string | null
): Promise<SEOMeta> {
  const model = await getModel('openai/gpt-5.3-chat')

  const SEOSchema = z.object({
    title: z.string(),
    description: z.string(),
    keywords: z.array(z.string()),
  })

  const { object } = await generateObject({
    model,
    schema: SEOSchema,
    prompt: `Generate SEO metadata for a website:

Website purpose: ${prompt}
${brandContext ? `Brand Context:\n${brandContext}` : ''}

Generate:
- title: Page title (50-60 chars)
- description: Meta description (150-160 chars)
- keywords: 5-10 relevant keywords`,
  })

  return object as any
}

/**
 * Get layout guidelines for section type
 */
function getSectionLayoutGuidelines(type: SectionType): string {
  const guidelines: Record<SectionType, string> = {
    hero: 'Hero: Use centered or split layout. Include headline, subheadline, CTA, and optional media.',
    features: 'Features: Use grid or cards layout with 3-6 items. Each item needs title, description, and optional icon.',
    testimonials: 'Testimonials: Use cards or list layout with 2-4 items. Include quote, name, and title.',
    pricing: 'Pricing: Use grid or cards for 2-4 pricing tiers with features list.',
    faq: 'FAQ: Use list layout with 5-8 common questions and answers.',
    cta: 'CTA: Use centered layout with compelling headline and clear button.',
    about: 'About: Use split or centered layout with company story and values.',
    team: 'Team: Use grid or cards with 3-6 team member profiles.',
    contact: 'Contact: Use split layout with contact form on one side, info on other.',
    gallery: 'Gallery: Use grid layout with 6-12 images.',
    stats: 'Stats: Use grid layout with 3-4 impressive numbers.',
    logos: 'Logos: Use centered layout with 4-8 company logos.',
    comparison: 'Comparison: Use table or cards to compare features/products.',
    timeline: 'Timeline: Use list layout for chronological events.',
    blog: 'Blog: Use grid or cards for 3-6 recent posts.',
    custom: 'Custom: Flexible layout based on content needs.',
  }

  return guidelines[type] || ''
}

/**
 * Get template context from reference templates
 */
async function getTemplateContext(templateIds: string[]): Promise<string> {
  const supabase = createServiceClient()

  const { data: templates } = await supabase
    .from('templates')
    .select('name, description, structure')
    .in('id', templateIds)

  if (!templates?.length) return ''

  return templates
    .map(t => `Template: ${t.name}\nDescription: ${t.description}`)
    .join('\n\n')
}

/**
 * Save design to database
 */
async function saveDesign(design: WebsiteDesign): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('website_designs')
    .upsert({
      id: design.id,
      workspace_id: design.workspace_id,
      name: design.name,
      description: design.description,
      brand_id: design.brand_id,
      sections: design.sections,
      global_styles: design.globalStyles,
      seo_meta: design.seoMeta,
      status: design.status,
      published_url: design.published_url,
      created_at: design.created_at,
      updated_at: design.updated_at,
    })

  if (error) {
    console.error('Failed to save design:', error)
  }
}

/**
 * Regenerate a specific section
 */
export async function regenerateSection(
  design: WebsiteDesign,
  sectionId: string,
  feedback?: string
): Promise<WebsiteSection> {
  const section = design.sections.find(s => s.id === sectionId)
  if (!section) {
    throw new Error('Section not found')
  }

  const brandContext = design.brand_id
    ? await getBrandContext(design.workspace_id, design.brand_id)
    : null
  const brandContextString = brandContext ? JSON.stringify(brandContext) : null

  const model = await getModel('anthropic/claude-sonnet-4.6')

  // Regenerate with feedback
  const prompt = feedback
    ? `Regenerate this ${section.type} section with feedback: ${feedback}`
    : `Regenerate this ${section.type} section with fresh content`

  const newSection = await generateSection(
    { type: section.type, purpose: prompt },
    design.description || '',
    brandContextString,
    'modern',
    true
  )

  return {
    ...newSection,
    id: sectionId,
    order: section.order,
  }
}

/**
 * Add a new section to design
 */
export async function addSection(
  design: WebsiteDesign,
  sectionType: SectionType,
  afterSectionId?: string
): Promise<WebsiteSection> {
  const brandContext = design.brand_id
    ? await getBrandContext(design.workspace_id, design.brand_id)
    : null
  const brandContextString = brandContext ? JSON.stringify(brandContext) : null

  const newSection = await generateSection(
    { type: sectionType, purpose: `Add ${sectionType} section` },
    design.description || '',
    brandContextString,
    'modern',
    true
  )

  // Calculate order
  let order = design.sections.length
  if (afterSectionId) {
    const afterIndex = design.sections.findIndex(s => s.id === afterSectionId)
    if (afterIndex !== -1) {
      order = afterIndex + 1
    }
  }

  return {
    ...newSection,
    order,
  }
}
