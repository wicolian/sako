import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanCode as PrismaPlanCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPlanDefinitions, getAllPlanCodes } from './plan.config';

export async function validateBillingConfiguration(app: INestApplication) {
    const logger = new Logger('BillingValidation');
    const prisma = app.get(PrismaService);
    const configService = app.get(ConfigService);
    const isProduction = process.env.NODE_ENV === 'production';

    logger.log('🔍 Validating billing configuration...');

    // 1. Validate Environment Variables for Stripe Prices
    const planDefinitions = buildPlanDefinitions(configService);
    const missingEnvs: string[] = [];
    
    Object.values(planDefinitions).forEach(plan => {
        // Skip validation for plans that don't use Stripe (like COMPOSER_FREE)
        if (plan.planCode === 'COMPOSER_FREE') {
            return;
        }

        if (!plan.stripePriceId || plan.stripePriceId.trim() === '') {
            missingEnvs.push(`Stripe Price ID for ${plan.planKey}`);
        }
        if (!plan.stripeProductId || plan.stripeProductId.trim() === '') {
            missingEnvs.push(`Stripe Product ID for ${plan.planCode}`);
        }
    });

    if (missingEnvs.length > 0) {
        if (isProduction) {
            logger.error(`❌ Missing Stripe IDs for: ${missingEnvs.join(', ')}`);
            logger.error(`   Please check your STRIPE_PRODUCT_ID_* and STRIPE_PRICE_ID_* environment variables.`);
            throw new Error('Billing configuration validation failed: Missing Stripe IDs');
        } else {
            logger.warn(`⚠️  Missing Stripe IDs (OK for dev): ${missingEnvs.join(', ')}`);
            logger.warn(`   Stripe checkout will not work until env vars are configured.`);
        }
    }

    // 2. Validate Plan Seeding in DB
    // Check for the PlanCodes defined in the Prisma enum (CORE, OPS, ENTERPRISE)
    const requiredPlanCodes = Object.values(PrismaPlanCode);
    const existingPlans = await prisma.plan.findMany({
        where: {
            code: { in: requiredPlanCodes }
        },
        select: { code: true }
    });

    const existingCodes = new Set(existingPlans.map(p => p.code));
    const missingCodes = requiredPlanCodes.filter(code => !existingCodes.has(code));

    if (missingCodes.length > 0) {
        if (isProduction) {
            logger.error(`❌ Missing Plan records in DB for codes: ${missingCodes.join(', ')}`);
            logger.error(`   Please run the seed script to populate plans.`);
            throw new Error('Billing configuration validation failed: Missing Plan records');
        } else {
            logger.warn(`⚠️  Missing Plan records in DB (OK for dev): ${missingCodes.join(', ')}`);
            logger.warn(`   Run 'npx prisma db seed' inside the API container to create plans.`);
        }
    }

    logger.log('✅ Billing configuration validated');
}
