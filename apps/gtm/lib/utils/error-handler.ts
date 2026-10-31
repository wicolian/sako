/**
 * Centralized Error Handling and Retry Logic
 * 
 * Provides:
 * - Structured error types
 * - Exponential backoff retry
 * - Error logging and reporting
 */

// ============================================================================
// Error Types
// ============================================================================

export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly context?: Record<string, unknown>
  
  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.context = context
    
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, true, context)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` (${id})` : ''} not found`,
      'NOT_FOUND',
      404,
      true,
      { resource, id }
    )
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401, true)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403, true)
    this.name = 'ForbiddenError'
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter?: number
  
  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, true, { retryAfter })
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

export class AIProviderError extends AppError {
  public readonly provider: string
  
  constructor(provider: string, message: string, context?: Record<string, unknown>) {
    super(message, 'AI_PROVIDER_ERROR', 502, true, { provider, ...context })
    this.name = 'AIProviderError'
    this.provider = provider
  }
}

// ============================================================================
// Retry Logic
// ============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number
  
  /** Initial delay in ms before first retry */
  initialDelayMs?: number
  
  /** Maximum delay in ms between retries */
  maxDelayMs?: number
  
  /** Backoff multiplier */
  backoffMultiplier?: number
  
  /** Jitter factor (0-1) to add randomness */
  jitter?: number
  
  /** Function to determine if error is retryable */
  shouldRetry?: (error: Error, attempt: number) => boolean
  
  /** Called before each retry */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: 0.1,
  shouldRetry: (error: Error) => {
    // Retry on network errors and 5xx server errors
    if (error instanceof AppError) {
      return error.statusCode >= 500 || error.code === 'NETWORK_ERROR'
    }
    return false
  },
  onRetry: () => {},
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  
  let lastError: Error
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt === opts.maxRetries || !opts.shouldRetry(lastError, attempt)) {
        throw lastError
      }
      
      // Calculate delay with exponential backoff
      let delayMs = opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt)
      
      // Cap at max delay
      delayMs = Math.min(delayMs, opts.maxDelayMs)
      
      // Add jitter
      const jitterMs = delayMs * opts.jitter * (Math.random() * 2 - 1)
      delayMs = Math.round(delayMs + jitterMs)
      
      opts.onRetry(lastError, attempt + 1, delayMs)
      
      await sleep(delayMs)
    }
  }
  
  throw lastError!
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// Error Response Formatting
// ============================================================================

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * Format an error for API response
 */
export function formatErrorResponse(error: Error): ErrorResponse {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.context,
      },
    }
  }
  
  // Log unexpected errors
  console.error('Unexpected error:', error)
  
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  }
}

/**
 * Get HTTP status code from error
 */
export function getStatusCode(error: Error): number {
  if (error instanceof AppError) {
    return error.statusCode
  }
  return 500
}

// ============================================================================
// Error Logging
// ============================================================================

/**
 * Log an error with context
 */
export function logError(
  error: Error,
  context?: Record<string, unknown>
): void {
  const logData = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error instanceof AppError && {
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      context: error.context,
    }),
    ...context,
    timestamp: new Date().toISOString(),
  }
  
  // In production, this would send to an error tracking service
  console.error('Error logged:', JSON.stringify(logData, null, 2))
}

// ============================================================================
// Circuit Breaker
// ============================================================================

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold?: number
  
  /** Time in ms to wait before trying again */
  resetTimeoutMs?: number
  
  /** Percentage of successes needed to close circuit */
  successThreshold?: number
}

export class CircuitBreaker {
  private failures = 0
  private successes = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private lastFailureTime?: number
  
  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number
  private readonly successThreshold: number
  
  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold || 5
    this.resetTimeoutMs = options.resetTimeoutMs || 60000
    this.successThreshold = options.successThreshold || 3
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailureTime || 0) > this.resetTimeoutMs) {
        this.state = 'half-open'
        this.successes = 0
      } else {
        throw new AppError('Circuit breaker is open', 'CIRCUIT_OPEN', 503)
      }
    }
    
    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess(): void {
    this.failures = 0
    
    if (this.state === 'half-open') {
      this.successes++
      if (this.successes >= this.successThreshold) {
        this.state = 'closed'
      }
    }
  }
  
  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open'
    }
  }
  
  getState(): string {
    return this.state
  }
}
