import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiSecurity, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { WorkspaceId } from '../common/decorators/workspace.decorator';
import { TaskService } from './task.service';
import { StorageService } from '../common/storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Task Attachments')
@ApiSecurity('workspace-header')
@Controller()
export class TaskAttachmentController {
  constructor(
    private taskService: TaskService,
    private storageService: StorageService,
    private prisma: PrismaService,
  ) { }

  @Post('tasks/:taskId/attachments')
  @ApiOperation({ summary: 'Upload attachment to task' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 50 }), // 50MB
          // Allow any file type - clients can upload anything
        ],
      }),
    )
    file: any,
  ) {
    try {
      // Verify task ownership
      const task = await this.taskService.getTask(workspaceId, taskId);

      // Upload to S3 (this will throw ServiceUnavailableException if storage not configured)
      const { url } = await this.storageService.uploadFile(file, `workspaces/${workspaceId}/tasks/${taskId}`);

      // Create attachment record
      const attachment = await this.prisma.attachment.create({
        data: {
          taskId,
          url,
          kind: 'REFERENCE', // Default kind, could be passed in body
        },
      });

      return attachment;
    } catch (error) {
      // Log with context for debugging
      if (error.status === 503) {
        // ServiceUnavailableException - storage not configured
        throw error; // Re-throw as-is
      } else if (error.status === 404) {
        // Task not found
        throw error;
      } else {
        // Unexpected error - log with full context
        console.error('[AttachmentUpload] Unexpected error:', {
          workspaceId,
          taskId,
          fileName: file?.originalname,
          fileSize: file?.size,
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }
  }

  @Get('tasks/:taskId/attachments')
  @ApiOperation({ summary: 'List attachments for task' })
  async listAttachments(
    @WorkspaceId() workspaceId: string,
    @Param('taskId') taskId: string,
  ) {
    await this.taskService.getTask(workspaceId, taskId);

    const attachments = await this.prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });

    // Generate signed URLs for private files
    // We assume all files are private now.
    // If we want to keep persistent URLs for public files, we'd need a flag.
    // But for now, let's sign them all.
    const signedAttachments = await Promise.all(attachments.map(async (att) => {
      const keyMatch = att.url.match(/(workspaces\/.*)/);
      if (keyMatch && keyMatch[1]) {
        const signedUrl = await this.storageService.getSignedUrl(keyMatch[1]);
        return { ...att, url: signedUrl, originalUrl: att.url };
      }
      return att;
    }));

    return signedAttachments;
  }

  @Delete('attachments/:id')
  @ApiOperation({ summary: 'Delete attachment' })
  async deleteAttachment(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
  ) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: { task: true },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // Verify ownership via task
    if (attachment.task.workspaceId !== workspaceId) {
      throw new NotFoundException('Attachment not found');
    }

    // Delete from S3
    const keyMatch = attachment.url.match(/(workspaces\/.*)/);
    if (keyMatch && keyMatch[1]) {
      try {
        await this.storageService.deleteFile(keyMatch[1]);
      } catch (error) {
        console.error(`Failed to delete file from S3: ${error.message}`);
      }
    }

    await this.prisma.attachment.delete({
      where: { id },
    });

    return { success: true };
  }
}

