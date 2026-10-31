import { describe, expect, it } from 'vitest'

import type { WebsiteDesign } from '@/lib/website/ai-designer'
import { renderOpenUiToHtml } from '@/lib/openui/html'
import {
  SAMPLE_OPENUI_DOCUMENT,
  buildOpenUiPromptFromDesign,
  websiteDesignToOpenUiSource,
} from '@/lib/openui/sako-library'

describe('Sako OpenUI POC', () => {
  it('renders sample OpenUI source into static HTML', () => {
    const rendered = renderOpenUiToHtml(SAMPLE_OPENUI_DOCUMENT)

    expect(rendered.parseResult.root?.typeName).toBe('LandingPage')
    expect(rendered.parseResult.meta.validationErrors).toHaveLength(0)
    expect(rendered.html).toContain('Launch proof-heavy pages faster')
    // renderOpenUiToHtml returns a self-contained dark-themed source snapshot;
    // it uses inline <style> only — no CDN dependencies.
    expect(rendered.html).toContain('<style>')
    expect(rendered.html).not.toContain('cdn.tailwindcss.com')
  })

  it('maps a WebsiteDesign into OpenUI source', () => {
    const design: WebsiteDesign = {
      id: 'test-design',
      workspace_id: 'workspace-1',
      name: 'Layerbeam Preview',
      description: 'A proof-heavy landing page preview',
      brand_id: 'brand-1',
      sections: [
        {
          id: 'hero-1',
          type: 'hero',
          order: 0,
          content: {
            headline: 'Cut the time to launch',
            subheadline: 'Stream proof-aware landing pages directly into the editor.',
            cta: {
              text: 'Book a demo',
              link: '/demo',
              variant: 'primary',
            },
          },
          styles: {
            layout: 'centered',
            alignment: 'center',
            background: 'dark',
            spacing: 'spacious',
          },
        },
        {
          id: 'features-1',
          type: 'features',
          order: 1,
          content: {
            headline: 'Why teams adopt it',
            subheadline: 'Keep the component contract small and predictable.',
            items: [
              { title: 'Streaming', description: 'See layout first, details second.' },
              { title: 'Constrained', description: 'Stay inside approved section patterns.' },
            ],
          },
          styles: {
            layout: 'grid',
            alignment: 'left',
            background: 'light',
            spacing: 'normal',
            columns: 2,
          },
        },
        {
          id: 'cta-1',
          type: 'cta',
          order: 2,
          content: {
            headline: 'Try the editor path',
            subheadline: 'Compare HTML and OpenUI preview side by side.',
            cta: {
              text: 'Open preview',
              link: '/editor',
              variant: 'primary',
            },
          },
          styles: {
            layout: 'centered',
            alignment: 'center',
            background: 'gradient',
            spacing: 'normal',
          },
        },
      ],
      globalStyles: {
        colorScheme: 'light',
        primaryColor: '#0f172a',
        secondaryColor: '#334155',
        accentColor: '#84cc16',
        fontHeading: 'Newsreader',
        fontBody: 'IBM Plex Sans',
        borderRadius: 'large',
        buttonStyle: 'solid',
      },
      seoMeta: {
        title: 'Layerbeam Preview',
        description: 'A test design',
      },
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const source = websiteDesignToOpenUiSource(design)
    const prompt = buildOpenUiPromptFromDesign(design)

    expect(source).toContain('root = LandingPage')
    expect(source).toContain('HeroSection')
    expect(source).toContain('FeatureGrid')
    expect(source).toContain('CTASection')
    expect(prompt).toContain('Layerbeam Preview')
    expect(prompt).toContain('Preferred sections')
  })
})
