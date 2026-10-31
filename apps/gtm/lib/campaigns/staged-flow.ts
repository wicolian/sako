/**
 * Campaign Staged Flow (Phase 3.1)
 * 
 * 5-stage campaign progression:
 * Content -> Design -> Compliance -> Publish -> Performance
 */

// ============================================================================
// Types
// ============================================================================

export type CampaignStage = 
  | 'content'
  | 'design'
  | 'compliance'
  | 'publish'
  | 'performance';

export interface StageConfig {
  id: CampaignStage;
  name: string;
  description: string;
  order: number;
  icon: string;
  requiredStages: CampaignStage[];
}

export interface StageStatus {
  stage: CampaignStage;
  isComplete: boolean;
  isUnlocked: boolean;
  isCurrent: boolean;
  progress: number; // 0-100
  blockers: StageBlocker[];
  completedAt?: string;
}

export interface StageBlocker {
  type: 'missing' | 'invalid' | 'pending' | 'blocked';
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface CampaignProgress {
  currentStage: CampaignStage;
  overallProgress: number; // 0-100
  stages: StageStatus[];
  canPublish: boolean;
  blockers: StageBlocker[];
}

// ============================================================================
// Stage Configuration
// ============================================================================

export const CAMPAIGN_STAGES: StageConfig[] = [
  {
    id: 'content',
    name: 'Content',
    description: 'Create your campaign messaging and copy',
    order: 1,
    icon: 'FileText',
    requiredStages: [],
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Design visuals and creative assets',
    order: 2,
    icon: 'Palette',
    requiredStages: ['content'],
  },
  {
    id: 'compliance',
    name: 'Compliance',
    description: 'Review and validate claims',
    order: 3,
    icon: 'Shield',
    requiredStages: ['content'],
  },
  {
    id: 'publish',
    name: 'Publish',
    description: 'Configure and launch your campaign',
    order: 4,
    icon: 'Rocket',
    requiredStages: ['content', 'compliance'],
  },
  {
    id: 'performance',
    name: 'Performance',
    description: 'Track results and optimize',
    order: 5,
    icon: 'BarChart3',
    requiredStages: ['publish'],
  },
];

// ============================================================================
// Stage Calculations
// ============================================================================

/**
 * Calculate content stage progress
 */
export function calculateContentProgress(campaign: {
  headline?: string;
  subheadline?: string;
  body?: string;
  cta?: string;
  messages?: unknown[];
}): { progress: number; blockers: StageBlocker[] } {
  const blockers: StageBlocker[] = [];
  let completed = 0;
  const total = 4;

  if (campaign.headline && campaign.headline.trim()) {
    completed++;
  } else {
    blockers.push({
      type: 'missing',
      field: 'headline',
      message: 'Headline is required',
      severity: 'error',
    });
  }

  if (campaign.body && campaign.body.trim()) {
    completed++;
  } else {
    blockers.push({
      type: 'missing',
      field: 'body',
      message: 'Body content is required',
      severity: 'error',
    });
  }

  if (campaign.cta && campaign.cta.trim()) {
    completed++;
  } else {
    blockers.push({
      type: 'missing',
      field: 'cta',
      message: 'Call to action is required',
      severity: 'warning',
    });
  }

  // Subheadline is optional but adds to progress
  if (campaign.subheadline && campaign.subheadline.trim()) {
    completed++;
  }

  return {
    progress: Math.round((completed / total) * 100),
    blockers,
  };
}

/**
 * Calculate design stage progress
 */
export function calculateDesignProgress(campaign: {
  assets?: unknown[];
  template_id?: string;
  design_config?: Record<string, unknown>;
}): { progress: number; blockers: StageBlocker[] } {
  const blockers: StageBlocker[] = [];
  let progress = 0;

  const hasAssets = campaign.assets && Array.isArray(campaign.assets) && campaign.assets.length > 0;
  const hasTemplate = !!campaign.template_id;
  const hasDesignConfig = campaign.design_config && Object.keys(campaign.design_config).length > 0;

  if (hasTemplate) progress += 40;
  if (hasAssets) progress += 40;
  if (hasDesignConfig) progress += 20;

  if (!hasAssets && !hasTemplate) {
    blockers.push({
      type: 'missing',
      field: 'design',
      message: 'Add at least one visual asset or select a template',
      severity: 'warning',
    });
  }

  return { progress, blockers };
}

/**
 * Calculate compliance stage progress
 */
export function calculateComplianceProgress(claims: {
  id: string;
  status: string;
  tier?: string;
}[]): { progress: number; blockers: StageBlocker[] } {
  const blockers: StageBlocker[] = [];

  if (!claims || claims.length === 0) {
    return {
      progress: 100, // No claims = compliant
      blockers: [],
    };
  }

  const total = claims.length;
  const approved = claims.filter(c => c.status === 'approved').length;
  const blocked = claims.filter(c => c.status === 'blocked' || c.status === 'rejected');
  const pending = claims.filter(c => c.status === 'pending' || c.status === 'review');
  const weak = claims.filter(c => c.tier === 'C' || c.tier === 'weak');

  // Add blockers
  if (blocked.length > 0) {
    const count = blocked.length;
    blockers.push({
      type: 'blocked',
      message: `${count} claim${count === 1 ? '' : 's'} blocked by compliance`,
      severity: 'error',
    });
  }

  if (pending.length > 0) {
    const count = pending.length;
    blockers.push({
      type: 'pending',
      message: `${count} claim${count === 1 ? '' : 's'} pending review`,
      severity: 'warning',
    });
  }

  if (weak.length > 0) {
    const count = weak.length;
    blockers.push({
      type: 'invalid',
      message: `${count} claim${count === 1 ? ' has' : 's have'} weak evidence (Tier C)`,
      severity: 'warning',
    });
  }

  const progress = total > 0 ? Math.round((approved / total) * 100) : 100;

  return { progress, blockers };
}

/**
 * Calculate publish stage progress
 */
export function calculatePublishProgress(campaign: {
  status: string;
  publish_date?: string;
  channels?: string[];
  integrations?: unknown[];
}): { progress: number; blockers: StageBlocker[] } {
  const blockers: StageBlocker[] = [];
  let progress = 0;

  if (campaign.status === 'live' || campaign.status === 'published') {
    return { progress: 100, blockers: [] };
  }

  if (campaign.status === 'ready') {
    progress = 80;
  }

  if (campaign.channels && campaign.channels.length > 0) {
    progress += 10;
  } else {
    blockers.push({
      type: 'missing',
      field: 'channels',
      message: 'Select at least one publish channel',
      severity: 'warning',
    });
  }

  if (campaign.publish_date) {
    progress += 10;
  }

  return { progress: Math.min(progress, 100), blockers };
}

/**
 * Calculate performance stage progress
 */
export function calculatePerformanceProgress(campaign: {
  status: string;
  analytics?: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
  };
}): { progress: number; blockers: StageBlocker[] } {
  // Performance stage is always "in progress" for live campaigns
  if (campaign.status !== 'live' && campaign.status !== 'published') {
    return {
      progress: 0,
      blockers: [{
        type: 'pending',
        message: 'Campaign must be published to track performance',
        severity: 'warning',
      }],
    };
  }

  const analytics = campaign.analytics || {};
  let progress = 20; // Base for being live

  if ((analytics.impressions || 0) > 0) progress += 20;
  if ((analytics.clicks || 0) > 0) progress += 20;
  if ((analytics.conversions || 0) > 0) progress += 40;

  return { progress: Math.min(progress, 100), blockers: [] };
}

// ============================================================================
// Main Progress Calculator
// ============================================================================

/**
 * Calculate full campaign progress across all stages
 */
export function calculateCampaignProgress(
  campaign: {
    headline?: string;
    subheadline?: string;
    body?: string;
    cta?: string;
    assets?: unknown[];
    template_id?: string;
    design_config?: Record<string, unknown>;
    status: string;
    publish_date?: string;
    channels?: string[];
    integrations?: unknown[];
    analytics?: { impressions?: number; clicks?: number; conversions?: number };
  },
  claims: { id: string; status: string; tier?: string }[]
): CampaignProgress {
  // Calculate each stage
  const contentResult = calculateContentProgress(campaign);
  const designResult = calculateDesignProgress(campaign);
  const complianceResult = calculateComplianceProgress(claims);
  const publishResult = calculatePublishProgress(campaign);
  const performanceResult = calculatePerformanceProgress(campaign);

  // Check stage completion and unlock status
  const contentComplete = contentResult.progress >= 75 && 
    !contentResult.blockers.some(b => b.severity === 'error');
  const designComplete = designResult.progress >= 50;
  const complianceComplete = complianceResult.progress >= 80 && 
    !complianceResult.blockers.some(b => b.severity === 'error');
  const publishComplete = publishResult.progress >= 100;

  // Build stage statuses
  const stages: StageStatus[] = [
    {
      stage: 'content',
      isComplete: contentComplete,
      isUnlocked: true, // Always unlocked
      isCurrent: !contentComplete,
      progress: contentResult.progress,
      blockers: contentResult.blockers,
    },
    {
      stage: 'design',
      isComplete: designComplete,
      isUnlocked: contentComplete, // Requires content
      isCurrent: contentComplete && !designComplete,
      progress: designResult.progress,
      blockers: designResult.blockers,
    },
    {
      stage: 'compliance',
      isComplete: complianceComplete,
      isUnlocked: contentComplete, // Requires content
      isCurrent: contentComplete && !complianceComplete && designComplete,
      progress: complianceResult.progress,
      blockers: complianceResult.blockers,
    },
    {
      stage: 'publish',
      isComplete: publishComplete,
      isUnlocked: contentComplete && complianceComplete, // Requires content + compliance
      isCurrent: complianceComplete && !publishComplete,
      progress: publishResult.progress,
      blockers: publishResult.blockers,
    },
    {
      stage: 'performance',
      isComplete: false, // Never truly "complete"
      isUnlocked: publishComplete, // Requires publish
      isCurrent: publishComplete,
      progress: performanceResult.progress,
      blockers: performanceResult.blockers,
    },
  ];

  // Determine current stage
  const currentStage = stages.find(s => s.isCurrent)?.stage || 'content';

  // Calculate overall progress (weighted)
  const weights = { content: 25, design: 15, compliance: 30, publish: 20, performance: 10 };
  const overallProgress = stages.reduce((sum, s) => {
    return sum + (s.progress * weights[s.stage]) / 100;
  }, 0);

  // Collect all blockers preventing publish
  const allBlockers = stages
    .filter(s => ['content', 'compliance', 'publish'].includes(s.stage))
    .flatMap(s => s.blockers.filter(b => b.severity === 'error'));

  return {
    currentStage,
    overallProgress: Math.round(overallProgress),
    stages,
    canPublish: contentComplete && complianceComplete && 
      !allBlockers.some(b => b.severity === 'error'),
    blockers: allBlockers,
  };
}

/**
 * Get stage config by ID
 */
export function getStageConfig(stageId: CampaignStage): StageConfig | undefined {
  return CAMPAIGN_STAGES.find(s => s.id === stageId);
}

/**
 * Check if a stage is unlocked
 */
export function isStageUnlocked(
  stageId: CampaignStage,
  completedStages: CampaignStage[]
): boolean {
  const stage = getStageConfig(stageId);
  if (!stage) return false;

  return stage.requiredStages.every(req => completedStages.includes(req));
}

/**
 * Get next stage to work on
 */
export function getNextStage(progress: CampaignProgress): CampaignStage | null {
  const incompleteStage = progress.stages.find(
    s => s.isUnlocked && !s.isComplete
  );
  return incompleteStage?.stage || null;
}

/**
 * Format blocker message with proper grammar
 */
export function formatBlockerMessage(blockers: StageBlocker[]): string {
  if (blockers.length === 0) return '';
  if (blockers.length === 1) return blockers[0].message;
  
  const errorCount = blockers.filter(b => b.severity === 'error').length;
  const warningCount = blockers.filter(b => b.severity === 'warning').length;

  const parts: string[] = [];
  if (errorCount > 0) {
    parts.push(`${errorCount} error${errorCount === 1 ? '' : 's'}`);
  }
  if (warningCount > 0) {
    parts.push(`${warningCount} warning${warningCount === 1 ? '' : 's'}`);
  }

  return parts.join(' and ') + ' to resolve';
}
