import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class PauseSubscriptionDto {
  @ApiPropertyOptional({ description: 'Reason for pausing (optional)' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResumeSubscriptionDto {
  @ApiPropertyOptional({ description: 'Note about resuming (optional)' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional({ description: 'Reason for canceling (optional)' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UncancelSubscriptionDto {
  @ApiPropertyOptional({ description: 'Optional note when undoing cancellation' })
  @IsOptional()
  @IsString()
  note?: string;
}

