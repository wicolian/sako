import { db } from './db';
import { fetchWithCache } from './cache';
import { getAllSourceHealth } from './dataTrust';
import { METRIC_CONTRACT } from '@/config/metrics';
import { fetchStripeMetrics } from '@/providers/stripe';
import { fetchPostHogMetrics, isPostHogConfigured } from '@/providers/posthog';
import { fetchGA4Metrics } from '@/providers/ga4';
import { fetchSakoDbMetrics } from '@/providers/sakoDb';
import { fetchComposerDbMetrics } from '@/providers/composerDb';
import { fetchUptimeMetrics } from '@/providers/uptime';
import { isSakoDbConfigured } from '@/lib/sakoDb';
import { isComposerDbConfigured } from '@/lib/composerDb';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatLatency,
  getISTDateBoundaries,
} from './utils';
import type {
  MetricValue,
  WallSummaryResponse,
  ScoreboardData,
  PodData,
  ComposerData,
  ChartDataPoint,
  AlertItem,
  ContextLogItem,
  SocialPost,
  TopMover,
  SourceStatus,
} from '@/types';

/**
 * Generate real alerts from system state
 */
async function generateAlerts(
  sourceHealth: SourceStatus[],
  uptime: { label: string; status: string; latencyMs: number }[],
  composerErrorRate: number,
  churnRiskCount: number,
  blockedTasks: number
): Promise<AlertItem[]> {
  const alerts: AlertItem[] = [];
  const now = Date.now();

  // Check for degraded/down sources
  for (const source of sourceHealth) {
    if (source.status === 'DOWN') {
      alerts.push({
        id: `src-down-${source.key}`,
        severity: 'critical',
        message: `${source.label} is DOWN`,
        timestamp: formatTimeAgo(source.lastAttemptAt || now),
        source: source.key,
      });
    } else if (source.status === 'STALE') {
      alerts.push({
        id: `src-stale-${source.key}`,
        severity: 'warning',
        message: `${source.label} data is stale`,
        timestamp: formatTimeAgo(source.lastSuccessAt || now),
        source: source.key,
      });
    }
  }

  // Check uptime monitors
  for (const monitor of uptime) {
    if (monitor.status === 'DOWN') {
      alerts.push({
        id: `uptime-${monitor.label}`,
        severity: 'critical',
        message: `${monitor.label} is unreachable`,
        timestamp: 'now',
      });
    } else if (monitor.latencyMs > 2000) {
      alerts.push({
        id: `uptime-slow-${monitor.label}`,
        severity: 'warning',
        message: `${monitor.label} latency high (${monitor.latencyMs}ms)`,
        timestamp: 'now',
      });
    }
  }

  // Check composer error rate
  if (composerErrorRate > 5) {
    alerts.push({
      id: 'composer-errors',
      severity: 'critical',
      message: `Composer error rate at ${composerErrorRate.toFixed(1)}%`,
      timestamp: 'now',
      source: 'composer_db',
    });
  } else if (composerErrorRate > 2) {
    alerts.push({
      id: 'composer-errors-warn',
      severity: 'warning',
      message: `Composer error rate elevated (${composerErrorRate.toFixed(1)}%)`,
      timestamp: 'now',
      source: 'composer_db',
    });
  }

  // Check churn risk
  if (churnRiskCount > 10) {
    alerts.push({
      id: 'churn-risk',
      severity: 'warning',
      message: `${churnRiskCount} accounts at churn risk`,
      timestamp: 'now',
      source: 'sako_db',
    });
  }

  // Check blocked tasks
  if (blockedTasks > 5) {
    alerts.push({
      id: 'blocked-tasks',
      severity: 'warning',
      message: `${blockedTasks} tasks blocked`,
      timestamp: 'now',
      source: 'sako_db',
    });
  }

  // If no alerts, show a positive message
  if (alerts.length === 0) {
    alerts.push({
      id: 'all-good',
      severity: 'info',
      message: 'All systems operational',
      timestamp: 'now',
    });
  }

  return alerts.slice(0, 5); // Max 5 alerts
}

/**
 * Fetch context logs from manual inputs
 */
async function fetchContextLogs(): Promise<ContextLogItem[]> {
  try {
    const logsEntry = await db.wallManualInput.findUnique({
      where: { key: 'context_logs' },
    });

    if (logsEntry && logsEntry.valueJson) {
      const logs = logsEntry.valueJson as unknown as ContextLogItem[];
      return Array.isArray(logs) ? logs.slice(0, 10) : [];
    }
  } catch (error) {
    console.error('Failed to fetch context logs:', error);
  }

  // Return default logs if none in DB
  return [
    { id: 'default-1', type: 'config', title: 'Wall dashboard deployed', time: 'Just now' },
  ];
}

/**
 * Fetch social post - tries LinkedIn API first, falls back to manual inputs
 */
async function fetchSocialPost(): Promise<SocialPost | null> {
  // Try LinkedIn API first
  try {
    const { isLinkedInConfigured, fetchLatestLinkedInPost } = await import('@/providers/linkedin');
    
    if (isLinkedInConfigured()) {
      const linkedInPost = await fetchLatestLinkedInPost();
      if (linkedInPost) {
        return linkedInPost;
      }
    }
  } catch (error) {
    console.error('LinkedIn API fetch failed:', error);
  }

  // Fallback to manual inputs
  try {
    const socialEntry = await db.wallManualInput.findUnique({
      where: { key: 'linkedin_latest' },
    });

    if (socialEntry && socialEntry.valueJson) {
      const data = socialEntry.valueJson as Record<string, unknown>;
      return {
        platform: 'linkedin',
        title: (data.linkedin_post_title as string) || '',
        impressions: formatNumber(Number(data.linkedin_views) || 0),
        reactions: formatNumber(Number(data.linkedin_reactions) || 0),
        comments: formatNumber(Number(data.linkedin_comments) || 0),
        postedAt: formatTimeAgo(new Date(socialEntry.updatedAt).getTime()),
      };
    }
  } catch (error) {
    console.error('Failed to fetch social post:', error);
  }

  return null;
}

/**
 * Fetch chart data from snapshots
 */
async function fetchChartFromSnapshots(
  metricKey: string,
  days: number = 14
): Promise<ChartDataPoint[]> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const snapshots = await db.wallSnapshot.findMany({
      where: {
        metricKey,
        segment: 'all',
        ts: { gte: cutoff },
      },
      orderBy: { ts: 'asc' },
      take: days * 4, // ~4 snapshots per day (every 15 min = 96/day, but we aggregate)
    });

    if (snapshots.length === 0) {
      return generatePlaceholderChartData(days);
    }

    // Group by date and take latest value per day
    const byDate = new Map<string, number>();
    for (const snap of snapshots) {
      const dateKey = snap.ts.toISOString().split('T')[0];
      byDate.set(dateKey, snap.valueNumeric || 0);
    }

    const result: ChartDataPoint[] = [];
    const dates = Array.from(byDate.keys()).sort();
    
    for (const date of dates.slice(-days)) {
      result.push({
        date: formatDateShort(date),
        value: byDate.get(date) || 0,
      });
    }

    // Pad with placeholders if not enough data
    while (result.length < days) {
      result.unshift({
        date: `Day ${days - result.length}`,
        value: 0,
      });
    }

    return result;
  } catch (error) {
    console.error(`Failed to fetch snapshots for ${metricKey}:`, error);
    return generatePlaceholderChartData(days);
  }
}

/**
 * Calculate top movers from snapshot deltas
 */
async function calculateTopMovers(
  currentMetrics: Map<string, number>
): Promise<TopMover[]> {
  const movers: TopMover[] = [];

  try {
    // Get yesterday's snapshots
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dayBefore = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const yesterdaySnapshots = await db.wallSnapshot.findMany({
      where: {
        segment: 'all',
        ts: { gte: dayBefore, lt: yesterday },
      },
      orderBy: { ts: 'desc' },
    });

    // Group by metric, take latest
    const yesterdayValues = new Map<string, number>();
    for (const snap of yesterdaySnapshots) {
      if (!yesterdayValues.has(snap.metricKey)) {
        yesterdayValues.set(snap.metricKey, snap.valueNumeric || 0);
      }
    }

    // Calculate deltas
    for (const [key, currentValue] of currentMetrics) {
      const prevValue = yesterdayValues.get(key);
      if (prevValue !== undefined && prevValue > 0) {
        const deltaPercent = ((currentValue - prevValue) / prevValue) * 100;
        const def = METRIC_CONTRACT[key];

        if (def && Math.abs(deltaPercent) > 1) { // Only show >1% changes
          movers.push({
            key,
            label: def.label,
            delta: `${deltaPercent >= 0 ? '+' : ''}${deltaPercent.toFixed(1)}%`,
            deltaIsPositive: deltaPercent >= 0,
            goalDirection: def.goalDirection,
          });
        }
      }
    }

    // Sort by absolute delta
    movers.sort((a, b) => {
      const aDelta = Math.abs(parseFloat(a.delta));
      const bDelta = Math.abs(parseFloat(b.delta));
      return bDelta - aDelta;
    });

  } catch (error) {
    console.error('Failed to calculate top movers:', error);
  }

  // Return top 3, or defaults if none
  if (movers.length === 0) {
    return [
      { key: 'no-data', label: 'Accumulating data...', delta: '—', deltaIsPositive: true, goalDirection: 'up' },
    ];
  }

  return movers.slice(0, 3);
}

/**
 * Main aggregator that fetches all metrics with caching
 */
export async function fetchAllMetrics(
  segment: string = 'all',
  investorMode: boolean = false
): Promise<WallSummaryResponse> {
  const metrics: MetricValue[] = [];
  const currentValues = new Map<string, number>();
  const sourceHealth = await getAllSourceHealth();
  const uptime = await fetchUptimeMetrics();

  // Fetch Stripe metrics
  try {
    const stripeData = await fetchWithCache(
      `stripe:metrics:${segment}`,
      'stripe',
      METRIC_CONTRACT['revenue-today']?.ttlSeconds || 180,
      fetchStripeMetrics
    );

    const stripe = stripeData.data;
    currentValues.set('revenue-today', stripe.revenueToday);
    currentValues.set('revenue-mtd', stripe.revenueMTD);

    metrics.push({
      key: 'revenue-today',
      value: stripe.revenueToday,
      prevValue: 0,
      formattedValue: investorMode ? '••••' : formatCurrency(stripe.revenueToday),
      delta: '+0%',
      deltaIsPositive: true,
      timestamp: Date.now(),
      sparkline: [],
    });

    metrics.push({
      key: 'revenue-mtd',
      value: stripe.revenueMTD,
      prevValue: 0,
      formattedValue: investorMode ? '••••' : formatCurrency(stripe.revenueMTD),
      delta: '+0%',
      deltaIsPositive: true,
      timestamp: Date.now(),
      sparkline: [],
    });
  } catch (error) {
    console.error('Stripe metrics fetch failed:', error);
    metrics.push(
      createPlaceholderMetric('revenue-today', 'currency', investorMode),
      createPlaceholderMetric('revenue-mtd', 'currency', investorMode)
    );
  }

  // Fetch PostHog metrics
  if (isPostHogConfigured()) {
    try {
      const postHogData = await fetchWithCache(
        `posthog:metrics:${segment}`,
        'posthog',
        METRIC_CONTRACT['dau']?.ttlSeconds || 180,
        fetchPostHogMetrics
      );

      const ph = postHogData.data;
      currentValues.set('dau', ph.dau);

      metrics.push({
        key: 'dau',
        value: ph.dau,
        prevValue: 0,
        formattedValue: formatNumber(ph.dau),
        delta: '+0%',
        deltaIsPositive: true,
        timestamp: Date.now(),
        sparkline: [],
      });
    } catch (error) {
      console.error('PostHog metrics fetch failed:', error);
      metrics.push(createPlaceholderMetric('dau', 'number', investorMode));
    }
  }

  // Fetch GA4 metrics
  try {
    const ga4Data = await fetchWithCache(
      `ga4:metrics:${segment}`,
      'ga4',
      METRIC_CONTRACT['visits']?.ttlSeconds || 900,
      fetchGA4Metrics
    );

    const ga4 = ga4Data.data;
    currentValues.set('visits', ga4.visits);

    metrics.push({
      key: 'visits',
      value: ga4.visits,
      prevValue: 0,
      formattedValue: formatNumber(ga4.visits),
      delta: '+0%',
      deltaIsPositive: true,
      timestamp: Date.now(),
      sparkline: [],
      warning: ga4.source === 'posthog_fallback' ? 'GA4 unavailable, using PostHog' : undefined,
    });
  } catch (error) {
    console.error('GA4 metrics fetch failed:', error);
    metrics.push(createPlaceholderMetric('visits', 'number', investorMode));
  }

  // Fetch Sako DB metrics (sako-v1 database)
  let sakoData = {
    signups: 0,
    activationRate: 0,
    d7Retention: { rate: 0, retained: 0, cohort: 0 },
    taskCounts: { total: 0, queued: 0, inProgress: 0, inReview: 0, completed: 0, paused: 0 },
    churnRiskAccounts: 0,
    conversionRate: 0,
    activeSubscriptions: 0,
    activeWorkspaces: 0,
    totalUsers: 0,
  };

  if (isSakoDbConfigured()) {
    try {
      const sakoResult = await fetchWithCache(
        `sako_db:metrics:${segment}`,
        'sako_db',
        METRIC_CONTRACT['signups']?.ttlSeconds || 60,
        fetchSakoDbMetrics
      );
      sakoData = sakoResult.data;
    } catch (error) {
      console.error('Sako DB metrics fetch failed:', error);
    }
  }

  // Add sako_db metrics to currentValues and metrics array
  currentValues.set('signups', sakoData.signups);
  currentValues.set('activation', sakoData.activationRate);
  currentValues.set('d7-retention', sakoData.d7Retention.rate);
  currentValues.set('churn-risk', sakoData.churnRiskAccounts);
  currentValues.set('conversion', sakoData.conversionRate);
  currentValues.set('active-subscriptions', sakoData.activeSubscriptions);
  currentValues.set('active-workspaces', sakoData.activeWorkspaces);
  currentValues.set('total-users', sakoData.totalUsers);

  metrics.push({
    key: 'signups',
    value: sakoData.signups,
    prevValue: 0,
    formattedValue: formatNumber(sakoData.signups),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'total-users',
    value: sakoData.totalUsers,
    prevValue: 0,
    formattedValue: formatNumber(sakoData.totalUsers),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'active-subscriptions',
    value: sakoData.activeSubscriptions,
    prevValue: 0,
    formattedValue: formatNumber(sakoData.activeSubscriptions),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'active-workspaces',
    value: sakoData.activeWorkspaces,
    prevValue: 0,
    formattedValue: formatNumber(sakoData.activeWorkspaces),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'activation',
    value: sakoData.activationRate,
    prevValue: 0,
    formattedValue: formatPercent(sakoData.activationRate),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'd7-retention',
    value: sakoData.d7Retention.rate,
    prevValue: 0,
    formattedValue: formatPercent(sakoData.d7Retention.rate),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'conversion',
    value: sakoData.conversionRate,
    prevValue: 0,
    formattedValue: formatPercent(sakoData.conversionRate),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'churn-risk',
    value: sakoData.churnRiskAccounts,
    prevValue: 0,
    formattedValue: investorMode ? '••' : formatNumber(sakoData.churnRiskAccounts),
    delta: '+0%',
    deltaIsPositive: false,
    timestamp: Date.now(),
    sparkline: [],
  });

  // Fetch Composer DB metrics (sako-gtm database)
  let composerData = {
    generationCount: 0,
    successRate: 0,
    avgLatencyMs: 0,
    dailyBurn: 0,
    costPerGen: 0,
    totalTokens: 0,
    errorRate: 0,
    campaignsToday: 0,
    totalCampaigns: 0,
    deploymentsToday: 0,
    activeWorkspaces: 0,
  };

  if (isComposerDbConfigured()) {
    try {
      const composerResult = await fetchWithCache(
        `composer_db:metrics:${segment}`,
        'composer_db',
        METRIC_CONTRACT['gen-count']?.ttlSeconds || 60,
        fetchComposerDbMetrics
      );
      composerData = composerResult.data;
    } catch (error) {
      console.error('Composer DB metrics fetch failed:', error);
    }
  }

  // Add composer_db metrics to currentValues and metrics array
  currentValues.set('gen-count', composerData.generationCount);
  currentValues.set('gen-success-rate', composerData.successRate);
  currentValues.set('daily-burn', composerData.dailyBurn);
  currentValues.set('ai-tokens-today', composerData.totalTokens);
  currentValues.set('campaigns-today', composerData.campaignsToday);
  currentValues.set('total-campaigns', composerData.totalCampaigns);
  currentValues.set('deployments-today', composerData.deploymentsToday);
  currentValues.set('composer-workspaces', composerData.activeWorkspaces);

  metrics.push({
    key: 'gen-count',
    value: composerData.generationCount,
    prevValue: 0,
    formattedValue: formatNumber(composerData.generationCount),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'gen-success-rate',
    value: composerData.successRate,
    prevValue: 0,
    formattedValue: formatPercent(composerData.successRate),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'daily-burn',
    value: composerData.dailyBurn,
    prevValue: 0,
    formattedValue: investorMode ? '••••' : formatCurrency(composerData.dailyBurn),
    delta: '+0%',
    deltaIsPositive: false,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'ai-tokens-today',
    value: composerData.totalTokens,
    prevValue: 0,
    formattedValue: formatTokens(composerData.totalTokens),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'campaigns-today',
    value: composerData.campaignsToday,
    prevValue: 0,
    formattedValue: formatNumber(composerData.campaignsToday),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'total-campaigns',
    value: composerData.totalCampaigns,
    prevValue: 0,
    formattedValue: formatNumber(composerData.totalCampaigns),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'deployments-today',
    value: composerData.deploymentsToday,
    prevValue: 0,
    formattedValue: formatNumber(composerData.deploymentsToday),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  metrics.push({
    key: 'composer-workspaces',
    value: composerData.activeWorkspaces,
    prevValue: 0,
    formattedValue: formatNumber(composerData.activeWorkspaces),
    delta: '+0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
  });

  // Build tiles with metadata
  const tiles = metrics.map((m) => {
    const def = METRIC_CONTRACT[m.key];
    return {
      ...m,
      label: def?.label || m.key,
      investorSafe: def?.investorSafe ?? true,
      target: def?.target,
      goalDirection: def?.goalDirection || ('up' as const),
    };
  });

  // Fetch all parallel data
  const [
    alerts,
    contextLogs,
    socialPost,
    topMovers,
    dauChart,
    revenueChart,
  ] = await Promise.all([
    generateAlerts(sourceHealth, uptime, composerData.errorRate, sakoData.churnRiskAccounts, sakoData.taskCounts.paused),
    fetchContextLogs(),
    fetchSocialPost(),
    calculateTopMovers(currentValues),
    fetchChartFromSnapshots('dau', 14),
    fetchChartFromSnapshots('revenue-today', 14),
  ]);

  // Build scoreboard
  const scoreboard: ScoreboardData = calculateScoreboard(tiles);

  // Build pod data (task pipeline status)
  const podData: PodData = {
    open: sakoData.taskCounts.total - sakoData.taskCounts.completed,
    notStarted: sakoData.taskCounts.queued,
    inProgress: sakoData.taskCounts.inProgress,
    inReview: sakoData.taskCounts.inReview,
    completed: sakoData.taskCounts.completed,
    avgCycleTime: '—', // Would need lifecycle event calculation
    blocked: sakoData.taskCounts.paused,
  };

  // Build composer panel data
  const composerPanelData: ComposerData = {
    generations: composerData.generationCount,
    successRate: composerData.successRate,
    avgLatency: formatLatency(composerData.avgLatencyMs),
    costToday: composerData.dailyBurn,
    costPerGen: `$${composerData.costPerGen.toFixed(4)}`,
    tokensTotal: formatTokens(composerData.totalTokens),
    errorRate: composerData.errorRate,
  };

  return {
    tiles,
    charts: {
      dau: dauChart,
      revenue: revenueChart,
    },
    sourceHealth,
    uptime,
    alerts,
    contextLogs,
    socialPost,
    topMovers,
    scoreboard,
    podData,
    composerData: composerPanelData,
    lastUpdated: Date.now(),
  };
}

// Helper functions

function createPlaceholderMetric(
  key: string,
  format: 'currency' | 'number' | 'percent',
  investorMode: boolean
): MetricValue {
  return {
    key,
    value: 0,
    prevValue: 0,
    formattedValue:
      format === 'currency'
        ? investorMode
          ? '••••'
          : '$0'
        : format === 'percent'
        ? '0%'
        : '0',
    delta: '0%',
    deltaIsPositive: true,
    timestamp: Date.now(),
    sparkline: [],
    warning: 'Data unavailable',
  };
}

function calculateScoreboard(
  tiles: (MetricValue & { target?: string; goalDirection: 'up' | 'down' })[]
): ScoreboardData {
  let hitCount = 0;
  let totalWithTargets = 0;

  for (const tile of tiles) {
    if (tile.target) {
      totalWithTargets++;
      const target = parseFloat(tile.target);
      if (tile.goalDirection === 'up' && tile.value >= target) hitCount++;
      if (tile.goalDirection === 'down' && tile.value <= target) hitCount++;
    }
  }

  const score = totalWithTargets > 0 ? Math.round((hitCount / totalWithTargets) * 100) : 50;

  const status: ScoreboardData['status'] =
    score >= 70 ? 'winning' : score >= 40 ? 'at_risk' : 'losing';

  // Revenue forecast using IST timezone
  const { start: todayStart } = getISTDateBoundaries();
  const hoursElapsed = (Date.now() - todayStart.getTime()) / (1000 * 60 * 60);
  
  const revenueToday = tiles.find((t) => t.key === 'revenue-today')?.value || 0;
  const projectedRevenue = hoursElapsed > 0 ? (revenueToday / hoursElapsed) * 24 : revenueToday;

  const signups = tiles.find((t) => t.key === 'signups')?.value || 0;
  const projectedSignups = hoursElapsed > 0 ? Math.round((signups / hoursElapsed) * 24) : signups;

  return {
    score,
    status,
    revenueForecast: `$${(projectedRevenue / 1000).toFixed(1)}k`,
    signupForecast: projectedSignups.toString(),
  };
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'now';
}

function formatDateShort(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function generatePlaceholderChartData(days: number): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    result.push({
      date: formatDateShort(date.toISOString()),
      value: 0,
    });
  }
  return result;
}
