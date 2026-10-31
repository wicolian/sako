import type { ReactNode } from 'react'

import type { BrandContext } from '@/lib/ai/brand-context'
import { formatBrandPrompt } from '@/lib/ai/brand-context'
import type { OpenUiNode } from '@/lib/openui/runtime'
import { createLibrary, defineComponent, z } from '@/lib/openui/runtime'
import type { WebsiteDesign, WebsiteSection } from '@/lib/website/ai-designer'

export const SUPPORTED_OPENUI_SECTION_TYPES = ['hero', 'features', 'testimonials', 'cta'] as const

type SupportedOpenUiSectionType = (typeof SUPPORTED_OPENUI_SECTION_TYPES)[number]

interface FeatureItemProps {
  title: string
  description: string
}

interface FeatureGridProps {
  title: string
  intro: string
  items: OpenUiNode<FeatureItemProps>[]
}

interface TestimonialItemProps {
  quote: string
  name: string
  role: string
}

interface TestimonialStripProps {
  title: string
  items: OpenUiNode<TestimonialItemProps>[]
}

interface HeroSectionProps {
  headline: string
  subheadline: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel?: string
  secondaryHref?: string
}

interface CTASectionProps {
  headline: string
  body: string
  label: string
  href: string
}

interface LandingPageProps {
  name: string
  sections: Array<OpenUiNode<HeroSectionProps | FeatureGridProps | TestimonialStripProps | CTASectionProps>>
}

const FeatureItem = defineComponent({
  name: 'FeatureItem',
  description: 'A single feature or benefit card with a short title and description.',
  props: z.object({
    title: z.string().min(1).describe('Short feature title.'),
    description: z.string().min(1).describe('One or two short sentences explaining the feature.'),
  }),
  component: ({ props }: { props: FeatureItemProps }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-950">{props.title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{props.description}</p>
    </div>
  ),
})

const FeatureGrid = defineComponent({
  name: 'FeatureGrid',
  description: 'A section that introduces two to four feature cards.',
  props: z.object({
    title: z.string().min(1).describe('Section headline.'),
    intro: z.string().min(1).describe('Brief supporting copy for the feature grid.'),
    items: z.array(FeatureItem.ref).min(2).max(4).describe('Two to four feature cards.'),
  }),
  component: ({ props, renderNode }: { props: FeatureGridProps; renderNode: (value: unknown) => ReactNode }) => (
    <section className="border-t border-slate-200 bg-slate-50 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{props.title}</h2>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">{props.intro}</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {props.items.map((item, index) => (
            <div key={`${item.typeName}-${index}`}>{renderNode(item)}</div>
          ))}
        </div>
      </div>
    </section>
  ),
})

const TestimonialItem = defineComponent({
  name: 'TestimonialItem',
  description: 'A single customer proof card with quote, name, and role.',
  props: z.object({
    quote: z.string().min(1).describe('Customer quote.'),
    name: z.string().min(1).describe('Customer name.'),
    role: z.string().min(1).describe('Customer role, title, or company.'),
  }),
  component: ({ props }: { props: TestimonialItemProps }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-base leading-7 text-slate-700">&ldquo;{props.quote}&rdquo;</p>
      <div className="mt-5">
        <p className="text-sm font-semibold text-slate-950">{props.name}</p>
        <p className="text-sm text-slate-500">{props.role}</p>
      </div>
    </div>
  ),
})

const TestimonialStrip = defineComponent({
  name: 'TestimonialStrip',
  description: 'A section with two or three customer proof cards.',
  props: z.object({
    title: z.string().min(1).describe('Section headline.'),
    items: z.array(TestimonialItem.ref).min(2).max(3).describe('Two or three testimonial cards.'),
  }),
  component: ({ props, renderNode }: { props: TestimonialStripProps; renderNode: (value: unknown) => ReactNode }) => (
    <section className="border-t border-slate-200 bg-white px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{props.title}</h2>
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {props.items.map((item, index) => (
            <div key={`${item.typeName}-${index}`}>{renderNode(item)}</div>
          ))}
        </div>
      </div>
    </section>
  ),
})

const HeroSection = defineComponent({
  name: 'HeroSection',
  description: 'A top-of-page hero with headline, subheadline, and one or two call-to-action buttons.',
  props: z.object({
    headline: z.string().min(1).describe('Main value proposition headline.'),
    subheadline: z.string().min(1).describe('Supporting explanation below the headline.'),
    primaryLabel: z.string().min(1).describe('Primary call-to-action label.'),
    primaryHref: z.string().min(1).describe('Primary call-to-action link.'),
    secondaryLabel: z.string().optional().describe('Optional secondary call-to-action label.'),
    secondaryHref: z.string().optional().describe('Optional secondary call-to-action link.'),
  }),
  component: ({ props }: { props: HeroSectionProps }) => (
    <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-20 text-white sm:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{props.headline}</h1>
          <p className="mt-6 text-lg leading-8 text-slate-200">{props.subheadline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              className="inline-flex items-center rounded-full bg-lime-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-lime-200"
              href={props.primaryHref}
            >
              {props.primaryLabel}
            </a>
            {props.secondaryLabel && props.secondaryHref ? (
              <a
                className="inline-flex items-center rounded-full border border-white/25 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/45"
                href={props.secondaryHref}
              >
                {props.secondaryLabel}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  ),
})

const CTASection = defineComponent({
  name: 'CTASection',
  description: 'A bottom-of-page conversion section with a headline, supporting copy, and a single CTA.',
  props: z.object({
    headline: z.string().min(1).describe('Conversion-focused closing headline.'),
    body: z.string().min(1).describe('Supporting copy for the CTA.'),
    label: z.string().min(1).describe('CTA button label.'),
    href: z.string().min(1).describe('CTA button link.'),
  }),
  component: ({ props }: { props: CTASectionProps }) => (
    <section className="border-t border-slate-200 bg-lime-100 px-6 py-16 sm:px-10">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{props.headline}</h2>
        <p className="mt-4 text-base leading-7 text-slate-700">{props.body}</p>
        <a
          className="mt-8 inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          href={props.href}
        >
          {props.label}
        </a>
      </div>
    </section>
  ),
})

const LandingPage = defineComponent({
  name: 'LandingPage',
  description: 'The root landing page component. Always use this as the final root.',
  props: z.object({
    name: z.string().min(1).describe('Internal page name for the layout.'),
    sections: z
      .array(z.union([HeroSection.ref, FeatureGrid.ref, TestimonialStrip.ref, CTASection.ref]))
      .min(1)
      .max(4)
      .describe('Ordered landing-page sections.'),
  }),
  component: ({ props, renderNode }: { props: LandingPageProps; renderNode: (value: unknown) => ReactNode }) => (
    <main className="min-h-screen bg-white text-slate-950">
      {props.sections.map((section, index) => (
        <div key={`${section.typeName}-${index}`}>{renderNode(section)}</div>
      ))}
    </main>
  ),
})

export const sakoOpenUiLibrary = createLibrary({
  components: [LandingPage, HeroSection, FeatureGrid, FeatureItem, TestimonialStrip, TestimonialItem, CTASection],
  componentGroups: [
    { name: 'Page', components: ['LandingPage'] },
    { name: 'Hero', components: ['HeroSection'] },
    { name: 'Benefits', components: ['FeatureGrid', 'FeatureItem'] },
    { name: 'Proof', components: ['TestimonialStrip', 'TestimonialItem'] },
    { name: 'Conversion', components: ['CTASection'] },
  ],
  root: 'LandingPage',
})

export const SAMPLE_OPENUI_DOCUMENT = [
  'root = LandingPage("Sako OpenUI POC", [hero, features, proof, cta])',
  'feature1 = FeatureItem("Compliance-first workflows", "Turn proof-heavy messaging into on-brand landing pages without rewriting every block by hand.")',
  'feature2 = FeatureItem("Streaming previews", "Show the shape of the page while the model is still composing the content.")',
  'quote1 = TestimonialItem("We went from rough prompt to a reviewable landing page in one session.", "Alex Nguyen", "Head of Growth, Layerbeam")',
  'quote2 = TestimonialItem("The proof blocks look deliberate instead of generic.", "Rina Patel", "Product Marketing, Traceforge")',
  'hero = HeroSection("Launch proof-heavy pages faster", "OpenUI streams a constrained landing-page composition from Sako-approved components so teams see structure immediately.", "Start the demo", "/demo", "See the source", "#source")',
  'features = FeatureGrid("Why this POC matters", "The component library keeps the model inside Sako-safe layout patterns while still letting it tailor copy to the brief.", [feature1, feature2])',
  'proof = TestimonialStrip("What teams notice first", [quote1, quote2])',
  'cta = CTASection("Use OpenUI where streaming matters", "Keep the current HTML export path for publishing, and let the OpenUI runtime own fast interactive previews.", "Open the editor", "/editor")',
].join('\n')

export function buildSakoOpenUiSystemPrompt(options?: {
  brand?: BrandContext | null
  sectionTypes?: readonly SupportedOpenUiSectionType[]
}): string {
  const sectionTypes = options?.sectionTypes?.length ? options.sectionTypes : SUPPORTED_OPENUI_SECTION_TYPES

  return sakoOpenUiLibrary.prompt({
    preamble: [
      'You are Sako Composer’s generative UI designer.',
      'Respond only with valid OpenUI Lang statements.',
      'Never use Markdown fences, prose, explanations, or HTML.',
      options?.brand ? formatBrandPrompt(options.brand) : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    additionalRules: [
      'Always assign the final page to `root`.',
      `Prefer these section shapes when helpful: ${sectionTypes.join(', ')}.`,
      'Keep copy concise, proof-aware, and conversion-focused.',
      'Use no more than four sections in a single response.',
      'Use relative links such as "/demo" or fragment links such as "#proof".',
      'If the brand emphasizes compliance or proof, include a testimonial or proof-style section.',
    ],
    examples: [SAMPLE_OPENUI_DOCUMENT],
  })
}

export function buildOpenUiPromptFromDesign(design: WebsiteDesign): string {
  const supportedSections = [...design.sections]
    .sort((left, right) => left.order - right.order)
    .map((section) => section.type)
    .filter((section): section is SupportedOpenUiSectionType =>
      SUPPORTED_OPENUI_SECTION_TYPES.includes(section as SupportedOpenUiSectionType)
    )

  const sectionSummary =
    supportedSections.length > 0 ? supportedSections.join(', ') : SUPPORTED_OPENUI_SECTION_TYPES.join(', ')

  return [
    `Create an interactive landing page concept for "${design.name}".`,
    design.description ? `Context: ${design.description}` : 'Context: This is a Sako Composer website design preview.',
    `Preferred sections: ${sectionSummary}.`,
    'Keep the page strong on proof, clear on the CTA, and visually deliberate.',
    'Use only the available OpenUI components.',
  ].join('\n')
}

export function websiteDesignToOpenUiSource(design: WebsiteDesign): string {
  const sortedSections = [...design.sections].sort((left, right) => left.order - right.order)
  const lines: string[] = []
  const sectionRefs: string[] = []

  sortedSections.forEach((section, index) => {
    const ref = `${section.type}${index + 1}`
    const rendered = renderSectionToOpenUi(section, ref, lines)
    if (rendered) {
      sectionRefs.push(rendered)
    }
  })

  if (sectionRefs.length === 0) {
    return SAMPLE_OPENUI_DOCUMENT
  }

  return [
    `root = LandingPage(${stringLiteral(design.name || 'Sako OpenUI Preview')}, [${sectionRefs.join(', ')}])`,
    ...lines,
  ].join('\n')
}

function renderSectionToOpenUi(section: WebsiteSection, ref: string, lines: string[]): string | null {
  switch (section.type) {
    case 'hero': {
      lines.push(
        `${ref} = HeroSection(${stringLiteral(section.content.headline || 'Launch your next page faster')}, ${stringLiteral(
          section.content.subheadline || section.content.description || 'Stream a landing-page draft from Sako-approved components.'
        )}, ${stringLiteral(section.content.cta?.text || 'Get started')}, ${stringLiteral(
          section.content.cta?.link || '/demo'
        )}, ${stringLiteral(section.content.secondaryCta?.text || 'Learn more')}, ${stringLiteral(
          section.content.secondaryCta?.link || '#details'
        )})`
      )
      return ref
    }
    case 'features': {
      const itemRefs = (section.content.items || []).slice(0, 4).map((item, itemIndex) => {
        const itemRef = `${ref}Item${itemIndex + 1}`
        lines.push(
          `${itemRef} = FeatureItem(${stringLiteral(item.title)}, ${stringLiteral(
            item.description || 'Explain the product benefit in a single sentence.'
          )})`
        )
        return itemRef
      })

      if (itemRefs.length === 0) return null

      lines.push(
        `${ref} = FeatureGrid(${stringLiteral(section.content.headline || 'Why teams switch')}, ${stringLiteral(
          section.content.subheadline || section.content.description || 'Summarize the core product benefits with proof-aware copy.'
        )}, [${itemRefs.join(', ')}])`
      )
      return ref
    }
    case 'testimonials': {
      const itemRefs = (section.content.items || []).slice(0, 3).map((item, itemIndex) => {
        const itemRef = `${ref}Quote${itemIndex + 1}`
        lines.push(
          `${itemRef} = TestimonialItem(${stringLiteral(
            item.description || 'Add a short customer proof quote.'
          )}, ${stringLiteral(item.title || 'Customer name')}, ${stringLiteral(item.link || 'Customer role')})`
        )
        return itemRef
      })

      if (itemRefs.length === 0) return null

      lines.push(`${ref} = TestimonialStrip(${stringLiteral(section.content.headline || 'Proof that feels reviewable')}, [${itemRefs.join(', ')}])`)
      return ref
    }
    case 'cta': {
      lines.push(
        `${ref} = CTASection(${stringLiteral(section.content.headline || 'Make the next step obvious')}, ${stringLiteral(
          section.content.subheadline || section.content.description || 'Close with a concrete action the buyer can take now.'
        )}, ${stringLiteral(section.content.cta?.text || 'Talk to sales')}, ${stringLiteral(
          section.content.cta?.link || '/contact'
        )})`
      )
      return ref
    }
    default:
      return null
  }
}

function stringLiteral(value: string): string {
  return JSON.stringify(value)
}
