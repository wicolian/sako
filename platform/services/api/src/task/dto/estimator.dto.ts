import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray, MinLength } from 'class-validator';
import { TaskCategory } from '@prisma/client';

// Request DTO
export class EstimateTaskDto {
  @ApiProperty({ description: 'Task title', minLength: 4 })
  @IsString()
  @MinLength(4)
  title: string;

  @ApiProperty({ description: 'Task description', minLength: 10 })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiPropertyOptional({ description: 'Tags for the task', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: TaskCategory, description: 'Task category (DESIGN or MOTION)' })
  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  @ApiPropertyOptional({ description: 'Brand ID (optional)' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Structured brief JSON' })
  @IsOptional()
  structuredBriefJson?: any;
}

// Response DTO
export class TaskEstimatorResponseDto {
  @ApiProperty({ description: 'Estimated effort in hours (8-80, clamped)', example: 24 })
  estimatedEffortHours: number;

  @ApiProperty({ description: 'Display SLA in hours (24-standardSlaHours, clamped)', example: 48 })
  displaySlaHours: number;

  @ApiProperty({ enum: ['simple', 'complex', 'unsupported'], description: 'Complexity category' })
  complexity: 'simple' | 'complex' | 'unsupported';

  @ApiProperty({ description: 'Complexity score (1-10)', example: 6 })
  complexityScore: number;

  @ApiProperty({ description: 'Whether AI tools can support this task', example: true })
  isAiSupported: boolean;

  @ApiProperty({ description: 'Reason if unsupported', nullable: true, example: null })
  unsupportedReason: string | null;

  @ApiProperty({ description: 'Whether this fits standard 48h window', example: true })
  fits48hWindow: boolean;

  @ApiProperty({ description: 'Whether this should be flagged for admin review', example: false })
  flagForAdminReview: boolean;

  @ApiProperty({ description: 'Reason for flagging', nullable: true, example: null })
  flagReason: string | null;

  @ApiProperty({ description: 'Recommended number of subtasks to split into', example: 1 })
  recommendedSplitCount: number;

  @ApiProperty({ description: 'List of suggested subtasks', type: [String], example: ['Design hero section', 'Create mobile variations'] })
  suggestedSubtasks: string[];

  @ApiProperty({ description: 'Questions to improve the brief', type: [String], example: ['What is the target platform?'] })
  missingInfoQuestions: string[];

  @ApiProperty({ description: 'Whether AI help is recommended', example: true })
  aiHelpRecommended: boolean;

  @ApiProperty({ description: 'Reason for AI help recommendation', example: 'AI tools like Midjourney can accelerate concept exploration.' })
  aiHelpReason: string;

  @ApiProperty({ description: 'Reasoning behind the estimate' })
  reasoning: string;
}

// Internal type for model output (raw, before clamping)
export type TaskEstimatorResult = {
  estimated_effort_hours: number;
  display_sla_hours: number;
  complexity: 'simple' | 'complex' | 'unsupported';
  complexity_score: number;
  is_ai_supported: boolean;
  unsupported_reason: string | null;
  fits_48h_window: boolean;
  flag_for_admin_review: boolean;
  flag_reason: string | null;
  recommended_split_count: number;
  suggested_subtasks: string[];
  missing_info_questions: string[];
  ai_help_recommended: boolean;
  ai_help_reason: string;
  reasoning: string;
};

