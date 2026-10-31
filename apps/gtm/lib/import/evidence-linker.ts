/**
 * Evidence Auto-Linker (Jan 2026)
 * 
 * Automatically links evidence to claims with confidence scoring,
 * gap detection, and rewrite suggestions for unsupported claims.
 */

import { generateObject } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { buildEvidenceResearchPrompt } from '@/lib/ai/prompts-v2';
import type { ExtractedClaim } from './claims-extractor';
import type { EvidenceCandidate } from './evidence-researcher';

export interface LinkedEvidence {
  claimId: string;
  evidenceIds: string[];
  status: 'supported' | 'weak' | 'unsupported';
  confidence: number;
  suggestedRewrite?: string;
  summary: string;
}

export interface LinkingSummary {
  totalClaims: number;
  supported: number;
  weak: number;
  unsupported: number;
  evidenceUsed: number;
  averageConfidence: number;
}

// Schema for linking evaluation
const LinkEvaluationSchema = z.object({
  isMatch: z.boolean().describe('Does this evidence support this claim?'),
  confidence: z.number().min(0).max(1).describe('How confident (0-1)'),
  reasoning: z.string().describe('Brief explanation'),
});

// Schema for rewrite suggestion
const RewriteSchema = z.object({
  rewrite: z.string().describe('Safer version of the claim'),
  explanation: z.string().describe('Why this is safer'),
});

/**
 * Auto-link evidence to claims
 */
export async function autoLinkEvidence(
  claims: ExtractedClaim[],
  evidenceByClaimId: Map<string, EvidenceCandidate[]>
): Promise<LinkedEvidence[]> {
  const linkedEvidence: LinkedEvidence[] = [];
  
  for (const claim of claims) {
    const evidence = evidenceByClaimId.get(claim.id) || [];
    const linked = await linkEvidenceToClaim(claim, evidence);
    linkedEvidence.push(linked);
  }
  
  return linkedEvidence;
}

/**
 * Link evidence to a single claim
 */
async function linkEvidenceToClaim(
  claim: ExtractedClaim,
  evidence: EvidenceCandidate[]
): Promise<LinkedEvidence> {
  // If no evidence found, mark as unsupported
  if (evidence.length === 0) {
    const rewrite = await generateRewrite(claim);
    return {
      claimId: claim.id,
      evidenceIds: [],
      status: 'unsupported',
      confidence: 0,
      suggestedRewrite: rewrite,
      summary: 'No supporting evidence found',
    };
  }
  
  // Filter evidence that was auto-linked (high confidence)
  const autoLinked = evidence.filter(e => e.autoLinked);
  
  // If we have auto-linked evidence with high confidence
  if (autoLinked.length > 0) {
    const avgConfidence = autoLinked.reduce((sum, e) => sum + e.confidence, 0) / autoLinked.length;
    
    if (avgConfidence >= 0.7) {
      return {
        claimId: claim.id,
        evidenceIds: autoLinked.map(e => e.id),
        status: 'supported',
        confidence: avgConfidence,
        summary: generateLinkingSummary(autoLinked),
      };
    }
  }
  
  // Manual evaluation for uncertain cases
  const evaluatedLinks = await evaluateEvidenceLinks(claim, evidence);
  
  if (evaluatedLinks.length === 0) {
    const rewrite = await generateRewrite(claim);
    return {
      claimId: claim.id,
      evidenceIds: [],
      status: 'unsupported',
      confidence: 0,
      suggestedRewrite: rewrite,
      summary: 'Evidence found but does not adequately support the claim',
    };
  }
  
  const avgConfidence = evaluatedLinks.reduce((sum, l) => sum + l.confidence, 0) / evaluatedLinks.length;
  const status = avgConfidence >= 0.7 ? 'supported' : 'weak';
  
  const result: LinkedEvidence = {
    claimId: claim.id,
    evidenceIds: evaluatedLinks.map(l => l.evidenceId),
    status,
    confidence: avgConfidence,
    summary: generateLinkingSummary(evidence.filter(e => evaluatedLinks.some(l => l.evidenceId === e.id))),
  };
  
  // Add rewrite suggestion for weak evidence
  if (status === 'weak') {
    result.suggestedRewrite = await generateRewrite(claim);
  }
  
  return result;
}

/**
 * Evaluate potential evidence links
 */
async function evaluateEvidenceLinks(
  claim: ExtractedClaim,
  evidence: EvidenceCandidate[]
): Promise<Array<{ evidenceId: string; confidence: number }>> {
  const validLinks: Array<{ evidenceId: string; confidence: number }> = [];
  
  // Evaluate each piece of evidence
  for (const e of evidence.slice(0, 5)) { // Limit to top 5
    try {
      const { object } = await generateObject({
        model: MODELS.FAST,
        schema: LinkEvaluationSchema,
        system: buildEvidenceResearchPrompt(),
        prompt: `Evaluate if this evidence supports the marketing claim.

CLAIM: "${claim.text}"

EVIDENCE:
Source: ${e.sourceUrl}
Tier: ${e.tier} (${getTierDescription(e.tier)})
Title: ${e.title}
Content: ${e.snippet}
Extracted Data: ${e.extractedData.join('; ')}

Does this evidence adequately support the claim?
Consider:
1. Does the evidence directly address the claim?
2. Is the evidence from a credible source?
3. Are the numbers or facts aligned?
        4. Does the evidence support this exact claim, not just a related idea?`,
      });

      const typedObject = object as z.infer<typeof LinkEvaluationSchema>

      if (typedObject.isMatch && typedObject.confidence > 0.5) {
        validLinks.push({
          evidenceId: e.id,
          confidence: typedObject.confidence,
        });
      }
    } catch (error) {
      console.error('Failed to evaluate evidence link:', error);
    }
  }
  
  return validLinks.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Generate safer rewrite for unsupported claim
 */
async function generateRewrite(claim: ExtractedClaim): Promise<string> {
  try {
    const { object } = await generateObject({
      model: MODELS.FAST,
      schema: RewriteSchema,
      system: buildEvidenceResearchPrompt(),
      prompt: `Rewrite this marketing claim to be legally safer since no supporting evidence was found.

ORIGINAL CLAIM: "${claim.text}"
RISK FLAGS: ${claim.flags.join(', ')}

Create a defensible version that:
1. Removes unverifiable specifics
2. Uses qualifiers like "may", "can help", "designed to"
3. Maintains persuasive impact
4. Is honest and not misleading
5. Preserves the brand's sentence style where possible

Do NOT make it sound weak - just make it defensible.`,
    });
    
    return (object as z.infer<typeof RewriteSchema>).rewrite;
  } catch (error) {
    console.error('Failed to generate rewrite:', error);
    return claim.text.replace(/(\d+%|\d+x|\d+\+)/g, 'significant');
  }
}

/**
 * Generate summary of linked evidence
 */
function generateLinkingSummary(evidence: EvidenceCandidate[]): string {
  if (evidence.length === 0) return 'No evidence linked';
  
  const tierCounts = { A: 0, B: 0, C: 0 };
  const types: string[] = [];
  
  evidence.forEach(e => {
    tierCounts[e.tier]++;
    if (!types.includes(e.sourceType)) types.push(e.sourceType);
  });
  
  const parts: string[] = [];
  
  if (tierCounts.A > 0) parts.push(`${tierCounts.A} official source${tierCounts.A > 1 ? 's' : ''}`);
  if (tierCounts.B > 0) parts.push(`${tierCounts.B} customer validation source${tierCounts.B > 1 ? 's' : ''}`);
  if (tierCounts.C > 0) parts.push(`${tierCounts.C} additional source${tierCounts.C > 1 ? 's' : ''}`);
  
  return `Linked to ${parts.join(', ')} (${types.join(', ')})`;
}

/**
 * Get tier description
 */
function getTierDescription(tier: 'A' | 'B' | 'C'): string {
  switch (tier) {
    case 'A': return 'Official/Verified';
    case 'B': return 'Customer Validation';
    case 'C': return 'Unverified';
  }
}

/**
 * Get overall linking summary
 */
export function getLinkingSummary(linkedEvidence: LinkedEvidence[]): LinkingSummary {
  let supported = 0;
  let weak = 0;
  let unsupported = 0;
  let totalConfidence = 0;
  const evidenceIds = new Set<string>();
  
  linkedEvidence.forEach(link => {
    switch (link.status) {
      case 'supported': supported++; break;
      case 'weak': weak++; break;
      case 'unsupported': unsupported++; break;
    }
    totalConfidence += link.confidence;
    link.evidenceIds.forEach(id => evidenceIds.add(id));
  });
  
  return {
    totalClaims: linkedEvidence.length,
    supported,
    weak,
    unsupported,
    evidenceUsed: evidenceIds.size,
    averageConfidence: linkedEvidence.length > 0 ? totalConfidence / linkedEvidence.length : 0,
  };
}

/**
 * Find claims that need attention
 */
export function findClaimsNeedingAttention(
  claims: ExtractedClaim[],
  linkedEvidence: LinkedEvidence[]
): {
  unsupportedClaims: ExtractedClaim[];
  weakClaims: ExtractedClaim[];
  highRiskClaims: ExtractedClaim[];
} {
  const linkMap = new Map(linkedEvidence.map(l => [l.claimId, l]));
  
  const unsupportedClaims: ExtractedClaim[] = [];
  const weakClaims: ExtractedClaim[] = [];
  const highRiskClaims: ExtractedClaim[] = [];
  
  claims.forEach(claim => {
    const link = linkMap.get(claim.id);
    
    if (!link || link.status === 'unsupported') {
      unsupportedClaims.push(claim);
    } else if (link.status === 'weak') {
      weakClaims.push(claim);
    }
    
    if (claim.riskScore >= 70) {
      highRiskClaims.push(claim);
    }
  });
  
  return {
    unsupportedClaims,
    weakClaims,
    highRiskClaims,
  };
}

/**
 * Calculate compliance score
 */
export function calculateComplianceScore(
  claims: ExtractedClaim[],
  linkedEvidence: LinkedEvidence[]
): {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
} {
  if (claims.length === 0) {
    return { score: 100, grade: 'A', summary: 'No claims to validate' };
  }
  
  const summary = getLinkingSummary(linkedEvidence);
  
  // Calculate score based on:
  // - Percentage of supported claims (50%)
  // - Average confidence (30%)
  // - Absence of high-risk unsupported claims (20%)
  
  const supportedPct = (summary.supported / summary.totalClaims) * 100;
  const confidencePct = summary.averageConfidence * 100;
  
  // Check for high-risk unsupported
  const highRiskUnsupported = claims.filter(c => {
    const link = linkedEvidence.find(l => l.claimId === c.id);
    return c.riskScore >= 70 && (!link || link.status === 'unsupported');
  }).length;
  
  const riskPenalty = Math.min(highRiskUnsupported * 10, 30);
  
  const score = Math.round(
    (supportedPct * 0.5) + 
    (confidencePct * 0.3) + 
    ((100 - riskPenalty) * 0.2)
  );
  
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';
  
  const summaryText = `${summary.supported} of ${summary.totalClaims} claims supported, ${summary.unsupported} need attention`;
  
  return { score, grade, summary: summaryText };
}
