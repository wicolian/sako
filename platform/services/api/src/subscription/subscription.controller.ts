import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { WorkspaceId } from '../common/decorators/workspace.decorator';
import { SubscriptionService } from './subscription.service';
import { PauseSubscriptionDto, ResumeSubscriptionDto, CancelSubscriptionDto, UncancelSubscriptionDto } from './dto/subscription.dto';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';

@ApiTags('Subscription')
@ApiSecurity('workspace-header')
@BypassSubscription() // allow pause/resume/cancel even when subscription is paused
@Controller('subscription')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);
  
  constructor(private subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({
    summary: 'Get subscription details',
    description: 'Returns subscription, plan, and derived values (effectiveActiveTaskLimit, effectiveSlaSeconds)',
  })
  async getSubscription(@WorkspaceId() workspaceId: string) {
    return this.subscriptionService.getSubscription(workspaceId);
  }

  @Post('pause')
  @ApiOperation({
    summary: 'Pause subscription',
    description: `
      HARD FREEZE on pause:
      - Blocks new task creation
      - Blocks all state transitions
      - SLA timers effectively stop
      - Day credits stop burning
      - All operations frozen until resumed
    `,
  })
  async pauseSubscription(
    @WorkspaceId() workspaceId: string,
    @Body() dto: PauseSubscriptionDto,
  ) {
    this.logger.log(`[POST /subscription/pause] Received request for workspace ${workspaceId}`);
    return this.subscriptionService.pauseSubscription(workspaceId, dto.reason);
  }

  @Post('resume')
  @ApiOperation({
    summary: 'Resume subscription',
    description: 'Restores subscription from PAUSED to ACTIVE. Operations allowed again.',
  })
  async resumeSubscription(
    @WorkspaceId() workspaceId: string,
    @Body() dto: ResumeSubscriptionDto,
  ) {
    return this.subscriptionService.resumeSubscription(workspaceId, dto.note);
  }

  @Post('cancel')
  @ApiOperation({
    summary: 'Cancel subscription',
    description: `
      Cancel subscription rules:
      - New tasks cannot be created
      - Do NOT auto-promote QUEUED tasks to IN_PROGRESS
      - Current IN_PROGRESS tasks can still be moved to IN_REVIEW (admin)
      - Current IN_REVIEW tasks can still be completed (client)
      - After billing end date, workspace becomes read-only (future)
    `,
  })
  async cancelSubscription(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.subscriptionService.cancelSubscription(workspaceId, dto.reason);
  }

  @Post('uncancel')
  @ApiOperation({
    summary: 'Undo cancellation (keep subscription)',
    description: `
      Clears cancel_at_period_end so the subscription renews normally.
      Use when a user changes their mind while in CANCEL_AT_PERIOD_END state.
    `,
  })
  async uncancelSubscription(
    @WorkspaceId() workspaceId: string,
    @Body() dto: UncancelSubscriptionDto,
  ) {
    return this.subscriptionService.uncancelSubscription(workspaceId, dto.note);
  }
}
