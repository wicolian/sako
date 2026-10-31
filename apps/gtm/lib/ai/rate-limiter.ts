/**
 * AI Rate Limiter with Circuit Breaker (Jan 2026)
 * 
 * Implements:
 * - Token bucket rate limiting per workspace
 * - Circuit breaker for failing providers
 * - Request queuing with timeouts
 * - Automatic retry with exponential backoff
 */

import { createServiceClient } from '@/lib/supabase/service';

// ============================================================================
// Types
// ============================================================================

interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  maxConcurrent: number;
}

interface CircuitState {
  failures: number;
  lastFailure: Date | null;
  state: 'closed' | 'open' | 'half-open';
  openedAt: Date | null;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    requestsPerMinute: 10,
    tokensPerMinute: 50000,
    maxConcurrent: 2,
  },
  starter: {
    requestsPerMinute: 30,
    tokensPerMinute: 200000,
    maxConcurrent: 5,
  },
  pro: {
    requestsPerMinute: 100,
    tokensPerMinute: 500000,
    maxConcurrent: 10,
  },
  enterprise: {
    requestsPerMinute: 500,
    tokensPerMinute: 2000000,
    maxConcurrent: 50,
  },
};

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  recoveryTimeMs: 30000, // 30 seconds
  halfOpenRequests: 3,
};

// ============================================================================
// In-Memory State (use Redis in production)
// ============================================================================

const workspaceTokenBuckets = new Map<string, {
  tokens: number;
  lastRefill: number;
  requests: number[];
  concurrent: number;
}>();

const providerCircuits = new Map<string, CircuitState>();

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Check if a request can proceed under rate limits
 */
export async function checkRateLimit(
  workspaceId: string,
  estimatedTokens: number
): Promise<{ allowed: boolean; retryAfterMs?: number; reason?: string }> {
  const supabase = createServiceClient();
  
  // Get workspace plan
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .single();

  const plan = (workspace?.plan as keyof typeof DEFAULT_LIMITS) || 'free';
  const limits = DEFAULT_LIMITS[plan];

  // Get or create bucket
  let bucket = workspaceTokenBuckets.get(workspaceId);
  const now = Date.now();

  if (!bucket) {
    bucket = {
      tokens: limits.tokensPerMinute,
      lastRefill: now,
      requests: [],
      concurrent: 0,
    };
    workspaceTokenBuckets.set(workspaceId, bucket);
  }

  // Refill tokens based on time elapsed
  const elapsed = now - bucket.lastRefill;
  const refillAmount = (elapsed / 60000) * limits.tokensPerMinute;
  bucket.tokens = Math.min(limits.tokensPerMinute, bucket.tokens + refillAmount);
  bucket.lastRefill = now;

  // Clean old requests (older than 1 minute)
  bucket.requests = bucket.requests.filter((t) => now - t < 60000);

  // Check limits
  if (bucket.concurrent >= limits.maxConcurrent) {
    return {
      allowed: false,
      retryAfterMs: 1000,
      reason: 'Max concurrent requests reached',
    };
  }

  if (bucket.requests.length >= limits.requestsPerMinute) {
    const oldestRequest = bucket.requests[0];
    const retryAfterMs = 60000 - (now - oldestRequest);
    return {
      allowed: false,
      retryAfterMs,
      reason: 'Rate limit exceeded',
    };
  }

  if (bucket.tokens < estimatedTokens) {
    const tokensNeeded = estimatedTokens - bucket.tokens;
    const refillRatePerMs = limits.tokensPerMinute / 60000;
    const retryAfterMs = Math.ceil(tokensNeeded / refillRatePerMs);
    return {
      allowed: false,
      retryAfterMs,
      reason: 'Token limit exceeded',
    };
  }

  // Consume resources
  bucket.tokens -= estimatedTokens;
  bucket.requests.push(now);
  bucket.concurrent++;

  return { allowed: true };
}

/**
 * Release a concurrent request slot
 */
export function releaseRequest(workspaceId: string): void {
  const bucket = workspaceTokenBuckets.get(workspaceId);
  if (bucket && bucket.concurrent > 0) {
    bucket.concurrent--;
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Check if a provider circuit is open (failing)
 */
export function isCircuitOpen(provider: string): boolean {
  const circuit = providerCircuits.get(provider);
  if (!circuit) return false;

  const now = Date.now();

  switch (circuit.state) {
    case 'closed':
      return false;

    case 'open':
      // Check if recovery time has passed
      if (circuit.openedAt && now - circuit.openedAt.getTime() >= CIRCUIT_BREAKER_CONFIG.recoveryTimeMs) {
        circuit.state = 'half-open';
        return false;
      }
      return true;

    case 'half-open':
      return false;
  }
}

/**
 * Record a provider failure
 */
export function recordFailure(provider: string): void {
  let circuit = providerCircuits.get(provider);
  
  if (!circuit) {
    circuit = {
      failures: 0,
      lastFailure: null,
      state: 'closed',
      openedAt: null,
    };
    providerCircuits.set(provider, circuit);
  }

  circuit.failures++;
  circuit.lastFailure = new Date();

  if (circuit.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
    circuit.state = 'open';
    circuit.openedAt = new Date();
    console.warn(`[CircuitBreaker] Provider ${provider} circuit opened after ${circuit.failures} failures`);
  }
}

/**
 * Record a provider success
 */
export function recordSuccess(provider: string): void {
  const circuit = providerCircuits.get(provider);
  if (!circuit) return;

  if (circuit.state === 'half-open') {
    circuit.state = 'closed';
    circuit.failures = 0;
    console.log(`[CircuitBreaker] Provider ${provider} circuit closed after successful request`);
  }
}

/**
 * Get circuit state for monitoring
 */
export function getCircuitState(provider: string): CircuitState | null {
  return providerCircuits.get(provider) || null;
}

// ============================================================================
// Retry Logic
// ============================================================================

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Execute with exponential backoff retry
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number;
    onRetry?: (attempt: number, error: Error) => void;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? MAX_RETRIES;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        options?.onRetry?.(attempt + 1, lastError);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Rate Limit Middleware
// ============================================================================

/**
 * Higher-order function that wraps AI calls with rate limiting
 */
export function withRateLimiting<T, A extends unknown[]>(
  workspaceId: string,
  estimatedTokens: number,
  fn: (...args: A) => Promise<T>
): (...args: A) => Promise<T> {
  return async (...args: A) => {
    const check = await checkRateLimit(workspaceId, estimatedTokens);
    
    if (!check.allowed) {
      throw new Error(`Rate limit: ${check.reason}. Retry after ${check.retryAfterMs}ms`);
    }

    try {
      const result = await fn(...args);
      return result;
    } finally {
      releaseRequest(workspaceId);
    }
  };
}
