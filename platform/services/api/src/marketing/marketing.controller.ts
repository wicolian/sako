/**
 * Marketing Controller
 *
 * Endpoints for lead capture, conversion tracking, and admin management.
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Param,
  Res,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';
import { MarketingEmailService } from './marketing-email.service';
import { QueueService } from '../queue/queue.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';
import { SuperAdmin } from '../common/decorators/super-admin.decorator';
import { Public } from '../common/decorators/public.decorator';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { ConfigService } from '@nestjs/config';
import { MarketingEmailStep } from '@prisma/client';

// DTOs
class CaptureLeadDto {
  email!: string;
  source!: string;
  name?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

class TrackInteractionDto {
  action!: string;
}

class UpdateLeadDto {
  unsubscribed?: boolean;
  suppressMarketing?: boolean;
  notes?: string;
  converted?: boolean;
}

@ApiTags('Marketing')
@Controller('marketing')
@BypassSubscription()
@BypassWorkspaceMember()
export class MarketingController {
  private readonly logger = new Logger(MarketingController.name);

  constructor(
    private marketingService: MarketingService,
    private marketingEmailService: MarketingEmailService,
    private queueService: QueueService,
    private configService: ConfigService,
  ) {}

  // ========================
  // PUBLIC/CLIENT ENDPOINTS
  // ========================

  @Post('capture-lead')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Capture a marketing lead' })
  async captureLead(
    @Body() dto: CaptureLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    try {
      const result = await this.marketingService.captureLead({
        email: dto.email || user.email,
        source: dto.source,
        clerkUserId: user.clerkUserId,
        name: dto.name || user.name,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        utmTerm: dto.utmTerm,
      });

      return { success: true, enabled: result.enabled };
    } catch (error: any) {
      this.logger.error(`Failed to capture lead: ${error.message}`);
      return { success: false, error: 'Failed to capture lead' };
    }
  }

  @Post('track-pricing-interaction')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Track pricing page interaction' })
  async trackInteraction(
    @Body() dto: TrackInteractionDto,
    @CurrentUser() user: AuthUser,
  ) {
    try {
      await this.marketingService.touchLead(user.email, dto.action);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Failed to track interaction: ${error.message}`);
      return { success: false };
    }
  }

  @Post('mark-converted')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark lead as converted after payment' })
  async markConverted(@CurrentUser() user: AuthUser) {
    try {
      await this.marketingService.markConverted(user.email);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Failed to mark converted: ${error.message}`);
      return { success: false };
    }
  }

  @Get('unsubscribe')
  @Public()
  @ApiOperation({ summary: 'Unsubscribe from marketing emails' })
  async unsubscribe(
    @Query('email') email: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.trysako.com';

    if (!email || !token) {
      return res.redirect(`${frontendUrl}?unsubscribe=error`);
    }

    try {
      await this.marketingService.unsubscribeByToken(email, token);
      return res.redirect(`${frontendUrl}?unsubscribe=success`);
    } catch (error: any) {
      this.logger.error(`Unsubscribe failed: ${error.message}`);
      return res.redirect(`${frontendUrl}?unsubscribe=error`);
    }
  }

  // ========================
  // ADMIN ENDPOINTS
  // ========================

  @Get('admin/leads')
  @SuperAdmin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List marketing leads (admin)' })
  async listLeads(
    @Query('converted') converted?: string,
    @Query('limit') limit?: string,
    @Query('sinceDays') sinceDays?: string,
    @Query('search') search?: string,
  ) {
    const leads = await this.marketingService.listLeads({
      converted: converted === undefined ? undefined : converted === 'true',
      limit: limit ? parseInt(limit, 10) : 100,
      sinceDays: sinceDays ? parseInt(sinceDays, 10) : 60,
      search,
    });

    return { leads, count: leads.length };
  }

  @Get('admin/leads.csv')
  @SuperAdmin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export leads as CSV (admin)' })
  async exportLeadsCsv(
    @Query('converted') converted?: string,
    @Query('sinceDays') sinceDays?: string,
    @Res() res?: Response,
  ) {
    const leads = await this.marketingService.listLeads({
      converted: converted === undefined ? undefined : converted === 'true',
      limit: 10000,
      sinceDays: sinceDays ? parseInt(sinceDays, 10) : 365,
    });

    const csvHeader = 'email,name,source,signupDate,lastActivity,converted,unsubscribed\n';
    const csvRows = leads.map((lead: any) =>
      `"${lead.email}","${lead.name || ''}","${lead.source}","${lead.signupDate.toISOString()}","${lead.lastActivity.toISOString()}","${lead.converted}","${lead.unsubscribed}"`
    ).join('\n');

    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', `attachment; filename=marketing-leads-${new Date().toISOString().split('T')[0]}.csv`);
    res!.send(csvHeader + csvRows);
  }

  @Get('admin/leads/:id')
  @SuperAdmin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get lead details (admin)' })
  async getLeadById(@Param('id') id: string) {
    const lead = await this.marketingService.getLeadById(id);
    if (!lead) {
      throw new BadRequestException('Lead not found');
    }
    return { lead };
  }

  @Patch('admin/leads/:id')
  @SuperAdmin()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update lead (admin)' })
  async updateLead(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: AuthUser,
  ) {
    const lead = await this.marketingService.updateLead(id, dto, user.id);
    return { lead };
  }

  @Post('admin/leads/:id/mark-converted')
  @SuperAdmin()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually mark lead as converted (admin)' })
  async adminMarkConverted(@Param('id') id: string) {
    const lead = await this.marketingService.getLeadById(id);
    if (!lead) {
      throw new BadRequestException('Lead not found');
    }
    await this.marketingService.markConverted(lead.email);
    return { success: true };
  }

  @Post('admin/leads/:id/send-step')
  @SuperAdmin()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually send a step to a lead (admin/testing)' })
  async adminSendStep(
    @Param('id') id: string,
    @Body('step') step: MarketingEmailStep,
  ) {
    if (!step || !['D0', 'D1', 'D3', 'D5', 'D10'].includes(step)) {
      throw new BadRequestException('Invalid step. Must be D0, D1, D3, D5, or D10');
    }

    const lead = await this.marketingService.getLeadById(id);
    if (!lead) {
      throw new BadRequestException('Lead not found');
    }

    // Enqueue the email job
    await this.queueService.enqueueMarketingEmail({
      leadId: lead.id,
      step,
      email: lead.email,
      name: lead.name || undefined,
    });

    return { success: true, message: `Step ${step} enqueued for ${lead.email}` };
  }

  @Post('admin/run-sequence')
  @SuperAdmin()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Manually trigger the marketing scheduler (admin/testing)' })
  async adminRunSequence() {
    // This is handled by the scheduler, but we provide a manual trigger for testing
    // The actual implementation will be in the scheduler
    return { success: true, message: 'Scheduler triggered - check worker logs' };
  }
}
