/**
 * Sales Deck Generator (Jan 2026)
 * 
 * Generate presentation slides from campaign briefs with
 * speaker notes, visual suggestions, and claim validation.
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { detectAdjectiveStacks, detectSlop, extractNewClaims } from '@/lib/ai/anti-slop';
import { getBrandContext, getDefaultBrandContext, formatBrandPrompt } from '@/lib/ai/brand-context';
import type { DesignArchetype } from '@/lib/design/archetype-selector';
import { buildCopywriterPrompt } from '@/lib/ai/prompts-v2';
import { searchTemplates } from '@/lib/templates/retriever';
import type { Campaign } from '@/lib/supabase/types';
import type { GenerationPlan } from '@/lib/planning/types';
import {
  buildPlanPromptContext,
  buildVisualTastePrompt,
  getSelectedCreativeRoute,
} from '@/lib/planning/generation-plan';

export type SlideType = 
  | 'title'
  | 'problem'
  | 'solution'
  | 'features'
  | 'proof'
  | 'comparison'
  | 'pricing'
  | 'cta'
  | 'quote'
  | 'stats'
  | 'team'
  | 'timeline'
  | 'blank';

export type SlideLayout = 
  | 'title'
  | 'bullets'
  | 'split'
  | 'image'
  | 'comparison'
  | 'quote'
  | 'stats';

export interface Slide {
  id: string;
  type: SlideType;
  order: number;
  headline: string;
  subheadline?: string;
  bullets?: string[];
  speakerNotes: string;
  visualSuggestion: string;
  claims: string[];
  layout: SlideLayout;
  imageUrl?: string;
}

export interface SalesDeck {
  id: string;
  title: string;
  slides: Slide[];
  totalSlides: number;
  estimatedDuration: string;
  theme: {
    primaryColor: string;
    fontFamily: string;
  };
}

export interface DeckGeneratorOptions {
  slideCount?: number;
  includePricing?: boolean;
  includeComparison?: boolean;
  includeTeam?: boolean;
  style?: 'minimal' | 'detailed' | 'visual';
  designArchetype?: DesignArchetype;
  plan?: GenerationPlan;
  improvementContext?: string;
}

// Schema for slide generation
const SlideSchema = z.object({
  type: z.enum([
    'title', 'problem', 'solution', 'features', 'proof',
    'comparison', 'pricing', 'cta', 'quote', 'stats', 'team', 'timeline', 'blank'
  ]),
  headline: z.string().describe('Main headline (5-10 words)'),
  subheadline: z.string().optional().describe('Supporting subheadline'),
  bullets: z.array(z.string()).optional().describe('3-5 bullet points'),
  speakerNotes: z.string().describe('Detailed notes for presenter'),
  visualSuggestion: z.string().describe('What image/graphic to show'),
  layout: z.enum(['title', 'bullets', 'split', 'image', 'comparison', 'quote', 'stats']),
});

const DeckSchema = z.object({
  title: z.string().describe('Deck title'),
  slides: z.array(SlideSchema),
});

type GeneratedSlide = z.infer<typeof SlideSchema>;
type GeneratedDeck = z.infer<typeof DeckSchema>;

/**
 * Generate a sales deck
 */
export const generateDeck = generateSalesDeck; // Alias for backwards compatibility

export async function generateSalesDeck(
  campaign: Campaign,
  workspaceId: string,
  options: DeckGeneratorOptions = {}
): Promise<SalesDeck> {
  const brandContext =
    (await getBrandContext(workspaceId, campaign.brand_id ?? undefined)) ?? getDefaultBrandContext();
  const slideCount = options.slideCount || 10;
  const planPrompt = options.plan ? buildPlanPromptContext(options.plan) : '';
  const visualTastePrompt = options.plan ? buildVisualTastePrompt(options.plan) : '';
  const selectedRoute = options.plan ? getSelectedCreativeRoute(options.plan) : null;
  
  // Get template references for visual style inspiration
  const [heroTemplates, ctaTemplates] = await Promise.all([
    searchTemplates({ prompt: `hero section bold headline ${selectedRoute?.headlineAngle ?? ''}`, category: 'hero', topK: 2 }),
    searchTemplates({ prompt: `cta section call to action ${selectedRoute?.headlineAngle ?? ''}`, category: 'cta', topK: 2 }),
  ]);
  
  // Build style reference from templates
  const styleReference = heroTemplates.length > 0 
    ? `Visual Style Reference:
- Theme: ${heroTemplates[0].visualStyle?.theme || 'modern'}
- Layout: ${heroTemplates[0].visualStyle?.layout || 'centered'}
- Aesthetics: ${heroTemplates[0].aestheticTags?.slice(0, 3).join(', ') || 'clean, professional'}
- Design Pattern: ${heroTemplates[0].patternSignature || 'bold-centered-layout'}`
    : '';
  
  // Build slide structure prompt
  const slideStructure = buildSlideStructure(slideCount, options, campaign);
  
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: DeckSchema,
    system: buildCopywriterPrompt({
      audience: campaign.audience || 'decision makers',
      brandVoice: brandContext ? formatBrandPrompt(brandContext) : undefined,
    }),
    prompt: `Create a ${slideCount}-slide sales deck for this campaign.

${styleReference}

CAMPAIGN:
- Name: ${campaign.name}
- Audience: ${campaign.audience || 'decision makers'}
- Goal: ${campaign.goal || 'generate interest'}
- Offer: ${campaign.offer || campaign.name}
- Key Benefits: ${(campaign as any).benefits?.join(', ') || 'TBD'}
- CTA: ${campaign.cta || 'Schedule a demo'}

BRAND:
- Name: ${brandContext?.name || 'Company'}
- Voice: ${brandContext?.voice?.tone || 'professional, confident'}
- Colors: ${brandContext?.colors?.primary || '#000'}
${planPrompt ? `\n${planPrompt}\n` : ''}
${visualTastePrompt ? `\n${visualTastePrompt}\n` : ''}
${options.improvementContext ? `\n${options.improvementContext}\n` : ''}

DECK STRUCTURE:
${slideStructure}

STYLE: ${options.style || 'minimal'} 
- ${options.style === 'minimal' ? 'Few words, high impact, visual-first' : ''}
- ${options.style === 'detailed' ? 'More text, comprehensive, data-driven' : ''}
- ${options.style === 'visual' ? 'Icon-heavy, infographics, minimal text' : ''}
- Art direction: ${options.designArchetype?.direction ?? 'auto'}
- Motion policy: ${options.designArchetype?.motionPolicy ?? 'none'}
- Ornament level: ${options.designArchetype?.ornamentLevel ?? 'none'}
- Avoid decorative gradients, fake dashboard chrome, browser-window mockups, and novelty effects
${selectedRoute ? `- Route framing: ${selectedRoute.label} — ${selectedRoute.headlineAngle}` : ''}

For each slide, provide:
1. A compelling headline (max 10 words)
2. Supporting content (bullets or subheadline)
3. Detailed speaker notes (what to say when presenting)
4. Visual suggestion (what image/graphic to use)
5. Appropriate layout

Make it persuasive, clear, and memorable.`,
  });
  
  // Process slides
  const typedDeck = object as GeneratedDeck;

  const slides: Slide[] = typedDeck.slides.map((slide, idx) => {
    const slideText = [
      slide.headline,
      slide.subheadline,
      ...(slide.bullets || []),
      slide.speakerNotes,
    ]
      .filter(Boolean)
      .join('\n')

    const slopFlags = [
      ...detectSlop(slideText, brandContext?.messaging.valuePropositions).map((violation) => `slop:${violation.phrase}`),
      ...detectAdjectiveStacks(slideText).map((stack) => `adjective_stack:${stack}`),
    ]

    return {
      id: `slide-${idx + 1}`,
      ...slide,
      order: idx + 1,
      claims: [...extractNewClaims(slideText), ...slopFlags],
    }
  });
  
  // Calculate estimated duration (average 2 min per slide)
  const durationMinutes = Math.round(slides.length * 2);
  
  return {
    id: `deck-${Date.now()}`,
    title: typedDeck.title,
    slides,
    totalSlides: slides.length,
    estimatedDuration: `${durationMinutes} minutes`,
    theme: {
      primaryColor: brandContext?.colors?.primary || '#3b82f6',
      fontFamily: brandContext?.typography?.fontFamily || 'Inter',
    },
  };
}

/**
 * Build slide structure based on options
 */
function buildSlideStructure(slideCount: number, options: DeckGeneratorOptions, campaign: Campaign): string {
  const structure: string[] = [];
  const decisionStage = options.plan?.decisionStage ?? 'discover';
  const proofStrategy = options.plan?.proofStrategy ?? 'product-proof';
  const actor = options.plan?.primaryActor.label ?? (campaign.audience || 'decision makers');
  const justifyDeck = decisionStage === 'justify';
  
  structure.push('1. Title slide (company name, tagline, presenter)');
  structure.push(`2. Problem slide focused on ${actor}'s key pains`);
  structure.push(justifyDeck ? '3. Decision framing slide (why this matters now)' : '3. Solution overview (your answer)');
  structure.push(justifyDeck ? '4. Product and workflow slide' : '4-5. Features/capabilities (2 slides)');
  structure.push(
    proofStrategy === 'product-proof'
      ? `${justifyDeck ? '5' : '6'}. Product proof (screens, workflow, implementation detail)`
      : `${justifyDeck ? '5' : '6'}. Evidence / customer proof (metrics, testimonial, case study)`,
  );
  
  if (options.includeComparison) {
    structure.push(`${structure.length + 1}. Competitive comparison`);
  }
  
  if (options.includePricing) {
    structure.push(`${structure.length + 1}. Pricing options`);
  }
  
  if (options.includeTeam) {
    structure.push(`${structure.length + 1}. Team/about us`);
  }
  
  structure.push(`${slideCount - 1}. Results / ROI / proof summary`);
  structure.push(`${slideCount}. CTA slide (next steps)`);
  
  return structure.join('\n');
}

/**
 * Generate a single slide (for regeneration)
 */
export async function generateSlide(
  slideType: SlideType,
  campaign: Campaign,
  workspaceId: string,
  context?: string
): Promise<Slide> {
  const brandContext = await getBrandContext(workspaceId);
  
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: SlideSchema,
    system: buildCopywriterPrompt({
      audience: campaign.audience || 'decision makers',
      brandVoice: brandContext ? formatBrandPrompt(brandContext) : undefined,
    }),
    prompt: `Generate a single ${slideType} slide for a sales deck.

CAMPAIGN: ${campaign.name}
AUDIENCE: ${campaign.audience || 'decision makers'}
BRAND VOICE: ${brandContext?.voice?.tone || 'professional'}

${context ? `ADDITIONAL CONTEXT:\n${context}` : ''}

Create a compelling ${slideType} slide with:
1. Punchy headline
2. Supporting content
3. Detailed speaker notes
4. Visual suggestion
5. Appropriate layout`,
  });
  
  const typedSlide = object as GeneratedSlide;

  return {
    id: `slide-${Date.now()}`,
    ...typedSlide,
    order: 0, // Will be set when added to deck
    claims: [
      ...extractNewClaims([
        typedSlide.headline,
        typedSlide.subheadline,
        ...(typedSlide.bullets || []),
        typedSlide.speakerNotes,
      ].filter(Boolean).join('\n')),
    ],
  };
}

/**
 * Export deck to JSON format (for Reveal.js or other renderers)
 */
export function exportDeckToJson(deck: SalesDeck): object {
  return {
    title: deck.title,
    theme: deck.theme,
    slides: deck.slides.map(slide => ({
      type: slide.type,
      layout: slide.layout,
      content: {
        headline: slide.headline,
        subheadline: slide.subheadline,
        bullets: slide.bullets,
      },
      notes: slide.speakerNotes,
      visual: slide.visualSuggestion,
      image: slide.imageUrl,
    })),
    metadata: {
      totalSlides: deck.totalSlides,
      estimatedDuration: deck.estimatedDuration,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Export deck to PPTX format
 * Uses pptxgenjs for actual PowerPoint generation
 */
export async function exportDeckToPptx(deck: SalesDeck): Promise<Buffer> {
  // Dynamic import to avoid bundling issues
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  
  // Set presentation properties
  pptx.author = 'Sako Composer';
  pptx.title = deck.title;
  pptx.subject = 'Sales Deck';
  pptx.company = 'Generated by Sako';
  
  // Define master slide layouts
  pptx.defineSlideMaster({
    title: 'TITLE_SLIDE',
    background: { color: deck.theme.primaryColor },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 2.5, w: 9, h: 1.5 }, text: '' } },
      { placeholder: { options: { name: 'subtitle', type: 'body', x: 0.5, y: 4.5, w: 9, h: 1 }, text: '' } },
    ],
  });
  
  pptx.defineSlideMaster({
    title: 'CONTENT_SLIDE',
    background: { color: 'FFFFFF' },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.3, w: 9, h: 0.8 }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.5, y: 1.3, w: 9, h: 4.5 }, text: '' } },
    ],
  });
  
  // Generate slides
  for (const slide of deck.slides) {
    const pptSlide = pptx.addSlide();
    
    // Set slide notes
    pptSlide.addNotes(slide.speakerNotes);
    
    // Title slide
    if (slide.type === 'title') {
      pptSlide.background = { color: deck.theme.primaryColor };
      pptSlide.addText(slide.headline, {
        x: 0.5,
        y: 2,
        w: 9,
        h: 1.5,
        fontSize: 44,
        bold: true,
        color: 'FFFFFF',
        align: 'center',
        fontFace: deck.theme.fontFamily,
      });
      if (slide.subheadline) {
        pptSlide.addText(slide.subheadline, {
          x: 0.5,
          y: 3.7,
          w: 9,
          h: 1,
          fontSize: 24,
          color: 'FFFFFF',
          align: 'center',
          fontFace: deck.theme.fontFamily,
        });
      }
    }
    // Content slides
    else {
      // Headline
      pptSlide.addText(slide.headline, {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.8,
        fontSize: 32,
        bold: true,
        color: deck.theme.primaryColor.replace('#', ''),
        fontFace: deck.theme.fontFamily,
      });
      
      // Subheadline
      if (slide.subheadline) {
        pptSlide.addText(slide.subheadline, {
          x: 0.5,
          y: 1.1,
          w: 9,
          h: 0.5,
          fontSize: 18,
          color: '666666',
          fontFace: deck.theme.fontFamily,
        });
      }
      
      // Bullets
      if (slide.bullets && slide.bullets.length > 0) {
        const bulletY = slide.subheadline ? 1.8 : 1.3;
        pptSlide.addText(
          slide.bullets.map(b => ({ text: b, options: { bullet: true, indentLevel: 0 } })),
          {
            x: 0.5,
            y: bulletY,
            w: 9,
            h: 4,
            fontSize: 18,
            color: '333333',
            fontFace: deck.theme.fontFamily,
            valign: 'top',
          }
        );
      }
      
      // Stats layout
      if (slide.layout === 'stats' && slide.bullets) {
        // Clear bullets and show as big numbers
        pptSlide.addText('', { x: 0, y: 0, w: 0, h: 0 }); // Clear
        const statsPerRow = Math.min(3, slide.bullets.length);
        const statWidth = 9 / statsPerRow;
        
        slide.bullets.forEach((stat, idx) => {
          const col = idx % statsPerRow;
          pptSlide.addText(stat, {
            x: 0.5 + col * statWidth,
            y: 2,
            w: statWidth - 0.2,
            h: 2,
            fontSize: 28,
            bold: true,
            color: deck.theme.primaryColor.replace('#', ''),
            align: 'center',
            fontFace: deck.theme.fontFamily,
          });
        });
      }
      
      // Quote layout
      if (slide.layout === 'quote') {
        pptSlide.addText(`"${slide.subheadline || slide.headline}"`, {
          x: 1,
          y: 2,
          w: 8,
          h: 2,
          fontSize: 28,
          italic: true,
          color: '333333',
          align: 'center',
          fontFace: deck.theme.fontFamily,
        });
      }
    }
    
    // Add visual suggestion as a comment/note
    if (slide.visualSuggestion) {
      pptSlide.addNotes(`\n\nVisual suggestion: ${slide.visualSuggestion}`);
    }
  }
  
  // Generate buffer
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  return buffer as Buffer;
}

/**
 * Export deck to Google Slides format (JSON for import)
 */
export function exportDeckToGoogleSlides(deck: SalesDeck): object {
  return {
    title: deck.title,
    locale: 'en',
    slides: deck.slides.map(slide => ({
      objectId: slide.id,
      slideProperties: {
        layoutObjectId: slide.layout,
      },
      pageElements: [
        {
          objectId: `${slide.id}_title`,
          shape: {
            shapeType: 'TEXT_BOX',
            text: {
              textElements: [
                { textRun: { content: slide.headline } }
              ]
            }
          }
        },
        ...(slide.bullets || []).map((bullet, idx) => ({
          objectId: `${slide.id}_bullet_${idx}`,
          shape: {
            shapeType: 'TEXT_BOX',
            text: {
              textElements: [
                { textRun: { content: `• ${bullet}` } }
              ]
            }
          }
        })),
      ],
      notesPage: {
        notesProperties: {
          speakerNotesObjectId: `${slide.id}_notes`,
        },
        pageElements: [
          {
            objectId: `${slide.id}_notes`,
            shape: {
              shapeType: 'TEXT_BOX',
              text: {
                textElements: [
                  { textRun: { content: slide.speakerNotes } }
                ]
              }
            }
          }
        ]
      }
    })),
    masters: [],
    layouts: [],
  };
}

/**
 * Export deck to Markdown (for easy editing)
 */
export function exportDeckToMarkdown(deck: SalesDeck): string {
  const lines: string[] = [];
  
  lines.push(`# ${deck.title}`);
  lines.push('');
  lines.push(`*${deck.totalSlides} slides | ${deck.estimatedDuration}*`);
  lines.push('');
  lines.push('---');
  lines.push('');
  
  deck.slides.forEach(slide => {
    lines.push(`## Slide ${slide.order}: ${slide.headline}`);
    lines.push('');
    
    if (slide.subheadline) {
      lines.push(`*${slide.subheadline}*`);
      lines.push('');
    }
    
    if (slide.bullets && slide.bullets.length > 0) {
      slide.bullets.forEach(bullet => {
        lines.push(`- ${bullet}`);
      });
      lines.push('');
    }
    
    lines.push('**Visual:** ' + slide.visualSuggestion);
    lines.push('');
    lines.push('**Speaker Notes:**');
    lines.push('');
    lines.push(slide.speakerNotes);
    lines.push('');
    lines.push('---');
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Generate pitch deck specifically for investors
 */
export async function generateInvestorDeck(
  campaign: Campaign,
  workspaceId: string,
  options: {
    stage?: 'pre-seed' | 'seed' | 'series-a' | 'series-b';
    includeFinancials?: boolean;
  } = {}
): Promise<SalesDeck> {
  const brandContext = await getBrandContext(workspaceId);
  
  const InvestorDeckSchema = z.object({
    title: z.string(),
    slides: z.array(SlideSchema),
  });
  
  const { object } = await generateObject({
    model: MODELS.REASONING,
    schema: InvestorDeckSchema,
    prompt: `Create a ${options.stage || 'seed'}-stage investor pitch deck.

COMPANY: ${brandContext?.name || campaign.name}
WHAT THEY DO: ${campaign.offer || campaign.name}
TARGET MARKET: ${campaign.audience || 'TBD'}

Create a 12-slide investor deck with:

1. Title (company name, one-liner, your name)
2. Problem (market pain, why now)
3. Solution (your product, how it works)
4. Market Size (TAM, SAM, SOM)
5. Business Model (how you make money)
6. Traction (metrics, growth, milestones)
7. Competition (landscape, differentiation)
8. Go-to-Market (distribution strategy)
9. Team (founders, key hires)
${options.includeFinancials ? '10. Financials (projections, unit economics)' : '10. Roadmap (next 12-18 months)'}
11. The Ask (how much, use of funds)
12. Contact (next steps)

Make it concise, metrics-driven, and investor-ready.
Headlines should be one-liners that tell the story.
Speaker notes should include talking points and data to mention.`,
  });
  
  const typedDeck = object as GeneratedDeck;

  const slides: Slide[] = typedDeck.slides.map((slide, idx) => ({
    id: `investor-slide-${idx + 1}`,
    ...slide,
    order: idx + 1,
    claims: [],
  }));
  
  return {
    id: `investor-deck-${Date.now()}`,
    title: typedDeck.title,
    slides,
    totalSlides: slides.length,
    estimatedDuration: '20-25 minutes',
    theme: {
      primaryColor: brandContext?.colors?.primary || '#000000',
      fontFamily: brandContext?.typography?.fontFamily || 'Inter',
    },
  };
}
