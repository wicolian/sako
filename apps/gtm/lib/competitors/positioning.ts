/**
 * Competitor Positioning AI (Jan 2026)
 * 
 * Generate AI-powered positioning suggestions and battle cards
 * based on competitor analysis.
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import type { Competitor, CompetitorMetrics } from './tracker';
import { getBrandContext, type BrandContext } from '@/lib/ai/brand-context';

export interface BattleCard {
  id: string;
  competitorId: string;
  competitorName: string;
  strengths: string[];
  weaknesses: string[];
  counterMessages: CounterMessage[];
  winningAngles: string[];
  loseTos: string[];
  keyDifferentiators: string[];
  generatedAt: Date;
}

export interface CounterMessage {
  competitorClaim: string;
  yourResponse: string;
  evidenceNeeded: string[];
}

export interface PositioningSuggestion {
  category: string;
  currentPosition: string;
  suggestedPosition: string;
  rationale: string;
  messagingAngles: string[];
}

// Schema for battle card generation
const BattleCardSchema = z.object({
  strengths: z.array(z.string()).describe('Competitor strengths'),
  weaknesses: z.array(z.string()).describe('Competitor weaknesses'),
  counterMessages: z.array(z.object({
    competitorClaim: z.string().describe('What the competitor claims'),
    yourResponse: z.string().describe('How to counter this claim'),
    evidenceNeeded: z.array(z.string()).describe('Evidence to support your response'),
  })),
  winningAngles: z.array(z.string()).describe('Angles where you can win'),
  loseTos: z.array(z.string()).describe('Situations where you might lose'),
  keyDifferentiators: z.array(z.string()).describe('Your key differentiators'),
});

// Schema for positioning suggestions
const PositioningSuggestionSchema = z.object({
  suggestions: z.array(z.object({
    category: z.string().describe('Category like pricing, features, support'),
    currentPosition: z.string().describe('How you currently position'),
    suggestedPosition: z.string().describe('Recommended positioning'),
    rationale: z.string().describe('Why this positioning works'),
    messagingAngles: z.array(z.string()).describe('3-5 messaging angles'),
  })),
});

/**
 * Generate battle card for a competitor
 */
export async function generateBattleCard(
  competitor: Competitor,
  workspaceId: string
): Promise<BattleCard> {
  const brandContext = await getBrandContext(workspaceId);
  
  const { object } = await generateObject({
    model: MODELS.REASONING,
    schema: BattleCardSchema,
    prompt: `Generate a competitive battle card for sales/marketing teams.

YOUR COMPANY:
- Name: ${brandContext?.name || 'Your Company'}
- Value Props: ${brandContext?.messaging?.valuePropositions?.join(', ') || 'N/A'}
- Voice: ${brandContext?.voice?.tone || 'professional'}

COMPETITOR:
- Name: ${competitor.name}
- Domain: ${competitor.domain}
- G2 Rating: ${competitor.metrics.g2Rating || 'N/A'} (${competitor.metrics.g2Reviews || 0} reviews)
- Capterra Rating: ${competitor.metrics.capterraRating || 'N/A'}
- LinkedIn Followers: ${competitor.metrics.linkedinFollowers || 'N/A'}
- Employee Count: ${competitor.metrics.employeeCount ? `${competitor.metrics.employeeCount.min}-${competitor.metrics.employeeCount.max}` : 'N/A'}
- Funding Stage: ${competitor.metrics.fundingStage || 'N/A'}

Generate a battle card that helps our team:
1. Understand competitor strengths (acknowledge them, don't dismiss)
2. Identify their weaknesses (opportunities for us)
3. Counter their common claims/pitches
4. Know when we win vs when we might lose
5. Articulate our key differentiators

Be specific and actionable. Avoid generic statements.`,
  });
  
  return {
    id: `battlecard-${competitor.id}-${Date.now()}`,
    competitorId: competitor.id,
    competitorName: competitor.name,
    ...(object as any),
    generatedAt: new Date(),
  };
}

/**
 * Generate positioning suggestions based on competitive landscape
 */
export async function generatePositioningSuggestions(
  competitors: Competitor[],
  workspaceId: string
): Promise<PositioningSuggestion[]> {
  const brandContext = await getBrandContext(workspaceId);
  
  // Build competitor summary
  const competitorSummary = competitors.map(c => ({
    name: c.name,
    g2Rating: c.metrics.g2Rating,
    reviews: c.metrics.g2Reviews,
    employees: c.metrics.employeeCount,
  }));
  
  const { object } = await generateObject({
    model: MODELS.REASONING,
    schema: PositioningSuggestionSchema,
    prompt: `Generate positioning suggestions based on the competitive landscape.

YOUR COMPANY:
- Name: ${brandContext?.name || 'Your Company'}
- Current Tagline: ${brandContext?.tagline || 'N/A'}
- Industry: ${(brandContext as any)?.industry || 'N/A'}
- Key Messages: ${brandContext?.messaging?.keyMessages?.join(', ') || 'N/A'}

COMPETITIVE LANDSCAPE:
${competitorSummary.map(c => `- ${c.name}: ${c.g2Rating || 'N/A'} G2 rating, ${c.reviews || 0} reviews, ${c.employees ? `${c.employees.min}-${c.employees.max}` : 'N/A'} employees`).join('\n')}

Generate positioning suggestions for 3-5 key categories:
1. Analyze where you can differentiate
2. Suggest specific positioning for each category
3. Provide messaging angles to test
4. Be specific to this competitive landscape

Categories to consider:
- Overall market position
- Pricing/value
- Product capabilities
- Support/service
- Target customer segment`,
  });
  
  return (object as any).suggestions;
}

/**
 * Generate competitive messaging for a specific use case
 */
export async function generateCompetitiveMessaging(
  competitor: Competitor,
  useCase: string,
  workspaceId: string
): Promise<{
  headline: string;
  subheadline: string;
  bullets: string[];
  cta: string;
}> {
  const brandContext = await getBrandContext(workspaceId);
  
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: z.object({
      headline: z.string().describe('Attention-grabbing headline'),
      subheadline: z.string().describe('Supporting subheadline'),
      bullets: z.array(z.string()).describe('3-4 benefit bullets'),
      cta: z.string().describe('Call to action'),
    }),
    prompt: `Generate competitive messaging for when prospects are comparing us to ${competitor.name}.

USE CASE: ${useCase}

YOUR COMPANY:
- Name: ${brandContext?.name || 'Your Company'}
- Voice: ${brandContext?.voice?.tone || 'professional'}

COMPETITOR: ${competitor.name}
- G2 Rating: ${competitor.metrics.g2Rating || 'N/A'}

Create messaging that:
1. Doesn't mention the competitor by name
2. Subtly addresses why we're better for this use case
3. Uses our brand voice
4. Is compelling but not aggressive`,
  });
  
  return object as any;
}

/**
 * Generate win/loss analysis template
 */
export async function generateWinLossQuestions(
  competitors: Competitor[]
): Promise<{
  winQuestions: string[];
  lossQuestions: string[];
  competitorQuestions: Record<string, string[]>;
}> {
  const { object } = await generateObject({
    model: MODELS.FAST,
    schema: z.object({
      winQuestions: z.array(z.string()).describe('Questions to ask after a win'),
      lossQuestions: z.array(z.string()).describe('Questions to ask after a loss'),
      competitorQuestions: z.record(z.array(z.string())).describe('Competitor-specific questions'),
    }),
    prompt: `Generate win/loss analysis questions for sales debriefs.

COMPETITORS TRACKED:
${competitors.map(c => `- ${c.name}`).join('\n')}

Generate:
1. 5-7 questions to ask after winning a deal
2. 5-7 questions to ask after losing a deal
3. 2-3 specific questions per competitor

Questions should help understand:
- Why the prospect chose us/them
- What features mattered most
- Pricing considerations
- Service/support factors`,
  });
  
  return object as any;
}

/**
 * Score your positioning against a competitor
 */
export function scorePositioning(
  yourMetrics: CompetitorMetrics,
  competitor: Competitor
): {
  overallScore: number;
  categoryScores: Record<string, { yours: number; theirs: number; diff: number }>;
  summary: string;
} {
  const categoryScores: Record<string, { yours: number; theirs: number; diff: number }> = {};
  let totalScore = 0;
  let categories = 0;
  
  // G2 comparison (scale 0-100)
  if (yourMetrics.g2Rating && competitor.metrics.g2Rating) {
    const yours = (yourMetrics.g2Rating / 5) * 100;
    const theirs = (competitor.metrics.g2Rating / 5) * 100;
    categoryScores['G2 Rating'] = { yours, theirs, diff: yours - theirs };
    totalScore += yours - theirs > 0 ? 1 : -1;
    categories++;
  }
  
  // Review count (logarithmic scale)
  if (yourMetrics.g2Reviews && competitor.metrics.g2Reviews) {
    const yours = Math.log10(yourMetrics.g2Reviews + 1) * 25;
    const theirs = Math.log10(competitor.metrics.g2Reviews + 1) * 25;
    categoryScores['Review Volume'] = { yours, theirs, diff: yours - theirs };
    totalScore += yours > theirs ? 1 : -1;
    categories++;
  }
  
  // LinkedIn followers (relative)
  if (yourMetrics.linkedinFollowers && competitor.metrics.linkedinFollowers) {
    const total = yourMetrics.linkedinFollowers + competitor.metrics.linkedinFollowers;
    const yours = (yourMetrics.linkedinFollowers / total) * 100;
    const theirs = (competitor.metrics.linkedinFollowers / total) * 100;
    categoryScores['Social Presence'] = { yours, theirs, diff: yours - theirs };
    totalScore += yours > theirs ? 1 : -1;
    categories++;
  }
  
  const overallScore = categories > 0 ? (totalScore / categories + 1) * 50 : 50;
  
  let summary = '';
  if (overallScore > 60) {
    summary = `You're outperforming ${competitor.name} in most tracked metrics.`;
  } else if (overallScore < 40) {
    summary = `${competitor.name} has stronger metrics in most categories.`;
  } else {
    summary = `You and ${competitor.name} are closely matched in most metrics.`;
  }
  
  return { overallScore, categoryScores, summary };
}
