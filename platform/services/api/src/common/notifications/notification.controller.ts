import { Controller, Get, Patch, Param, Query, Post, Body, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { NotificationService, NotificationPreferenceDto, NotificationEventType } from './notification.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthUser } from '../../auth/clerk.config';
import { BypassWorkspaceMember } from '../decorators/bypass-workspace-member.decorator';
import { BypassSubscription } from '../../billing/decorators/bypass-subscription.decorator';
import { IsEnum, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class UpdateNotificationPreferenceDto {
  @ApiProperty({ enum: NotificationEventType })
  @IsEnum(NotificationEventType)
  eventType: NotificationEventType;

  @ApiProperty()
  @IsBoolean()
  emailEnabled: boolean;

  @ApiProperty()
  @IsBoolean()
  slackEnabled: boolean;

  @ApiProperty()
  @IsBoolean()
  inAppEnabled: boolean;
}

class UpdateNotificationPreferencesDto {
  @ApiProperty({ type: [UpdateNotificationPreferenceDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateNotificationPreferenceDto)
  preferences: UpdateNotificationPreferenceDto[];
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@BypassWorkspaceMember() // Notifications are user-level, not workspace-specific
@BypassSubscription()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for the current user' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  async getNotifications(
    @CurrentUser() user: AuthUser,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationService.getNotifications(user.id, {
      limit: limit ? parseInt(limit, 10) : 20,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for the current user' })
  async getPreferences(@CurrentUser() user: AuthUser) {
    return this.notificationService.getPreferences(user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences for the current user' })
  @ApiBody({ type: UpdateNotificationPreferencesDto })
  async updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationService.updatePreferences(user.id, dto.preferences);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.notificationService.markAsRead(id, user.id);
    return { success: true };
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: AuthUser) {
    await this.notificationService.markAllAsRead(user.id);
    return { success: true };
  }
}

