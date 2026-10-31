/**
 * Competitor Evidence Module (Jan 2026)
 * 
 * Tavily-powered evidence collection for competitor intelligence.
 * NO hallucinated data - only metrics backed by evidence sources.
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

/**
 * Evidence source from Tavily search
 */
export interface EvidenceSource {
  id: string;
  url: string;
  title?: string;
  snippet?: string;
  extractedText?: string;
  retrievedAt: string;
  provider: 'tavily';
  query: string;
  score?: number;
}

/**
 * Reference linking a metric to its evidence
 */
export interface EvidenceRef {
  sourceId: string;
  url: string;
  quote: string;
  confidence: number; // 0-1
}

/**
 * Extracted metrics with provenance
 */
export interface ExtractedMetrics {
  g2Rating?: number;
  g2ReviewCount?: number;
  capterraRating?: number;
  capterraReviewCount?: number;
  linkedInFollowers?: number;
  linkedInEmployees?: string;
}

/**
 * Review signals extracted from search results
 */
export interface ReviewSignals {
  strengths: string[];
  weaknesses: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
}

/**
 * Result from public signals fetch
 */
export interface PublicSignalsResult {
  metrics: ExtractedMetrics;
  reviewSignals: ReviewSignals;
  sources: EvidenceSource[];
  metricProvenance: Record<string, EvidenceRef | undefined>;
}

/**
 * Web presence data extracted from company websites
 */
export interface WebPresenceResult {
  companyName?: string;
  description?: string;
  category?: string;
  primaryValueProp?: string;
  targetAudience?: string;
  pricingModel?: string;
  keyDifferentiators: string[];
  sources: EvidenceSource[];
}

// ============================================================================
// Tavily API Types
// ============================================================================

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

// ============================================================================
// In-Memory Cache (24h TTL)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const signalsCache = new Map<string, CacheEntry<PublicSignalsResult>>();
const webPresenceCache = new Map<string, CacheEntry<WebPresenceResult>>();

function getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Clear cache for a specific domain (useful for manual refresh)
 */
export function clearCompetitorCache(domain: string): void {
  signalsCache.delete(domain);
  webPresenceCache.delete(domain);
}

/**
 * Clear all competitor caches
 */
export function clearAllCompetitorCaches(): void {
  signalsCache.clear();
  webPresenceCache.clear();
}

// ============================================================================
// Tavily Search
// ============================================================================

/**
 * Check if Tavily is configured
 */
export function isTavilyConfigured(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

/**
 * Execute a single Tavily search
 */
async function tavilySearch(query: string, maxResults = 5): Promise<TavilySearchResult[]> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  
  if (!tavilyKey) {
    console.warn('TAVILY_API_KEY not configured - competitor intelligence will be limited');
    return [];
  }
  
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
        max_results: maxResults,
      }),
    });
    
    if (!response.ok) {
      console.error(`Tavily search failed for "${query}": ${response.status}`);
      return [];
    }
    
    const data: TavilyResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error(`Tavily search error for "${query}":`, error);
    return [];
  }
}

/**
 * Execute multiple Tavily searches in parallel
 */
async function batchTavilySearch(
  queries: string[],
  maxResultsPerQuery = 5
): Promise<Map<string, TavilySearchResult[]>> {
  const results = new Map<string, TavilySearchResult[]>();
  
  const searchPromises = queries.map(async (query) => {
    const searchResults = await tavilySearch(query, maxResultsPerQuery);
    return { query, results: searchResults };
  });
  
  const allResults = await Promise.all(searchPromises);
  allResults.forEach(({ query, results: r }) => {
    results.set(query, r);
  });
  
  return results;
}

// ============================================================================
// Metric Extraction Patterns
// ============================================================================

// G2 rating patterns (e.g., "4.5/5", "4.5 out of 5", "Rating: 4.5")
const G2_RATING_PATTERNS = [
  /(\d+\.?\d*)\s*\/\s*5/i,
  /(\d+\.?\d*)\s*out\s*of\s*5/i,
  /rating[:\s]+(\d+\.?\d*)/i,
  /(\d+\.?\d*)\s*stars?/i,
  /rated\s+(\d+\.?\d*)/i,
];

// Review count patterns (e.g., "1,234 reviews", "Based on 500+ reviews")
const REVIEW_COUNT_PATTERNS = [
  /([\d,]+)\s*reviews?/i,
  /based\s+on\s+([\d,]+)/i,
  /([\d,]+)\s*ratings?/i,
  /([\d,]+)\+?\s*verified/i,
];

// LinkedIn followers patterns (e.g., "10K followers", "10,000 followers")
const LINKEDIN_FOLLOWERS_PATTERNS = [
  /([\d,]+\.?\d*)\s*[kK]\s*followers?/i,
  /([\d,]+\.?\d*)\s*[mM]\s*followers?/i,
  /([\d,]+)\s*followers?/i,
];

// LinkedIn employees patterns (e.g., "51-200 employees", "1,001-5,000")
const LINKEDIN_EMPLOYEES_PATTERNS = [
  /([\d,]+-[\d,]+)\s*employees?/i,
  /([\d,]+)\+?\s*employees?/i,
  /company\s*size[:\s]+([\d,]+-[\d,]+)/i,
];

/**
 * Extract rating from text using patterns
 */
function extractRating(text: string): number | undefined {
  for (const pattern of G2_RATING_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const rating = parseFloat(match[1]);
      if (rating >= 0 && rating <= 5) {
        return rating;
      }
    }
  }
  return undefined;
}

/**
 * Extract review count from text
 */
function extractReviewCount(text: string): number | undefined {
  for (const pattern of REVIEW_COUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const count = parseInt(match[1].replace(/,/g, ''), 10);
      if (count > 0 && count < 1000000) { // Sanity check
        return count;
      }
    }
  }
  return undefined;
}

/**
 * Extract LinkedIn followers from text
 */
function extractLinkedInFollowers(text: string): number | undefined {
  for (const pattern of LINKEDIN_FOLLOWERS_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let count = parseFloat(match[1].replace(/,/g, ''));
      
      // Handle K/M suffixes
      if (text.match(/[\d,]+\.?\d*\s*[kK]\s*followers?/i)) {
        count *= 1000;
      } else if (text.match(/[\d,]+\.?\d*\s*[mM]\s*followers?/i)) {
        count *= 1000000;
      }
      
      if (count > 0 && count < 100000000) { // Sanity check
        return Math.round(count);
      }
    }
  }
  return undefined;
}

/**
 * Extract LinkedIn employee range from text
 */
function extractLinkedInEmployees(text: string): string | undefined {
  for (const pattern of LINKEDIN_EMPLOYEES_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Extract strengths/weaknesses from review snippets
 */
function extractReviewThemes(snippets: string[]): { strengths: string[]; weaknesses: string[] } {
  const strengthKeywords = ['love', 'great', 'excellent', 'easy', 'best', 'amazing', 'helpful', 'intuitive', 'powerful', 'fast'];
  const weaknessKeywords = ['difficult', 'confusing', 'slow', 'expensive', 'missing', 'lacks', 'limited', 'complicated', 'buggy', 'poor'];
  
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  
  for (const snippet of snippets) {
    const lowerSnippet = snippet.toLowerCase();
    
    // Check for strength indicators
    for (const keyword of strengthKeywords) {
      if (lowerSnippet.includes(keyword)) {
        // Extract a short phrase around the keyword
        const sentences = snippet.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(keyword) && sentence.length < 150) {
            strengths.push(sentence.trim());
            break;
          }
        }
        break;
      }
    }
    
    // Check for weakness indicators
    for (const keyword of weaknessKeywords) {
      if (lowerSnippet.includes(keyword)) {
        const sentences = snippet.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(keyword) && sentence.length < 150) {
            weaknesses.push(sentence.trim());
            break;
          }
        }
        break;
      }
    }
  }
  
  // Deduplicate and limit
  return {
    strengths: [...new Set(strengths)].slice(0, 5),
    weaknesses: [...new Set(weaknesses)].slice(0, 5),
  };
}

// ============================================================================
// Main Fetch Functions
// ============================================================================

/**
 * Check if a search result is actually about the target company
 * This prevents returning data from unrelated companies
 */
function isResultAboutCompany(
  result: { title: string; url: string; content: string },
  companyName: string,
  domain: string
): boolean {
  const combinedText = `${result.title || ''} ${result.url || ''} ${result.content || ''}`.toLowerCase();
  const nameLower = companyName.toLowerCase();
  const domainLower = domain.toLowerCase().replace(/\.(com|io|co|net|org)$/, '');
  
  // Check if the result mentions the company name or domain
  const mentionsName = combinedText.includes(nameLower);
  const mentionsDomain = combinedText.includes(domainLower);
  
  // Also check URL contains company/domain reference
  const urlHasCompany = result.url.toLowerCase().includes(nameLower) || 
                        result.url.toLowerCase().includes(domainLower);
  
  return mentionsName || mentionsDomain || urlHasCompany;
}

/**
 * Fetch public signals for a competitor using Tavily
 * Replaces fetchG2Data, fetchCapterraData, fetchLinkedInData
 */
export async function fetchPublicSignals(
  domain: string,
  companyName?: string
): Promise<PublicSignalsResult> {
  // Check cache first
  const cached = getCached(signalsCache, domain);
  if (cached) {
    return cached;
  }
  
  const name = companyName || extractCompanyNameFromDomain(domain);
  const retrievedAt = new Date().toISOString();
  
  // Build search queries - search multiple review platforms
  const queries = [
    // G2 searches
    `site:g2.com "${name}" rating reviews`,
    `site:g2.com ${domain} rating reviews`,
    // Capterra searches
    `site:capterra.com "${name}" reviews rating`,
    `site:capterra.com ${domain} reviews`,
    // TrustRadius searches (additional source)
    `site:trustradius.com "${name}" reviews`,
    // LinkedIn searches (best effort)
    `site:linkedin.com/company "${name}" followers`,
    `site:linkedin.com/company ${domain} employees`,
    // General company search as fallback
    `"${name}" company reviews rating`,
  ];
  
  // Execute all searches
  const searchResults = await batchTavilySearch(queries, 5);
  
  // Collect all sources - BUT validate they're actually about the target company
  const sources: EvidenceSource[] = [];
  const allSnippets: string[] = [];
  let discardedCount = 0;
  
  for (const [query, results] of searchResults) {
    for (const result of results) {
      // CRITICAL: Validate the result is actually about the company we searched for
      // This prevents returning "PL Rating" when searching for "pickyourtrail"
      if (!isResultAboutCompany(result, name, domain)) {
        discardedCount++;
        continue; // Skip unrelated results
      }
      
      const source: EvidenceSource = {
        id: uuidv4(),
        url: result.url,
        title: result.title,
        snippet: result.content?.slice(0, 500),
        retrievedAt,
        provider: 'tavily',
        query,
        score: result.score,
      };
      sources.push(source);
      if (result.content) {
        allSnippets.push(result.content);
      }
    }
  }
  
  if (discardedCount > 0) {
    console.log(`[CompetitorEvidence] Discarded ${discardedCount} unrelated results for ${name} (${domain})`);
  }
  
  // Extract metrics from sources
  const metrics: ExtractedMetrics = {};
  const metricProvenance: Record<string, EvidenceRef | undefined> = {};
  
  // Process G2 sources
  const g2Sources = sources.filter(s => s.url.includes('g2.com'));
  for (const source of g2Sources) {
    const combinedText = `${source.title || ''} ${source.snippet || ''}`;
    
    if (!metrics.g2Rating) {
      const rating = extractRating(combinedText);
      if (rating !== undefined) {
        metrics.g2Rating = rating;
        metricProvenance['g2Rating'] = {
          sourceId: source.id,
          url: source.url,
          quote: combinedText.slice(0, 200),
          confidence: source.score || 0.7,
        };
      }
    }
    
    if (!metrics.g2ReviewCount) {
      const count = extractReviewCount(combinedText);
      if (count !== undefined) {
        metrics.g2ReviewCount = count;
        metricProvenance['g2ReviewCount'] = {
          sourceId: source.id,
          url: source.url,
          quote: combinedText.slice(0, 200),
          confidence: source.score || 0.7,
        };
      }
    }
  }
  
  // Process Capterra sources
  const capterraSources = sources.filter(s => s.url.includes('capterra.com'));
  for (const source of capterraSources) {
    const combinedText = `${source.title || ''} ${source.snippet || ''}`;
    
    if (!metrics.capterraRating) {
      const rating = extractRating(combinedText);
      if (rating !== undefined) {
        metrics.capterraRating = rating;
        metricProvenance['capterraRating'] = {
          sourceId: source.id,
          url: source.url,
          quote: combinedText.slice(0, 200),
          confidence: source.score || 0.7,
        };
      }
    }
    
    if (!metrics.capterraReviewCount) {
      const count = extractReviewCount(combinedText);
      if (count !== undefined) {
        metrics.capterraReviewCount = count;
        metricProvenance['capterraReviewCount'] = {
          sourceId: source.id,
          url: source.url,
          quote: combinedText.slice(0, 200),
          confidence: source.score || 0.7,
        };
      }
    }
  }
  
  // Process LinkedIn sources
  const linkedInSources = sources.filter(s => s.url.includes('linkedin.com'));
  for (const source of linkedInSources) {
    const combinedText = `${source.title || ''} ${source.snippet || ''}`;
    
    if (!metrics.linkedInFollowers) {
      const followers = extractLinkedInFollowers(combinedText);
      if (followers !== undefined) {
        metrics.linkedInFollowers = followers;
        metricProvenance['linkedInFollowers'] = {
          sourceId: source.id,
          url: source.url,
          quote: combinedText.slice(0, 200),
          confidence: source.score || 0.5, // Lower confidence for LinkedIn data
        };
      }
    }
    
    if (!metrics.linkedInEmployees) {
      const employees = extractLinkedInEmployees(combinedText);
      if (employees !== undefined) {
        metrics.linkedInEmployees = employees;
        metricProvenance['linkedInEmployees'] = {
          sourceId: source.id,
          url: source.url,
          quote: combinedText.slice(0, 200),
          confidence: source.score || 0.5,
        };
      }
    }
  }
  
  // Extract review signals
  const reviewSnippets = [...g2Sources, ...capterraSources]
    .map(s => s.snippet || '')
    .filter(Boolean);
  const { strengths, weaknesses } = extractReviewThemes(reviewSnippets);
  
  // Determine sentiment from ratings
  let sentiment: 'positive' | 'neutral' | 'negative' | undefined;
  const ratings = [metrics.g2Rating, metrics.capterraRating].filter(Boolean) as number[];
  if (ratings.length > 0) {
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    if (avgRating >= 4.0) sentiment = 'positive';
    else if (avgRating >= 3.0) sentiment = 'neutral';
    else sentiment = 'negative';
  }
  
  const result: PublicSignalsResult = {
    metrics,
    reviewSignals: {
      strengths,
      weaknesses,
      sentiment,
    },
    sources,
    metricProvenance,
  };
  
  // Cache the result
  setCache(signalsCache, domain, result);
  
  return result;
}

/**
 * Fetch web presence data using Tavily
 * Replaces the LLM-only fetchWebPresenceData
 */
export async function fetchWebPresence(
  domain: string,
  companyName?: string
): Promise<WebPresenceResult> {
  // Check cache first
  const cached = getCached(webPresenceCache, domain);
  if (cached) {
    return cached;
  }
  
  const name = companyName || extractCompanyNameFromDomain(domain);
  const retrievedAt = new Date().toISOString();
  
  // Build search queries for web presence
  const queries = [
    // Direct site searches (most reliable)
    `site:${domain} about`,
    `site:${domain} pricing`,
    `site:${domain} features`,
    // General searches (need validation)
    `"${name}" company description`,
    `"${name}" what is`,
    `"${name}" alternatives competitors`,
  ];
  
  // Execute searches
  const searchResults = await batchTavilySearch(queries, 5);
  
  // Collect sources - validate non-site-specific results
  const sources: EvidenceSource[] = [];
  const allContent: string[] = [];
  
  for (const [query, results] of searchResults) {
    const isSiteSpecific = query.startsWith(`site:${domain}`);
    
    for (const result of results) {
      // For non-site-specific queries, validate the result is about our company
      if (!isSiteSpecific && !isResultAboutCompany(result, name, domain)) {
        continue; // Skip unrelated results
      }
      
      const source: EvidenceSource = {
        id: uuidv4(),
        url: result.url,
        title: result.title,
        snippet: result.content?.slice(0, 500),
        retrievedAt,
        provider: 'tavily',
        query,
        score: result.score,
      };
      sources.push(source);
      if (result.content) {
        allContent.push(result.content);
      }
    }
  }
  
  // Extract web presence info from content
  const result: WebPresenceResult = {
    companyName: name,
    keyDifferentiators: [],
    sources,
  };
  
  // Try to extract description from about page content
  const aboutSources = sources.filter(s => 
    s.url.includes(domain) && (s.query.includes('about') || s.query.includes('what is'))
  );
  
  if (aboutSources.length > 0) {
    const aboutContent = aboutSources.map(s => s.snippet || '').join(' ');
    
    // Extract first coherent sentence as description
    const sentences = aboutContent.split(/[.!?]+/).filter(s => s.trim().length > 30);
    if (sentences.length > 0) {
      result.description = sentences[0].trim() + '.';
    }
  }
  
  // Try to extract pricing model from pricing page
  const pricingSources = sources.filter(s => s.query.includes('pricing'));
  if (pricingSources.length > 0) {
    const pricingContent = pricingSources.map(s => `${s.title || ''} ${s.snippet || ''}`).join(' ').toLowerCase();
    
    if (pricingContent.includes('free tier') || pricingContent.includes('freemium') || pricingContent.includes('free plan')) {
      result.pricingModel = 'freemium';
    } else if (pricingContent.includes('enterprise') || pricingContent.includes('contact sales') || pricingContent.includes('custom pricing')) {
      result.pricingModel = 'enterprise';
    } else if (pricingContent.includes('per user') || pricingContent.includes('/user') || pricingContent.includes('per seat')) {
      result.pricingModel = 'per-seat';
    } else if (pricingContent.includes('usage') || pricingContent.includes('pay as you go') || pricingContent.includes('metered')) {
      result.pricingModel = 'usage-based';
    } else if (pricingContent.includes('/month') || pricingContent.includes('monthly') || pricingContent.includes('subscription')) {
      result.pricingModel = 'subscription';
    }
  }
  
  // Extract differentiators from feature/comparison content
  const featureSources = sources.filter(s => 
    s.query.includes('features') || s.query.includes('alternatives')
  );
  
  if (featureSources.length > 0) {
    const featureContent = featureSources.map(s => s.snippet || '').join(' ');
    
    // Look for differentiator patterns
    const differentiatorPatterns = [
      /only\s+[\w\s]+\s+that\s+([^.]+)/gi,
      /unique(?:ly)?\s+([^.]+)/gi,
      /unlike\s+[\w\s]+,\s+([^.]+)/gi,
      /first\s+to\s+([^.]+)/gi,
    ];
    
    for (const pattern of differentiatorPatterns) {
      const matches = featureContent.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length < 100) {
          result.keyDifferentiators.push(match[1].trim());
        }
      }
    }
    
    result.keyDifferentiators = [...new Set(result.keyDifferentiators)].slice(0, 5);
  }
  
  // Cache the result
  setCache(webPresenceCache, domain, result);
  
  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract company name from domain
 */
function extractCompanyNameFromDomain(domain: string): string {
  // Remove common TLDs and extract name
  const parts = domain.replace(/^www\./, '').split('.');
  const name = parts[0];
  
  // Capitalize
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Calculate confidence for a metric based on source quality
 */
export function calculateMetricConfidence(
  provenance: EvidenceRef | undefined,
  source: EvidenceSource | undefined
): number {
  if (!provenance || !source) return 0;
  
  let confidence = provenance.confidence;
  
  // Boost confidence for authoritative sources
  if (source.url.includes('g2.com') || source.url.includes('capterra.com')) {
    confidence = Math.min(1, confidence * 1.2);
  }
  
  // Reduce confidence for older data (if we had timestamps)
  // For now, just use the base confidence
  
  return confidence;
}

/**
 * Validate that all metrics have provenance
 * Returns list of metrics that are missing evidence
 */
export function validateMetricProvenance(
  metrics: ExtractedMetrics,
  provenance: Record<string, EvidenceRef | undefined>
): string[] {
  const unverified: string[] = [];
  
  for (const [key, value] of Object.entries(metrics)) {
    if (value !== undefined && !provenance[key]) {
      unverified.push(key);
    }
  }
  
  return unverified;
}
