/**
 * Credits Controller
 * Internal endpoints for credit management and testing
 */

import {
  Controller,
  Post,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { DayCreditBurnService } from './day-credit-burn.service';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkspaceRole } from '@prisma/client';

@ApiTags('Credits')
@Roles(WorkspaceRole.OWNER) // internal-only endpoints
@Controller('credits')
export class CreditsController {
  private readonly logger = new Logger(CreditsController.name);

  constructor(private readonly dayCreditBurnService: DayCreditBurnService) {}

  /**
   * Require INTERNAL_API_TOKEN header outside of local dev to call these endpoints
   */
  private assertInternalToken(token?: string) {
    const requiredToken = process.env.INTERNAL_API_TOKEN;
    if (requiredToken) {
      if (token !== requiredToken) {
        throw new ForbiddenException('Invalid internal token');
      }
      return;
    }

    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('Internal token required');
    }
  }

  /**
   * Manually trigger day credit burn (for testing/development only)
   * 
   * **WARNING**: This endpoint should be removed or restricted in production.
   * In production, credit burning is handled automatically by the scheduled cron job.
   */
  @Post('burn-once')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Internal testing endpoint
  async burnCreditsManually(
    @Headers('x-internal-token') internalToken?: string,
  ): Promise<{
    processed: number;
    burned: number;
    skipped: number;
    errors: number;
  }> {
    this.assertInternalToken(internalToken);
    this.logger.warn('⚠️ Manual credit burn triggered (dev only)');
    return await this.dayCreditBurnService.burnForAllActiveSubscriptions();
  }

  /**
   * Check if a workspace is eligible for credit burn today
   * Useful for debugging
   */
  @Get('burn-eligible/:workspaceId')
  @ApiExcludeEndpoint() // Internal debug endpoint
  async checkBurnEligibility(
    @Param('workspaceId') workspaceId: string,
    @Headers('x-internal-token') internalToken?: string,
  ): Promise<{
    eligible: boolean;
    reason?: string;
  }> {
    this.assertInternalToken(internalToken);
    return await this.dayCreditBurnService.isBurnEligibleToday(workspaceId);
  }
}
