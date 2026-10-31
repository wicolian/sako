/**
 * Claims Validation API
 * 
 * Real-time validation of claims against workspace policy.
 * Used by the Playground for live compliance linting.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { validateClaim, parsePolicyFromDatabase, createDefaultPolicyContext } from '@/lib/claims/rules-engine'
import type { PolicyValidationContext } from '@/lib/claims/types'

export async function POST(request: NextRequest) {
  const workspaceId = getWorkspaceIdWithFallback(request)

  try {
    const body = await request.json()
    const { text, policyVersion } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get workspace policy
    let policyContext: PolicyValidationContext

    const { data: policy } = await supabase
      .from('policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (policy) {
      const parsedPolicy = parsePolicyFromDatabase(policy)
      policyContext = {
        policy: parsedPolicy,
        hasEvidence: false, // Will be determined by linked evidence
        linkedEvidenceCount: 0,
      }
    } else {
      // Use default policy
      policyContext = createDefaultPolicyContext()
    }

    // Validate the claim
    const result = validateClaim(text, policyContext)

    // Convert to violation format for UI
    const violations = result.reasonCodes.map((code, index) => ({
      id: `${code}-${index}`,
      text: text,
      reasonCode: code,
      message: getReasonMessage(code),
      severity: getSeverity(code),
      requiredEvidenceTier: result.requiredEvidenceTier,
      suggestedRewrite: null, // Could enhance with AI suggestions
    }))

    // Calculate trust score (inverse of risk)
    const trustScore = Math.max(0, 100 - result.riskScore)

    return NextResponse.json({
      violations,
      trustScore,
      isValid: result.status === 'allowed',
      riskLevel: getRiskLevel(result.riskScore),
      detectedCategory: result.detectedCategory,
      policyVersion: policy?.version || 1,
    })
  } catch (error) {
    console.error('Validation error:', error)
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    )
  }
}

function getReasonMessage(code: string): string {
  const messages: Record<string, string> = {
    SUPERLATIVE_NO_PROOF: 'Superlative claim requires evidence to support',
    FORBIDDEN_TERM: 'Contains a term that violates brand policy',
    REGULATED_CATEGORY: 'Touches regulated category requiring Tier A evidence',
    QUANT_DELTA_NO_SOURCE: 'Quantified claim needs a verifiable source',
    COMPARATIVE_NO_BASELINE: 'Comparative statement lacks a baseline for comparison',
    WEASEL_WORDS_STRICT: 'Contains ambiguous language (strict mode)',
    ABSOLUTE_CLAIM: 'Absolute claim requires strong evidence',
    MISSING_EVIDENCE: 'Claim requires linked evidence',
  }
  return messages[code] || 'Policy violation detected'
}

function getSeverity(code: string): 'error' | 'warning' | 'info' {
  const errorCodes = ['FORBIDDEN_TERM', 'REGULATED_CATEGORY']
  const warningCodes = ['SUPERLATIVE_NO_PROOF', 'ABSOLUTE_CLAIM', 'QUANT_DELTA_NO_SOURCE']
  
  if (errorCodes.includes(code)) return 'error'
  if (warningCodes.includes(code)) return 'warning'
  return 'info'
}

function getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
  if (riskScore <= 20) return 'low'
  if (riskScore <= 40) return 'medium'
  if (riskScore <= 60) return 'high'
  return 'critical'
}
