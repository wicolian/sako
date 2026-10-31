// IMPORTANT: Import instrument.ts at the top to initialize Sentry early
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateRequiredEnv } from './config/required-env';
import { validateBillingConfiguration } from './billing/billing-validation';
import { isSentryEnabled } from './instrument';

async function bootstrap() {
  // Validate required environment variables
  validateRequiredEnv();

  // Enable raw body for Stripe webhook signature verification
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Security headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disabled to allow Swagger UI and inline scripts
      crossOriginEmbedderPolicy: false, // Disabled for iframe embeds (review board, Figma)
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin resource loading
    }),
  );

  // Validate billing configuration (Stripe envs + DB plans)
  await validateBillingConfiguration(app);

  // Global Sentry Filter (only if Sentry is initialized)
  if (isSentryEnabled()) {
    const { HttpAdapterHost } = await import('@nestjs/core');
    const { SentryFilter } = await import('./common/filters/sentry.filter');
    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new SentryFilter(httpAdapter));
  }

  // Set global prefix for API routes
  app.setGlobalPrefix('api/v1');

  // Global validation pipe with whitelist and transform
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Enable CORS
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()) || [];

  // In development, allow localhost defaults
  if (process.env.NODE_ENV !== 'production') {
    const devOrigins = [
      'http://localhost:3000',
      'http://localhost:3002', // Composer
      'http://localhost:3003', // Composer fallback port
      'http://localhost:5173', // Client
      'http://localhost:5174', // Studio
    ];
    devOrigins.forEach(origin => {
      if (!corsOrigins.includes(origin)) {
        corsOrigins.push(origin);
      }
    });
  } else {
    // Production check
    if (corsOrigins.length === 0) {
      console.warn('⚠️  WARNING: CORS_ORIGINS is empty in production. API calls from browser may fail.');
    }
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const enableSwagger =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true';
  if (enableSwagger) {
    // Swagger API documentation (disabled in production by default)
    const config = new DocumentBuilder()
      .setTitle('Sako API')
      .setDescription('Sako platform API - Phase 1')
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', name: 'x-workspace-id', in: 'header' }, 'workspace-header')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Clerk JWT' }, 'bearer')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0'); // Bind to 0.0.0.0 for Docker compatibility
  console.log(`\n🚀 Sako API Server`);
  console.log(`   API: http://localhost:${port}/api/v1`);
  console.log(`   Docs: http://localhost:${port}/api/docs`);
  console.log(`\n💡 Run frontend apps separately:`);
  console.log(`   Studio: npm run dev:studio (http://localhost:3000)`);
  console.log(`   Client: npm run dev:client (http://localhost:5173)\n`);
}

bootstrap();
