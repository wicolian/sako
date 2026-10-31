/**
 * Template Retriever v2 (Jan 2026)
 * 
 * Semantic search for design templates using AI Gateway embeddings.
 * 
 * PUimport { Database } from '@/lib/supabase/types'

RPOSE:
 * - Find relevant design PATTERNS for AI generation
 * - Uses v2 schema with rich metadata (spatial, typography, color patterns)
 * - Templates are REFERENCE only - never exposed directly
 */

import { createServiceClient } from '@/lib/supabase/service';
import { generateEmbedding } from '@/lib/ai/ai-sdk-client';

// ============================================================================
// v2 Search Query Interface
// ============================================================================

export interface TemplateSearchQuery {
  // Natural language prompt describing what user wants
  prompt: string;
  
  // Category filter
  category?: string;
  
  // Visual style filters (v2)
  style?: {
    theme?: 'light' | 'dark' | 'gradient' | 'glass' | 'minimal' | 'bold' | 'mixed';
    layout?: 'centered' | 'split' | 'grid' | 'asymmetric' | 'fullwidth' | 'contained' | 'zigzag' | 'cards';
    density?: 'compact' | 'normal' | 'spacious' | 'airy';
    visualHierarchy?: 'headline-dominant' | 'visual-dominant' | 'balanced' | 'cta-dominant';
    direction?: string;
    motionPolicy?: string;
    ornamentLevel?: string;
  };
  
  // Industry/use case filter
  industry?: string[];
  
  // Aesthetic tags filter
  aestheticTags?: string[];
  
  // Pattern signature for exact match
  patternSignature?: string;
  
  // Number of results
  topK?: number;
}

// ============================================================================
// v2 Search Result Interface
// ============================================================================

export interface TemplateSearchResult {
  id: string;
  sectionId: string;
  templateName: string;
  category: string;
  industry: string[];
  
  // v2 Visual style
  visualStyle: {
    theme: string;
    layout: string;
    density: string;
    visualHierarchy?: string;
  };
  
  // v2 Spatial composition
  spatialComposition?: {
    hasOverlappingElements: boolean;
    hasAsymmetry: boolean;
    hasDiagonalFlow: boolean;
    hasGridBreaking: boolean;
    negativeSpaceUsage: string;
  };
  
  // v2 Typography pattern
  typographyPattern?: {
    headlineStyle: string;
    textContrast: string;
    hasCustomLetterSpacing: boolean;
  };
  
  // v2 Color pattern
  colorPattern?: {
    dominantApproach: string;
    hasDarkMode: boolean;
    hasGradients: boolean;
    contrastLevel: string;
  };
  
  // Extracted design tokens (colors, fonts - NOT for direct use, for AI context)
  designTokens: Record<string, unknown>;
  
  // Components in this section
  components: string[];
  
  // Motion hints for animations
  motionHints?: string[];
  
  // Aesthetic descriptors
  aestheticTags: string[];
  
  // v2 Pattern signature
  patternSignature?: string;
  
  // HTML for AI reference (INTERNAL ONLY - never expose to users)
  html: string;
  
  // Semantic description
  description: string;

  // Similarity score from vector search
  similarity: number;

  // Template-as-DNA compiled skeleton fields
  designSkeleton?: Record<string, unknown> | null;
  skeletonCss?: string | null;
  skeletonHtml?: string | null;
  complexityScore?: number | null;
  aestheticSignature?: number[] | null;
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Search templates using hybrid search (semantic + metadata filters)
 * Returns design PATTERNS for AI reference - never expose HTML directly
 * Gracefully returns empty array if templates are not available
 */
export async function searchTemplates(
  query: TemplateSearchQuery
): Promise<TemplateSearchResult[]> {
  try {
    const supabase = createServiceClient();

    // First try the vector search RPC function
    try {
      // Generate query embedding using AI Gateway
      const embedding = await generateEmbedding(query.prompt);

      // Call the hybrid search function
      const { data: results, error } = await supabase.rpc('search_templates', {
        query_embedding: embedding,
        category_filter: query.category || null,
        theme_filter: query.style?.theme || null,
        layout_filter: query.style?.layout || null,
        industry_filter: query.industry || null,
        top_k: query.topK || 5,
      });

      if (!error && results && results.length > 0) {
        return results.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          sectionId: r.section_id as string,
          templateName: r.template_name as string,
          category: r.category as string,
          industry: r.industry as string[],
          visualStyle: r.visual_style as TemplateSearchResult['visualStyle'],
          spatialComposition: r.spatial_composition as TemplateSearchResult['spatialComposition'],
          typographyPattern: r.typography_pattern as TemplateSearchResult['typographyPattern'],
          colorPattern: r.color_pattern as TemplateSearchResult['colorPattern'],
          designTokens: r.design_tokens as Record<string, unknown>,
          components: (r.components as string[]) || [],
          motionHints: (r.motion_hints as string[]) || [],
          aestheticTags: (r.aesthetic_tags as string[]) || [],
          patternSignature: r.pattern_signature as string | undefined,
          html: r.html as string,
          description: r.description as string,
          similarity: r.similarity as number,
          designSkeleton: (r.design_skeleton as Record<string, unknown> | null) ?? null,
          skeletonCss: (r.skeleton_css as string | null) ?? null,
          skeletonHtml: (r.skeleton_html as string | null) ?? null,
          complexityScore: (r.complexity_score as number | null) ?? null,
          aestheticSignature: (r.aesthetic_signature as number[] | null) ?? null,
        }));
      }
    } catch (rpcError) {
      console.warn('Vector search unavailable, trying fallback query:', rpcError);
    }

    // Fallback: simple category-based query without vectors
    const { data: fallbackResults, error: fallbackError } = await supabase
      .from('design_templates')
      .select('*')
      .eq('category', query.category || 'hero')
      .limit(query.topK || 5);

    if (fallbackError) {
      console.warn('Fallback template query failed:', fallbackError);
      return [];
    }

    return (fallbackResults || []).map(mapToSearchResult);
  } catch (error) {
    console.warn('Template search completely unavailable:', error);
    return [];
  }
}

// ============================================================================
// Additional Search Functions
// ============================================================================

/**
 * Search by pattern signature (exact match)
 */
export async function searchByPatternSignature(
  signature: string,
  limit: number = 5
): Promise<TemplateSearchResult[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('design_templates')
    .select('*')
    .ilike('pattern_signature', `%${signature}%`)
    .limit(limit);

  if (error) {
    console.error('Pattern search error:', error);
    return [];
  }

  return (data || []).map(mapToSearchResult);
}

/**
 * Get templates by category with v2 metadata
 */
export async function getTemplatesByCategory(
  category: string,
  limit: number = 10
): Promise<TemplateSearchResult[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('design_templates')
    .select('*')
    .eq('category', category)
    .order('success_rate', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching templates:', error);
    throw new Error(`Failed to fetch templates: ${error.message}`);
  }

  return (data || []).map(mapToSearchResult);
}

/**
 * Get templates by aesthetic tags
 */
export async function getTemplatesByAesthetics(
  tags: string[],
  limit: number = 10
): Promise<TemplateSearchResult[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('design_templates')
    .select('*')
    .contains('aesthetic_tags', tags)
    .order('success_rate', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching templates:', error);
    return [];
  }

  return (data || []).map(mapToSearchResult);
}

/**
 * Get templates suitable for an industry
 */
export async function getTemplatesForIndustry(
  industry: string,
  limit: number = 10
): Promise<TemplateSearchResult[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('design_templates')
    .select('*')
    .contains('suitable_for', [industry])
    .order('success_rate', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching templates:', error);
    return [];
  }

  return (data || []).map(mapToSearchResult);
}

/**
 * Get all unique categories
 */
export async function getTemplateCategories(): Promise<string[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('design_templates')
    .select('category')
    .limit(1000);

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return [...new Set((data || []).map((r) => r.category))];
}

/**
 * Get unique aesthetic tags across all templates
 */
export async function getAllAestheticTags(): Promise<string[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('design_templates')
    .select('aesthetic_tags')
    .limit(500);

  if (error) {
    return [];
  }

  const allTags = (data || []).flatMap(r => r.aesthetic_tags || []);
  return [...new Set(allTags)].sort();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map database row to search result
 */
function mapToSearchResult(r: Record<string, unknown>): TemplateSearchResult {
  return {
    id: r.id as string,
    sectionId: r.section_id as string,
    templateName: r.template_name as string,
    category: r.category as string,
    industry: (r.industry as string[]) || [],
    visualStyle: (r.visual_style as TemplateSearchResult['visualStyle']) || {
      theme: 'light',
      layout: 'centered',
      density: 'normal',
    },
    spatialComposition: r.spatial_composition as TemplateSearchResult['spatialComposition'],
    typographyPattern: r.typography_pattern as TemplateSearchResult['typographyPattern'],
    colorPattern: r.color_pattern as TemplateSearchResult['colorPattern'],
    designTokens: (r.design_tokens as Record<string, unknown>) || {},
    components: (r.components as string[]) || [],
    motionHints: (r.motion_hints as string[]) || [],
    aestheticTags: (r.aesthetic_tags as string[]) || [],
    patternSignature: r.pattern_signature as string | undefined,
    html: r.html as string,
    description: r.description as string,
    similarity: 1.0, // Default for non-vector queries
    designSkeleton: (r.design_skeleton as Record<string, unknown> | null) ?? null,
    skeletonCss: (r.skeleton_css as string | null) ?? null,
    skeletonHtml: (r.skeleton_html as string | null) ?? null,
    complexityScore: (r.complexity_score as number | null) ?? null,
    aestheticSignature: (r.aesthetic_signature as number[] | null) ?? null,
  };
}

// ============================================================================
// Embedding Management
// ============================================================================

/**
 * Store template embeddings in database
 */
export async function storeTemplateEmbedding(
  sectionId: string,
  embedding: number[]
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('design_templates')
    .update({ embedding })
    .eq('section_id', sectionId);

  if (error) {
    console.error('Error storing embedding:', error);
    throw new Error(`Failed to store embedding: ${error.message}`);
  }
}

/**
 * Generate and store embeddings for all templates without embeddings
 */
export async function generateMissingEmbeddings(): Promise<number> {
  const supabase = createServiceClient();

  // Get templates without embeddings
  const { data: templates, error } = await supabase
    .from('design_templates')
    .select('section_id, description, category, visual_style, aesthetic_tags, components')
    .is('embedding', null)
    .limit(100);

  if (error || !templates) {
    console.error('Error fetching templates:', error);
    return 0;
  }

  let count = 0;
  for (const template of templates) {
    try {
      // Build rich embedding text
      const style = template.visual_style as { theme?: string; layout?: string };
      const embeddingText = `
SECTION: ${template.category}
STYLE: ${style?.theme || 'modern'} ${style?.layout || 'centered'}
DESCRIPTION: ${template.description}
AESTHETICS: ${(template.aesthetic_tags || []).join(', ')}
COMPONENTS: ${(template.components || []).join(', ')}
`.trim();
      
      const embedding = await generateEmbedding(embeddingText);
      await storeTemplateEmbedding(template.section_id, embedding);
      count++;
    } catch (e) {
      console.error(`Failed to generate embedding for ${template.section_id}:`, e);
    }
  }

  return count;
}
