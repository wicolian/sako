/**
 * Gate Rate Limiter
 * 
 * Rate limits the public /gate validation endpoint by IP address.
 * 10 validations per day per IP. Shows remaining count to user.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Singleton rate limiter instance
let rateLimiter: Ratelimit | null = null

/**
 * Get or create the rate limiter instance
 * Returns null if Upstash credentials are not configured
 */
function getRateLimiter(): Ratelimit | null {
  if (rateLimiter) return rateLimiter
  
  // Only initialize if Upstash credentials are available
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Gate rate limiting disabled: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set')
    return null
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '24h'), // 10 per day per IP
    analytics: true,
    prefix: 'gate_validation',
  })
  
  return rateLimiter
}

export interface GateRateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean
  /** Number of validations remaining today */
  remaining: number
  /** When the limit resets (UTC timestamp) */
  reset: Date
  /** Total limit per day */
  limit: number
  /** Whether rate limiting is enabled */
  enabled: boolean
}

/**
 * Check rate limit for a gate validation request
 * 
 * @param ip - Client IP address (from request headers)
 * @returns Rate limit check result
 */
export async function checkGateRateLimit(ip: string): Promise<GateRateLimitResult> {
  const limiter = getRateLimiter()
  
  // If rate limiting is not configured, allow all requests
  if (!limiter) {
    return {
      allowed: true,
      remaining: Infinity,
      reset: new Date(Date.now() + 24 * 60 * 60 * 1000),
      limit: Infinity,
      enabled: false,
    }
  }
  
  // Normalize IP (handle IPv6, forwarded headers, etc.)
  const normalizedIp = normalizeIp(ip)
  const identifier = `ip:${normalizedIp}`
  
  const { success, remaining, reset, limit } = await limiter.limit(identifier)
  
  return {
    allowed: success,
    remaining,
    reset: new Date(reset),
    limit,
    enabled: true,
  }
}

/**
 * Get remaining validations for an IP without consuming a request
 * 
 * @param ip - Client IP address
 * @returns Remaining validations count
 */
export async function getGateRemainingValidations(ip: string): Promise<number> {
  const limiter = getRateLimiter()
  
  if (!limiter) {
    return Infinity
  }
  
  const normalizedIp = normalizeIp(ip)
  const identifier = `ip:${normalizedIp}`
  
  // Get remaining without consuming
  const { remaining } = await limiter.getRemaining(identifier)
  
  return remaining
}

/**
 * Normalize IP address for consistent rate limiting
 */
function normalizeIp(ip: string): string {
  // Handle common edge cases
  if (!ip || ip === '::1' || ip === 'localhost') {
    return '127.0.0.1'
  }
  
  // Extract first IP if multiple (e.g., from X-Forwarded-For)
  const firstIp = ip.split(',')[0].trim()
  
  // Remove IPv6 prefix if present
  if (firstIp.startsWith('::ffff:')) {
    return firstIp.substring(7)
  }
  
  return firstIp
}

/**
 * Get client IP from request headers
 * Handles various proxy configurations
 */
export function getClientIp(headers: Headers): string {
  // Try various headers in order of preference
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIp = headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  const cfConnectingIp = headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }
  
  // Fallback
  return '127.0.0.1'
}
