import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateTaskFromComposerDto {
  @ApiProperty({ description: 'ID of the Composer draft to link to the task' })
  @IsString()
  @IsNotEmpty()
  composerDraftId: string;

  @ApiPropertyOptional({ description: 'Title for the Studio task' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Description of what needs to be done' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Brand ID to link the task to' })
  @IsString()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Type of deliverable (e.g., LANDING_PAGE, DECK)' })
  @IsString()
  @IsOptional()
  deliverableType?: string;

  @ApiPropertyOptional({ description: 'Expected output description' })
  @IsString()
  @IsOptional()
  expectedOutput?: string;
}



