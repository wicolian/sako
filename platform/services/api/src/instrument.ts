// Import with `const Sentry = require("@sentry/nestjs");` if you are using CJS
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry only if DSN is provided
const sentryDsn = process.env.SENTRY_DSN;
const nodeEnv = process.env.NODE_ENV || 'development';
const sentryRelease = process.env.SENTRY_RELEASE || undefined;

// Determine environment string for Sentry
const getSentryEnvironment = (): string => {
    if (nodeEnv === 'production') return 'production';
    if (nodeEnv === 'staging') return 'staging';
    return 'development';
};

// Determine traces sample rate based on environment
const getTracesSampleRate = (): number => {
    if (nodeEnv === 'production') return 0.3; // 30% in production to manage quota
    return 1.0; // 100% in dev/staging for full visibility
};

if (sentryDsn && sentryDsn.trim()) {
    try {
        Sentry.init({
            dsn: sentryDsn,
            environment: getSentryEnvironment(),
            release: sentryRelease,
            integrations: [
                nodeProfilingIntegration(),
                // HTTP integration for tracing incoming requests is auto-enabled by @sentry/nestjs
            ],
            // Performance Monitoring
            tracesSampleRate: getTracesSampleRate(),
            profilesSampleRate: nodeEnv === 'production' ? 0.3 : 1.0,
            // Send structured logs to Sentry
            enableLogs: true,
            // Send PII data (IP addresses, etc.) for better debugging
            sendDefaultPii: true,
            // Attach stack traces to messages
            attachStacktrace: true,
            // Add breadcrumbs for better context
            maxBreadcrumbs: 50,
        });
        console.log(`✓ Sentry observability enabled (env: ${getSentryEnvironment()}, release: ${sentryRelease || 'unset'}, tracesSampleRate: ${getTracesSampleRate()})`);
    } catch (err) {
        console.error('⚠ Sentry initialization failed:', err);
    }
} else {
    console.log('⚠ SENTRY_DSN not configured - observability disabled');
}

// Export a helper to check if Sentry is initialized
export const isSentryEnabled = () => {
    return !!(sentryDsn && sentryDsn.trim());
};

// Export Sentry for use in other modules
export { Sentry };
