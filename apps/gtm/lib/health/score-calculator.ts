/**
 * Campaign Health Score Calculator (Jan 2026)
 * 
 * Calcimport { Database } from '@/lib/supabase/types'

type MessageRow = Database['public']['Tables']['messages']['Row']
type EvidenceRow = Database['public']['Tables']['evidence']['Row']
type CampaignAssetRow = Database['public']['Tables']['campaign_assets']['Row']
ulates a comprehensive health score for campaigns based on:
 * - Compliance: Claims validation status, evidence coverage
 * - Freshness: Evidence age, link validity, data currency
 * - Performance: CTR, conversions, engagement metrics
 */

import { createServiceClient } from '@/lib/supabase/service';

// Score weights (must sum to 1.0)
const WEIGHTS = {
  compliance: 0.4,
  freshness: 0.35,
  performance: 0.25,
};

// Thresholds for scoring
const THRESHOLDS = {
  // Evidence age in days
  evidenceFresh: 30,
  evidenceStale: 90,
  evidenceExpired: 180,
  
  // Link check intervals
  linkCheckInterval: 7, // days
  
  // Performance benchmarks
  ctrGood: 2.5, // %
  ctrAverage: 1.0, // %
  conversionGood: 3.0, // %
  conversionAverage: 1.5, // %
};

export interface HealthScore {
  overall: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  components: {
    compliance: ComponentScore;
    freshness: ComponentScore;
    performance: ComponentScore;
  };
  issues: HealthIssue[];
  recommendations: string[];
  lastCalculated: string;
}

export interface ComponentScore {
  score: number; // 0-100
  weight: number;
  weightedScore: number;
  details: Record<string, number | string>;
}

export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'compliance' | 'freshness' | 'performance';
  message: string;
  action?: string;
}

export interface CampaignHealthData {
  campaignId: string;
  claims: ClaimData[];
  evidence: EvidenceData[];
  assets: AssetData[];
  /**
   * null when no analytics_events rows exist yet for this campaign —
   * the health score excludes the performance component in that case
   * rather than using synthetic fallback values.
   */
  performance: PerformanceData | null;
}

interface ClaimData {
  id: string;
  status: 'supported' | 'weak' | 'blocked' | 'pending';
  evidenceCount: number;
  riskScore: number;
}

interface EvidenceData {
  id: string;
  type: string;
  tier: 'A' | 'B' | 'C';
  url?: string;
  lastValidated?: string;
  linkStatus?: 'valid' | 'broken' | 'unknown';
  createdAt: string;
}

interface AssetData {
  id: string;
  type: string;
  claimsValidated: boolean;
  updatedAt: string;
}

interface PerformanceData {
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversionRate: number;
}

/**
 * Calculate comprehensive health score for a campaign
 */
export async function calculateHealthScore(
  campaignId: string,
  workspaceId: string
): Promise<HealthScore> {
  const supabase = createServiceClient();
  
  // Fetch all campaign data
  const data = await fetchCampaignHealthData(campaignId, workspaceId, supabase);
  
  // Calculate component scores
  const complianceScore = calculateComplianceScore(data);
  const freshnessScore = calculateFreshnessScore(data);
  const performanceScore = calculatePerformanceScore(data);

  // Calculate weighted overall score.
  // When performance data is absent (no metrics sync yet), redistribute its
  // 25% weight proportionally across compliance and freshness so the overall
  // score reflects only what is actually known.
  let overall: number;
  if (data.performance === null) {
    const knownWeightTotal = WEIGHTS.compliance + WEIGHTS.freshness;
    overall = Math.round(
      (complianceScore.score * (WEIGHTS.compliance / knownWeightTotal)) +
      (freshnessScore.score * (WEIGHTS.freshness / knownWeightTotal))
    );
  } else {
    overall = Math.round(
      complianceScore.weightedScore +
      freshnessScore.weightedScore +
      performanceScore.weightedScore
    );
  }
  
  // Determine grade
  const grade = getGrade(overall);
  
  // Collect issues and recommendations
  const issues = collectIssues(data, complianceScore, freshnessScore, performanceScore);
  const recommendations = generateRecommendations(issues, data);
  
  return {
    overall,
    grade,
    components: {
      compliance: complianceScore,
      freshness: freshnessScore,
      performance: performanceScore,
    },
    issues,
    recommendations,
    lastCalculated: new Date().toISOString(),
  };
}

/**
 * Fetch all data needed for health calculation
 */
async function fetchCampaignHealthData(
  campaignId: string,
  workspaceId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<CampaignHealthData> {
  // Fetch claims
  const { data: claimsData } = await supabase
    .from('messages')
    .select(`
      id,
      status,
      risk_score,
      message_evidence(count)
    `)
    .eq('campaign_id', campaignId)
    .eq('workspace_id', workspaceId);
  
  const claims: ClaimData[] = (claimsData || []).map((c: any) => ({
    id: c.id,
    status: c.status || 'pending',
    evidenceCount: c.message_evidence?.[0]?.count || 0,
    riskScore: c.risk_score || 50,
  }));
  
  // Fetch evidence
  const { data: evidenceData } = await supabase
    .from('evidence')
    .select('*')
    .eq('workspace_id', workspaceId);
  
  const evidence: EvidenceData[] = (evidenceData || []).map((e: any) => ({
    id: e.id,
    type: e.type,
    tier: e.tier || 'C',
    url: e.url,
    lastValidated: e.last_validated,
    linkStatus: e.link_status,
    createdAt: e.created_at,
  }));
  
  // Fetch assets
  const { data: assetsData } = await supabase
    .from('campaign_assets')
    .select('*')
    .eq('campaign_id', campaignId);
  
  const assets: AssetData[] = (assetsData || []).map((a: any) => ({
    id: a.id,
    type: a.type,
    claimsValidated: a.claims_validated ?? false,
    updatedAt: a.updated_at,
  }));
  
  // Fetch real performance from analytics_events.
  // TODO: once a dedicated campaign_performance aggregate table exists, query
  // that instead for efficiency (see supabase/migrations/ for the `performance`
  // table with JSONB metrics; it is not yet populated by a sync job).
  const { data: analyticsEvents } = await supabase
    .from('analytics_events')
    .select('event_type, value')
    .eq('campaign_id', campaignId)
    .eq('workspace_id', workspaceId);

  let performance: PerformanceData | null = null;

  if (analyticsEvents && analyticsEvents.length > 0) {
    const impressions = analyticsEvents.filter(
      (e: { event_type: string }) => e.event_type === 'impression'
    ).length;
    const clicks = analyticsEvents.filter(
      (e: { event_type: string }) => e.event_type === 'click'
    ).length;
    const conversions = analyticsEvents.filter(
      (e: { event_type: string }) => e.event_type === 'conversion'
    ).length;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

    performance = {
      impressions,
      clicks,
      conversions,
      ctr: Math.round(ctr * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
    };
  }
  // performance remains null — no analytics_events rows yet.
  // calculateHealthScore will exclude the performance component weight so
  // the overall score is honest rather than based on synthetic data.

  return {
    campaignId,
    claims,
    evidence,
    assets,
    performance,
  };
}

/**
 * Calculate compliance score
 */
function calculateComplianceScore(data: CampaignHealthData): ComponentScore {
  const { claims, assets } = data;
  
  if (claims.length === 0) {
    return {
      score: 100,
      weight: WEIGHTS.compliance,
      weightedScore: 100 * WEIGHTS.compliance,
      details: {
        totalClaims: 0,
        supportedClaims: 0,
        validatedAssets: assets.filter(a => a.claimsValidated).length,
        totalAssets: assets.length,
      },
    };
  }
  
  // Calculate claim status distribution
  const supported = claims.filter(c => c.status === 'supported').length;
  const weak = claims.filter(c => c.status === 'weak').length;
  const blocked = claims.filter(c => c.status === 'blocked').length;
  const pending = claims.filter(c => c.status === 'pending').length;
  
  // Score based on claim status (supported=100, weak=50, blocked=0, pending=25)
  const claimScore = (
    (supported * 100) +
    (weak * 50) +
    (blocked * 0) +
    (pending * 25)
  ) / claims.length;
  
  // Score based on evidence coverage
  const claimsWithEvidence = claims.filter(c => c.evidenceCount > 0).length;
  const evidenceCoverage = (claimsWithEvidence / claims.length) * 100;
  
  // Score based on asset validation
  const validatedAssets = assets.filter(a => a.claimsValidated).length;
  const assetValidation = assets.length > 0 
    ? (validatedAssets / assets.length) * 100 
    : 100;
  
  // Average risk score (invert so lower risk = higher score)
  const avgRisk = claims.reduce((sum, c) => sum + c.riskScore, 0) / claims.length;
  const riskScore = 100 - avgRisk;
  
  // Combined compliance score
  const score = Math.round(
    (claimScore * 0.4) +
    (evidenceCoverage * 0.3) +
    (assetValidation * 0.15) +
    (riskScore * 0.15)
  );
  
  return {
    score,
    weight: WEIGHTS.compliance,
    weightedScore: score * WEIGHTS.compliance,
    details: {
      totalClaims: claims.length,
      supportedClaims: supported,
      weakClaims: weak,
      blockedClaims: blocked,
      evidenceCoverage: Math.round(evidenceCoverage),
      assetValidation: Math.round(assetValidation),
      avgRiskScore: Math.round(avgRisk),
    },
  };
}

/**
 * Calculate freshness score
 */
function calculateFreshnessScore(data: CampaignHealthData): ComponentScore {
  const { evidence, assets } = data;
  const now = new Date();
  
  if (evidence.length === 0) {
    return {
      score: 50, // Neutral if no evidence
      weight: WEIGHTS.freshness,
      weightedScore: 50 * WEIGHTS.freshness,
      details: {
        totalEvidence: 0,
        freshEvidence: 0,
        staleEvidence: 0,
        brokenLinks: 0,
      },
    };
  }
  
  // Calculate evidence age distribution
  let freshCount = 0;
  let staleCount = 0;
  let expiredCount = 0;
  let brokenLinks = 0;
  
  for (const ev of evidence) {
    const createdDate = new Date(ev.createdAt);
    const ageInDays = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (ageInDays <= THRESHOLDS.evidenceFresh) {
      freshCount++;
    } else if (ageInDays <= THRESHOLDS.evidenceStale) {
      staleCount++;
    } else {
      expiredCount++;
    }
    
    if (ev.linkStatus === 'broken') {
      brokenLinks++;
    }
  }
  
  // Score based on freshness distribution
  const freshnessDistribution = (
    (freshCount * 100) +
    (staleCount * 50) +
    (expiredCount * 0)
  ) / evidence.length;
  
  // Score based on link validity
  const linkValidity = ((evidence.length - brokenLinks) / evidence.length) * 100;
  
  // Score based on evidence tier (A=100, B=70, C=40)
  const tierA = evidence.filter(e => e.tier === 'A').length;
  const tierB = evidence.filter(e => e.tier === 'B').length;
  const tierC = evidence.filter(e => e.tier === 'C').length;
  const tierScore = (
    (tierA * 100) +
    (tierB * 70) +
    (tierC * 40)
  ) / evidence.length;
  
  // Asset freshness (how recently updated)
  let assetFreshness = 100;
  if (assets.length > 0) {
    const avgAssetAge = assets.reduce((sum, a) => {
      const age = Math.floor((now.getTime() - new Date(a.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
      return sum + age;
    }, 0) / assets.length;
    
    assetFreshness = Math.max(0, 100 - (avgAssetAge * 2)); // Lose 2 points per day
  }
  
  // Combined freshness score
  const score = Math.round(
    (freshnessDistribution * 0.35) +
    (linkValidity * 0.25) +
    (tierScore * 0.25) +
    (assetFreshness * 0.15)
  );
  
  return {
    score,
    weight: WEIGHTS.freshness,
    weightedScore: score * WEIGHTS.freshness,
    details: {
      totalEvidence: evidence.length,
      freshEvidence: freshCount,
      staleEvidence: staleCount,
      expiredEvidence: expiredCount,
      brokenLinks,
      tierACount: tierA,
      tierBCount: tierB,
      tierCCount: tierC,
    },
  };
}

/**
 * Calculate performance score.
 * Returns a sentinel ComponentScore with score 0 and dataStatus 'no_metrics'
 * when no analytics_events rows exist yet — callers should check
 * data.performance === null to distinguish "genuinely zero" from "pending".
 */
function calculatePerformanceScore(data: CampaignHealthData): ComponentScore {
  const { performance } = data;

  if (performance === null) {
    return {
      score: 0,
      weight: WEIGHTS.performance,
      weightedScore: 0,
      details: {
        dataStatus: 'no_metrics',
        message: 'Awaiting first metrics sync',
      },
    };
  }

  // CTR score
  let ctrScore = 0;
  if (performance.ctr >= THRESHOLDS.ctrGood) {
    ctrScore = 100;
  } else if (performance.ctr >= THRESHOLDS.ctrAverage) {
    ctrScore = 50 + ((performance.ctr - THRESHOLDS.ctrAverage) / (THRESHOLDS.ctrGood - THRESHOLDS.ctrAverage)) * 50;
  } else {
    ctrScore = (performance.ctr / THRESHOLDS.ctrAverage) * 50;
  }
  
  // Conversion score
  let conversionScore = 0;
  if (performance.conversionRate >= THRESHOLDS.conversionGood) {
    conversionScore = 100;
  } else if (performance.conversionRate >= THRESHOLDS.conversionAverage) {
    conversionScore = 50 + ((performance.conversionRate - THRESHOLDS.conversionAverage) / (THRESHOLDS.conversionGood - THRESHOLDS.conversionAverage)) * 50;
  } else {
    conversionScore = (performance.conversionRate / THRESHOLDS.conversionAverage) * 50;
  }
  
  // Volume score (based on impressions)
  const volumeScore = Math.min(100, (performance.impressions / 10000) * 100);
  
  // Combined performance score
  const score = Math.round(
    (ctrScore * 0.4) +
    (conversionScore * 0.4) +
    (volumeScore * 0.2)
  );
  
  return {
    score,
    weight: WEIGHTS.performance,
    weightedScore: score * WEIGHTS.performance,
    details: {
      impressions: performance.impressions,
      clicks: performance.clicks,
      conversions: performance.conversions,
      ctr: performance.ctr,
      conversionRate: performance.conversionRate,
      ctrScore: Math.round(ctrScore),
      conversionScore: Math.round(conversionScore),
    },
  };
}

/**
 * Get letter grade from score
 */
function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Collect issues from all components
 */
function collectIssues(
  data: CampaignHealthData,
  compliance: ComponentScore,
  freshness: ComponentScore,
  performance: ComponentScore
): HealthIssue[] {
  const issues: HealthIssue[] = [];
  
  // Compliance issues
  if ((compliance.details.blockedClaims as number) > 0) {
    issues.push({
      severity: 'critical',
      category: 'compliance',
      message: `${compliance.details.blockedClaims} claims are blocked and cannot be used`,
      action: 'Review and rewrite blocked claims or add supporting evidence',
    });
  }
  
  if ((compliance.details.weakClaims as number) > 0) {
    issues.push({
      severity: 'warning',
      category: 'compliance',
      message: `${compliance.details.weakClaims} claims need additional evidence`,
      action: 'Add Tier A or B evidence to strengthen weak claims',
    });
  }
  
  if ((compliance.details.evidenceCoverage as number) < 80) {
    issues.push({
      severity: 'warning',
      category: 'compliance',
      message: `Only ${compliance.details.evidenceCoverage}% of claims have linked evidence`,
      action: 'Link evidence to unsupported claims',
    });
  }
  
  // Freshness issues
  if ((freshness.details.brokenLinks as number) > 0) {
    issues.push({
      severity: 'critical',
      category: 'freshness',
      message: `${freshness.details.brokenLinks} evidence links are broken`,
      action: 'Update or replace broken evidence links',
    });
  }
  
  if ((freshness.details.expiredEvidence as number) > 0) {
    issues.push({
      severity: 'warning',
      category: 'freshness',
      message: `${freshness.details.expiredEvidence} pieces of evidence are over 6 months old`,
      action: 'Refresh expired evidence with current data',
    });
  }
  
  if ((freshness.details.staleEvidence as number) > (freshness.details.freshEvidence as number)) {
    issues.push({
      severity: 'info',
      category: 'freshness',
      message: 'Most evidence is becoming stale',
      action: 'Consider refreshing evidence to maintain credibility',
    });
  }
  
  // Performance issues — only raised when real metrics are available
  if (data.performance === null) {
    issues.push({
      severity: 'info',
      category: 'performance',
      message: 'Performance metrics are not yet available',
      action: 'Publish the campaign and wait for the first analytics sync',
    });
  } else {
    if ((performance.details.ctr as number) < THRESHOLDS.ctrAverage) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        message: `CTR (${performance.details.ctr}%) is below average`,
        action: 'A/B test headlines and CTAs to improve engagement',
      });
    }

    if ((performance.details.conversionRate as number) < THRESHOLDS.conversionAverage) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        message: `Conversion rate (${performance.details.conversionRate}%) is below average`,
        action: 'Review landing page and offer alignment',
      });
    }
  }
  
  return issues;
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  issues: HealthIssue[],
  data: CampaignHealthData
): string[] {
  const recommendations: string[] = [];
  
  // Priority recommendations based on critical issues
  const criticalIssues = issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    recommendations.push(
      `🚨 Address ${criticalIssues.length} critical issue(s) immediately to avoid compliance risks`
    );
  }
  
  // Evidence quality recommendation
  const tierAPercent = data.evidence.length > 0
    ? (data.evidence.filter(e => e.tier === 'A').length / data.evidence.length) * 100
    : 0;
  
  if (tierAPercent < 30) {
    recommendations.push(
      '📊 Increase Tier A evidence (case studies, research) to strengthen claim credibility'
    );
  }
  
  // Freshness recommendation
  const staleEvidence = data.evidence.filter(e => {
    const age = Math.floor((Date.now() - new Date(e.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return age > THRESHOLDS.evidenceStale;
  });
  
  if (staleEvidence.length > 0) {
    recommendations.push(
      `🔄 ${staleEvidence.length} evidence items need refreshing - use One-Click Refresh`
    );
  }
  
  // Performance recommendation — only when real data is available
  if (data.performance === null) {
    recommendations.push(
      '📊 Publish this campaign to start collecting performance data'
    );
  } else if (data.performance.impressions < 1000) {
    recommendations.push(
      '📈 Increase campaign reach to gather more performance data for optimization'
    );
  }
  
  // General best practices
  if (recommendations.length === 0) {
    recommendations.push(
      '✅ Campaign health is good! Consider A/B testing to further optimize performance'
    );
  }
  
  return recommendations;
}

/**
 * Quick health check (lighter weight, for list views)
 */
export async function quickHealthCheck(
  campaignId: string,
  workspaceId: string
): Promise<{ score: number; grade: string; criticalIssues: number }> {
  const fullScore = await calculateHealthScore(campaignId, workspaceId);
  
  return {
    score: fullScore.overall,
    grade: fullScore.grade,
    criticalIssues: fullScore.issues.filter(i => i.severity === 'critical').length,
  };
}

/**
 * Batch health check for multiple campaigns
 */
export async function batchHealthCheck(
  campaignIds: string[],
  workspaceId: string
): Promise<Map<string, { score: number; grade: string }>> {
  const results = new Map<string, { score: number; grade: string }>();
  
  // Process in parallel with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < campaignIds.length; i += batchSize) {
    const batch = campaignIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (id) => {
        const health = await quickHealthCheck(id, workspaceId);
        return { id, health };
      })
    );
    
    for (const { id, health } of batchResults) {
      results.set(id, { score: health.score, grade: health.grade });
    }
  }
  
  return results;
}
