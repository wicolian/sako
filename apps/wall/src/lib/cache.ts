import { db } from './db';
import type { SourceType, DataTrustState } from '@/types';

/**
 * Neon-backed cache that survives serverless cold starts
 */

interface CacheEntry<T> {
  data: T;
  fetchedAt: Date;
  ttlSeconds: number;
  source: SourceType;
}

/**
 * Get a cached value
 */
export async function getCache<T>(key: string): Promise<CacheEntry<T> | null> {
  const entry = await db.wallCache.findUnique({
    where: { cacheKey: key },
  });

  if (!entry) return null;

  // Check if expired
  const expiresAt = new Date(entry.fetchedAt.getTime() + entry.ttlSeconds * 1000);
  if (expiresAt < new Date()) {
    // Expired, but we might still want to use it as fallback
    // Return it anyway and let the caller decide
  }

  return {
    data: entry.payload as T,
    fetchedAt: entry.fetchedAt,
    ttlSeconds: entry.ttlSeconds,
    source: entry.source as SourceType,
  };
}

/**
 * Check if cache is valid (not expired)
 */
export async function isCacheValid(key: string): Promise<boolean> {
  const entry = await db.wallCache.findUnique({
    where: { cacheKey: key },
  });

  if (!entry) return false;

  const expiresAt = new Date(entry.fetchedAt.getTime() + entry.ttlSeconds * 1000);
  return expiresAt >= new Date();
}

/**
 * Set a cache value
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttlSeconds: number,
  source: SourceType
): Promise<void> {
  await db.wallCache.upsert({
    where: { cacheKey: key },
    update: {
      payload: data as object,
      fetchedAt: new Date(),
      ttlSeconds,
      source,
    },
    create: {
      cacheKey: key,
      payload: data as object,
      fetchedAt: new Date(),
      ttlSeconds,
      source,
    },
  });
}

/**
 * Delete a cache entry
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await db.wallCache.delete({ where: { cacheKey: key } });
  } catch {
    // Ignore if doesn't exist
  }
}

/**
 * Clear all expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  const now = new Date();

  // Get all entries and check expiration
  const allEntries = await db.wallCache.findMany();
  const expiredKeys: string[] = [];

  for (const entry of allEntries) {
    const expiresAt = new Date(entry.fetchedAt.getTime() + entry.ttlSeconds * 1000);
    if (expiresAt < now) {
      expiredKeys.push(entry.cacheKey);
    }
  }

  if (expiredKeys.length > 0) {
    await db.wallCache.deleteMany({
      where: { cacheKey: { in: expiredKeys } },
    });
  }

  return expiredKeys.length;
}

/**
 * Update source status after fetch attempt
 */
export async function updateSourceStatus(
  source: SourceType,
  success: boolean,
  error?: string
): Promise<void> {
  const now = new Date();

  const existing = await db.wallSourceStatus.findUnique({
    where: { source },
  });

  const errorCount = success ? 0 : (existing?.errorCount || 0) + 1;

  // Determine state based on error count and last success
  let state: DataTrustState = 'OK';
  if (!success) {
    if (errorCount >= 3) {
      state = 'DOWN';
    } else if (errorCount >= 1) {
      state = 'DEGRADED';
    }
  }

  await db.wallSourceStatus.upsert({
    where: { source },
    update: {
      state,
      lastAttemptAt: now,
      ...(success ? { lastSuccessAt: now, errorCount: 0 } : { errorCount, lastError: error }),
    },
    create: {
      source,
      state,
      lastAttemptAt: now,
      lastSuccessAt: success ? now : null,
      errorCount,
      lastError: error,
    },
  });
}

/**
 * Get source status
 */
export async function getSourceStatus(source: SourceType): Promise<{
  state: DataTrustState;
  lastSuccessAt: Date | null;
  lastAttemptAt: Date | null;
  errorCount: number;
  lastError: string | null;
}> {
  const status = await db.wallSourceStatus.findUnique({
    where: { source },
  });

  if (!status) {
    return {
      state: 'OK',
      lastSuccessAt: null,
      lastAttemptAt: null,
      errorCount: 0,
      lastError: null,
    };
  }

  return {
    state: status.state as DataTrustState,
    lastSuccessAt: status.lastSuccessAt,
    lastAttemptAt: status.lastAttemptAt,
    errorCount: status.errorCount,
    lastError: status.lastError,
  };
}

/**
 * Get all source statuses
 */
export async function getAllSourceStatuses(): Promise<
  Map<
    SourceType,
    {
      state: DataTrustState;
      lastSuccessAt: Date | null;
      lastAttemptAt: Date | null;
      errorCount: number;
      lastError: string | null;
    }
  >
> {
  const statuses = await db.wallSourceStatus.findMany();
  const map = new Map<
    SourceType,
    {
      state: DataTrustState;
      lastSuccessAt: Date | null;
      lastAttemptAt: Date | null;
      errorCount: number;
      lastError: string | null;
    }
  >();

  for (const status of statuses) {
    map.set(status.source as SourceType, {
      state: status.state as DataTrustState,
      lastSuccessAt: status.lastSuccessAt,
      lastAttemptAt: status.lastAttemptAt,
      errorCount: status.errorCount,
      lastError: status.lastError,
    });
  }

  return map;
}

/**
 * Fetch with cache - main utility for providers
 */
export async function fetchWithCache<T>(
  key: string,
  source: SourceType,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<{ data: T; fromCache: boolean; stale: boolean }> {
  // Check cache first
  const cached = await getCache<T>(key);

  if (cached) {
    const expiresAt = new Date(cached.fetchedAt.getTime() + cached.ttlSeconds * 1000);
    const isValid = expiresAt >= new Date();

    if (isValid) {
      return { data: cached.data, fromCache: true, stale: false };
    }
  }

  // Try to fetch fresh data
  try {
    const startTime = Date.now();
    const data = await fetcher();
    const latency = Date.now() - startTime;

    // Update cache
    await setCache(key, data, ttlSeconds, source);

    // Update source status
    await updateSourceStatus(source, true);

    return { data, fromCache: false, stale: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update source status
    await updateSourceStatus(source, false, errorMessage);

    // Return stale cache if available
    if (cached) {
      console.warn(`Using stale cache for ${key}: ${errorMessage}`);
      return { data: cached.data, fromCache: true, stale: true };
    }

    // No cache, throw error
    throw error;
  }
}
