import { Controller, Get, Post, Patch, Param, Body, Query, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReviewService, CreateAssetDto, CreateRevisionDto, CreateAnnotationDto } from './review.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { StorageService } from '../common/storage/storage.service';
import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { ReviewAssetType, ReviewAnnotationKind } from '@prisma/client';

class CreateAssetBodyDto {
  @IsEnum(ReviewAssetType)
  type: ReviewAssetType;

  @IsString()
  title: string;

  @IsString()
  sourceUrl: string;
}

class CreateRevisionBodyDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

class CreateAnnotationBodyDto {
  @IsEnum(ReviewAnnotationKind)
  kind: ReviewAnnotationKind;

  @IsString()
  text: string;

  @IsObject()
  payload: Record<string, any>;

  @IsString()
  @IsOptional()
  parentId?: string;
}

class ReplyBodyDto {
  @IsString()
  text: string;
}

class RequestChangesBodyDto {
  @IsString()
  feedback: string;
}

@ApiTags('Review Board')
@ApiBearerAuth()
@Controller('tasks/:taskId')
@BypassWorkspaceMember() // Access is checked in service
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) { }

  @Get('review-board')
  @BypassSubscription()
  @ApiOperation({ summary: 'Get the review board for a task' })
  async getReviewBoard(
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const isAdmin = user.role === 'ADMIN' || user.isSuperAdmin === true;
    return this.reviewService.getReviewBoard(taskId, user.id, isAdmin);
  }

  @Post('assets')
  @BypassSubscription()
  @ApiOperation({ summary: 'Create a new review asset for a task' })
  async createAsset(
    @Param('taskId') taskId: string,
    @Body() dto: CreateAssetBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviewService.createAsset(taskId, dto, user.id);
  }
}

@ApiTags('Review Board - Assets')
@ApiBearerAuth()
@Controller('assets/:assetId')
@BypassWorkspaceMember()
@BypassSubscription()
export class ReviewAssetController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly storageService: StorageService,
  ) { }

  @Post('revisions')
  @ApiOperation({ summary: 'Create a new revision for an asset' })
  async createRevision(
    @Param('assetId') assetId: string,
    @Body() dto: CreateRevisionBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviewService.createRevision(assetId, dto, user.id);
  }

  @Post('revisions/upload')
  @ApiOperation({ summary: 'Upload a file as a new revision for an asset' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadRevision(
    @Param('assetId') assetId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 }), // 100MB
          new FileTypeValidator({
            fileType: /(image\/(png|jpeg|jpg|webp|gif)|application\/pdf|video\/(mp4|webm|quicktime)|application\/json|application\/octet-stream)/,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    // Upload file to storage
    const uploaded = await this.storageService.uploadFile(file, 'revisions');

    // Create the revision with the uploaded URL
    return this.reviewService.createRevision(assetId, { fileUrl: uploaded.url }, user.id);
  }
}

@ApiTags('Review Board - Revisions')
@ApiBearerAuth()
@Controller('revisions/:revisionId')
@BypassWorkspaceMember()
@BypassSubscription()
export class ReviewRevisionController {
  constructor(private readonly reviewService: ReviewService) { }

  @Post('annotations')
  @ApiOperation({ summary: 'Create an annotation on a revision' })
  async createAnnotation(
    @Param('revisionId') revisionId: string,
    @Body() dto: CreateAnnotationBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviewService.createAnnotation(revisionId, dto, user.id);
  }

  @Post('request-changes')
  @ApiOperation({ summary: 'Request changes on a revision' })
  async requestChanges(
    @Param('revisionId') revisionId: string,
    @Body() dto: RequestChangesBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviewService.requestChanges(revisionId, dto.feedback, user.id);
  }

  @Post('mark-completed')
  @ApiOperation({ summary: 'Mark a revision as completed/approved' })
  async markCompleted(
    @Param('revisionId') revisionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviewService.markCompleted(revisionId, user.id);
  }
}

@ApiTags('Review Board - Annotations')
@ApiBearerAuth()
@Controller('annotations/:annotationId')
@BypassWorkspaceMember()
@BypassSubscription()
export class ReviewAnnotationController {
  constructor(private readonly reviewService: ReviewService) { }

  @Patch('resolve')
  @ApiOperation({ summary: 'Resolve an annotation' })
  async resolveAnnotation(
    @Param('annotationId') annotationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviewService.resolveAnnotation(annotationId, user.id);
  }

  @Patch('unresolve')
  @ApiOperation({ summary: 'Unresolve an annotation' })
  async unresolveAnnotation(
    @Param('annotationId') annotationId: string,
  ) {
    return this.reviewService.unresolveAnnotation(annotationId);
  }

  @Post('reply')
  @ApiOperation({ summary: 'Reply to an annotation' })
  async replyToAnnotation(
    @Param('annotationId') annotationId: string,
    @Body() dto: ReplyBodyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviewService.replyToAnnotation(annotationId, dto.text, user.id);
  }
}
