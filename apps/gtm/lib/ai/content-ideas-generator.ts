/**
 * Content Ideas Generator (Jan 2026)
 * 
 * Generates marketing content ideas using AI.
 * Supports batch generation for swipe discovery.
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { createServiceClient } from '@/lib/supabase/service';

// ============================================================================
// Types
// ============================================================================

export interface ContentIdea {
  id: string;
  content: string;
  type: 'headline' | 'angle' | 'hook' | 'cta' | 'concept';
  category?: string;
  framework?: string;
  tone?: string;
  targetAudience?: string;
  status: 'pending' | 'saved' | 'skipped';
  campaignId?: string;
  workspaceId: string;
  generatedAt: string;
}

export interface IdeaGenerationContext {
  workspaceId: string;
  campaignId?: string;
  brandContext?: {
    name?: string;
    industry?: string;
    tone?: string;
    targetAudience?: string;
  };
  previousIdeas?: string[];
  focusAreas?: string[];
}

// ============================================================================
// Schemas
// ============================================================================

const ideaSchema = z.object({
  content: z.string().describe('The actual content idea text'),
  type: z.enum(['headline', 'angle', 'hook', 'cta', 'concept']),
  category: z.string().optional().describe('Marketing category (e.g., awareness, conversion)'),
  framework: z.string().optional().describe('Marketing framework used (e.g., AIDA, PAS)'),
  tone: z.string().optional().describe('Tone of the content (e.g., professional, playful)'),
  targetAudience: z.string().optional().describe('Target audience segment'),
});

const ideasBatchSchema = z.object({
  ideas: z.array(ideaSchema),
});

// ============================================================================
// Generation Functions
// ============================================================================

/**
 * Generate a batch of content ideas
 */
export async function generateContentIdeas(
  context: IdeaGenerationContext,
  count: number = 10
): Promise<ContentIdea[]> {
  const brandInstructions = context.brandContext ? `
Brand Context:
- Company: ${context.brandContext.name || 'Not specified'}
- Industry: ${context.brandContext.industry || 'Not specified'}
- Tone: ${context.brandContext.tone || 'Professional'}
- Target Audience: ${context.brandContext.targetAudience || 'General'}
` : '';

  const avoidInstructions = context.previousIdeas?.length ? `
Avoid these ideas (already generated):
${context.previousIdeas.slice(-20).map(i => `- ${i}`).join('\n')}
` : '';

  const focusInstructions = context.focusAreas?.length ? `
Focus on these areas:
${context.focusAreas.map(f => `- ${f}`).join('\n')}
` : '';

  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: ideasBatchSchema,
    system: `You are a creative marketing expert generating content ideas.

Your ideas should be:
- Original and compelling
- Actionable and specific
- Varied in type (headlines, angles, hooks, CTAs, concepts)
- Marketing-focused with clear value propositions

${brandInstructions}
${avoidInstructions}
${focusInstructions}

Generate diverse ideas across different types:
- Headlines: Attention-grabbing titles
- Angles: Unique perspectives or approaches
- Hooks: Opening statements that engage
- CTAs: Calls to action that convert
- Concepts: Campaign or content concepts`,
    prompt: `Generate ${count} diverse marketing content ideas. Make them creative, specific, and actionable.`,
    temperature: 0.8,
  });

  const result = object as { ideas: Array<Partial<ContentIdea>> };
  const ideas: ContentIdea[] = result.ideas.map((idea) => ({
    id: crypto.randomUUID(),
    content: idea.content || '',
    type: idea.type || 'concept',
    category: idea.category || 'general',
    framework: idea.framework,
    tone: idea.tone,
    targetAudience: idea.targetAudience,
    status: 'pending' as const,
    workspaceId: context.workspaceId,
    campaignId: context.campaignId,
    generatedAt: new Date().toISOString(),
  }));

  return ideas;
}

/**
 * Generate variations of a specific idea
 */
export async function generateIdeaVariations(
  idea: ContentIdea,
  count: number = 5
): Promise<ContentIdea[]> {
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: ideasBatchSchema,
    system: `You are a creative marketing expert generating variations of a content idea.

Create variations that:
- Maintain the core concept but with different angles
- Use different tones or approaches
- Target slightly different audiences
- Use different marketing frameworks
- Are equally compelling but distinct`,
    prompt: `Generate ${count} variations of this ${idea.type}:
"${idea.content}"

Make each variation unique while keeping the essence.`,
    temperature: 0.9,
  });

  const result2 = object as { ideas: Array<Partial<ContentIdea>> };
  const variations: ContentIdea[] = result2.ideas.map((variation) => ({
    id: crypto.randomUUID(),
    content: variation.content || '',
    type: variation.type || 'concept',
    category: variation.category || 'general',
    framework: variation.framework,
    tone: variation.tone,
    targetAudience: variation.targetAudience,
    status: 'pending' as const,
    workspaceId: idea.workspaceId,
    campaignId: idea.campaignId,
    generatedAt: new Date().toISOString(),
  }));

  return variations;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Save an idea to the database
 */
export async function saveIdea(idea: ContentIdea, campaignId?: string): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from('content_ideas').upsert({
    id: idea.id,
    content: idea.content,
    type: idea.type,
    category: idea.category,
    framework: idea.framework,
    tone: idea.tone,
    target_audience: idea.targetAudience,
    status: 'saved',
    campaign_id: campaignId || idea.campaignId,
    workspace_id: idea.workspaceId,
    generated_at: idea.generatedAt,
  });
}

/**
 * Mark an idea as skipped
 */
export async function skipIdea(ideaId: string): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from('content_ideas')
    .update({ status: 'skipped' })
    .eq('id', ideaId);
}

/**
 * Get saved ideas for a campaign
 */
export async function getSavedIdeas(
  workspaceId: string,
  campaignId?: string
): Promise<ContentIdea[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from('content_ideas')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'saved')
    .order('created_at', { ascending: false });

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get saved ideas:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    content: row.content,
    type: row.type,
    category: row.category,
    framework: row.framework,
    tone: row.tone,
    targetAudience: row.target_audience,
    status: row.status,
    campaignId: row.campaign_id,
    workspaceId: row.workspace_id,
    generatedAt: row.generated_at,
  }));
}

/**
 * Get fresh (unreviewed) ideas
 */
export async function getFreshIdeas(
  workspaceId: string,
  limit: number = 20
): Promise<ContentIdea[]> {
  const supabase = createServiceClient();

  // Get ideas that are pending and less than 7 days old
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  const { data, error } = await supabase
    .from('content_ideas')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .gte('generated_at', cutoffDate.toISOString())
    .order('generated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get fresh ideas:', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    content: row.content,
    type: row.type,
    category: row.category,
    framework: row.framework,
    tone: row.tone,
    targetAudience: row.target_audience,
    status: row.status,
    campaignId: row.campaign_id,
    workspaceId: row.workspace_id,
    generatedAt: row.generated_at,
  }));
}

/**
 * Get count of fresh ideas (for badge)
 */
export async function getFreshIdeasCount(workspaceId: string): Promise<number> {
  const supabase = createServiceClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  const { count, error } = await supabase
    .from('content_ideas')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .gte('generated_at', cutoffDate.toISOString());

  if (error) {
    console.error('Failed to count fresh ideas:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Clean up old expired ideas (> 7 days)
 */
export async function cleanupExpiredIdeas(workspaceId: string): Promise<number> {
  const supabase = createServiceClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  const { data, error } = await supabase
    .from('content_ideas')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('status', 'pending')
    .lt('generated_at', cutoffDate.toISOString())
    .select('id');

  if (error) {
    console.error('Failed to cleanup expired ideas:', error);
    return 0;
  }

  return data?.length || 0;
}
