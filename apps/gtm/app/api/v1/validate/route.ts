/**
 * ClaimsOS Public Validation API
 * 
 * Public endpoint for validating marketing claims against compliance policies.
 * This is the "wedge product" that can be sold standalone or used to attract
 * users into the full Sako Composer platform.
 * 
 * Authentication: API Key via x-api-key header or Bearer token
 * Rate Limit: 100 requests/minute per API key (Upstash Redis sliding window)
 * 
 * @example
 * curl -X POST https://composer.trysako.com/api/v1/validate \
 *   -H "x-api-key: YOUR_API_KEY" \
 *   -H "Content-Type: application/json" \
 *   -d '{"claims": ["Our product is the best in the market"]}'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { validateClaim, createDefaultPolicyContext, parsePolicyFromDatabase } from '@/lib/claims/rules-engine';
import { quickClaimCheck, batchValidateClaims } from '@/lib/ai/ai-sdk-client';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Response types for the public API
interface ClaimValidationResult {
  text: string;
  status: 'approved' | 'needs_proof' | 'blocked';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  issues: string[];
  category?: string;
  requiredEvidenceTier?: 'A' | 'B' | 'C' | null;
  suggestion?: string;
  requiresEvidence: boolean;
}

interface ValidationResponse {
  success: boolean;
  results: ClaimValidationResult[];
  summary: {
    total: number;
    approved: number;
    needsProof: number;
    blocked: number;
    averageRiskScore: number;
  };
  meta: {
    policyVersion?: number;
    policyMode?: string;
    processingTimeMs: number;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

/**
 * Initialize rate limiter (100 requests per minute per API key)
 */
const getRateLimiter = () => {
  // Only initialize if Upstash credentials are available
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
    analytics: true,
  });
};

/**
 * POST /api/v1/validate
 * 
 * Validate one or more marketing claims against compliance policies.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ValidationResponse | ErrorResponse>> {
  const startTime = Date.now();
  
  try {
    // Extract API key from headers
    const apiKey = request.headers.get('x-api-key') || 
                   request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'API key required. Provide via x-api-key header or Authorization: Bearer token.',
        },
      }, { status: 401 });
    }

    // Rate limiting check
    const rateLimiter = getRateLimiter();
    if (rateLimiter) {
      const identifier = `api_key:${hashApiKey(apiKey)}`;
      const { success, limit, remaining, reset } = await rateLimiter.limit(identifier);

      if (!success) {
        const retryAfter = Math.ceil((reset - Date.now()) / 1000);
        return NextResponse.json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. ${limit} requests per minute allowed.`,
            details: `Retry after ${retryAfter} seconds.`,
          },
        }, {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset),
          },
        });
      }
    }

    // Validate API key and get workspace
    const supabase = createServiceClient();
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from('api_keys')
      .select('workspace_id, permissions, rate_limit')
      .eq('key_hash', hashApiKey(apiKey))
      .eq('is_active', true)
      .single();

    // Invalid or missing API key must fail hard — no demo workspace fallback.
    if (keyError || !apiKeyRecord) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_API_KEY', message: 'Invalid or inactive API key' } },
        { status: 401 }
      );
    }

    const workspaceId = apiKeyRecord.workspace_id;
    let policyConfig = createDefaultPolicyContext().policy;
    let policyVersion: number | undefined;
    let policyMode: string | undefined;

    // Get workspace policy
    const { data: policy } = await supabase
      .from('policies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (policy) {
      policyConfig = parsePolicyFromDatabase(policy);
      policyVersion = policy.version;
      policyMode = policy.mode;
    }

    // Parse request body
    const body = await request.json();
    const { claims, options = {} } = body;

    if (!claims || !Array.isArray(claims) || claims.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body must include a "claims" array with at least one claim.',
          details: 'Example: {"claims": ["Your marketing claim here"]}',
        },
      }, { status: 400 });
    }

    if (claims.length > 100) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'LIMIT_EXCEEDED',
          message: 'Maximum 100 claims per request.',
        },
      }, { status: 400 });
    }

    // Normalize claims input (support both string array and object array)
    const normalizedClaims: string[] = claims.map((c: string | { text: string }) => 
      typeof c === 'string' ? c : c.text
    );

    // Use AI for enhanced validation if requested
    const useAI = options.enhanced !== false;
    let aiResults: Array<{ text: string; riskLevel: string; issues: string[]; suggestion?: string; category?: string; requiresEvidence: boolean }> = [];
    
    if (useAI && normalizedClaims.length <= 20) {
      try {
        aiResults = await batchValidateClaims(normalizedClaims);
      } catch (aiError) {
        console.warn('AI validation failed, falling back to rules-only:', aiError);
      }
    }

    // Run rules engine validation for each claim
    const results: ClaimValidationResult[] = await Promise.all(
      normalizedClaims.map(async (claimText, index) => {
        // Get AI result for this claim if available
        const aiResult = aiResults[index];
        
        // Run rules engine
        const rulesResult = validateClaim(claimText, {
          policy: policyConfig,
          hasEvidence: false,
          linkedEvidenceCount: 0,
        });

        // Combine AI and rules results
        const combinedIssues = [
          ...rulesResult.reasonCodes,
          ...(aiResult?.issues || []),
        ].filter((v, i, a) => a.indexOf(v) === i); // Dedupe

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high';
        if (rulesResult.riskScore >= 70 || aiResult?.riskLevel === 'high') {
          riskLevel = 'high';
        } else if (rulesResult.riskScore >= 40 || aiResult?.riskLevel === 'medium') {
          riskLevel = 'medium';
        } else {
          riskLevel = 'low';
        }

        // Map 'allowed' to 'approved' for the public API
        const status: 'approved' | 'needs_proof' | 'blocked' = 
          rulesResult.status === 'allowed' ? 'approved' : rulesResult.status;

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
        };
      })
    );

    // Calculate summary
    const summary = {
      total: results.length,
      approved: results.filter(r => r.status === 'approved').length,
      needsProof: results.filter(r => r.status === 'needs_proof').length,
      blocked: results.filter(r => r.status === 'blocked').length,
      averageRiskScore: Math.round(
        results.reduce((sum, r) => sum + r.riskScore, 0) / results.length
      ),
    };

    const processingTimeMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      results,
      summary,
      meta: {
        policyVersion,
        policyMode,
        processingTimeMs,
      },
    });

  } catch (error: any) {
    console.error('Public validation API error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while validating claims.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
    }, { status: 500 });
  }
}

/**
 * GET /api/v1/validate
 * 
 * Returns API documentation and health check
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: 'ClaimsOS Validation API',
    version: '1.0.0',
    status: 'healthy',
    documentation: {
      endpoint: 'POST /api/v1/validate',
      description: 'Validate marketing claims against compliance policies',
      authentication: {
        required: true,
        methods: ['x-api-key header', 'Authorization: Bearer <api-key>'],
        createKey: 'Create an API key in Settings > API Keys inside an authenticated workspace.',
      },
      requestBody: {
        claims: ['Array of claim strings or objects with { text: string }'],
        options: {
          enhanced: 'boolean - Use AI for enhanced validation (default: true)',
        },
      },
      response: {
        success: 'boolean',
        results: 'Array of validation results',
        summary: 'Aggregate statistics',
        meta: 'Processing metadata',
      },
      riskLevels: {
        low: 'Score 0-39 - Claim is likely safe',
        medium: 'Score 40-69 - Claim may need review or evidence',
        high: 'Score 70-100 - Claim is risky and should be modified',
      },
      statuses: {
        approved: 'Claim passes validation',
        needs_proof: 'Claim requires supporting evidence',
        blocked: 'Claim violates policy and should be rewritten',
      },
    },
    examples: {
      basic: {
        headers: { 'x-api-key': 'sk_live_your_workspace_key' },
        request: '{"claims": ["Our product is the best in the market"]}',
        description: 'Validate a single claim',
      },
      batch: {
        request: '{"claims": ["Claim 1", "Claim 2", "Claim 3"]}',
        description: 'Validate multiple claims at once (max 100)',
      },
      rulesOnly: {
        request: '{"claims": ["Test claim"], "options": {"enhanced": false}}',
        description: 'Use rules engine only, skip AI enhancement',
      },
    },
    limits: {
      perRequest: 'Maximum 100 claims',
      rateLimit: '100 requests per minute per API key when Upstash rate limiting is configured',
    },
    onboarding: {
      step1: 'Sign in to Sako Composer.',
      step2: 'Create an API key in workspace settings.',
      step3: 'Send that key in x-api-key or Authorization headers.',
    },
  });
}

/**
 * Hash API key for secure storage comparison
 */
function hashApiKey(key: string): string {
  // Simple hash for demo - in production use bcrypt or similar
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(key).digest('hex');
}
