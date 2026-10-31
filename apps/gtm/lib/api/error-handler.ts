/**
 * API Error Handler (Jan 2026)
 * 
 * Comprehensive error handling for all API routes:
 * - Typed error classes
 * - Consistent error responses
 * - Error logging
 * - Rate limiting errors
 * - Validation errors
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

// Error codes
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  
  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// Error response structure
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    requestId?: string;
    timestamp: string;
  };
}

// Custom error class
export class APIError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: any;
  
  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: any
  ) {
    super(message);
    this.name = 'APIError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
  
  static badRequest(message: string, details?: any): APIError {
    return new APIError(ErrorCodes.BAD_REQUEST, message, 400, details);
  }
  
  static unauthorized(message = 'Unauthorized'): APIError {
    return new APIError(ErrorCodes.UNAUTHORIZED, message, 401);
  }
  
  static forbidden(message = 'Forbidden'): APIError {
    return new APIError(ErrorCodes.FORBIDDEN, message, 403);
  }
  
  static notFound(resource = 'Resource'): APIError {
    return new APIError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404);
  }
  
  static conflict(message: string): APIError {
    return new APIError(ErrorCodes.CONFLICT, message, 409);
  }
  
  static validation(errors: any): APIError {
    return new APIError(
      ErrorCodes.VALIDATION_ERROR,
      'Validation failed',
      422,
      errors
    );
  }
  
  static rateLimited(retryAfter?: number): APIError {
    return new APIError(
      ErrorCodes.RATE_LIMITED,
      'Too many requests',
      429,
      { retryAfter }
    );
  }
  
  static internal(message = 'Internal server error'): APIError {
    return new APIError(ErrorCodes.INTERNAL_ERROR, message, 500);
  }
  
  static database(message: string): APIError {
    return new APIError(ErrorCodes.DATABASE_ERROR, message, 500);
  }
  
  static aiService(message: string): APIError {
    return new APIError(ErrorCodes.AI_SERVICE_ERROR, message, 503);
  }
  
  static externalApi(service: string, message: string): APIError {
    return new APIError(
      ErrorCodes.EXTERNAL_API_ERROR,
      `${service} error: ${message}`,
      502
    );
  }
}

// Generate request ID
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
}

// Format error response
export function formatErrorResponse(
  error: APIError | Error | ZodError,
  requestId?: string
): { response: ErrorResponse; statusCode: number } {
  const rid = requestId || generateRequestId();
  const timestamp = new Date().toISOString();
  
  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      response: {
        error: {
          code: ErrorCodes.VALIDATION_ERROR,
          message: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message,
          })),
          requestId: rid,
          timestamp,
        },
      },
      statusCode: 422,
    };
  }
  
  // Handle custom API errors
  if (error instanceof APIError) {
    return {
      response: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: rid,
          timestamp,
        },
      },
      statusCode: error.statusCode,
    };
  }
  
  // Handle generic errors
  return {
    response: {
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : error.message,
        requestId: rid,
        timestamp,
      },
    },
    statusCode: 500,
  };
}

// Error handler wrapper for API routes
export function withErrorHandler<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    const requestId = generateRequestId();
    
    try {
      return await handler(...args);
    } catch (error: any) {
      // Log error
      console.error(`[${requestId}] API Error:`, {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
      
      const { response, statusCode } = formatErrorResponse(error, requestId);
      
      return NextResponse.json(response, {
        status: statusCode,
        headers: {
          'X-Request-ID': requestId,
        },
      });
    }
  }) as T;
}

// Validate request body with Zod
export async function validateBody<T>(
  request: Request,
  schema: { parse: (data: unknown) => T }
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw APIError.validation(
        error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }))
      );
    }
    if (error instanceof SyntaxError) {
      throw APIError.badRequest('Invalid JSON in request body');
    }
    throw error;
  }
}

// Validate query parameters
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: { parse: (data: unknown) => T }
): T {
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      throw APIError.validation(
        error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }))
      );
    }
    throw error;
  }
}

// Ensure resource exists
export function ensureExists<T>(
  resource: T | null | undefined,
  resourceName = 'Resource'
): T {
  if (!resource) {
    throw APIError.notFound(resourceName);
  }
  return resource;
}

// Ensure user has access
export function ensureAccess(
  condition: boolean,
  message = 'Access denied'
): void {
  if (!condition) {
    throw APIError.forbidden(message);
  }
}

// Retry wrapper for external API calls
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, delay = 1000, backoff = 2, onRetry } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxRetries) {
        onRetry?.(error, attempt);
        await new Promise(resolve => 
          setTimeout(resolve, delay * Math.pow(backoff, attempt - 1))
        );
      }
    }
  }
  
  throw lastError;
}

// Timeout wrapper
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new APIError(
      ErrorCodes.SERVICE_UNAVAILABLE,
      errorMessage,
      504
    )), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}
