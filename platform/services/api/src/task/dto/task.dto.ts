import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean, MaxLength, IsInt, Min } from 'class-validator';
import { TaskCategory, TaskStatus, CommentKind } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Task description' })
  @IsString()
  description: string;

  @ApiProperty({ enum: TaskCategory, description: 'Task category (DESIGN or MOTION)' })
  @IsEnum(TaskCategory)
  category: TaskCategory;

  @ApiPropertyOptional({ description: 'Brand ID (optional)' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Use AI assistance (consumes AI credits)', default: false })
  @IsOptional()
  @IsBoolean()
  useAI?: boolean;

  @ApiPropertyOptional({ description: 'Structured brief JSON' })
  @IsOptional()
  structuredBriefJson?: any;

  @ApiPropertyOptional({ description: 'Reference links JSON' })
  @IsOptional()
  referenceLinksJson?: any;

  @ApiPropertyOptional({ description: 'Deliverables JSON' })
  @IsOptional()
  deliverablesJson?: any;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'Task title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Task description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskCategory, description: 'Task category' })
  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  @ApiPropertyOptional({ description: 'Brand ID' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ enum: TaskStatus, description: 'Task status' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}

export class RequestRevisionDto extends UpdateTaskDto {
  @ApiPropertyOptional({ description: 'Feedback for requested changes' })
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment body' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ enum: CommentKind, description: 'Comment kind', default: CommentKind.COMMENT })
  @IsOptional()
  @IsEnum(CommentKind)
  kind?: CommentKind;
}

export class TaskQueryDto {
  @ApiPropertyOptional({ enum: TaskStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Search query' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page size', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Cursor for pagination (task ID)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sort?: 'asc' | 'desc';
}

// ========================================
// TASK DRAFTS
// ========================================

export class SaveTaskDraftDto {
  @ApiPropertyOptional({ description: 'Draft ID (for updates, omit for new draft)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ description: 'Task title' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Task description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskCategory, description: 'Task category (DESIGN or MOTION)' })
  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;

  @ApiPropertyOptional({ description: 'Brand ID' })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Use AI assistance', default: false })
  @IsOptional()
  @IsBoolean()
  useAI?: boolean;

  @ApiPropertyOptional({ description: 'Structured brief JSON' })
  @IsOptional()
  structuredBriefJson?: any;

  @ApiPropertyOptional({ description: 'Reference links JSON' })
  @IsOptional()
  referenceLinksJson?: any;

  @ApiPropertyOptional({ description: 'Deliverables JSON' })
  @IsOptional()
  deliverablesJson?: any;
}
