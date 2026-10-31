import { Controller, Get, Param, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { OptionalWorkspaceId } from '../common/decorators/workspace.decorator';
import { StudioService } from './studio.service';
import { SuperAdmin } from '../common/decorators/super-admin.decorator';
import { BypassWorkspaceMember } from '../common/decorators/bypass-workspace-member.decorator';
import { BypassSubscription } from '../billing/decorators/bypass-subscription.decorator';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { TaskService } from '../task/task.service';
import { CreateCommentDto } from '../task/dto/task.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';
import { CommentKind } from '@prisma/client';

@ApiTags('Studio')
@ApiSecurity('workspace-header')
@SuperAdmin()
@BypassWorkspaceMember()
@BypassSubscription()
@Controller('studio')
export class StudioController {
  constructor(
    private studioService: StudioService,
    private prisma: PrismaService,
    private taskService: TaskService,
  ) {}

  @Get('clients')
  @ApiOperation({
    summary: 'List all workspaces/clients',
    description: `
      Returns list of all workspaces with summary data:
      - id, name, slug
      - planCode
      - subscriptionStatus
      - activeTaskCount (IN_PROGRESS)
      - queuedTaskCount
    `,
  })
  async listClients() {
    return this.studioService.listClients();
  }

  @Get('clients/:workspaceId')
  @ApiOperation({
    summary: 'Get client detail',
    description: `
      Returns detailed view of a specific workspace:
      - workspace info
      - plan and subscription
      - task counts by status
      - recent tasks (last 10)
      - credit summaries
    `,
  })
  async getClientDetail(@Param('workspaceId') workspaceId: string) {
    return this.studioService.getClientDetail(workspaceId);
  }

  @Get('tasks')
  @ApiOperation({
    summary: 'List tasks (studio view)',
    description: `
      Returns tasks across all workspaces (or scoped to workspace via header).
      For now, limited to 100 most recent/relevant tasks.
    `,
  })
  async listTasks(@OptionalWorkspaceId() workspaceId: string | null) {
    return this.studioService.listTasks(workspaceId || undefined);
  }

  @Get('tasks/:taskId')
  @ApiOperation({
    summary: 'Get task detail (studio view)',
  })
  async getTaskDetail(@Param('taskId') taskId: string) {
    return this.studioService.getTaskById(taskId);
  }

  @Get('tasks/:taskId/comments')
  @AdminOnly()
  @BypassWorkspaceMember()
  @BypassSubscription()
  @ApiOperation({ summary: 'List comments for a task (studio/admin bypass subscription)' })
  async listTaskComments(
    @Param('taskId') taskId: string,
    @Query('kind') kind?: CommentKind,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { workspaceId: true },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return this.taskService.listComments(task.workspaceId, taskId, kind);
  }

  @Post('tasks/:taskId/comments')
  @AdminOnly()
  @BypassWorkspaceMember()
  @BypassSubscription()
  @ApiOperation({ summary: 'Create comment on a task (studio/admin bypass subscription)' })
  async createTaskComment(
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

  @Get('metrics')
  @ApiOperation({
    summary: 'Get aggregated metrics for Studio dashboard',
    description:
      'Returns key performance metrics (tasks completed, average turnaround, FPAR) across all workspaces.',
  })
  async getStudioMetrics() {
    return this.studioService.getAggregatedMetrics();
  }
}
