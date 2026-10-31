/**
 * Competitor Intelligence Module (Jan 2026)
 * 
 * Evidence-based competitor intelligence using Tavily search.
 * NO hallucinated data - only metrics backed by verified sources.
 * 
 * Data sources:
 * - G2 reviews and ratings (via Tavily search)
 * - Capterra reviews (via Tavily search)
 * - LinkedIn company data (best-effort via Tavily)
 * - Public web presence
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { z } from 'zod';
import {
  fetchPublicSignals,
  fetchWebPresence,
  isTavilyConfigured,
  type EvidenceSource,
  type EvidenceRef,
  type ExtractedMetrics,
  type ReviewSignals,
} from './evidence';

// ============================================================================
// Types
// ============================================================================

export interface CompetitorProfile {
  id: string;
  name: string;
  domain: string;
  description?: string;
  category?: string;
  metrics: CompetitorMetrics;
  reviews: ReviewSummary;
  positioning: PositioningData;
  lastUpdated: string;
  // New: Evidence tracking
  sources: EvidenceSource[];
  metricProvenance: Record<string, EvidenceRef | undefined>;
}

export interface CompetitorMetrics {
  g2Rating?: number;
  g2ReviewCount?: number;
  capterraRating?: number;
  capterraReviewCount?: number;
  linkedInFollowers?: number;
  linkedInEmployees?: string;
  alexaRank?: number;
  estimatedTraffic?: string;
}

export interface ReviewSummary {
  overallSentiment: 'positive' | 'neutral' | 'negative' | undefined;
  topStrengths: string[];
  topWeaknesses: string[];
  commonThemes: string[];
  recentTrend: 'improving' | 'stable' | 'declining' | 'unknown';
}

export interface PositioningData {
  primaryValueProp?: string;
  targetAudience?: string;
  pricingModel?: string;
  keyDifferentiators: string[];
  marketPosition: 'leader' | 'challenger' | 'niche' | 'emerging' | 'unknown';
}

export interface BattleCard {
  competitorId: string;
  competitorName: string;
  ourStrengths: string[];
  theirStrengths: string[];
  ourWeaknesses: string[];
  theirWeaknesses: string[];
  winningTalkingPoints: string[];
  objectionsAndResponses: Array<{
    objection: string;
    response: string;
  }>;
  idealCustomerProfile: string;
  generatedAt: string;
  // New: Evidence grounding
  evidenceSources: EvidenceSource[];
  groundedClaims: Array<{
    claim: string;
    sourceId: string;
    quote: string;
  }>;
}

// Re-export types for backwards compatibility
export type { EvidenceSource, EvidenceRef } from './evidence';

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Fetch competitor data from public sources via Tavily
 * NO API keys required except TAVILY_API_KEY
 */
export async function fetchCompetitorData(
  domain: string,
  options: { includeReviews?: boolean; includeLinkedIn?: boolean } = {}
): Promise<CompetitorProfile> {
  const { includeReviews = true, includeLinkedIn = true } = options;
  
  const competitorId = `comp-${domain.replace(/\./g, '-')}`;
  
  // Check Tavily availability
  if (!isTavilyConfigured()) {
    console.warn(
      'TAVILY_API_KEY not configured. Competitor intelligence will be limited. ' +
      'Get your API key from https://tavily.com and add it to .env.local'
    );
  }
  
  // Default empty result for when signals are not fetched
  const emptySignalsResult = {
    metrics: {} as ExtractedMetrics,
    reviewSignals: { strengths: [], weaknesses: [], sentiment: undefined } as ReviewSignals,
    sources: [] as EvidenceSource[],
    metricProvenance: {} as Record<string, EvidenceRef | undefined>,
  };
  
  // Fetch public signals and web presence in parallel
  const [signalsResult, webPresenceResult] = await Promise.all([
    (includeReviews || includeLinkedIn)
      ? fetchPublicSignals(domain)
      : Promise.resolve(emptySignalsResult),
    fetchWebPresence(domain),
  ]);
  
  // Combine all sources
  const allSources = [...signalsResult.sources, ...webPresenceResult.sources];
  
  // Build metrics (only include values with evidence)
  const metrics: CompetitorMetrics = {};
  const metricProvenance: Record<string, EvidenceRef | undefined> = {};
  
  // Only assign metrics that have evidence
  if (signalsResult.metricProvenance['g2Rating']) {
    metrics.g2Rating = signalsResult.metrics.g2Rating;
    metricProvenance['g2Rating'] = signalsResult.metricProvenance['g2Rating'];
  }
  if (signalsResult.metricProvenance['g2ReviewCount']) {
    metrics.g2ReviewCount = signalsResult.metrics.g2ReviewCount;
    metricProvenance['g2ReviewCount'] = signalsResult.metricProvenance['g2ReviewCount'];
  }
  if (signalsResult.metricProvenance['capterraRating']) {
    metrics.capterraRating = signalsResult.metrics.capterraRating;
    metricProvenance['capterraRating'] = signalsResult.metricProvenance['capterraRating'];
  }
  if (signalsResult.metricProvenance['capterraReviewCount']) {
    metrics.capterraReviewCount = signalsResult.metrics.capterraReviewCount;
    metricProvenance['capterraReviewCount'] = signalsResult.metricProvenance['capterraReviewCount'];
  }
  if (includeLinkedIn && signalsResult.metricProvenance['linkedInFollowers']) {
    metrics.linkedInFollowers = signalsResult.metrics.linkedInFollowers;
    metricProvenance['linkedInFollowers'] = signalsResult.metricProvenance['linkedInFollowers'];
  }
  if (includeLinkedIn && signalsResult.metricProvenance['linkedInEmployees']) {
    metrics.linkedInEmployees = signalsResult.metrics.linkedInEmployees;
    metricProvenance['linkedInEmployees'] = signalsResult.metricProvenance['linkedInEmployees'];
  }
  
  // Build reviews summary (only from evidence)
  const reviews: ReviewSummary = {
    overallSentiment: signalsResult.reviewSignals.sentiment,
    topStrengths: signalsResult.reviewSignals.strengths,
    topWeaknesses: signalsResult.reviewSignals.weaknesses,
    commonThemes: extractCommonThemes(signalsResult.reviewSignals),
    recentTrend: 'unknown', // Cannot determine trend without time-series data
  };
  
  // Build positioning from web presence
  const positioning = await analyzePositioning(
    domain,
    webPresenceResult,
    allSources
  );
  
  return {
    id: competitorId,
    name: webPresenceResult.companyName || extractCompanyName(domain),
    domain,
    description: webPresenceResult.description,
    category: webPresenceResult.category,
    metrics,
    reviews,
    positioning,
    lastUpdated: new Date().toISOString(),
    sources: allSources,
    metricProvenance,
  };
}

/**
 * Generate a battle card for a competitor
 * Grounded on extracted facts + quoted evidence
 */
export async function generateBattleCard(
  competitor: CompetitorProfile,
  ourProduct: {
    name: string;
    strengths: string[];
    valueProps: string[];
  }
): Promise<BattleCard> {
  // Build evidence context from sources
  const evidenceContext = competitor.sources
    .slice(0, 10)
    .map(s => `[${s.id}] ${s.title}: ${s.snippet?.slice(0, 150)}...`)
    .join('\n');
  
  const { object } = await generateObject({
    model: MODELS.CREATIVE,
    schema: z.object({
      ourStrengths: z.array(z.string()),
      theirStrengths: z.array(z.string()),
      ourWeaknesses: z.array(z.string()),
      theirWeaknesses: z.array(z.string()),
      winningTalkingPoints: z.array(z.string()),
      objectionsAndResponses: z.array(z.object({
        objection: z.string(),
        response: z.string(),
      })),
      idealCustomerProfile: z.string(),
      groundedClaims: z.array(z.object({
        claim: z.string().describe('A claim about the competitor'),
        sourceId: z.string().describe('The source ID that supports this claim'),
        quote: z.string().describe('The exact quote from the source'),
      })),
    }),
    prompt: `Generate a competitive battle card based ONLY on the evidence provided.

Our Product: ${ourProduct.name}
Our Strengths: ${ourProduct.strengths.join(', ')}
Our Value Props: ${ourProduct.valueProps.join(', ')}

Competitor: ${competitor.name}
Domain: ${competitor.domain}
Description: ${competitor.description || 'Not available'}

VERIFIED METRICS (only include if present):
- G2 Rating: ${competitor.metrics.g2Rating ?? 'Not available'}
- G2 Reviews: ${competitor.metrics.g2ReviewCount ?? 'Not available'}
- Capterra Rating: ${competitor.metrics.capterraRating ?? 'Not available'}

Their Strengths (from reviews): ${competitor.reviews.topStrengths.join(', ') || 'Not available'}
Their Weaknesses (from reviews): ${competitor.reviews.topWeaknesses.join(', ') || 'Not available'}
Their Market Position: ${competitor.positioning.marketPosition}

EVIDENCE SOURCES:
${evidenceContext}

IMPORTANT RULES:
1. Do NOT invent or hallucinate data not in the evidence.
2. Every claim about the competitor should reference a source ID.
3. If data is missing, say "No verified data available" rather than guessing.
4. Focus on factual comparisons, not assumptions.

Generate:
1. Our key strengths vs them (3-5 points)
2. Their key strengths vs us (3-5 points, ONLY from evidence)
3. Our weaknesses to address (2-3 points)
4. Their weaknesses to exploit (2-3 points, ONLY from evidence)
5. Winning talking points for sales (5-7 points)
6. Common objections and responses (3-5)
7. Ideal customer profile where we win
8. Grounded claims with source references`,
  });
  
  return {
    competitorId: competitor.id,
    competitorName: competitor.name,
    ...(object as any),
    generatedAt: new Date().toISOString(),
    evidenceSources: competitor.sources,
  };
}

/**
 * Compare multiple competitors
 * Only includes verified metrics in comparison
 */
export async function compareCompetitors(
  competitors: CompetitorProfile[]
): Promise<{
  comparison: Array<{
    metric: string;
    values: Record<string, string | number | undefined>;
    verified: Record<string, boolean>;
  }>;
  insights: string[];
  dataQuality: {
    totalMetrics: number;
    verifiedMetrics: number;
    missingData: string[];
  };
}> {
  const metrics = [
    'G2 Rating',
    'G2 Reviews',
    'Capterra Rating',
    'LinkedIn Followers',
    'Market Position',
    'Overall Sentiment',
  ];
  
  const comparison = metrics.map(metric => {
    const values: Record<string, string | number | undefined> = {};
    const verified: Record<string, boolean> = {};
    
    for (const comp of competitors) {
      switch (metric) {
        case 'G2 Rating':
          values[comp.name] = comp.metrics.g2Rating;
          verified[comp.name] = !!comp.metricProvenance['g2Rating'];
          break;
        case 'G2 Reviews':
          values[comp.name] = comp.metrics.g2ReviewCount;
          verified[comp.name] = !!comp.metricProvenance['g2ReviewCount'];
          break;
        case 'Capterra Rating':
          values[comp.name] = comp.metrics.capterraRating;
          verified[comp.name] = !!comp.metricProvenance['capterraRating'];
          break;
        case 'LinkedIn Followers':
          values[comp.name] = comp.metrics.linkedInFollowers;
          verified[comp.name] = !!comp.metricProvenance['linkedInFollowers'];
          break;
        case 'Market Position':
          values[comp.name] = comp.positioning.marketPosition;
          verified[comp.name] = comp.positioning.marketPosition !== 'unknown';
          break;
        case 'Overall Sentiment':
          values[comp.name] = comp.reviews.overallSentiment;
          verified[comp.name] = !!comp.reviews.overallSentiment;
          break;
      }
    }
    
    return { metric, values, verified };
  });
  
  // Calculate data quality
  let totalMetrics = 0;
  let verifiedMetrics = 0;
  const missingData: string[] = [];
  
  for (const row of comparison) {
    for (const comp of competitors) {
      totalMetrics++;
      if (row.values[comp.name] !== undefined && row.verified[comp.name]) {
        verifiedMetrics++;
      } else if (row.values[comp.name] === undefined) {
        missingData.push(`${comp.name}: ${row.metric}`);
      }
    }
  }
  
  // Generate insights only from verified data
  const verifiedComparison = comparison.map(row => ({
    metric: row.metric,
    values: Object.fromEntries(
      Object.entries(row.values).filter(([name]) => row.verified[name])
    ),
  }));
  
  const { object } = await generateObject({
    model: MODELS.FAST,
    schema: z.object({
      insights: z.array(z.string()),
    }),
    prompt: `Analyze this competitor comparison and provide 3-5 key insights.
ONLY use the verified data provided. Do not make assumptions about missing data.

Verified Data:
${JSON.stringify(verifiedComparison, null, 2)}

Missing Data Points:
${missingData.slice(0, 10).join('\n')}

Focus on:
- Clear market gaps and opportunities based on verified ratings
- Competitive advantages visible in the data
- Note where data is insufficient to draw conclusions`,
  });
  
  return {
    comparison,
    insights: (object as any).insights,
    dataQuality: {
      totalMetrics,
      verifiedMetrics,
      missingData: missingData.slice(0, 20), // Limit for readability
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract common themes from review signals
 */
function extractCommonThemes(signals: ReviewSignals): string[] {
  const allThemes = [...signals.strengths, ...signals.weaknesses];
  
  // Extract keywords
  const keywords = new Map<string, number>();
  const stopWords = new Set(['the', 'is', 'a', 'an', 'and', 'or', 'but', 'to', 'for', 'of', 'in', 'on', 'it', 'that', 'this', 'with']);
  
  for (const theme of allThemes) {
    const words = theme.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3 && !stopWords.has(word)) {
        keywords.set(word, (keywords.get(word) || 0) + 1);
      }
    }
  }
  
  // Return top keywords as themes
  return Array.from(keywords.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Analyze positioning based on web presence and evidence
 */
async function analyzePositioning(
  domain: string,
  webPresence: {
    primaryValueProp?: string;
    targetAudience?: string;
    pricingModel?: string;
    keyDifferentiators: string[];
  },
  sources: EvidenceSource[]
): Promise<PositioningData> {
  // If we have good web presence data, use it directly
  if (webPresence.keyDifferentiators.length > 0 || webPresence.pricingModel) {
    return {
      primaryValueProp: webPresence.primaryValueProp,
      targetAudience: webPresence.targetAudience,
      pricingModel: webPresence.pricingModel,
      keyDifferentiators: webPresence.keyDifferentiators,
      marketPosition: determineMarketPosition(sources),
    };
  }
  
  // Use LLM to analyze from source snippets only
  const sourceSnippets = sources
    .slice(0, 10)
    .map(s => s.snippet)
    .filter(Boolean)
    .join('\n');
  
  if (!sourceSnippets) {
    return {
      keyDifferentiators: [],
      marketPosition: 'unknown',
    };
  }
  
  try {
    const { object } = await generateObject({
      model: MODELS.FAST,
      schema: z.object({
        primaryValueProp: z.string().optional(),
        targetAudience: z.string().optional(),
        pricingModel: z.string().optional(),
        keyDifferentiators: z.array(z.string()),
        marketPosition: z.enum(['leader', 'challenger', 'niche', 'emerging', 'unknown']),
      }),
      prompt: `Analyze the market positioning of ${domain} based ONLY on these source snippets.
Do NOT invent information not present in the snippets.

SOURCE SNIPPETS:
${sourceSnippets}

Extract:
- primaryValueProp: Their main value proposition (if stated)
- targetAudience: Who they target (if clear)
- pricingModel: Their pricing approach (if mentioned)
- keyDifferentiators: What makes them unique (only from sources)
- marketPosition: Based on evidence (leader/challenger/niche/emerging/unknown)

If information is not clear from sources, mark as undefined or 'unknown'.`,
    });
    
    return object as any;
  } catch (error) {
    console.error('Positioning analysis error:', error);
    return {
      keyDifferentiators: [],
      marketPosition: 'unknown',
    };
  }
}

/**
 * Determine market position from source indicators
 */
function determineMarketPosition(
  sources: EvidenceSource[]
): 'leader' | 'challenger' | 'niche' | 'emerging' | 'unknown' {
  const allText = sources.map(s => `${s.title || ''} ${s.snippet || ''}`).join(' ').toLowerCase();
  
  // Look for market position indicators
  if (allText.includes('market leader') || allText.includes('#1') || allText.includes('leading')) {
    return 'leader';
  }
  if (allText.includes('challenger') || allText.includes('competitor to') || allText.includes('alternative to')) {
    return 'challenger';
  }
  if (allText.includes('niche') || allText.includes('specialized') || allText.includes('focused on')) {
    return 'niche';
  }
  if (allText.includes('startup') || allText.includes('new') || allText.includes('emerging')) {
    return 'emerging';
  }
  
  return 'unknown';
}

/**
 * Extract company name from domain
 */
function extractCompanyName(domain: string): string {
  const parts = domain.replace(/^www\./, '').split('.');
  const name = parts[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ============================================================================
// Backwards Compatibility Exports
// ============================================================================

/**
 * @deprecated Use fetchCompetitorData instead
 * Kept for backwards compatibility
 */
export async function fetchG2Data(): Promise<null> {
  console.warn('fetchG2Data is deprecated. Use fetchCompetitorData which uses Tavily for evidence-based data.');
  return null;
}

/**
 * @deprecated Use fetchCompetitorData instead
 */
export async function fetchCapterraData(): Promise<null> {
  console.warn('fetchCapterraData is deprecated. Use fetchCompetitorData which uses Tavily for evidence-based data.');
  return null;
}

/**
 * @deprecated Use fetchCompetitorData instead
 */
export async function fetchLinkedInData(): Promise<null> {
  console.warn('fetchLinkedInData is deprecated. Use fetchCompetitorData which uses Tavily for evidence-based data.');
  return null;
}
