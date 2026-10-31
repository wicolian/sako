/**
 * Evidence Auto-Researcher (Jan 2026)
 * 
 * AI-powered evidence research using Tavily API to find
 * supporting evidence for marketing claims.
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { buildEvidenceResearchPrompt } from '@/lib/ai/prompts-v2';
import type { ExtractedClaim } from './claims-extractor';
import { v4 as uuidv4 } from 'uuid';

export interface EvidenceCandidate {
  id: string;
  claimId: string;
  sourceUrl: string;
  sourceType: EvidenceSourceType;
  tier: 'A' | 'B' | 'C';
  title: string;
  snippet: string;
  extractedData: string[];
  relevanceScore: number;
  confidence: number;
  autoLinked: boolean;
}

export type EvidenceSourceType = 
  | 'g2'
  | 'capterra'
  | 'case_study'
  | 'press_release'
  | 'testimonial'
  | 'news'
  | 'official_doc'
  | 'social_media'
  | 'other';

export interface CompanyContext {
  name: string;
  domain: string;
  industry?: string;
}

// Tavily API types
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilySearchResult[];
  query: string;
}

// Tier classification rules
const TIER_A_INDICATORS = [
  'press release', 'sec.gov', 'sec filing', 'certified', 'audit',
  'government', '.gov', 'peer-reviewed', 'official',
];

const TIER_B_INDICATORS = [
  'g2.com', 'capterra.com', 'trustradius', 'gartner',
  'case study', 'testimonial', 'review', 'award',
  'forbes.com', 'techcrunch.com', 'bloomberg.com',
];

const TIER_C_INDICATORS = [
  'blog', 'medium.com', 'twitter.com', 'linkedin.com',
  'reddit.com', 'forum', 'comment',
];

// Schema for search query generation
const SearchQueriesSchema = z.object({
  queries: z.array(z.string()).describe('5-7 search queries to find evidence'),
});

// Schema for evidence evaluation
const EvidenceEvaluationSchema = z.object({
  isRelevant: z.boolean().describe('Does this result support the claim?'),
  relevanceScore: z.number().min(0).max(1).describe('How relevant (0-1)'),
  extractedData: z.array(z.string()).describe('Key quotes or data points that support the claim'),
  confidence: z.number().min(0).max(1).describe('Confidence in this evidence'),
});

type GeneratedSearchQueries = z.infer<typeof SearchQueriesSchema>;
type GeneratedEvidenceEvaluation = z.infer<typeof EvidenceEvaluationSchema>;

/**
 * Research evidence for a single claim
 */
export async function researchClaim(
  claim: ExtractedClaim,
  companyContext: CompanyContext
): Promise<EvidenceCandidate[]> {
  // Generate search queries
  const queries = await generateSearchQueries(claim, companyContext);
  
  // Execute searches
  const searchResults = await executeSearches(queries);
  
  // Evaluate and filter results
  const evaluatedResults = await evaluateResults(claim, searchResults);
  
  // Convert to evidence candidates
  return evaluatedResults.map(result => ({
    id: uuidv4(),
    claimId: claim.id,
    sourceUrl: result.url,
    sourceType: classifySourceType(result.url),
    tier: classifyTier(result.url, result.snippet), // Use snippet as content fallback
    title: result.title,
    snippet: result.snippet,
    extractedData: result.extractedData,
    relevanceScore: result.relevanceScore,
    confidence: result.confidence,
    autoLinked: result.relevanceScore > 0.7 && result.confidence > 0.6,
  }));
}

/**
 * Research evidence for all claims
 */
export async function researchAllClaims(
  claims: ExtractedClaim[],
  companyContext: CompanyContext,
  onProgress?: (progress: { current: number; total: number; claim: string }) => void
): Promise<Map<string, EvidenceCandidate[]>> {
  const results = new Map<string, EvidenceCandidate[]>();
  
  // Process claims in parallel batches
  const batchSize = 3;
  for (let i = 0; i < claims.length; i += batchSize) {
    const batch = claims.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (claim, idx) => {
        onProgress?.({
          current: i + idx + 1,
          total: claims.length,
          claim: claim.text.slice(0, 50),
        });
        
        const evidence = await researchClaim(claim, companyContext);
        return { claimId: claim.id, evidence };
      })
    );
    
    batchResults.forEach(({ claimId, evidence }) => {
      results.set(claimId, evidence);
    });
  }
  
  return results;
}

export async function isTavilyReachable(timeoutMs = 3000): Promise<boolean> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'OPTIONS',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.status < 500;
  } catch (error) {
    clearTimeout(timeoutId);
    if (isTavilyUnavailableError(error)) {
      return false;
    }

    return false;
  }
}

/**
 * Generate smart search queries for a claim
 */
async function generateSearchQueries(
  claim: ExtractedClaim,
  companyContext: CompanyContext
): Promise<string[]> {
  const { object } = await generateObject({
    model: MODELS.FAST,
    schema: SearchQueriesSchema,
    system: buildEvidenceResearchPrompt(),
    prompt: `Generate search queries to find evidence supporting this marketing claim.

CLAIM: "${claim.text}"
COMPANY: ${companyContext.name}
DOMAIN: ${companyContext.domain}
INDUSTRY: ${companyContext.industry || 'unknown'}
CLAIM TYPE: ${claim.type} (${claim.category})

Generate 5-7 search queries. Prioritize:
1. On-domain proof
2. Case studies
3. Reviews and customer proof
4. Press releases or official docs
5. Third-party reports when relevant

Avoid vague search strings that would surface generic blog spam.`,
  });
  
  return (object as GeneratedSearchQueries).queries;
}

/**
 * Extract key metric or number from claim for searching
 */
function extractKeyMetric(text: string): string {
  // Find percentages, numbers, or key terms
  const metricMatch = text.match(/(\d+%|\d+x|\d+\s*\+?|\$\d+)/);
  if (metricMatch) return metricMatch[1];
  
  // Find key marketing terms
  const keyTerms = ['faster', 'better', 'save', 'increase', 'reduce', 'improve'];
  for (const term of keyTerms) {
    if (text.toLowerCase().includes(term)) return term;
  }
  
  return '';
}

/**
 * Execute searches using Tavily API
 */
async function executeSearches(queries: string[]): Promise<TavilySearchResult[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  
  if (!tavilyKey) {
    throw new Error(
      'TAVILY_API_KEY is required for evidence research. ' +
      'Get your API key from https://tavily.com and add it to .env.local'
    );
  }
  
  const allResults: TavilySearchResult[] = [];
  
  // Execute searches in parallel
  const searchPromises = queries.map(async (query) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: 'basic',
          include_answer: false,
          include_raw_content: false,
          max_results: 5,
        }),
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status >= 500 || response.status === 401 || response.status === 403) {
          throw new Error(`Tavily unavailable (${response.status})`);
        }

        console.error(`Tavily search failed for "${query}": ${response.status}`);
        return [];
      }
      
      const data: TavilyResponse = await response.json();
      return data.results || [];
    } catch (error) {
      clearTimeout(timeoutId);
      if (isTavilyUnavailableError(error)) {
        throw new Error('Tavily search is unreachable right now');
      }

      console.error(`Tavily search error for "${query}":`, error);
      return [];
    }
  });
  
  const results = await Promise.all(searchPromises);
  results.forEach(r => allResults.push(...r));
  
  // Deduplicate by URL
  const seen = new Set<string>();
  return allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

function isTavilyUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('enotfound') ||
    message.includes('eai_again') ||
    message.includes('fetch failed') ||
    message.includes('tavily unavailable') ||
    message.includes('timed out') ||
    message.includes('aborted')
  );
}

/**
 * Evaluate search results for relevance
 */
async function evaluateResults(
  claim: ExtractedClaim,
  results: TavilySearchResult[]
): Promise<Array<{
  url: string;
  title: string;
  snippet: string;
  extractedData: string[];
  relevanceScore: number;
  confidence: number;
}>> {
  if (results.length === 0) return [];
  
  const evaluatedResults: Array<{
    url: string;
    title: string;
    snippet: string;
    extractedData: string[];
    relevanceScore: number;
    confidence: number;
  }> = [];
  
  // Evaluate results in parallel
  const evaluations = await Promise.all(
    results.slice(0, 10).map(async (result) => {
      try {
        const { object } = await generateObject({
          model: MODELS.FAST,
          schema: EvidenceEvaluationSchema,
          system: buildEvidenceResearchPrompt(),
          prompt: `Evaluate if this search result supports the marketing claim.

CLAIM: "${claim.text}"

SEARCH RESULT:
Title: ${result.title}
URL: ${result.url}
Content: ${result.content?.slice(0, 1000) || 'No content'}

Determine:
1. Is this result relevant to supporting the claim?
2. How confident are you in this relevance (0-1)?
3. Extract any specific quotes or data points that support the claim
4. Reject evidence that sounds related but does not actually substantiate the exact assertion`,
        });
        
        return {
          result,
          evaluation: object as GeneratedEvidenceEvaluation,
        };
      } catch (error) {
        console.error('Failed to evaluate result:', error);
        return null;
      }
    })
  );
  
  // Filter and format results
  for (const evaluation of evaluations) {
    if (!evaluation || !evaluation.evaluation.isRelevant) continue;
    if (evaluation.evaluation.relevanceScore < 0.5) continue;
    
    evaluatedResults.push({
      url: evaluation.result.url,
      title: evaluation.result.title,
      snippet: evaluation.result.content?.slice(0, 300) || '',
      extractedData: evaluation.evaluation.extractedData,
      relevanceScore: evaluation.evaluation.relevanceScore,
      confidence: evaluation.evaluation.confidence,
    });
  }
  
  // Sort by relevance
  return evaluatedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Classify source type based on URL
 */
function classifySourceType(url: string): EvidenceSourceType {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('g2.com')) return 'g2';
  if (urlLower.includes('capterra.com')) return 'capterra';
  if (urlLower.includes('case-study') || urlLower.includes('casestudy') || urlLower.includes('customer-story')) return 'case_study';
  if (urlLower.includes('press-release') || urlLower.includes('newsroom') || urlLower.includes('prnewswire')) return 'press_release';
  if (urlLower.includes('testimonial')) return 'testimonial';
  if (urlLower.includes('forbes') || urlLower.includes('techcrunch') || urlLower.includes('bloomberg')) return 'news';
  if (urlLower.includes('twitter.com') || urlLower.includes('linkedin.com')) return 'social_media';
  if (urlLower.includes('.gov') || urlLower.includes('sec.gov')) return 'official_doc';
  
  return 'other';
}

/**
 * Classify evidence tier
 */
function classifyTier(url: string, content?: string): 'A' | 'B' | 'C' {
  const combined = `${url} ${content || ''}`.toLowerCase();
  
  // Check for Tier A indicators
  for (const indicator of TIER_A_INDICATORS) {
    if (combined.includes(indicator)) return 'A';
  }
  
  // Check for Tier B indicators
  for (const indicator of TIER_B_INDICATORS) {
    if (combined.includes(indicator)) return 'B';
  }
  
  // Check for Tier C indicators
  for (const indicator of TIER_C_INDICATORS) {
    if (combined.includes(indicator)) return 'C';
  }
  
  // Default to B for unknown sources
  return 'B';
}

/**
 * Get tier description
 */
export function getTierDescription(tier: 'A' | 'B' | 'C'): string {
  switch (tier) {
    case 'A':
      return 'Official/Verified Source - Press releases, SEC filings, certifications, audited data';
    case 'B':
      return 'Customer Validation - G2/Capterra reviews, testimonials, case studies, news articles';
    case 'C':
      return 'Unverified Source - Blog posts, social media, forum comments';
  }
}

/**
 * Get evidence summary
 */
export function getEvidenceSummary(evidence: EvidenceCandidate[]): {
  total: number;
  byTier: { A: number; B: number; C: number };
  byType: Record<string, number>;
  autoLinked: number;
  averageConfidence: number;
} {
  const byTier = { A: 0, B: 0, C: 0 };
  const byType: Record<string, number> = {};
  let autoLinked = 0;
  let totalConfidence = 0;
  
  evidence.forEach(e => {
    byTier[e.tier]++;
    byType[e.sourceType] = (byType[e.sourceType] || 0) + 1;
    if (e.autoLinked) autoLinked++;
    totalConfidence += e.confidence;
  });
  
  return {
    total: evidence.length,
    byTier,
    byType,
    autoLinked,
    averageConfidence: evidence.length > 0 ? totalConfidence / evidence.length : 0,
  };
}
