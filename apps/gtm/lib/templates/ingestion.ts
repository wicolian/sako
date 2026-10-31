/**
 * Template Ingestion Pipeline v2 (Jan 2026)
 * 
 * Production-grade Template RAG system for AI-assisted landing page generation.
 * 
 * PURPOSE:
 * - Templates are REFERENCE patterns for AI generation (never exposed directly)
 * - Users apply their own brand, fonts, colors, and content
 * - AI uses template patterns to generate faster + cheaper than pure generation
 * - Output is exportable to Figma/Webflow/Framer/HubSpot
 * 
 * DESIGN PRINCIPLES (per frontend.mdc + design-principles-follow-ux.mdc):
 * - Capture DESIGN PATTERNS, not content
 * - Extract visual hierarchy, spacing, component composition
 * - Enable brand-agnostic pattern matching
 * - Protect vendor templates (only store abstracted patterns)
 * 
 * Uses Vercel AI Gateway with 2026 model allowlist.
 */

import { readFile, readdir } from 'fs/promises';
import { join, basename } from 'path';
import { createServiceClient } from '@/lib/supabase/service';
import { sanitizeTemplate, extractSections } from './sanitizer';
import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS, generateEmbedding, generateEmbeddings } from '@/lib/ai/ai-sdk-client';
import { compileDesignSkeleton } from './design-system-compiler';

// Lazy-initialize supabase client to allow env vars to be loaded first
let _supabase: ReturnType<typeof createServiceClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createServiceClient();
  }
  return _supabase;
}

// ============================================================================
// Enhanced Schema for Design Pattern Extraction
// ============================================================================

const SectionMetadataSchema = z.object({
  // Core classification
  category: z.enum([
    'hero', 'features', 'pricing', 'testimonials', 'faq', 'cta', 
    'footer', 'header', 'logos', 'stats', 'team', 'contact', 'about', 
    'comparison', 'process', 'gallery', 'nav', 'generic'
  ]),
  
  // Visual style characteristics
  visualStyle: z.object({
    theme: z.enum(['dark', 'light', 'gradient', 'glass', 'minimal', 'bold', 'mixed']),
    layout: z.enum(['centered', 'split', 'grid', 'asymmetric', 'fullwidth', 'contained', 'zigzag', 'cards']),
    density: z.enum(['compact', 'normal', 'spacious', 'airy']),
    visualHierarchy: z.enum(['headline-dominant', 'visual-dominant', 'balanced', 'cta-dominant']),
  }),
  
  // Spatial composition (per frontend.mdc: "Unexpected layouts. Asymmetry. Overlap.")
  spatialComposition: z.object({
    hasOverlappingElements: z.boolean(),
    hasAsymmetry: z.boolean(),
    hasDiagonalFlow: z.boolean(),
    hasGridBreaking: z.boolean(),
    negativeSpaceUsage: z.enum(['minimal', 'moderate', 'generous', 'dramatic']),
  }),
  
  // Component inventory
  components: z.array(z.string()).describe('UI components: buttons, cards, icons, badges, forms, images, videos, animations, gradients, etc.'),
  
  // Motion & interactivity hints
  motionHints: z.array(z.string()).describe('Animation patterns: fade-in, stagger, parallax, scroll-triggered, hover-effects, etc.'),
  
  // Industry/use case fit
  suitableFor: z.array(z.string()).describe('Industries: saas, fintech, agency, ecommerce, health, education, crypto, ai, creative, etc.'),
  
  // Aesthetic vocabulary (per frontend.mdc: "brutally minimal, maximalist chaos, retro-futuristic...")
  aestheticTags: z.array(z.string()).describe('Design language: modern, futuristic, elegant, playful, brutalist, editorial, luxury, organic, geometric, etc.'),
  
  // Typography pattern (NOT the font name - the PATTERN)
  typographyPattern: z.object({
    headlineStyle: z.enum(['bold-impact', 'elegant-serif', 'clean-sans', 'display-creative', 'mixed']),
    textContrast: z.enum(['high', 'medium', 'subtle']),
    hasCustomLetterSpacing: z.boolean(),
  }),
  
  // Color pattern (NOT actual colors - the PATTERN)
  colorPattern: z.object({
    dominantApproach: z.enum(['monochromatic', 'duotone', 'accent-pop', 'gradient-rich', 'muted-professional', 'vibrant-bold']),
    hasDarkMode: z.boolean(),
    hasGradients: z.boolean(),
    contrastLevel: z.enum(['high', 'medium', 'subtle']),
  }),
  
  // Semantic description optimized for RAG retrieval
  semanticDescription: z.string().describe('A detailed 2-3 sentence description focusing on VISUAL PATTERNS and DESIGN LANGUAGE, not content. Describe what makes this section visually distinctive and when an AI should choose this pattern.'),
  
  // Pattern signature (unique identifier for this design approach)
  patternSignature: z.string().describe('A short phrase capturing the essence: e.g. "bold-gradient-hero-with-floating-elements" or "minimal-split-layout-high-contrast"'),
});

type SectionMetadata = z.infer<typeof SectionMetadataSchema>;

// ============================================================================
// Ingestion Types
// ============================================================================

export interface IngestionProgress {
  total: number;
  processed: number;
  current: string;
  errors: string[];
  skipped: number;
  costs: CostTracker;
}

export interface IngestionResult {
  templatesProcessed: number;
  sectionsCreated: number;
  sectionsSkipped: number;
  sectionsUpdated: number;
  errors: string[];
  duration: number;
  costs: CostTracker;
}

export interface IngestionOptions {
  skipExisting?: boolean;      // Skip sections that already exist
  updateExisting?: boolean;    // Update existing sections (default: true via upsert)
  forceRegenerate?: boolean;   // Re-generate metadata even for existing
}

// ============================================================================
// Cost Tracking
// ============================================================================

export interface CostTracker {
  metadataCalls: number;       // GPT-5.2-chat calls for metadata
  embeddingCalls: number;      // text-embedding-3-small calls
  metadataTokensIn: number;    // Approximate input tokens for metadata
  metadataTokensOut: number;   // Approximate output tokens for metadata
  embeddingTokens: number;     // Approximate tokens for embeddings
  estimatedCostUsd: number;    // Running cost estimate
}

function createCostTracker(): CostTracker {
  return {
    metadataCalls: 0,
    embeddingCalls: 0,
    metadataTokensIn: 0,
    metadataTokensOut: 0,
    embeddingTokens: 0,
    estimatedCostUsd: 0,
  };
}

// Pricing (Jan 2026 - Vercel AI Gateway / OpenAI)
const PRICING = {
  // GPT-5.2-chat (used for metadata extraction)
  GPT_INPUT_PER_1K: 0.0015,
  GPT_OUTPUT_PER_1K: 0.002,
  // text-embedding-3-small
  EMBEDDING_PER_1K: 0.00002,
};

function updateCost(tracker: CostTracker, type: 'metadata' | 'embedding', inputTokens: number, outputTokens?: number): void {
  if (type === 'metadata') {
    tracker.metadataCalls++;
    tracker.metadataTokensIn += inputTokens;
    tracker.metadataTokensOut += outputTokens || 0;
    tracker.estimatedCostUsd += (inputTokens / 1000) * PRICING.GPT_INPUT_PER_1K;
    tracker.estimatedCostUsd += ((outputTokens || 0) / 1000) * PRICING.GPT_OUTPUT_PER_1K;
  } else {
    tracker.embeddingCalls++;
    tracker.embeddingTokens += inputTokens;
    tracker.estimatedCostUsd += (inputTokens / 1000) * PRICING.EMBEDDING_PER_1K;
  }
}

// ============================================================================
// Main Ingestion Function
// ============================================================================

/**
 * Get existing section IDs from database
 */
async function getExistingSectionIds(): Promise<Set<string>> {
  const { data } = await getSupabase()
    .from('design_templates')
    .select('section_id')
    .limit(10000);
  
  return new Set((data || []).map(r => r.section_id));
}

/**
 * Ingest all templates from a directory
 */
export async function ingestTemplatesFromDirectory(
  directoryPath: string,
  onProgress?: (progress: IngestionProgress) => void,
  options: IngestionOptions = {}
): Promise<IngestionResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let templatesProcessed = 0;
  let sectionsCreated = 0;
  let sectionsSkipped = 0;
  let sectionsUpdated = 0;
  const costs = createCostTracker();
  
  // Default options
  const { skipExisting = false, updateExisting = true, forceRegenerate = false } = options;
  
  // Get existing section IDs if we need to skip
  const existingIds = skipExisting ? await getExistingSectionIds() : new Set<string>();
  console.log(`\n📋 Found ${existingIds.size} existing sections in database`);
  if (skipExisting) {
    console.log('   Mode: SKIP existing sections');
  } else if (updateExisting) {
    console.log('   Mode: UPDATE existing sections (upsert)');
  }

  try {
    // Read all HTML files
    const files = await readdir(directoryPath);
    const htmlFiles = files.filter((f) => f.endsWith('.html'));

    const progress: IngestionProgress = {
      total: htmlFiles.length,
      processed: 0,
      current: '',
      errors: [],
      skipped: 0,
      costs,
    };

    // Process in batches of 3 for rate limiting (reduced from 5 for better reliability)
    const batchSize = 3;
    for (let i = 0; i < htmlFiles.length; i += batchSize) {
      const batch = htmlFiles.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (file) => {
          try {
            progress.current = file;
            onProgress?.(progress);

            const filePath = join(directoryPath, file);
            const templateName = basename(file, '.html');

            // Read and sanitize template (removes vendor branding)
            const rawHtml = await readFile(filePath, 'utf-8');
            const sanitized = sanitizeTemplate(rawHtml);

            // Extract sections
            const sections = extractSections(sanitized.html);

            // Process each section
            for (const section of sections) {
              try {
                // Generate section ID to check existence
                const tempSectionId = `${templateName}-${section.type}-${section.order}`;
                
                // Skip if exists and skipExisting is enabled
                if (skipExisting && existingIds.has(tempSectionId)) {
                  sectionsSkipped++;
                  progress.skipped++;
                  continue;
                }
                
                const isUpdate = existingIds.has(tempSectionId);
                
                const sectionResult = await processSection(
                  section,
                  templateName,
                  sanitized.designTokens,
                  costs
                );
                
                if (sectionResult) {
                  if (isUpdate) {
                    sectionsUpdated++;
                  } else {
                  sectionsCreated++;
                  }
                }
              } catch (sectionError) {
                const errorMsg = `Section error in ${file}: ${sectionError}`;
                errors.push(errorMsg);
                console.error(errorMsg);
              }
            }

            templatesProcessed++;
            progress.processed++;
          } catch (fileError) {
            const errorMsg = `Failed to process ${file}: ${fileError}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        })
      );

      // Delay between batches to avoid rate limits
      if (i + batchSize < htmlFiles.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    progress.errors = errors;
    progress.costs = costs;
    onProgress?.(progress);
  } catch (error) {
    errors.push(`Directory error: ${error}`);
  }

  return {
    templatesProcessed,
    sectionsCreated,
    sectionsSkipped,
    sectionsUpdated,
    errors,
    duration: Date.now() - startTime,
    costs,
  };
}

// ============================================================================
// Section Processing with Enhanced Pattern Extraction
// ============================================================================

async function processSection(
  section: { type: string; html: string; order: number },
  templateName: string,
  designTokens: Record<string, string[]>,
  costs: CostTracker
): Promise<boolean> {
  // Skip very small sections (likely navigation fragments)
  if (section.html.length < 300) {
    return false;
  }

  // Truncate HTML for AI analysis (keep first 5000 chars for better context)
  const truncatedHtml = section.html.slice(0, 5000);

  // Count structural elements for context
  const structureHints = analyzeHtmlStructure(section.html);

  // Estimate input tokens (rough: 4 chars = 1 token)
  const promptText = truncatedHtml.length + 1500; // HTML + prompt template
  const estimatedInputTokens = Math.ceil(promptText / 4);

  // ============================================================================
  // Production-grade prompt for design pattern extraction
  // ============================================================================
  const { object: metadata } = await generateObject({
    model: MODELS.FAST,
    schema: SectionMetadataSchema,
    prompt: `You are a senior UI/UX designer analyzing HTML to extract DESIGN PATTERNS for a Template RAG system.

CONTEXT:
- This template will be used as a REFERENCE for AI-generated landing pages
- Users will apply their own brand (fonts, colors, content)
- We need to capture the VISUAL PATTERN, not the content
- The pattern should help AI generate similar layouts with different brands

TEMPLATE SECTION:
${truncatedHtml}

STRUCTURE ANALYSIS:
- Section order: ${section.order} (0 = first section, likely hero)
- Detected type hint: ${section.type}
- Headings found: ${structureHints.headingCount}
- Images/media: ${structureHints.mediaCount}
- Buttons/CTAs: ${structureHints.ctaCount}
- Cards/containers: ${structureHints.cardCount}
- Grid/flex containers: ${structureHints.gridCount}

DESIGN TOKENS EXTRACTED:
- Colors: ${designTokens.colors?.slice(0, 8).join(', ') || 'default palette'}
- Font families: ${designTokens.fonts?.slice(0, 3).join(', ') || 'system fonts'}
- Gradients: ${designTokens.gradients?.length || 0} gradient definitions
- Border radius: ${designTokens.borderRadius?.slice(0, 3).join(', ') || 'default'}

EXTRACTION RULES:
1. CATEGORY: What section type is this? (hero, features, pricing, etc.)
2. VISUAL STYLE: Describe the theme, layout approach, density, and visual hierarchy
3. SPATIAL COMPOSITION: Note any asymmetry, overlapping elements, or grid-breaking
4. COMPONENTS: List all UI components used (be specific: "gradient button", "floating card", "icon badge")
5. MOTION HINTS: What animations would enhance this pattern? (stagger reveals, parallax, hover lifts)
6. SUITABLE FOR: What industries would this pattern work well for?
7. AESTHETIC TAGS: Use design vocabulary (brutalist, editorial, luxury, playful, etc.)
8. TYPOGRAPHY PATTERN: Describe the headline/body relationship
9. COLOR PATTERN: Describe the color strategy (not the colors themselves)
10. SEMANTIC DESCRIPTION: Write 2-3 sentences describing WHEN to use this pattern
11. PATTERN SIGNATURE: A unique phrase like "bold-gradient-hero-floating-cta"

Focus on PATTERNS that can be adapted to any brand, not specific content.`,
  });
  
  // Track metadata generation cost (estimate ~500 output tokens for metadata)
  updateCost(costs, 'metadata', estimatedInputTokens, 500);

  // ============================================================================
  // Build rich embedding text for optimal RAG retrieval
  // ============================================================================
  const embeddingText = buildEmbeddingText(metadata as any, designTokens);
  const embedding = await generateEmbedding(embeddingText);

  // Track embedding cost (rough: 4 chars = 1 token)
  const embeddingTokens = Math.ceil(embeddingText.length / 4);
  updateCost(costs, 'embedding', embeddingTokens);

  // Store in database (HTML stored for reference but NEVER exposed to users)
  const sectionId = `${templateName}-${(metadata as any).category}-${section.order}`;

  const { error } = await getSupabase().from('design_templates').upsert({
    section_id: sectionId,
    template_name: templateName,
    category: (metadata as any).category,
    visual_style: (metadata as any).visualStyle,
    design_tokens: designTokens,
    components: (metadata as any).components,
    suitable_for: (metadata as any).suitableFor,
    aesthetic_tags: (metadata as any).aestheticTags,
    html: section.html, // Stored for AI reference only - never exposed
    description: (metadata as any).semanticDescription,
    embedding: embedding,
    section_order: section.order,
    // New v2 fields
    spatial_composition: (metadata as any).spatialComposition,
    motion_hints: (metadata as any).motionHints,
    typography_pattern: (metadata as any).typographyPattern,
    color_pattern: (metadata as any).colorPattern,
    pattern_signature: (metadata as any).patternSignature,
    created_at: new Date().toISOString(),
  }, {
    onConflict: 'section_id',
  });

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  // ============================================================================
  // Second pass: Compile design skeleton for Template-as-DNA pipeline
  // ============================================================================
  try {
    // Extract CSS from the HTML (inline styles + style tags)
    const styleMatch = section.html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    const cssContent = styleMatch
      ? styleMatch.map((s) => s.replace(/<\/?style[^>]*>/gi, '')).join('\n')
      : '';

    const skeleton = compileDesignSkeleton(section.html, cssContent, {
      type: (metadata as any).category ?? section.type,
      category: (metadata as any).category,
      tags: (metadata as any).aestheticTags,
    });

    // Update the template record with skeleton data
    await getSupabase()
      .from('design_templates')
      .update({
        design_skeleton: skeleton,
        skeleton_css: skeleton.layoutCSS,
        skeleton_html: skeleton.structureHTML,
        complexity_score: skeleton.complexityScore,
        aesthetic_signature: JSON.stringify(skeleton.aestheticSignature),
      })
      .eq('section_id', sectionId);
  } catch (skeletonError) {
    // Non-critical: template still works without skeleton (fallback to prompt-based)
    console.warn(`Skeleton compilation failed for ${sectionId}:`, skeletonError);
  }

  return true;
}

// ============================================================================
// Helper: Analyze HTML structure for better context
// ============================================================================

function analyzeHtmlStructure(html: string): {
  headingCount: number;
  mediaCount: number;
  ctaCount: number;
  cardCount: number;
  gridCount: number;
} {
  return {
    headingCount: (html.match(/<h[1-6]/gi) || []).length,
    mediaCount: (html.match(/<img|<video|<svg/gi) || []).length,
    ctaCount: (html.match(/<button|type="submit"|class=".*btn.*"/gi) || []).length,
    cardCount: (html.match(/class=".*card.*"/gi) || []).length,
    gridCount: (html.match(/grid|flex/gi) || []).length,
  };
}

// ============================================================================
// Helper: Build rich embedding text for RAG retrieval
// ============================================================================

function buildEmbeddingText(
  metadata: SectionMetadata,
  designTokens: Record<string, string[]>
): string {
  const style = (metadata as any).visualStyle;
  const spatial = (metadata as any).spatialComposition;
  const typo = (metadata as any).typographyPattern;
  const color = (metadata as any).colorPattern;
  
  // Build a structured embedding that captures multiple retrieval angles
  return `
SECTION: ${(metadata as any).category}
PATTERN: ${(metadata as any).patternSignature}

VISUAL STYLE:
- Theme: ${style.theme}
- Layout: ${style.layout}
- Density: ${style.density}
- Hierarchy: ${style.visualHierarchy}

SPATIAL COMPOSITION:
- Negative space: ${spatial.negativeSpaceUsage}
- Has overlapping elements: ${spatial.hasOverlappingElements}
- Has asymmetry: ${spatial.hasAsymmetry}
- Has diagonal flow: ${spatial.hasDiagonalFlow}
- Grid-breaking: ${spatial.hasGridBreaking}

TYPOGRAPHY:
- Headline style: ${typo.headlineStyle}
- Text contrast: ${typo.textContrast}
- Custom spacing: ${typo.hasCustomLetterSpacing}

COLOR APPROACH:
- Strategy: ${color.dominantApproach}
- Dark mode ready: ${color.hasDarkMode}
- Uses gradients: ${color.hasGradients}
- Contrast: ${color.contrastLevel}

COMPONENTS: ${(metadata as any).components.join(', ')}
MOTION: ${(metadata as any).motionHints.join(', ')}
AESTHETICS: ${(metadata as any).aestheticTags.join(', ')}
INDUSTRIES: ${(metadata as any).suitableFor.join(', ')}

DESCRIPTION: ${(metadata as any).semanticDescription}

DESIGN TOKENS:
- Color count: ${designTokens.colors?.length || 0}
- Has gradients: ${(designTokens.gradients?.length || 0) > 0}
- Font families: ${designTokens.fonts?.length || 0}
`.trim();
}

// ============================================================================
// Batch embedding generation for missing embeddings
// ============================================================================

export async function generateMissingEmbeddingsBatch(): Promise<number> {
  const { data: sections, error } = await getSupabase()
    .from('design_templates')
    .select('section_id, category, visual_style, description, suitable_for, aesthetic_tags, components, design_tokens')
    .is('embedding', null)
    .limit(50);

  if (error || !sections?.length) {
    return 0;
  }

  const texts = sections.map((s) => {
    const style = s.visual_style as SectionMetadata['visualStyle'];
    const tokens = s.design_tokens as Record<string, string[]>;
    
    return `
SECTION: ${s.category}
STYLE: ${style?.theme || 'modern'} theme, ${style?.layout || 'centered'} layout, ${style?.density || 'normal'} density
DESCRIPTION: ${s.description || 'Standard section pattern'}
INDUSTRIES: ${(s.suitable_for as string[])?.join(', ') || 'general'}
AESTHETICS: ${(s.aesthetic_tags as string[])?.join(', ') || 'modern'}
COMPONENTS: ${(s.components as string[])?.join(', ') || 'standard'}
COLOR COUNT: ${tokens?.colors?.length || 0}
`.trim();
  });

  // Batch embed using AI Gateway
  const embeddings = await generateEmbeddings(texts);

  // Update each section
  let updated = 0;
  for (let i = 0; i < sections.length; i++) {
    const { error: updateError } = await getSupabase()
      .from('design_templates')
      .update({ embedding: embeddings[i] })
      .eq('section_id', sections[i].section_id);

    if (!updateError) updated++;
  }

  return updated;
}

// ============================================================================
// Statistics
// ============================================================================

export async function getTemplateStats(): Promise<{
  totalTemplates: number;
  totalSections: number;
  byCategory: Record<string, number>;
  byTheme: Record<string, number>;
  byLayout: Record<string, number>;
}> {
  const { data: sections } = await getSupabase()
    .from('design_templates')
    .select('category, visual_style, template_name');

  if (!sections) {
    return { totalTemplates: 0, totalSections: 0, byCategory: {}, byTheme: {}, byLayout: {} };
  }

  const templateNames = new Set(sections.map((s) => s.template_name));
  const byCategory: Record<string, number> = {};
  const byTheme: Record<string, number> = {};
  const byLayout: Record<string, number> = {};

  sections.forEach((s) => {
    byCategory[s.category] = (byCategory[s.category] || 0) + 1;
    const style = s.visual_style as { theme: string; layout: string };
    const theme = style?.theme || 'unknown';
    const layout = style?.layout || 'unknown';
    byTheme[theme] = (byTheme[theme] || 0) + 1;
    byLayout[layout] = (byLayout[layout] || 0) + 1;
  });

  return {
    totalTemplates: templateNames.size,
    totalSections: sections.length,
    byCategory,
    byTheme,
    byLayout,
  };
}

// ============================================================================
// Re-generate embeddings for all sections (with new schema)
// ============================================================================

export async function regenerateAllEmbeddings(): Promise<number> {
  const { data: sections, error } = await getSupabase()
    .from('design_templates')
    .select('section_id, category, visual_style, description, suitable_for, aesthetic_tags, components, design_tokens')
    .limit(500);

  if (error || !sections?.length) {
    return 0;
  }

  let updated = 0;
  const batchSize = 20;
  
  for (let i = 0; i < sections.length; i += batchSize) {
    const batch = sections.slice(i, i + batchSize);
    
    const texts = batch.map((s) => {
      const style = s.visual_style as SectionMetadata['visualStyle'];
      const tokens = s.design_tokens as Record<string, string[]>;
      
      return `
SECTION: ${s.category}
STYLE: ${style?.theme || 'modern'} theme, ${style?.layout || 'centered'} layout, ${style?.density || 'normal'} density
DESCRIPTION: ${s.description || 'Standard section pattern'}
INDUSTRIES: ${(s.suitable_for as string[])?.join(', ') || 'general'}
AESTHETICS: ${(s.aesthetic_tags as string[])?.join(', ') || 'modern'}
COMPONENTS: ${(s.components as string[])?.join(', ') || 'standard'}
COLOR COUNT: ${tokens?.colors?.length || 0}
`.trim();
    });

    const embeddings = await generateEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      const { error: updateError } = await getSupabase()
        .from('design_templates')
        .update({ embedding: embeddings[j] })
        .eq('section_id', batch[j].section_id);

      if (!updateError) updated++;
    }
    
    // Rate limit delay
    if (i + batchSize < sections.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return updated;
}
