import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import { CreateCommentDto } from '../task/dto/task.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';

@ApiTags('Studio Task Comments')
@ApiBearerAuth()
@AdminOnly()
@BypassWorkspaceMember()
@BypassSubscription()
@Controller('studio/tasks/:taskId/comments')
export class StudioTaskCommentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
  ) { }

  @Get()
  @ApiOperation({ summary: 'List comments for a task (studio/admin bypasses subscription)' })
  async listComments(@Param('taskId') taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { workspaceId: true },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return this.taskService.listComments(task.workspaceId, taskId);
  }

  @Post()
  @ApiOperation({ summary: 'Add comment to a task (studio/admin)' })
  async createComment(
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { workspaceId: true },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return this.taskService.createComment(task.workspaceId, taskId, dto, user?.id);
  }
}
