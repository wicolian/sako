/**
 * Template-Aware AI Generation (Feb 2026)
 *
 * Template-as-DNA pipeline: AI generates content only, layout comes from
 * decomposed professional template skeletons with brand tokens injected.
 *
 * Flow: Brief → AI Content → Skeleton Match → Brand Assembly → Visual QA → Output
 *
 * Uses Vercel AI Gateway with 2026 model allowlist.
 */

import { generateText, generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { searchTemplates } from '@/lib/templates/retriever';
import { createServiceClient } from '@/lib/supabase/service';
import { MODELS } from './ai-sdk-client';
import { getBrandContext, getDefaultBrandContext, type BrandContext } from './brand-context';
import {
  selectDesignArchetype,
  type DesignArchetype,
  type DesignDirection,
} from '@/lib/design/archetype-selector';
import { blockToHtml, generateHeroSectionHtml, generateLandingPageHtml, type PageBlock as HtmlPageBlock } from '@/lib/html/generator';
import { assembleFullPage, brandContextToTokens, type BrandMemoryTokens } from '@/lib/templates/brand-assembler';
import { scoreDesignQuality, autoFixIssues } from '@/lib/templates/visual-qa';
import type { DesignSkeleton } from '@/lib/templates/design-system-compiler';
import { createAssetDocument, type AssetDocument, type ClaimRef } from '@/lib/assets/asset-document';
import type { GenerationPlan } from '@/lib/planning/types';
import { buildPlanPromptContext, buildVisualTastePrompt, getSelectedCreativeRoute } from '@/lib/planning/generation-plan';
import type { GlobalStyles, SectionContent, SectionStyles, SectionType as WebsiteSectionType, WebsiteSection, SEOMeta } from '@/lib/website/ai-designer';

// Lazy initialization to avoid build-time errors
let _supabase: ReturnType<typeof createServiceClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createServiceClient();
  }
  return _supabase;
}

export interface GenerationRequest {
  brief: string;
  industry?: string;
  style?: {
    theme?: 'dark' | 'light' | 'gradient' | 'glass';
    layout?: 'centered' | 'split' | 'grid' | 'asymmetric' | 'stacked';
  };
  sections?: string[];
  brandId?: string;
  workspaceId: string;
  brand?: BrandContext | null;
  archetype?: DesignArchetype | null;
  designDirection?: DesignDirection;
  plan?: GenerationPlan;
  improvementContext?: string;
}

export interface GeneratedPage {
  html: string;
  sections: Array<{
    type: string;
    html: string;
    templateReference?: string;
  }>;
  websiteSections: WebsiteSection[];
  globalStyles: GlobalStyles;
  seoMeta: SEOMeta;
  designTokens: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    accentGradient?: string;
  };
  claims: string[];
}

const PageStructureSchema = z.object({
  headline: z.string(),
  subheadline: z.string(),
  sections: z.array(z.object({
    type: z.enum(['hero', 'features', 'testimonials', 'pricing', 'cta', 'faq', 'stats', 'logos']),
    content: z.object({
      heading: z.string().describe('Section heading - use empty string if not applicable'),
      body: z.string().describe('Section body text - use empty string if not applicable'),
      items: z.array(z.string()).describe('List items - use empty array if not applicable'),
    }),
  })),
  callToAction: z.string(),
  claims: z.array(z.string()).describe('Marketing claims that need compliance validation'),
});

/**
 * Generate a landing page using Template-as-DNA pipeline.
 *
 * Flow:
 * 1. Fetch brand context + brand memory tokens
 * 2. AI generates structured content (PageStructureSchema)
 * 3. Retrieve best DesignSkeleton per section via template search
 * 4. Assemble HTML via brand-assembler (skeleton + brand tokens + content)
 * 5. Run visual QA → auto-fix if score < 0.7
 * 6. Return GeneratedPage + optionally persist as AssetDocument
 */
export async function generateLandingPage(request: GenerationRequest): Promise<GeneratedPage> {
  // 1. Fetch brand context and tokens
  let brandTokens: BrandMemoryTokens | null = null;
  let brandPrompt = '';
  let brandContext: BrandContext | null = request.brand ?? null;

  if (!brandContext && request.brandId) {
    try {
      brandContext = await getBrandContext(request.workspaceId, request.brandId);
      if (brandContext) {
        brandTokens = brandContextToTokens(brandContext);
        brandPrompt = `
BRAND GUIDELINES:
- Company: ${brandContext.name}
- Primary Color: ${brandContext.colors.primary}
- Secondary Color: ${brandContext.colors.secondary ?? brandContext.colors.primary}
- Font: ${brandContext.typography.fontFamily}
- Voice: ${brandContext.voice?.tone ?? 'Professional'}
- Key Messages: ${brandContext.messaging?.keyMessages?.join(', ') ?? 'N/A'}
`;
      }
    } catch (e) {
      console.warn('Could not fetch brand:', e);
    }
  }

  if (brandContext && !brandTokens) {
    brandTokens = brandContextToTokens(brandContext);
  }

  const usingNeutralFallback = !brandContext;
  const effectiveBrandContext = brandContext ?? getDefaultBrandContext();
  const effectiveArchetype =
    request.archetype ??
    selectDesignArchetype(effectiveBrandContext, request.designDirection ?? 'auto');

  if (!brandTokens) {
    brandTokens = brandContextToTokens(effectiveBrandContext);
  }

  if (!brandPrompt) {
    brandPrompt = `
BRAND GUIDELINES:
- Company: ${effectiveBrandContext.name}
- Primary Color: ${effectiveBrandContext.colors.primary}
- Secondary Color: ${effectiveBrandContext.colors.secondary ?? effectiveBrandContext.colors.primary}
- Font: ${effectiveBrandContext.typography.fontFamily}
- Voice: ${effectiveBrandContext.voice?.tone ?? 'Measured'}
- Art Direction: ${effectiveArchetype.direction}
- Motion Policy: ${effectiveArchetype.motionPolicy}
- Ornament Level: ${effectiveArchetype.ornamentLevel}
${usingNeutralFallback ? '- No approved brand found: use the neutral fallback style.' : ''}`.trim();
  }

  // 2. Determine sections
  const selectedRoute = request.plan ? getSelectedCreativeRoute(request.plan) : null;
  const landingBlueprint = request.plan?.assetBlueprints.find((entry) => entry.assetType === 'landing-page');
  const sectionsToGenerate = request.sections || landingBlueprint?.requiredSections || ['hero', 'features', 'testimonials', 'cta'];
  const planPrompt = request.plan ? buildPlanPromptContext(request.plan) : '';
  const visualTastePrompt = request.plan ? buildVisualTastePrompt(request.plan) : '';

  // 3. Generate structured content via AI (content ONLY, not layout)
  const { object: rawStructure } = await generateObject({
    model: MODELS.STRUCTURED,
    schema: PageStructureSchema,
    prompt: `Create a landing page content structure for this brief:

${request.brief}

${brandPrompt}
${planPrompt ? `\n${planPrompt}\n` : ''}
${visualTastePrompt ? `\n${visualTastePrompt}\n` : ''}
${request.improvementContext ? `\n${request.improvementContext}\n` : ''}

Industry: ${request.industry || 'general'}
Art direction: ${effectiveArchetype.direction}
Layout: ${request.style?.layout || 'centered'}
${selectedRoute ? `Selected route headline angle: ${selectedRoute.headlineAngle}` : ''}

Generate:
1. A compelling headline
2. A subheadline that supports the headline
3. Sections with content (heading, body text, list items)
4. A strong call-to-action
5. List any marketing claims that need compliance review
6. If the direction is trust/proof-forward, include at least one proof-heavy section
7. Make the primary next step obvious for the actor and decision stage

IMPORTANT: Generate CONTENT only. Layout and design will be handled separately.`,
  });
  const structure = rawStructure as z.infer<typeof PageStructureSchema>;

  // 4. Retrieve design skeletons per section
  const skeletonsBySection: Record<string, DesignSkeleton | null> = {};

  await Promise.all(
    sectionsToGenerate.map(async (sectionType) => {
      try {
        const templates = await searchTemplates({
          prompt: `${request.brief} ${sectionType} section ${effectiveArchetype.direction} ${effectiveArchetype.landingPage} ${effectiveArchetype.proofDensity} proof ${selectedRoute?.headlineAngle ?? ''}`,
          category: sectionType,
          style: {
            ...(request.style as Record<string, unknown> | undefined),
            direction: effectiveArchetype.direction,
            motionPolicy: effectiveArchetype.motionPolicy,
            ornamentLevel: effectiveArchetype.ornamentLevel,
          },
          industry: request.industry ? [request.industry] : undefined,
          topK: 3,
        });

        // Find first template with a compiled skeleton
        for (const template of templates) {
          if (template.designSkeleton) {
            skeletonsBySection[sectionType] = template.designSkeleton as unknown as DesignSkeleton;
            break;
          }
        }

        if (!skeletonsBySection[sectionType]) {
          skeletonsBySection[sectionType] = null;
        }
      } catch {
        skeletonsBySection[sectionType] = null;
      }
    })
  );

  // 5. Assemble HTML: skeleton + brand tokens + AI content
  const hasSkeletons = Object.values(skeletonsBySection).some((s) => s !== null);

  let fullHtml: string;
  let renderedSections: Array<{ type: string; html: string; templateReference?: string }> = [];

  if (effectiveBrandContext) {
    const htmlBlocks = structureToHtmlBlocks(structure);
    fullHtml = generateLandingPageHtml(
      {
        id: crypto.randomUUID(),
        name: structure.headline,
        goal: structure.subheadline,
        audience: request.brief,
        cta: structure.callToAction,
      },
      htmlBlocks.filter((block) => block.type !== 'hero'),
      htmlBlocks.find((block) => block.type === 'hero') ?? null,
      {
        brand: effectiveBrandContext,
        archetype: effectiveArchetype,
        route: selectedRoute ?? undefined,
        includeMeta: true,
      }
    );

    renderedSections = [
      {
        type: 'hero',
        html: generateHeroSectionHtml(
          {
            name: structure.headline,
            goal: structure.subheadline,
            cta: structure.callToAction,
          },
          {
            headline: structure.headline,
            subheadline: structure.subheadline,
            cta_text: structure.callToAction,
            cta_url: '#cta',
          },
          effectiveArchetype,
          selectedRoute ?? undefined,
        ),
      },
      ...htmlBlocks
        .filter((block) => block.type !== 'hero')
        .map((block) => ({
          type: block.type,
          html: blockToHtml(block),
          templateReference: skeletonsBySection[block.type]?.templateId,
        })),
    ];
  } else if (hasSkeletons && brandTokens) {
    // Template-as-DNA path: assemble from skeletons
    const sectionPairs = structure.sections.map((section) => {
      const skeleton = skeletonsBySection[section.type];
      return {
        skeleton: skeleton!,
        content: {
          headline: section.content.heading,
          body: section.content.body,
          items: section.content.items,
          cta: structure.callToAction,
        },
      };
    }).filter((pair) => pair.skeleton !== null);

    if (sectionPairs.length > 0) {
      fullHtml = assembleFullPage(sectionPairs, brandTokens, {
        title: structure.headline,
        description: structure.subheadline,
      });
      renderedSections = structure.sections.map((section) => ({
        type: section.type,
        html: section.content.body || section.content.heading,
        templateReference: skeletonsBySection[section.type]?.templateId,
      }));
    } else {
      // All skeletons missed — fall through to AI generation
      fullHtml = await generateFullHtmlFallback(
        structure,
        brandPrompt,
        request,
        skeletonsBySection,
        effectiveArchetype,
        request.plan,
      );
    }
  } else {
    // Fallback: AI generates full HTML (with template CSS patterns as context)
    fullHtml = await generateFullHtmlFallback(
      structure,
      brandPrompt,
      request,
      skeletonsBySection,
      effectiveArchetype,
      request.plan,
    );
  }

  // 6. Best-of-3 Quality Loop: generate → score → auto-fix → select best
  let bestHtml = fullHtml;
  let bestScore = scoreDesignQuality(fullHtml);

  // If first attempt doesn't pass, try up to 2 more variants
  if (!bestScore.passed) {
    bestHtml = autoFixIssues(bestHtml, bestScore.issues);
    bestScore = scoreDesignQuality(bestHtml);

    // Generate additional variants if still below threshold
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt < MAX_RETRIES && !bestScore.passed; attempt++) {
      try {
        const retryHtml = hasSkeletons && brandTokens
          ? assembleFullPage(
              structure.sections.map((section) => ({
                skeleton: skeletonsBySection[section.type]!,
                content: {
                  headline: section.content.heading,
                  body: section.content.body,
                  items: section.content.items,
                  cta: structure.callToAction,
                },
              })).filter((p) => p.skeleton !== null),
              brandTokens,
              { title: structure.headline, description: structure.subheadline }
            )
          : await generateFullHtmlFallback(
              structure,
              brandPrompt,
              request,
              skeletonsBySection,
              effectiveArchetype,
              request.plan,
            );

        const retryScore = scoreDesignQuality(retryHtml);
        const fixedHtml = autoFixIssues(retryHtml, retryScore.issues);
        const fixedScore = scoreDesignQuality(fixedHtml);

        if (fixedScore.overall > bestScore.overall) {
          bestHtml = fixedHtml;
          bestScore = fixedScore;
        }
      } catch {
        // Retry failed — keep best so far
      }
    }
  }

  fullHtml = bestHtml;

  // Log quality telemetry for learning loop
  try {
    await getSupabase().from('design_quality_events').insert({
      workspace_id: request.workspaceId,
      event_type: 'generated',
      original_html: fullHtml,
      quality_score: bestScore.overall,
      issues_json: bestScore.issues,
      skeleton_id: Object.values(skeletonsBySection).find((s) => s)?.id ?? null,
    });
  } catch {
    // Non-critical
  }

  // 7. Extract sections from generated HTML
  const sections = renderedSections.length > 0
    ? renderedSections
    : sectionsToGenerate.map((type) => ({
        type,
        html: extractSectionFromHtml(fullHtml, type),
        templateReference: skeletonsBySection[type]?.templateId,
      }));

  // 8. Extract design tokens from brand or defaults
  const designTokens = brandTokens
    ? {
        primaryColor: brandTokens.colors.find((c) => c.role === 'primary')?.value ?? effectiveBrandContext.colors.primary,
        secondaryColor: brandTokens.colors.find((c) => c.role === 'secondary')?.value ?? (effectiveBrandContext.colors.secondary ?? effectiveBrandContext.colors.primary),
        fontFamily: brandTokens.fonts.find((f) => f.role === 'body')?.family ?? effectiveBrandContext.typography.fontFamily,
      }
    : {
        primaryColor: effectiveBrandContext.colors.primary,
        secondaryColor: effectiveBrandContext.colors.secondary ?? effectiveBrandContext.colors.primary,
        fontFamily: `${effectiveBrandContext.typography.fontFamily}, system-ui, sans-serif`,
      };

  const globalStyles = createGlobalStyles(effectiveBrandContext, designTokens, effectiveArchetype.prefersDark);
  const seoMeta: SEOMeta = {
    title: structure.headline,
    description: structure.subheadline,
  };
  const websiteSections = structureToWebsiteSections(
    structure,
    globalStyles,
    sectionsToGenerate,
  );

  return {
    html: fullHtml,
    sections,
    websiteSections,
    globalStyles,
    seoMeta,
    designTokens,
    claims: structure.claims,
  };
}

function structureToHtmlBlocks(
  structure: z.infer<typeof PageStructureSchema>
): HtmlPageBlock[] {
  const blocks: HtmlPageBlock[] = [
    {
      id: crypto.randomUUID(),
      type: 'hero',
      order: 0,
      props: {
        headline: structure.headline,
        subheadline: structure.subheadline,
        cta_text: structure.callToAction,
        cta_url: '#cta',
      },
    },
  ]

  structure.sections.forEach((section, index) => {
    const baseOrder = index + 1

    switch (section.type) {
      case 'features':
        section.content.items.forEach((item, itemIndex) => {
          blocks.push({
            id: crypto.randomUUID(),
            type: 'benefits',
            order: baseOrder * 10 + itemIndex,
            props: {
              title: item,
              description: section.content.body,
            },
          })
        })
        break
      case 'stats':
        blocks.push({
          id: crypto.randomUUID(),
          type: 'stats',
          order: baseOrder * 10,
          props: {
            title: section.content.heading,
            items: section.content.items,
            content: section.content.body,
          },
        })
        break
      case 'testimonials':
      case 'logos':
        blocks.push({
          id: crypto.randomUUID(),
          type: 'testimonial',
          order: baseOrder * 10,
          props: {
            quote: section.content.body || section.content.items.join(' '),
            author: section.content.heading || '[Customer Name]',
            company: '[Company]',
          },
        })
        break
      case 'cta':
        blocks.push({
          id: crypto.randomUUID(),
          type: 'cta',
          order: baseOrder * 10,
          props: {
            headline: section.content.heading || structure.callToAction,
            subheadline: section.content.body,
            cta_text: structure.callToAction,
            cta_url: '#cta',
          },
        })
        break
      default:
        blocks.push({
          id: crypto.randomUUID(),
          type: section.type === 'faq' ? 'how-it-works' : 'text',
          order: baseOrder * 10,
          props: {
            title: section.content.heading,
            content: section.content.body || section.content.items.join(' '),
          },
        })
    }
  })

  if (!blocks.some((block) => block.type === 'cta')) {
    blocks.push({
      id: crypto.randomUUID(),
      type: 'cta',
      order: 999,
      props: {
        headline: 'Take the next step',
        subheadline: structure.subheadline,
        cta_text: structure.callToAction,
        cta_url: '#cta',
      },
    })
  }

  return blocks
}

function structureToWebsiteSections(
  structure: z.infer<typeof PageStructureSchema>,
  globalStyles: GlobalStyles,
  sectionsToGenerate: string[],
): WebsiteSection[] {
  const sections: WebsiteSection[] = [
    {
      id: crypto.randomUUID(),
      type: 'hero',
      order: 0,
      content: {
        headline: structure.headline,
        subheadline: structure.subheadline,
        cta: {
          text: structure.callToAction,
          link: '#cta',
          variant: 'primary',
        },
      },
      styles: {
        layout: 'centered',
        alignment: 'center',
        background: globalStyles.colorScheme === 'dark' ? 'dark' : 'gradient',
        spacing: 'spacious',
      },
    },
  ];

  structure.sections.forEach((section, index) => {
    const type = normalizeWebsiteSectionType(section.type);
    const order = sections.length;
    const content = mapStructureSectionToContent(type, section.content, structure.callToAction);

    sections.push({
      id: crypto.randomUUID(),
      type,
      order,
      content,
      styles: websiteSectionStyles(type, index),
    });
  });

  const hasCta = sections.some((section) => section.type === 'cta');
  if (!hasCta || !sectionsToGenerate.includes('cta')) {
    sections.push({
      id: crypto.randomUUID(),
      type: 'cta',
      order: sections.length,
      content: {
        headline: 'Take the next step',
        subheadline: structure.subheadline,
        cta: {
          text: structure.callToAction,
          link: '#cta',
          variant: 'primary',
        },
      },
      styles: {
        layout: 'centered',
        alignment: 'center',
        background: 'gradient',
        spacing: 'spacious',
      },
    });
  }

  return sections.map((section, index) => ({ ...section, order: index }));
}

function mapStructureSectionToContent(
  type: WebsiteSectionType,
  content: z.infer<typeof PageStructureSchema>['sections'][number]['content'],
  callToAction: string,
): SectionContent {
  const items = content.items.map((item) => ({
    title: item,
    description: type === 'stats' ? content.body : '',
  }));

  switch (type) {
    case 'features':
      return {
        headline: content.heading,
        subheadline: content.body,
        items,
      };
    case 'testimonials':
      return {
        headline: content.heading,
        items: items.map((item) => ({
          title: item.title,
          description: item.description || content.body,
        })),
      };
    case 'pricing':
      return {
        headline: content.heading,
        subheadline: content.body,
        items: items.map((item, index) => ({
          title: item.title,
          description: item.description || content.body,
          link: index === 0 ? '#cta' : '#pricing',
        })),
      };
    case 'faq':
      return {
        headline: content.heading,
        items: items.map((item) => ({
          title: item.title,
          description: item.description || content.body,
        })),
      };
    case 'stats':
      return {
        headline: content.heading,
        items,
      };
    case 'logos':
      return {
        headline: content.heading,
        items,
      };
    case 'cta':
      return {
        headline: content.heading || 'Ready to move?',
        subheadline: content.body,
        cta: {
          text: callToAction,
          link: '#cta',
          variant: 'primary',
        },
      };
    default:
      return {
        headline: content.heading,
        description: content.body,
        items: items.length > 0 ? items : undefined,
      };
  }
}

function websiteSectionStyles(type: WebsiteSectionType, index: number): SectionStyles {
  if (type === 'cta') {
    return {
      layout: 'centered',
      alignment: 'center',
      background: 'gradient',
      spacing: 'spacious',
    };
  }

  if (type === 'logos' || type === 'stats') {
    return {
      layout: 'grid',
      alignment: 'center',
      background: index % 2 === 0 ? 'light' : 'white',
      spacing: 'normal',
      columns: type === 'stats' ? 4 : 5,
    };
  }

  return {
    layout: type === 'features' || type === 'comparison' || type === 'testimonials' ? 'cards' : 'centered',
    alignment: 'center',
    background: index % 2 === 0 ? 'white' : 'light',
    spacing: 'normal',
    columns: type === 'features' ? 3 : undefined,
  };
}

function normalizeWebsiteSectionType(type: string): WebsiteSectionType {
  switch (type) {
    case 'hero':
      return 'hero';
    case 'features':
      return 'features';
    case 'testimonials':
      return 'testimonials';
    case 'pricing':
      return 'pricing';
    case 'faq':
      return 'faq';
    case 'cta':
      return 'cta';
    case 'stats':
      return 'stats';
    case 'logos':
      return 'logos';
    default:
      return 'custom';
  }
}

function createGlobalStyles(
  brandContext: BrandContext,
  designTokens: GeneratedPage['designTokens'],
  prefersDark: boolean,
): GlobalStyles {
  return {
    colorScheme: prefersDark ? 'dark' : 'light',
    primaryColor: designTokens.primaryColor,
    secondaryColor: designTokens.secondaryColor,
    accentColor: brandContext.colors.accent ?? brandContext.colors.secondary ?? designTokens.secondaryColor,
    fontHeading: brandContext.typography.fontFamily,
    fontBody: brandContext.typography.fontFamily,
    borderRadius: prefersDark ? 'large' : 'medium',
    buttonStyle: 'solid',
  };
}

/**
 * Generate landing page as a full AssetDocument (for UADM pipeline)
 */
export async function generateLandingPageAssetDocument(
  request: GenerationRequest & { brandId: string; campaignId?: string }
): Promise<AssetDocument> {
  const page = await generateLandingPage(request);

  const claims: ClaimRef[] = page.claims.map((text) => ({
    id: crypto.randomUUID(),
    text,
    riskScore: 0,
    riskLevel: 'low' as const,
    status: 'unverified' as const,
    evidenceIds: [],
  }));

  return createAssetDocument({
    workspaceId: request.workspaceId,
    brandId: request.brandId,
    campaignId: request.campaignId,
    type: 'landing',
    html: page.html,
    blocks: page.sections.map((s) => ({
      id: crypto.randomUUID(),
      type: s.type === 'hero' ? 'headline' as const : s.type === 'cta' ? 'cta' as const : 'custom' as const,
      content: s.html,
    })),
    designTokens: {
      colors: {
        primary: page.designTokens.primaryColor,
        secondary: page.designTokens.secondaryColor,
        background: '#ffffff',
        text: '#111827',
      },
      typography: {
        heading: page.designTokens.fontFamily.split(',')[0].trim(),
        body: page.designTokens.fontFamily.split(',')[0].trim(),
        sizes: { h1: '48px', h2: '36px', h3: '24px', body: '16px' },
      },
      spacing: { base: 8, scale: [8, 16, 24, 32, 48, 64] },
    },
    claims,
    title: page.sections[0]?.html ? extractHeadlineFromHtml(page.html) : undefined,
  });
}

/**
 * Fallback: AI generates full HTML when skeletons unavailable
 * Uses template CSS patterns as style context (degraded but better than raw)
 */
async function generateFullHtmlFallback(
  structure: z.infer<typeof PageStructureSchema>,
  brandPrompt: string,
  request: GenerationRequest,
  skeletonsBySection: Record<string, DesignSkeleton | null>,
  archetype: DesignArchetype,
  plan?: GenerationPlan,
): Promise<string> {
  // Gather any available skeleton CSS as style hints
  const styleHints = Object.entries(skeletonsBySection)
    .filter(([, skeleton]) => skeleton !== null)
    .map(([type, skeleton]) => `/* ${type} section style */\n${skeleton!.layoutCSS.slice(0, 500)}`)
    .join('\n');
  const planPrompt = plan ? buildPlanPromptContext(plan) : '';
  const visualTastePrompt = plan ? buildVisualTastePrompt(plan) : '';
  const selectedRoute = plan ? getSelectedCreativeRoute(plan) : null;

  const { text: html } = await generateText({
    model: MODELS.BALANCED,
    prompt: `Generate a complete, production-ready landing page HTML.

## PAGE STRUCTURE:
Headline: ${structure.headline}
Subheadline: ${structure.subheadline}
Sections: ${JSON.stringify(structure.sections, null, 2)}
CTA: ${structure.callToAction}

${brandPrompt}
${planPrompt ? `\n${planPrompt}\n` : ''}
${visualTastePrompt ? `\n${visualTastePrompt}\n` : ''}
${request.improvementContext ? `\n${request.improvementContext}\n` : ''}

## STYLE REQUIREMENTS:
- Theme: ${request.style?.theme || (archetype.prefersDark ? 'dark' : 'light')}
- Layout: ${request.style?.layout || 'centered'}
- Use Tailwind CSS classes
- Mobile responsive
- One clear visual idea, not a collage of effects
- Motion policy: ${archetype.motionPolicy}
- Background treatment: ${archetype.backgroundTreatment}
- Proof density: ${archetype.proofDensity}
- Ornament level: ${archetype.ornamentLevel}
- ${selectedRoute ? `Selected route: ${selectedRoute.label} (${selectedRoute.headlineAngle})` : 'Selected route: keep the layout focused and proof-forward'}
- No cursor-follow effects, scroll-jacking, hover-scale gimmicks, glassmorphism, emoji filler, fake browser chrome, or decorative gradients
- Prefer proof, screenshots, clear hierarchy, and contrast over decoration

${styleHints ? `## STYLE REFERENCE (CSS patterns from professional templates):\n${styleHints}` : ''}

Generate the complete HTML with Tailwind classes. Start with <!DOCTYPE html>.`,
  });

  return html;
}

function extractHeadlineFromHtml(html: string): string {
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]*>/g, '').trim() : '';
}

/**
 * Generate a single section using template reference
 */
export async function generateSection(
  sectionType: string,
  brief: string,
  brandId?: string,
  designDirection: DesignDirection = 'auto',
): Promise<{ html: string; claims: string[] }> {
  // Retrieve relevant templates
  const templates = await searchTemplates({
    prompt: `${brief} ${designDirection} ${sectionType}`,
    category: sectionType,
    topK: 3,
  });

  const templateHtml = templates
    .slice(0, 2)
    .map((t: { html: string }, i: number) => `Example ${i + 1}:\n${t.html.slice(0, 2500)}`)
    .join('\n\n');

  // Get brand if provided
  let brandContext = '';
  if (brandId) {
    const { data: brand } = await getSupabase()
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single();

    if (brand) {
      brandContext = `Apply these brand guidelines:
- Primary: ${brand.primary_color}
- Secondary: ${brand.secondary_color}  
- Font: ${brand.font_family}
- Voice: ${brand.voice || 'Professional'}
- Design direction: ${designDirection}`;
    }
  }

  const { text: html } = await generateText({
    model: MODELS.BALANCED,
    prompt: `Generate a ${sectionType} section for a landing page.

Brief: ${brief}

${brandContext}

Use these templates as STYLE reference only (not content):
${templateHtml}

Generate restrained, brand-fit HTML with Tailwind CSS. Avoid decorative gradients, hover gimmicks, emoji filler, scroll-jacking cues, and fake dashboard chrome. Include any claims in the content that would need compliance review.
`,
  });

  // Extract claims from generated content
  const claims = extractClaimsFromHtml(html);

  return { html, claims };
}

function extractSectionFromHtml(html: string, sectionType: string): string {
  // Simple extraction - look for section by class or comments
  const sectionPattern = new RegExp(
    `<section[^>]*class="[^"]*${sectionType}[^"]*"[^>]*>([\\s\\S]*?)</section>`,
    'i'
  );
  const match = html.match(sectionPattern);
  return match ? match[0] : '';
}

function extractClaimsFromHtml(html: string): string[] {
  const claims: string[] = [];

  // Extract text that looks like marketing claims
  const claimPatterns = [
    /(?:increase|boost|improve|reduce|save|grow)\s+(?:by\s+)?\d+%/gi,
    /\d+x\s+(?:faster|better|more|stronger)/gi,
    /#1\s+(?:in|for|rated)/gi,
    /guaranteed\s+[\w\s]+/gi,
    /proven\s+(?:to|results)/gi,
    /trusted\s+by\s+[\d,]+/gi,
  ];

  claimPatterns.forEach((pattern) => {
    const matches = html.match(pattern);
    if (matches) {
      claims.push(...matches);
    }
  });

  return [...new Set(claims)];
}
