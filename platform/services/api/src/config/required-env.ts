import { Logger } from '@nestjs/common';

export const REQUIRED_ENVS = [
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'CORS_ORIGINS',
];

export const REQUIRED_PROD_ENVS = [
    'FRONTEND_URL',
];

export function validateRequiredEnv() {
    const logger = new Logger('EnvValidation');
    const missingEnvs: string[] = [];

    REQUIRED_ENVS.forEach((key) => {
        if (!process.env[key] || process.env[key].trim() === '') {
            missingEnvs.push(key);
        }
    });

    if (process.env.NODE_ENV === 'production') {
        REQUIRED_PROD_ENVS.forEach((key) => {
            if (!process.env[key] || process.env[key].trim() === '') {
                missingEnvs.push(key);
            }
        });
    }

    if (missingEnvs.length > 0) {
        logger.error(`❌ Missing required environment variables: ${missingEnvs.join(', ')}`);
        process.exit(1);
    }

    logger.log('✅ Environment variables validated');
}
