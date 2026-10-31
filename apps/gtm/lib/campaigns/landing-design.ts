import { JSDOM } from 'jsdom'

import { generateLandingPage, type GeneratedPage } from '@/lib/ai/template-aware-generation'
import { resolveCampaignBrandId } from '@/lib/campaigns/brand-link'
import type { DesignDirection } from '@/lib/design/archetype-selector'
import { createServiceClient } from '@/lib/supabase/service'
import { GenerationPlanSchema, type GenerationPlan } from '@/lib/planning/types'
import type {
  GlobalStyles,
  SEOMeta,
  SectionContent,
  SectionStyles,
  SectionType,
  WebsiteDesign,
  WebsiteSection,
} from '@/lib/website/ai-designer'
import { getWorkspaceSettings } from '@/lib/workspace'

const DEFAULT_GLOBAL_STYLES: GlobalStyles = {
  colorScheme: 'light',
  primaryColor: '#84cc16',
  secondaryColor: '#0f172a',
  accentColor: '#f59e0b',
  fontHeading: 'Figtree',
  fontBody: 'Figtree',
  borderRadius: 'large',
  buttonStyle: 'solid',
}

const DEFAULT_SECTION_STYLES: SectionStyles = {
  layout: 'centered',
  alignment: 'center',
  background: 'white',
  spacing: 'normal',
}

export class MissingWebsiteDesignStorageError extends Error {
  constructor(message = 'Canonical website design storage is unavailable in this environment. Apply the missing Supabase migrations before generating or editing campaign landing pages.') {
    super(message)
    this.name = 'MissingWebsiteDesignStorageError'
  }
}

export function isMissingWebsiteDesignStorageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const err = error as {
    code?: string
    message?: string
    details?: string
    hint?: string
  }
  const message = `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`.toLowerCase()

  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    message.includes('website_designs') ||
    message.includes('schema cache')
  )
}

export function mapWebsiteDesignRow(row: Record<string, unknown>): WebsiteDesign {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    name: typeof row.name === 'string' && row.name ? row.name : 'Untitled landing page',
    description: typeof row.description === 'string' ? row.description : undefined,
    brand_id: typeof row.brand_id === 'string' ? row.brand_id : undefined,
    sections: Array.isArray(row.sections) ? (row.sections as WebsiteSection[]) : [],
    globalStyles: isObject(row.global_styles)
      ? { ...DEFAULT_GLOBAL_STYLES, ...(row.global_styles as Partial<GlobalStyles>) }
      : DEFAULT_GLOBAL_STYLES,
    seoMeta: isObject(row.seo_meta)
      ? ({
          title: typeof (row.seo_meta as Record<string, unknown>).title === 'string'
            ? String((row.seo_meta as Record<string, unknown>).title)
            : '',
          description: typeof (row.seo_meta as Record<string, unknown>).description === 'string'
            ? String((row.seo_meta as Record<string, unknown>).description)
            : '',
          keywords: Array.isArray((row.seo_meta as Record<string, unknown>).keywords)
            ? ((row.seo_meta as Record<string, unknown>).keywords as string[])
            : undefined,
          ogImage: typeof (row.seo_meta as Record<string, unknown>).ogImage === 'string'
            ? String((row.seo_meta as Record<string, unknown>).ogImage)
            : undefined,
        } satisfies SEOMeta)
      : { title: '', description: '' },
    renderHtml: typeof row.render_html === 'string' ? row.render_html : '',
    renderManifest: isObject(row.render_manifest) ? (row.render_manifest as Record<string, unknown>) : {},
    editorMode: row.editor_mode === 'controlled' ? 'controlled' : 'freeform',
    status: row.status === 'published' ? 'published' : 'draft',
    published_url: typeof row.published_url === 'string' ? row.published_url : undefined,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
  }
}

export function websiteDesignToRow(design: WebsiteDesign): Record<string, unknown> {
  return {
    id: design.id,
    workspace_id: design.workspace_id,
    name: design.name,
    description: design.description,
    brand_id: design.brand_id,
    sections: design.sections,
    global_styles: design.globalStyles,
    seo_meta: design.seoMeta,
    render_html: design.renderHtml ?? '',
    render_manifest: design.renderManifest ?? {},
    editor_mode: design.editorMode ?? 'freeform',
    status: design.status,
    published_url: design.published_url,
    created_at: design.created_at,
    updated_at: design.updated_at,
  }
}

export async function persistCampaignLandingDesign(params: {
  supabase: ReturnType<typeof createServiceClient>
  workspaceId: string
  campaignId: string
  design: WebsiteDesign
}): Promise<WebsiteDesign> {
  const { supabase, campaignId, design } = params

  const { error: designError } = await supabase
    .from('website_designs')
    .upsert(websiteDesignToRow(design))

  if (designError) {
    if (isMissingWebsiteDesignStorageError(designError)) {
      throw new MissingWebsiteDesignStorageError()
    }
    throw new Error(designError.message)
  }

  const { error: linkError } = await supabase
    .from('campaigns')
    .update({ landing_design_id: design.id })
    .eq('id', campaignId)

  if (linkError) {
    throw new Error(linkError.message)
  }

  return design
}

export async function fetchLinkedCampaignLandingDesign(params: {
  supabase: ReturnType<typeof createServiceClient>
  campaignId: string
  workspaceId: string
}): Promise<WebsiteDesign | null> {
  const { supabase, campaignId, workspaceId } = params
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('id, name, goal, offer, cta, audience, constraints, brand_id, landing_design_id')
    .eq('id', campaignId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    if (isMissingWebsiteDesignStorageError(error)) {
      throw new MissingWebsiteDesignStorageError()
    }
    return null
  }

  if (!campaign) return null

  return getOrBackfillCampaignLandingDesign({
    supabase,
    workspaceId,
    campaign: campaign as Record<string, unknown>,
  })
}

export async function getOrBackfillCampaignLandingDesign(params: {
  supabase: ReturnType<typeof createServiceClient>
  workspaceId: string
  campaign: Record<string, unknown>
}): Promise<WebsiteDesign | null> {
  const { supabase, workspaceId, campaign } = params

  if (typeof campaign.landing_design_id === 'string' && campaign.landing_design_id) {
    const { data: designRow, error } = await supabase
      .from('website_designs')
      .select('*')
      .eq('id', campaign.landing_design_id)
      .maybeSingle()

    if (error) {
      if (isMissingWebsiteDesignStorageError(error)) {
        throw new MissingWebsiteDesignStorageError()
      }
      throw new Error(error.message)
    }

    if (designRow) {
      return mapWebsiteDesignRow(designRow as Record<string, unknown>)
    }
  }

  const backfilled = await backfillCampaignLandingDesign({
    supabase,
    workspaceId,
    campaign,
  })

  if (!backfilled) return null

  await persistCampaignLandingDesign({
    supabase,
    workspaceId,
    campaignId: String(campaign.id),
    design: backfilled,
  })

  return backfilled
}

export async function generateCampaignLandingDesign(params: {
  supabase: ReturnType<typeof createServiceClient>
  workspaceId: string
  campaign: Record<string, unknown>
  designDirection?: DesignDirection
}): Promise<WebsiteDesign> {
  const { supabase, workspaceId, campaign, designDirection = 'auto' } = params
  const brandId = resolveCampaignBrandId(campaign)
  const prompt = await buildCampaignLandingPrompt({ supabase, workspaceId, campaign })
  const page = await generateLandingPage({
    brief: prompt,
    workspaceId,
    brandId: brandId ?? undefined,
    designDirection,
    plan: extractGenerationPlan(campaign.constraints),
  })

  const design = createWebsiteDesignFromGeneratedPage({
    page,
    workspaceId,
    campaign,
    brandId,
    designId: typeof campaign.landing_design_id === 'string' ? campaign.landing_design_id : undefined,
    designDirection,
  })

  return persistCampaignLandingDesign({
    supabase,
    workspaceId,
    campaignId: String(campaign.id),
    design,
  })
}

export function createWebsiteDesignFromGeneratedPage(params: {
  page: GeneratedPage
  workspaceId: string
  campaign: Record<string, unknown>
  brandId?: string | null
  designId?: string
  designDirection?: DesignDirection
}): WebsiteDesign {
  const { page, workspaceId, campaign, brandId, designId, designDirection } = params
  const now = new Date().toISOString()
  const existingCreatedAt =
    typeof campaign.created_at === 'string' ? campaign.created_at : now

  const name =
    typeof campaign.name === 'string' && campaign.name
      ? `${campaign.name} Landing Page`
      : page.seoMeta.title || 'Campaign landing page'

  const renderManifest: Record<string, unknown> = {
    generatedAt: now,
    designDirection: designDirection ?? 'auto',
    claims: page.claims,
    templateRefs: page.sections
      .map((s) => s.templateReference)
      .filter((ref): ref is string => typeof ref === 'string' && ref.length > 0),
    isLegacyBackfill: false,
  }

  return {
    id: designId ?? crypto.randomUUID(),
    workspace_id: workspaceId,
    name,
    description:
      typeof campaign.goal === 'string' && campaign.goal
        ? campaign.goal
        : page.seoMeta.description,
    brand_id: brandId ?? undefined,
    sections: page.websiteSections,
    globalStyles: page.globalStyles,
    seoMeta: page.seoMeta,
    renderHtml: stripTailwindCdn(page.html),
    renderManifest,
    editorMode: 'controlled',
    status: 'draft',
    created_at: existingCreatedAt,
    updated_at: now,
  }
}

/**
 * Remove any Tailwind CDN script tags from generated HTML so campaign pages
 * are fully self-contained without runtime network dependencies.
 */
function stripTailwindCdn(html: string): string {
  return html.replace(
    /<script[^>]+src=["'][^"']*cdn\.tailwindcss\.com[^"']*["'][^>]*>\s*<\/script>/gi,
    '',
  )
}

export function projectDesignToPageBlocks(design: WebsiteDesign, campaignId: string) {
  return [...design.sections]
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({
      campaign_id: campaignId,
      type: mapSectionTypeToPageBlockType(section.type),
      order: index,
      props: {
        headline: section.content.headline,
        subheadline: section.content.subheadline,
        description: section.content.description,
        items: section.content.items,
        cta_text: section.content.cta?.text,
        cta_url: section.content.cta?.link,
      },
    }))
}

async function backfillCampaignLandingDesign(params: {
  supabase: ReturnType<typeof createServiceClient>
  workspaceId: string
  campaign: Record<string, unknown>
}): Promise<WebsiteDesign | null> {
  const { supabase, workspaceId, campaign } = params
  const campaignId = String(campaign.id)

  const { data: legacyAsset } = await supabase
    .from('campaign_assets')
    .select('id, content, html, created_at')
    .eq('campaign_id', campaignId)
    .eq('asset_type', 'landing_page')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Prefer raw HTML from the asset when available — it is the authoritative render.
  const assetRow = legacyAsset as Record<string, unknown> | null
  const assetHtml =
    assetRow && typeof assetRow.html === 'string' && assetRow.html.trim().length > 0
      ? assetRow.html
      : assetRow && isObject(assetRow.content) && typeof (assetRow.content as Record<string, unknown>).html === 'string'
        ? String((assetRow.content as Record<string, unknown>).html)
        : null

  const sectionsFromAsset = extractSectionsFromLegacyAsset(assetRow)
  if (sectionsFromAsset.length > 0 || assetHtml) {
    return createBackfilledDesign({
      workspaceId,
      campaign,
      sections: sectionsFromAsset,
      renderHtml: assetHtml ?? undefined,
    })
  }

  const { data: blocks } = await supabase
    .from('page_blocks')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('order', { ascending: true })

  if (!blocks?.length) return null

  const sections = (blocks as Record<string, unknown>[]).map((block, index) =>
    pageBlockToSection(block, index)
  )

  return createBackfilledDesign({
    workspaceId,
    campaign,
    sections,
    // page_blocks don't have canonical HTML — regeneration is recommended
    renderHtml: undefined,
  })
}

async function buildCampaignLandingPrompt(params: {
  supabase: ReturnType<typeof createServiceClient>
  workspaceId: string
  campaign: Record<string, unknown>
}): Promise<string> {
  const { supabase, workspaceId, campaign } = params
  const settings = await getWorkspaceSettings(workspaceId)

  const [{ data: evidence }, { data: prediction }] = await Promise.all([
    supabase
      .from('evidence')
      .select('title, summary, content, type')
      .eq('workspace_id', workspaceId)
      .limit(6),
    supabase
      .from('performance_predictions')
      .select('overall_score, positive_factors, negative_factors')
      .eq('campaign_id', String(campaign.id))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const evidenceContext = (evidence ?? [])
    .map((item) => {
      const title = typeof item.title === 'string' ? item.title : 'Evidence'
      const summary =
        typeof item.summary === 'string' && item.summary
          ? item.summary
          : typeof item.content === 'string'
            ? item.content.slice(0, 180)
            : ''
      return `- ${title}: ${summary}`
    })
    .join('\n')

  const performanceContext = prediction
    ? [
        typeof prediction.overall_score === 'number'
          ? `Predicted performance score: ${prediction.overall_score}/100.`
          : null,
        Array.isArray(prediction.positive_factors) && prediction.positive_factors.length > 0
          ? `Positive factors: ${prediction.positive_factors.join(', ')}.`
          : null,
        Array.isArray(prediction.negative_factors) && prediction.negative_factors.length > 0
          ? `Avoid: ${prediction.negative_factors.join(', ')}.`
          : null,
      ]
        .filter(Boolean)
        .join(' ')
    : ''

  const forbiddenPhrases = Array.isArray(settings.forbidden_phrases)
    ? settings.forbidden_phrases.filter(
        (value: unknown): value is string => typeof value === 'string' && value.length > 0,
      )
    : []

  return [
    `Create a production-ready SaaS landing page for "${stringValue(campaign.name, 'this product')}".`,
    `Audience: ${stringValue(campaign.audience, 'general buyers')}.`,
    `Goal: ${stringValue(campaign.goal, 'drive qualified conversions')}.`,
    `Offer: ${stringValue(campaign.offer, stringValue(campaign.name, 'the product'))}.`,
    `Primary CTA: ${stringValue(campaign.cta, 'Get started')}.`,
    settings.industry ? `Industry: ${settings.industry}.` : null,
    settings.brand_voice ? `Brand voice: ${settings.brand_voice}.` : null,
    forbiddenPhrases.length > 0 ? `Do not use these phrases: ${forbiddenPhrases.join(', ')}.` : null,
    evidenceContext ? `Use these proof points where relevant:\n${evidenceContext}` : null,
    performanceContext || null,
    'Use a confident but restrained visual system. Make the page feel designed, not placeholder-generated.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function createBackfilledDesign(params: {
  workspaceId: string
  campaign: Record<string, unknown>
  sections: WebsiteSection[]
  renderHtml?: string
}): WebsiteDesign {
  const { workspaceId, campaign, sections, renderHtml } = params
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    name: `${stringValue(campaign.name, 'Campaign')} Landing Page`,
    description: stringValue(campaign.goal, ''),
    brand_id: resolveCampaignBrandId(campaign) ?? undefined,
    sections,
    globalStyles: DEFAULT_GLOBAL_STYLES,
    seoMeta: {
      title: `${stringValue(campaign.name, 'Campaign')} Landing Page`,
      description: stringValue(campaign.offer, stringValue(campaign.goal, '')),
    },
    renderHtml: renderHtml ? stripTailwindCdn(renderHtml) : '',
    renderManifest: {
      isLegacyBackfill: true,
      backfilledAt: now,
      sourceHasHtml: Boolean(renderHtml),
    },
    editorMode: 'controlled',
    status: 'draft',
    created_at: now,
    updated_at: now,
  }
}

function extractSectionsFromLegacyAsset(asset: Record<string, unknown> | null): WebsiteSection[] {
  if (!asset) return []

  const content = isObject(asset.content) ? (asset.content as Record<string, unknown>) : null
  const directSections = content?.websiteSections
  if (Array.isArray(directSections) && directSections.every(isObject)) {
    return directSections as WebsiteSection[]
  }

  const rawSections = Array.isArray(content?.sections) ? (content?.sections as unknown[]) : []
  const mappedSections = rawSections
    .map((section, index) => mapLegacyAssetSection(section, index))
    .filter((section): section is WebsiteSection => section !== null)

  if (mappedSections.length > 0) return mappedSections

  const html =
    typeof asset.html === 'string'
      ? asset.html
      : typeof content?.html === 'string'
        ? String(content.html)
        : ''

  if (!html) return []

  return extractSectionsFromHtml(html)
}

function mapLegacyAssetSection(section: unknown, index: number): WebsiteSection | null {
  if (!isObject(section)) return null

  if (Array.isArray(section.content) || isObject(section.content)) {
    return {
      id: typeof section.id === 'string' ? section.id : crypto.randomUUID(),
      type: normalizeSectionType(section.type),
      order: index,
      content: isObject(section.content)
        ? (section.content as SectionContent)
        : {},
      styles: isObject(section.styles)
        ? ({ ...DEFAULT_SECTION_STYLES, ...(section.styles as Partial<SectionStyles>) } as SectionStyles)
        : sectionStyleForIndex(index, normalizeSectionType(section.type)),
    }
  }

  if (typeof section.html === 'string') {
    return htmlSnippetToSection(normalizeSectionType(section.type), section.html, index)
  }

  return null
}

function extractSectionsFromHtml(html: string): WebsiteSection[] {
  const dom = new JSDOM(html)
  const sections = Array.from(dom.window.document.querySelectorAll('section'))

  if (sections.length === 0) {
    return [htmlSnippetToSection('custom', html, 0)]
  }

  return sections.map((section, index) =>
    htmlSnippetToSection(inferSectionTypeFromElement(section, index), section.outerHTML, index)
  )
}

function htmlSnippetToSection(type: SectionType, html: string, order: number): WebsiteSection {
  const dom = new JSDOM(html)
  const document = dom.window.document
  const textContent = document.body.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  const heading =
    document.querySelector('h1, h2, h3')?.textContent?.trim() ||
    document.querySelector('[data-slot="headline"]')?.textContent?.trim() ||
    undefined
  const paragraph = document.querySelector('p')?.textContent?.trim() || undefined
  const listItems = Array.from(document.querySelectorAll('li'))
    .map((item) => item.textContent?.trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 6)
  const buttons = Array.from(document.querySelectorAll('a, button'))
    .map((node) => node.textContent?.trim())
    .filter((item): item is string => Boolean(item))

  const content: SectionContent = {
    headline: heading,
    subheadline: paragraph,
    description: paragraph ?? (textContent.slice(0, 220) || undefined),
  }

  if (listItems.length > 0) {
    content.items = listItems.map((item) => ({
      title: item,
      description: '',
    }))
  }

  if (buttons[0]) {
    content.cta = {
      text: buttons[0],
      link: '#cta',
      variant: 'primary',
    }
  }

  if (buttons[1]) {
    content.secondaryCta = {
      text: buttons[1],
      link: '#learn-more',
    }
  }

  return {
    id: crypto.randomUUID(),
    type,
    order,
    content,
    styles: sectionStyleForIndex(order, type),
  }
}

function inferSectionTypeFromElement(element: Element, index: number): SectionType {
  const text = element.textContent?.toLowerCase() ?? ''
  const className = element.getAttribute('class')?.toLowerCase() ?? ''

  if (index === 0 || className.includes('hero')) return 'hero'
  if (className.includes('faq') || text.includes('frequently asked')) return 'faq'
  if (className.includes('pricing') || text.includes('pricing')) return 'pricing'
  if (className.includes('testimonial') || text.includes('testimonial')) return 'testimonials'
  if (className.includes('logo') || text.includes('trusted by')) return 'logos'
  if (className.includes('stat') || text.includes('%')) return 'stats'
  if (className.includes('cta') || text.includes('get started') || text.includes('book demo')) return 'cta'
  return 'features'
}

function pageBlockToSection(block: Record<string, unknown>, index: number): WebsiteSection {
  const props = isObject(block.props) ? (block.props as Record<string, unknown>) : {}
  const type = mapPageBlockTypeToSectionType(typeof block.type === 'string' ? block.type : 'custom')

  return {
    id: typeof block.id === 'string' ? block.id : crypto.randomUUID(),
    type,
    order: index,
    content: mapPageBlockPropsToContent(type, props),
    styles: sectionStyleForIndex(index, type),
  }
}

function mapPageBlockPropsToContent(type: SectionType, props: Record<string, unknown>): SectionContent {
  const headline = readString(props.headline) ?? readString(props.title) ?? readString(props.heading)
  const subheadline = readString(props.subheadline) ?? readString(props.subtitle)
  const description = readString(props.description) ?? readString(props.content) ?? readString(props.body)

  const items = Array.isArray(props.items)
    ? (props.items as unknown[])
        .map((item) => {
          if (typeof item === 'string') {
            return { title: item, description: '' }
          }
          if (!isObject(item)) return null
          return {
            title: readString(item.title) ?? readString(item.name) ?? readString(item.question) ?? '',
            description: readString(item.description) ?? readString(item.desc) ?? readString(item.answer) ?? readString(item.price) ?? '',
          }
        })
        .filter((item): item is { title: string; description: string } => Boolean(item))
    : undefined

  const content: SectionContent = {
    headline,
    subheadline,
    description,
  }

  if (items && items.length > 0) {
    content.items = items
  }

  const ctaText = readString(props.cta_text) ?? readString(props.ctaText)
  if (ctaText) {
    content.cta = {
      text: ctaText,
      link: readString(props.cta_url) ?? '#cta',
      variant: 'primary',
    }
  }

  if (type === 'hero' && !content.headline) {
    content.headline = 'Landing page headline'
  }

  return content
}

function mapPageBlockTypeToSectionType(type: string): SectionType {
  switch (type) {
    case 'hero':
      return 'hero'
    case 'benefits':
    case 'features':
      return 'features'
    case 'trust':
    case 'logos':
      return 'logos'
    case 'pricing':
      return 'pricing'
    case 'faq':
      return 'faq'
    case 'stats':
      return 'stats'
    case 'comparison':
      return 'comparison'
    case 'testimonials':
    case 'testimonial':
      return 'testimonials'
    case 'cta':
    case 'footer':
    case 'footer_cta':
      return 'cta'
    case 'about':
      return 'about'
    case 'contact':
      return 'contact'
    case 'team':
      return 'team'
    case 'gallery':
      return 'gallery'
    case 'process':
      return 'timeline'
    default:
      return 'custom'
  }
}

function mapSectionTypeToPageBlockType(type: SectionType): string {
  switch (type) {
    case 'hero':
      return 'hero'
    case 'features':
      return 'features'
    case 'logos':
      return 'logos'
    case 'pricing':
      return 'pricing'
    case 'faq':
      return 'faq'
    case 'stats':
      return 'stats'
    case 'comparison':
      return 'comparison'
    case 'testimonials':
      return 'testimonials'
    case 'cta':
      return 'cta'
    default:
      return 'custom'
  }
}

function normalizeSectionType(value: unknown): SectionType {
  if (typeof value !== 'string') return 'custom'
  return mapPageBlockTypeToSectionType(value)
}

function sectionStyleForIndex(index: number, type: SectionType): SectionStyles {
  if (type === 'hero') {
    return {
      layout: 'centered',
      alignment: 'center',
      background: 'dark',
      spacing: 'spacious',
    }
  }

  if (type === 'cta') {
    return {
      layout: 'centered',
      alignment: 'center',
      background: 'gradient',
      spacing: 'spacious',
    }
  }

  if (type === 'logos' || type === 'stats') {
    return {
      layout: 'grid',
      alignment: 'center',
      background: index % 2 === 0 ? 'light' : 'white',
      spacing: 'normal',
      columns: type === 'stats' ? 4 : 5,
    }
  }

  return {
    ...DEFAULT_SECTION_STYLES,
    background: index % 2 === 0 ? 'white' : 'light',
    layout: type === 'features' || type === 'testimonials' || type === 'comparison' ? 'cards' : 'centered',
  }
}

function extractGenerationPlan(constraints: unknown): GenerationPlan | undefined {
  if (!isObject(constraints)) return undefined

  const rawPlan = (constraints as { generation_plan?: unknown }).generation_plan
  if (!rawPlan) return undefined

  const parsed = GenerationPlanSchema.safeParse(rawPlan)
  if (!parsed.success) {
    return undefined
  }

  return parsed.data
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
