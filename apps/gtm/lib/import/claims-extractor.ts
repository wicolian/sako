/**
 * Claims Extractor AI (Jan 2026)
 * 
 * AI-powered claim detection from page content with classification,
 * risk scoring, and evidence suggestions.
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { buildClaimsExtractionSystemPrompt } from '@/lib/ai/prompts-v2';
import type { ParsedPage, PageSection } from './html-parser';
import { v4 as uuidv4 } from 'uuid';

export interface ExtractedClaim {
  id: string;
  text: string;
  type: 'hard' | 'soft';
  category: ClaimCategory;
  evidenceStatus?: 'on_page_supported' | 'on_page_partial' | 'unsupported' | 'not_applicable';
  riskLevel?: 'safe' | 'needs_evidence' | 'risky' | 'blocked';
  source: 'headline' | 'body' | 'testimonial' | 'stat' | 'cta';
  location: {
    sectionId: string;
    sectionType: string;
  };
  riskScore: number;
  flags: string[];
  suggestedEvidence: string[];
  evidenceExpectation?: string;
  suggestedRewrite?: string;
  originalContext: string;
}

export type ClaimCategory = 
  | 'performance'
  | 'trust'
  | 'feature'
  | 'comparison'
  | 'testimonial'
  | 'stat'
  | 'security'
  | 'compliance'
  | 'roi'
  | 'support'
  | 'generic';

// Schema for individual claim
const ClaimSchema = z.object({
  text: z.string().describe('The exact claim text'),
  type: z.enum(['hard', 'soft']).describe('Hard = quantified/specific, Soft = qualitative/vague'),
  category: z.enum([
    'performance', 'trust', 'feature', 'comparison', 
    'testimonial', 'stat', 'security', 'compliance', 
    'roi', 'support', 'generic'
  ]).describe('Category of the claim'),
  evidenceStatus: z.enum(['on_page_supported', 'on_page_partial', 'unsupported', 'not_applicable']).describe('Whether evidence appears on the page'),
  riskLevel: z.enum(['safe', 'needs_evidence', 'risky', 'blocked']).describe('Compliance risk level'),
  source: z.enum(['headline', 'body', 'testimonial', 'stat', 'cta']).describe('Where the claim appears'),
  flags: z.array(z.string()).describe('Flags like superlative, quantified, unverified, comparative'),
  suggestedEvidence: z.array(z.string()).describe('What evidence would support this claim'),
  suggestedRewrite: z.string().nullable().describe('Safer rewrite for risky or blocked claims, or null when not needed'),
  originalContext: z.string().describe('The surrounding text for context'),
});

const ClaimsExtractionSchema = z.object({
  claims: z.array(ClaimSchema),
});

type GeneratedClaimsExtraction = z.infer<typeof ClaimsExtractionSchema>;

// Risk patterns and their scores
const RISK_PATTERNS = {
  superlative: {
    patterns: [/\b(best|#1|number one|leading|top|first|only|most|fastest|largest|biggest)\b/i],
    score: 30,
    flag: 'superlative',
  },
  quantified: {
    patterns: [/\d+%/, /\d+x/, /\$\d+/, /\d+\+/, /\d+ (customers|users|clients|companies)/i],
    score: 20,
    flag: 'quantified',
  },
  guaranteed: {
    patterns: [/\b(guarantee|guaranteed|promise|always|never|100%)\b/i],
    score: 25,
    flag: 'guaranteed',
  },
  comparative: {
    patterns: [/\b(better than|faster than|more than|unlike|compared to|vs\.?)\b/i],
    score: 20,
    flag: 'comparative',
  },
  medical: {
    patterns: [/\b(cure|heal|treat|prevent|diagnose|medical|clinical)\b/i],
    score: 40,
    flag: 'medical',
  },
  financial: {
    patterns: [/\b(save money|ROI|return on investment|increase revenue|profit|earnings)\b/i],
    score: 15,
    flag: 'financial',
  },
  timebound: {
    patterns: [/\b(in \d+ (minutes|hours|days)|instantly|immediately|overnight)\b/i],
    score: 15,
    flag: 'timebound',
  },
};

/**
 * Extract claims from parsed page
 */
export async function extractClaims(page: ParsedPage): Promise<ExtractedClaim[]> {
  const allClaims: ExtractedClaim[] = [];
  
  // Process each section
  for (const section of page.sections) {
    const sectionClaims = await extractClaimsFromSection(section);
    allClaims.push(...sectionClaims);
  }
  
  // Deduplicate similar claims
  const dedupedClaims = deduplicateClaims(allClaims);
  
  // Sort by risk score
  dedupedClaims.sort((a, b) => b.riskScore - a.riskScore);
  
  return dedupedClaims;
}

/**
 * Extract claims from a single section
 */
async function extractClaimsFromSection(section: PageSection): Promise<ExtractedClaim[]> {
  // Skip very small sections
  if (section.wordCount < 10) {
    return [];
  }
  
  // Skip footer/header for most claim extraction
  if (section.type === 'footer' && section.wordCount < 50) {
    return [];
  }
  
  try {
    const { object: result } = await generateObject({
      model: MODELS.FAST,
      schema: ClaimsExtractionSchema,
      system: buildClaimsExtractionSystemPrompt(),
      prompt: `Extract ALL marketing claims from this section that could potentially be challenged or require substantiation.

SECTION TYPE: ${section.type}
SECTION CONTENT:
${section.textContent.slice(0, 3000)}

Return every claim with:
1. Exact text
2. Hard or soft type
3. Category
4. On-page evidence status
5. Risk level
6. Risk indicators
7. Evidence suggestions
8. A safer rewrite for risky or blocked claims

Extract vague superlatives too. Do not skip them because they sound common.`,
    });
    
    // Process and enrich claims
    const typedResult = result as GeneratedClaimsExtraction

    return typedResult.claims.map(claim => {
      const riskScore = calculateRiskScore(claim.text, claim.flags);
      
      return {
        id: uuidv4(),
        text: claim.text,
        type: claim.type,
        category: claim.category as ClaimCategory,
        evidenceStatus: claim.evidenceStatus,
        riskLevel: claim.riskLevel,
        source: claim.source as ExtractedClaim['source'],
        location: {
          sectionId: section.id,
          sectionType: section.type,
        },
        riskScore,
        flags: [...claim.flags, ...detectAdditionalFlags(claim.text)],
        suggestedEvidence: claim.suggestedEvidence,
        evidenceExpectation: inferEvidenceExpectation(claim.category as ClaimCategory, claim.source as ExtractedClaim['source']),
        suggestedRewrite: claim.suggestedRewrite ?? undefined,
        originalContext: claim.originalContext,
      };
    });
    
  } catch (error) {
    console.error(`Failed to extract claims from section ${section.id}:`, error);
    return [];
  }
}

function inferEvidenceExpectation(category: ClaimCategory, source: ExtractedClaim['source']): string {
  if (category === 'testimonial' || source === 'testimonial') {
    return 'Named customer quote, customer logo, or attributable testimonial'
  }

  if (category === 'stat' || category === 'roi' || category === 'performance') {
    return 'Metric with baseline, time window, or source attribution'
  }

  if (category === 'security' || category === 'compliance') {
    return 'Certification, policy statement, audit result, or reviewable compliance artifact'
  }

  if (category === 'comparison') {
    return 'Comparison source, benchmark setup, or explicit reference point'
  }

  return 'Product detail, workflow evidence, or supporting customer proof'
}

/**
 * Calculate risk score based on claim text and flags
 */
function calculateRiskScore(text: string, existingFlags: string[]): number {
  let score = 10; // Base score
  
  // Add scores based on patterns
  for (const [key, config] of Object.entries(RISK_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        score += config.score;
        break; // Only add once per pattern type
      }
    }
  }
  
  // Add score based on existing flags
  if (existingFlags.includes('superlative')) score += 10;
  if (existingFlags.includes('quantified')) score += 10;
  if (existingFlags.includes('guaranteed')) score += 15;
  
  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Detect additional flags not caught by AI
 */
function detectAdditionalFlags(text: string): string[] {
  const flags: string[] = [];
  
  for (const [key, config] of Object.entries(RISK_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(text) && !flags.includes(config.flag)) {
        flags.push(config.flag);
        break;
      }
    }
  }
  
  return flags;
}

/**
 * Deduplicate similar claims
 */
function deduplicateClaims(claims: ExtractedClaim[]): ExtractedClaim[] {
  const seen = new Map<string, ExtractedClaim>();
  
  for (const claim of claims) {
    // Normalize text for comparison
    const normalized = claim.text.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    // Check if similar claim exists
    let isDuplicate = false;
    for (const [key, existing] of seen.entries()) {
      if (areSimilarClaims(normalized, key)) {
        // Keep the one with higher risk score
        if (claim.riskScore > existing.riskScore) {
          seen.delete(key);
          seen.set(normalized, claim);
        }
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      seen.set(normalized, claim);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Check if two claims are similar
 */
function areSimilarClaims(text1: string, text2: string): boolean {
  // Exact match
  if (text1 === text2) return true;
  
  // One contains the other
  if (text1.includes(text2) || text2.includes(text1)) return true;
  
  // Calculate simple similarity (Jaccard)
  const words1 = new Set(text1.split(/\s+/));
  const words2 = new Set(text2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  const similarity = intersection.size / union.size;
  return similarity > 0.7;
}

/**
 * Quick claim scan (without AI, pattern-based only)
 */
export function quickClaimScan(text: string): {
  potentialClaims: number;
  highRiskIndicators: string[];
} {
  const highRiskIndicators: string[] = [];
  let potentialClaims = 0;
  
  // Check for risk patterns
  for (const [key, config] of Object.entries(RISK_PATTERNS)) {
    for (const pattern of config.patterns) {
      const matches = text.match(new RegExp(pattern.source, 'gi'));
      if (matches) {
        potentialClaims += matches.length;
        if (config.score >= 25) {
          highRiskIndicators.push(...matches.map(m => `${config.flag}: "${m}"`));
        }
      }
    }
  }
  
  return {
    potentialClaims,
    highRiskIndicators: [...new Set(highRiskIndicators)].slice(0, 10),
  };
}

/**
 * Get claims summary
 */
export function getClaimsSummary(claims: ExtractedClaim[]): {
  total: number;
  byType: { hard: number; soft: number };
  byCategory: Record<string, number>;
  byRisk: { high: number; medium: number; low: number };
  topRisks: ExtractedClaim[];
} {
  const byType = { hard: 0, soft: 0 };
  const byCategory: Record<string, number> = {};
  const byRisk = { high: 0, medium: 0, low: 0 };
  
  claims.forEach(claim => {
    // By type
    byType[claim.type]++;
    
    // By category
    byCategory[claim.category] = (byCategory[claim.category] || 0) + 1;
    
    // By risk
    if (claim.riskScore >= 70) byRisk.high++;
    else if (claim.riskScore >= 40) byRisk.medium++;
    else byRisk.low++;
  });
  
  return {
    total: claims.length,
    byType,
    byCategory,
    byRisk,
    topRisks: claims.filter(c => c.riskScore >= 60).slice(0, 5),
  };
}

/**
 * Generate suggested rewrite for a risky claim
 */
export async function suggestClaimRewrite(claim: ExtractedClaim): Promise<string> {
  const { object } = await generateObject({
    model: MODELS.FAST,
    schema: z.object({
      rewrite: z.string().describe('A safer version of the claim'),
      explanation: z.string().describe('Why this is safer'),
    }),
    system: buildClaimsExtractionSystemPrompt(),
    prompt: `Rewrite this marketing claim to be legally safer while maintaining its impact.

ORIGINAL CLAIM: "${claim.text}"
RISK FLAGS: ${claim.flags.join(', ')}
RISK SCORE: ${claim.riskScore}/100

Rules for rewriting:
- Remove unsubstantiated superlatives
- Add qualification to outcome claims
- Replace unsupported specific numbers with citations or softer phrasing
- Use "designed to", "can help", or "built for" when proof is missing
- Keep the sentence style close to the original brand tone

Provide a rewritten version that is:
1. Legally defensible
2. Still compelling
3. Honest`,
  });
  
  return (object as { rewrite: string }).rewrite;
}
