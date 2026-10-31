/**
 * Gate Validation API - Public endpoint for /gate
 * 
 * No API key required. Rate limited by IP (10/day).
 * Used exclusively by the public compliance gate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateClaim, createDefaultPolicyContext } from '@/lib/claims/rules-engine'
import { getPolicyPreset, getDefaultPreset } from '@/lib/claims/policy-presets'
import { batchValidateClaims } from '@/lib/ai/ai-sdk-client'
import { checkGateRateLimit, getClientIp } from '@/lib/gate/rate-limiter'

// Response types
interface ClaimValidationResult {
  text: string
  status: 'approved' | 'needs_proof' | 'blocked'
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high'
  issues: string[]
  category?: string
  requiredEvidenceTier?: 'A' | 'B' | 'C' | null
  suggestion?: string
  requiresEvidence: boolean
}

interface ValidationResponse {
  success: boolean
  results: ClaimValidationResult[]
  summary: {
    total: number
    approved: number
    needsProof: number
    blocked: number
    averageRiskScore: number
  }
  meta: {
    policyMode?: string
    industry?: string
    processingTimeMs: number
  }
  rateLimit?: {
    remaining: number
    limit: number
    reset: string
  }
}

interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
  }
}

/**
 * Extract claims from text
 * Simple regex-based extraction for quick validation
 */
function extractClaimsFromText(text: string): string[] {
  // Split by sentences
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10 && s.length < 500) // Filter out too short/long
  
  // If we have reasonable sentences, use them
  if (sentences.length > 0 && sentences.length <= 50) {
    return sentences
  }
  
  // Otherwise, just treat the whole text as one claim
  return [text.trim()]
}

/**
 * POST /api/gate/validate
 * 
 * Validate marketing copy without requiring authentication
 */
export async function POST(request: NextRequest): Promise<NextResponse<ValidationResponse | ErrorResponse>> {
  const startTime = Date.now()
  
  try {
    // Check rate limit
    const clientIp = getClientIp(request.headers)
    const rateLimit = await checkGateRateLimit(clientIp)
    
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'You\'ve used all 10 free validations for today. Sign up for unlimited access.',
        },
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.reset.toISOString(),
          'Retry-After': String(Math.ceil((rateLimit.reset.getTime() - Date.now()) / 1000)),
        },
      })
    }
    
    // Parse request body
    const body = await request.json()
    const { text, industry = 'saas_b2b' } = body
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body must include a "text" field with your marketing copy.',
        },
      }, { status: 400 })
    }
    
    if (text.length > 10000) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'TEXT_TOO_LONG',
          message: 'Text must be under 10,000 characters.',
        },
      }, { status: 400 })
    }
    
    // Get policy preset for industry
    const preset = getPolicyPreset(industry) || getDefaultPreset()
    const policyContext = {
      policy: preset.config,
      hasEvidence: false,
      linkedEvidenceCount: 0,
    }
    
    // Extract claims from text
    const claims = extractClaimsFromText(text)
    
    // Limit claims to prevent abuse
    const claimsToValidate = claims.slice(0, 20)
    
    // Try AI-enhanced validation
    let aiResults: Array<{ 
      text: string
      riskLevel: string
      issues: string[]
      suggestion?: string
      category?: string
      requiresEvidence: boolean 
    }> = []
    
    try {
      aiResults = await batchValidateClaims(claimsToValidate)
    } catch (aiError) {
      console.warn('AI validation failed, using rules-only:', aiError)
    }
    
    // Run rules engine validation
    const results: ClaimValidationResult[] = claimsToValidate.map((claimText, index) => {
      const aiResult = aiResults[index]
      const rulesResult = validateClaim(claimText, policyContext)
      
      // Combine AI and rules results
      const combinedIssues = [
        ...rulesResult.reasonCodes,
        ...(aiResult?.issues || []),
      ].filter((v, i, a) => a.indexOf(v) === i)
      
      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high'
      if (rulesResult.riskScore >= 70 || aiResult?.riskLevel === 'high') {
        riskLevel = 'high'
      } else if (rulesResult.riskScore >= 40 || aiResult?.riskLevel === 'medium') {
        riskLevel = 'medium'
      } else {
        riskLevel = 'low'
      }
      
      // Map status
      const status: 'approved' | 'needs_proof' | 'blocked' = 
        rulesResult.status === 'allowed' ? 'approved' : rulesResult.status
      
      return {
        text: claimText,
        status,
        riskScore: rulesResult.riskScore,
        riskLevel,
        issues: combinedIssues,
        category: aiResult?.category || rulesResult.detectedCategory,
        requiredEvidenceTier: rulesResult.requiredEvidenceTier,
        suggestion: aiResult?.suggestion,
        requiresEvidence: aiResult?.requiresEvidence ?? rulesResult.status === 'needs_proof',
      }
    })
    
    // Calculate summary
    const summary = {
      total: results.length,
      approved: results.filter(r => r.status === 'approved').length,
      needsProof: results.filter(r => r.status === 'needs_proof').length,
      blocked: results.filter(r => r.status === 'blocked').length,
      averageRiskScore: Math.round(
        results.reduce((sum, r) => sum + r.riskScore, 0) / results.length
      ),
    }
    
    const processingTimeMs = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      results,
      summary,
      meta: {
        policyMode: preset.config.mode,
        industry: preset.id,
        processingTimeMs,
      },
      rateLimit: {
        remaining: rateLimit.remaining - 1,
        limit: rateLimit.limit,
        reset: rateLimit.reset.toISOString(),
      },
    })
    
  } catch (error: unknown) {
    console.error('Gate validation error:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while validating. Please try again.',
      },
    }, { status: 500 })
  }
}
