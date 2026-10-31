import { Controller, Post, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { TaskService } from '../task/task.service';

/**
 * Task actions for the studio (design team). Studio admins are usually not
 * members of the client's workspace, so these routes look up the task's
 * workspace and call the same task service the client routes use.
 */
@ApiTags('Admin - Tasks')
@ApiBearerAuth()
@Controller('admin/tasks')
@BypassWorkspaceMember()
@BypassSubscription()
export class AdminTasksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
  ) {}

  private async workspaceOf(taskId: string): Promise<string> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { workspaceId: true } });
    if (!task) throw new NotFoundException(`Task ${taskId} not found`);
    return task.workspaceId;
  }

  @Post(':id/complete')
  @AdminOnly()
  @ApiOperation({ summary: 'Mark a task completed (studio). Allowed from IN_REVIEW.' })
  async complete(@Param('id') taskId: string) {
    return this.taskService.completeTask(await this.workspaceOf(taskId), taskId);
  }

  @Post(':id/duplicate')
  @AdminOnly()
  @ApiOperation({ summary: 'Duplicate a task into the queue (studio).' })
  async duplicate(@Param('id') taskId: string) {
    return this.taskService.duplicateTask(await this.workspaceOf(taskId), taskId);
  }
}
