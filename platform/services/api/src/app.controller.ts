import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Root')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  getHealth() {
    return { status: 'ok' };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'API root endpoint' })
  getApiRoot() {
    return {
      message: 'Sako API v1',
      version: '1.0.0',
      status: 'running',
      docs: '/api/docs',
      endpoints: {
        workspace: '/api/v1/workspace',
        brands: '/api/v1/brands',
        tasks: '/api/v1/tasks',
        subscription: '/api/v1/subscription',
        studio: '/api/v1/studio',
        admin: '/api/v1/admin/tasks',
      },
    };
  }

  @Public()
  @Get('debug-sentry')
  @ApiOperation({ summary: 'Test Sentry error tracking (dev only)' })
  getError() {
    throw new Error('Sentry test error - this is intentional!');
  }
}
