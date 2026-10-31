import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Patch,
  Body,
  BadRequestException,
  Delete,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { TaskService } from './task.service';
import { TaskQueryDto, UpdateTaskDto } from './dto/task.dto';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { ReviewAssetType, ReviewRevisionStatus } from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';

@ApiTags('Tasks (Admin/Studio)')
@AdminOnly()
@BypassWorkspaceMember()
@BypassSubscription()
@Controller('admin/tasks')
export class AdminTaskController {
  private readonly logger = new Logger(AdminTaskController.name);
  constructor(
    private taskService: TaskService,
    private prisma: PrismaService,
    private storageService: StorageService,
  ) { }

  @Get()
  @ApiOperation({
    summary: 'List tasks (admin view)',
    description: 'Returns tasks for workspace with admin filters',
  })
  async listTasks(
    @Query() query: TaskQueryDto,
  ) {
    // Admin list defaults to all workspaces unless scoped via query.workspaceId
    if ((query as any).workspaceId) {
      return this.taskService.listTasks((query as any).workspaceId, query);
    }
    // Fallback: list tasks across all workspaces (limited)
    const tasks = await this.prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      take: query.limit || 50,
    });
    return {
      items: tasks,
      nextCursor: null,
      hasMore: false,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get task detail (admin view)',
  })
  async getTask(
    @Param('id') taskId: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { workspaceId: true },
    });
    if (!task) throw new BadRequestException('Task not found');
    return this.taskService.getTask(task.workspaceId, taskId);
  }

  @Post(':id/start')
  @ApiOperation({
    summary: 'Start task (admin: QUEUED -> IN_PROGRESS)',
    description: `
      Moves task from QUEUED to IN_PROGRESS.
      
      Business rules enforced:
      - Subscription must be ACTIVE
      - Task must be in QUEUED status
      - Active task limit must not be exceeded
      - Active tasks = count of IN_PROGRESS tasks only
    `,
  })
  async startTask(
    @Param('id') taskId: string,
  ) {
    const workspaceId = await this.getWorkspaceId(taskId);
    return this.taskService.startTaskAsAdmin(workspaceId, taskId);
  }

  @Post(':id/review')
  @ApiOperation({
    summary: 'Move to review (admin: IN_PROGRESS -> IN_REVIEW)',
    description: 'Submits work for client review. Only allowed if task is IN_PROGRESS.',
  })
  async moveToReview(
    @Param('id') taskId: string,
  ) {
    const workspaceId = await this.getWorkspaceId(taskId);
    return this.taskService.moveToReview(workspaceId, taskId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update task (admin)',
    description: 'Admin can edit any task fields (future: may need special permissions)',
  })
  async updateTask(
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    // Admin update - bypass some client restrictions
    // For now, use same service method but note this is admin context
    const workspaceId = await this.getWorkspaceId(taskId);
    return this.taskService.updateTask(workspaceId, taskId, dto, 'STUDIO');
  }

  @Post(':id/mark-ai-ineligible')
  @ApiOperation({
    summary: 'Mark task as AI ineligible (admin)',
    description: 'Marks a task as ineligible for AI processing with an optional reason',
  })
  async markAiIneligible(
    @Param('id') taskId: string,
    @Body() body: { reason?: string },
  ) {
    const workspaceId = await this.getWorkspaceId(taskId);
    return this.taskService.markAiIneligible(workspaceId, taskId, body.reason);
  }

  @Post(':id/approve-scope')
  @ApiOperation({
    summary: 'Approve task scope (admin)',
    description: 'Approves a task scope, marking it as AI eligible and creating an admin decision comment visible to the client',
  })
  async approveTaskScope(
    @Param('id') taskId: string,
    @Body() body: { message?: string },
  ) {
    const workspaceId = await this.getWorkspaceId(taskId);
    return this.taskService.approveTaskScope(workspaceId, taskId, body.message);
  }

  @Post(':id/reject-scope')
  @ApiOperation({
    summary: 'Reject task scope (admin)',
    description: 'Rejects a task scope with a reason, marking it as AI ineligible and creating an admin decision comment visible to the client',
  })
  async rejectTaskScope(
    @Param('id') taskId: string,
    @Body() body: { reason: string },
  ) {
    if (!body.reason) {
      throw new BadRequestException('Reason is required when rejecting scope');
    }
    const workspaceId = await this.getWorkspaceId(taskId);
    return this.taskService.rejectTaskScope(workspaceId, taskId, body.reason);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete task (only if QUEUED)',
    description: 'Permanently removes a task. Only allowed if status is QUEUED.',
  })
  async deleteTask(
    @Param('id') taskId: string,
  ) {
    const workspaceId = await this.getWorkspaceId(taskId);
    return this.taskService.deleteTask(workspaceId, taskId);
  }

  /**
   * Upload a deliverable/review asset (admin) via file upload to R2/S3.
   */
  @Post(':id/deliverables')
  @ApiOperation({ summary: 'Upload deliverable for review (admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        type: { type: 'string', enum: Object.values(ReviewAssetType) },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDeliverable(
    @Param('id') taskId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 100 }), // 100MB
          // Allow common image/video/document types + application/json + application/octet-stream (for .riv files)
          new FileTypeValidator({ 
            fileType: /(image\/(png|jpeg|jpg|webp|gif)|application\/pdf|video\/(mp4|webm|quicktime|x-msvideo)|application\/json|application\/octet-stream|application\/zip)/ 
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: any,
    @Body() body: { title?: string; type?: ReviewAssetType; reason?: string },
    @CurrentUser() user: AuthUser,
  ) {
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { workspaceId: true },
      });
      if (!task) {
        throw new BadRequestException('Task not found');
      }

      // Upload file to storage
      const { url } = await this.storageService.uploadFile(
        file,
        `workspaces/${task.workspaceId}/tasks/${taskId}/deliverables`,
      );

      const type = body?.type || this.inferAssetTypeFromFilename(file?.originalname || url);
      const title = body?.title || file?.originalname || this.extractTitleFromUrl(url);

      const asset = await this.prisma.reviewAsset.create({
        data: {
          taskId,
          type,
          title,
          sourceUrl: url,
          createdById: user?.id,
          revisions: {
            create: {
              label: 'Rev 1',
              isCurrent: true,
              status: ReviewRevisionStatus.IN_REVIEW,
              fileUrl: url,
              createdById: user?.id,
              // reason is intentionally optional; omit if not provided
              ...(body?.reason ? { reason: body.reason } : {}),
            },
          },
        },
        include: { revisions: true },
      });

      return asset;
    } catch (error) {
      this.logger.error(
        `Failed to upload deliverable for task ${taskId}`,
        (error as any)?.stack || String(error),
      );
      // Ensure Prisma errors and others are visible in Sentry
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Add a link-based deliverable (Figma, Lottie, external URL, etc.)
   */
  @Post(':id/deliverables/link')
  @ApiOperation({ summary: 'Add link deliverable for review (admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to the deliverable (Figma link, video URL, etc.)' },
        title: { type: 'string', description: 'Optional title for the deliverable' },
        type: { type: 'string', enum: Object.values(ReviewAssetType), description: 'Asset type' },
      },
      required: ['url'],
    },
  })
  async addLinkDeliverable(
    @Param('id') taskId: string,
    @Body() body: { url: string; title?: string; type?: ReviewAssetType },
    @CurrentUser() user: AuthUser,
  ) {
    try {
      if (!body.url) {
        throw new BadRequestException('URL is required');
      }

      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { workspaceId: true },
      });
      if (!task) {
        throw new BadRequestException('Task not found');
      }

      const type = body.type || this.inferAssetTypeFromFilename(body.url);
      const title = body.title || this.extractTitleFromUrl(body.url);

      const asset = await this.prisma.reviewAsset.create({
        data: {
          taskId,
          type,
          title,
          sourceUrl: body.url,
          createdById: user?.id,
          revisions: {
            create: {
              label: 'Rev 1',
              isCurrent: true,
              status: ReviewRevisionStatus.IN_REVIEW,
              fileUrl: body.url,
              createdById: user?.id,
            },
          },
        },
        include: { revisions: true },
      });

      return asset;
    } catch (error) {
      this.logger.error(
        `Failed to add link deliverable for task ${taskId}`,
        (error as any)?.stack || String(error),
      );
      Sentry.captureException(error);
      throw error;
    }
  }

  private async getWorkspaceId(taskId: string): Promise<string> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { workspaceId: true },
    });
    if (!task) {
      throw new BadRequestException('Task not found');
    }
    return task.workspaceId;
  }

  private inferAssetTypeFromFilename(filename: string): ReviewAssetType {
    // Strip query params from URL if present
    const cleanFilename = (filename || '').split('?')[0].toLowerCase();
    if (cleanFilename.includes('figma.com')) return ReviewAssetType.FIGMA;
    if (cleanFilename.endsWith('.pdf')) return ReviewAssetType.PDF;
    if (cleanFilename.endsWith('.mp4') || cleanFilename.endsWith('.mov') || cleanFilename.endsWith('.webm')) return ReviewAssetType.VIDEO;
    // Lottie detection - includes lottie.host and lottiefiles.com
    if (cleanFilename.includes('lottie.host') || cleanFilename.includes('lottiefiles.com') || cleanFilename.endsWith('.json') || cleanFilename.endsWith('.lottie')) return ReviewAssetType.LOTTIE;
    // Rive detection - includes cdn.rive.app
    if (cleanFilename.endsWith('.riv') || cleanFilename.includes('rive.app') || cleanFilename.includes('cdn.rive.app')) return ReviewAssetType.RIVE;
    if (cleanFilename.match(/\.(png|jpg|jpeg|gif|webp)$/)) return ReviewAssetType.IMAGE;
    return ReviewAssetType.EMBED;
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const parts = url.split('/');
      const last = parts[parts.length - 1];
      return decodeURIComponent(last || 'Asset');
    } catch {
      return 'Asset';
    }
  }
}
