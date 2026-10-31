import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { SentryExceptionCaptured } from '@sentry/nestjs';

/**
 * Global exception filter that captures errors in Sentry
 * Uses @SentryExceptionCaptured() decorator for automatic capture
 */
@Catch()
export class SentryFilter extends BaseExceptionFilter implements ExceptionFilter {
    @SentryExceptionCaptured()
    catch(exception: unknown, host: ArgumentsHost) {
        // Delegate to base filter for proper error response
        super.catch(exception, host);
    }
}
