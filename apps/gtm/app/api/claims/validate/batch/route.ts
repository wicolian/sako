/**
 * Batch Claims Validation API
 * 
 * Validate multiple claims at once.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { validateClaims, parsePolicyFromDatabase, createDefaultPolicyContext } from '@/lib/claims/rules-engine'
import type { PolicyValidationContext } from '@/lib/claims/types'

export async function POST(request: NextRequest) {
  const workspaceId = getWorkspaceIdWithFallback(request)

  try {
    const body = await request.json()
    const { claims } = body

    if (!claims || !Array.isArray(claims)) {
      return NextResponse.json(
        { error: 'Claims array is required' },
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
      .single()

    if (policy) {
      const parsedPolicy = parsePolicyFromDatabase(policy)
      policyContext = {
        policy: parsedPolicy,
        hasEvidence: false,
        linkedEvidenceCount: 0,
      }
    } else {
      policyContext = createDefaultPolicyContext()
    }

    // Validate all claims
    const normalizedClaims = claims
      .filter((claim): claim is { id: string; text: string; claimType?: string } => {
        return (
          claim !== null &&
          typeof claim === 'object' &&
          'id' in claim &&
          'text' in claim &&
          typeof claim.id === 'string' &&
          typeof claim.text === 'string'
        )
      })
      .map((claim) => ({
        id: claim.id,
        text: claim.text,
        claimType: claim.claimType,
      }))

    const results = validateClaims(normalizedClaims, policyContext)

    // Convert to response format
    const responseResults: Record<string, {
      violations: Array<{
        id: string
        reasonCode: string
        message: string
        severity: 'error' | 'warning' | 'info'
      }>
      trustScore: number
      isValid: boolean
      riskLevel: string
    }> = {}

    for (const [id, result] of results) {
      const violations = result.reasonCodes.map((code, index) => ({
        id: `${code}-${index}`,
        reasonCode: code,
        message: getReasonMessage(code),
        severity: getSeverity(code),
      }))

      responseResults[id] = {
        violations,
        trustScore: Math.max(0, 100 - result.riskScore),
        isValid: result.status === 'allowed',
        riskLevel: getRiskLevel(result.riskScore),
      }
    }

    const persistedUpdates = normalizedClaims.map((claim) => {
      const result = results.get(claim.id)
      if (!result) {
        return Promise.resolve()
      }

      const nextStatus =
        result.status === 'blocked'
          ? 'blocked'
          : result.status === 'needs_proof'
            ? 'needs_proof'
            : claim.claimType === 'hard'
              ? 'ready_review'
              : 'approved'

      return supabase
        .from('claims')
        .update({
          status: nextStatus,
          risk_score: result.riskScore,
          reason_codes: result.reasonCodes,
          required_evidence_tier: result.requiredEvidenceTier,
        })
        .eq('id', claim.id)
        .eq('workspace_id', workspaceId)
    })

    await Promise.all(persistedUpdates)

    return NextResponse.json({
      results: responseResults,
      totalClaims: normalizedClaims.length,
      validClaims: Object.values(responseResults).filter(r => r.isValid).length,
    })
  } catch (error) {
    console.error('Batch validation error:', error)
    return NextResponse.json(
      { error: 'Batch validation failed' },
      { status: 500 }
    )
  }
}

function getReasonMessage(code: string): string {
  const messages: Record<string, string> = {
    SUPERLATIVE_NO_PROOF: 'Superlative claim requires evidence',
    FORBIDDEN_TERM: 'Contains forbidden term',
    REGULATED_CATEGORY: 'Regulated category requires Tier A evidence',
    QUANT_DELTA_NO_SOURCE: 'Quantified claim needs source',
    COMPARATIVE_NO_BASELINE: 'Comparative lacks baseline',
    WEASEL_WORDS_STRICT: 'Ambiguous language',
    ABSOLUTE_CLAIM: 'Absolute claim requires evidence',
    MISSING_EVIDENCE: 'Missing evidence',
  }
  return messages[code] || 'Policy violation'
}

function getSeverity(code: string): 'error' | 'warning' | 'info' {
  const errorCodes = ['FORBIDDEN_TERM', 'REGULATED_CATEGORY']
  const warningCodes = ['SUPERLATIVE_NO_PROOF', 'ABSOLUTE_CLAIM', 'QUANT_DELTA_NO_SOURCE']
  
  if (errorCodes.includes(code)) return 'error'
  if (warningCodes.includes(code)) return 'warning'
  return 'info'
}

function getRiskLevel(riskScore: number): string {
  if (riskScore <= 20) return 'low'
  if (riskScore <= 40) return 'medium'
  if (riskScore <= 60) return 'high'
  return 'critical'
}
