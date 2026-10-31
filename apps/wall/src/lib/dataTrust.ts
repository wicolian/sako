import { db } from './db';
import type { DataTrustState, SourceType, SourceStatus } from '@/types';
import { SOURCE_DEFINITIONS, METRIC_CONTRACT } from '@/config/metrics';

// Stale thresholds per source (in seconds)
const STALE_THRESHOLDS: Record<SourceType, number> = {
  stripe: 600, // 10 min
  posthog: 600, // 10 min
  ga4: 3600, // 60 min
  sako_db: 300, // 5 min
  composer_db: 300, // 5 min
  manual: 604800, // 7 days
  neon: 300, // 5 min
  ping: 300, // 5 min
};

/**
 * Calculate data trust state based on last success time and error count
 */
export function calculateTrustState(
  lastSuccessAt: Date | null,
  errorCount: number,
  source: SourceType
): DataTrustState {
  // If never succeeded, it's DOWN if there are errors
  if (!lastSuccessAt) {
    if (errorCount > 0) return 'DOWN';
    return 'OK'; // Not yet attempted
  }

  const staleThreshold = STALE_THRESHOLDS[source] || 600;
  const now = Date.now();
  const timeSinceSuccess = (now - lastSuccessAt.getTime()) / 1000;

  // DOWN if multiple consecutive errors
  if (errorCount >= 3) {
    return 'DOWN';
  }

  // STALE if beyond threshold with any errors
  if (timeSinceSuccess > staleThreshold && errorCount > 0) {
    return 'STALE';
  }

  // STALE if way beyond threshold even without errors
  if (timeSinceSuccess > staleThreshold * 2) {
    return 'STALE';
  }

  // DEGRADED if recent errors
  if (errorCount > 0) {
    return 'DEGRADED';
  }

  return 'OK';
}

/**
 * Get all source statuses for the data trust panel
 */
export async function getAllSourceHealth(): Promise<SourceStatus[]> {
  const sources: SourceType[] = ['stripe', 'posthog', 'ga4', 'sako_db', 'composer_db', 'manual', 'ping'];

  const statuses = await db.wallSourceStatus.findMany({
    where: { source: { in: sources } },
  });

  const statusMap = new Map<string, typeof statuses[0]>();
  for (const s of statuses) {
    statusMap.set(s.source, s);
  }

  return sources.map((source) => {
    const status = statusMap.get(source);
    const def = SOURCE_DEFINITIONS[source];

    if (!status) {
      return {
        key: source,
        label: def?.label || source,
        status: 'OK' as DataTrustState,
        lastSuccessAt: null,
        lastAttemptAt: null,
        errorCount: 0,
        latencyMs: 0,
      };
    }

    const calculatedState = calculateTrustState(
      status.lastSuccessAt,
      status.errorCount,
      source
    );

    return {
      key: source,
      label: def?.label || source,
      status: calculatedState,
      lastSuccessAt: status.lastSuccessAt?.getTime() ?? null,
      lastAttemptAt: status.lastAttemptAt?.getTime() ?? null,
      errorCount: status.errorCount,
      latencyMs: 0, // We could track this in the status table
      lastError: status.lastError || undefined,
    };
  });
}

/**
 * Check if a metric's data is stale based on its last update time
 */
export function isMetricStale(
  metricKey: string,
  lastFetchedAt: Date | null
): boolean {
  const metric = METRIC_CONTRACT[metricKey];
  if (!metric || !lastFetchedAt) return false;

  const now = Date.now();
  const timeSinceFetch = (now - lastFetchedAt.getTime()) / 1000;

  return timeSinceFetch > metric.staleAfterSeconds;
}

/**
 * Get overall system health
 */
export async function getOverallHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'critical';
  healthyCount: number;
  degradedCount: number;
  downCount: number;
}> {
  const sources = await getAllSourceHealth();

  let healthyCount = 0;
  let degradedCount = 0;
  let downCount = 0;

  for (const source of sources) {
    switch (source.status) {
      case 'OK':
        healthyCount++;
        break;
      case 'DEGRADED':
      case 'STALE':
        degradedCount++;
        break;
      case 'DOWN':
        downCount++;
        break;
    }
  }

  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (downCount > 0) {
    status = 'critical';
  } else if (degradedCount > 0) {
    status = 'degraded';
  }

  return { status, healthyCount, degradedCount, downCount };
}
