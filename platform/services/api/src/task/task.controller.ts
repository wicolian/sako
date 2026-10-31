import { Controller, Get, Post, Patch, Body, Param, Query, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { WorkspaceId } from '../common/decorators/workspace.decorator';
import { TaskService } from './task.service';
import { TaskEstimatorService } from './task-estimator.service';
import { CreateTaskDto, UpdateTaskDto, CreateCommentDto, TaskQueryDto, RequestRevisionDto, SaveTaskDraftDto } from './dto/task.dto';
import { EstimateTaskDto, TaskEstimatorResponseDto } from './dto/estimator.dto';
import { CommentKind } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';

@ApiTags('Tasks (Client)')
@ApiSecurity('workspace-header')
@Controller('tasks')
export class TaskController {
  constructor(
    private taskService: TaskService,
    private estimatorService: TaskEstimatorService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List tasks',
    description: 'Returns paginated tasks with filters (status, search)',
  })
  async listTasks(
    @WorkspaceId() workspaceId: string,
    @Query() query: TaskQueryDto,
  ) {
    return this.taskService.listTasks(workspaceId, query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create task',
    description: `
      Creates a new task with status QUEUED.
      
      Business rules enforced:
      - Subscription must be ACTIVE (not PAUSED or CANCELED)
      - Category must be allowed by plan
      - For CORE plan, category must match subscription mode (DESIGN_ONLY or MOTION_ONLY)
      - If useAI is true, AI credits will be consumed (TODO: phase 1 logs only)
    `,
  })
  async createTask(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskService.createTask(workspaceId, dto, user?.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get task detail',
    description: 'Returns full task with brand, comments, revisions, and attachments',
  })
  async getTask(
    @WorkspaceId() workspaceId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.getTask(workspaceId, taskId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update task (client)',
    description: `
      Updates a task. Behavior depends on current status:
      
      - QUEUED: simple update allowed
      - IN_REVIEW: treated as revision request (increments revisionNumber, logs revision, creates comment)
      - IN_PROGRESS or COMPLETED: rejected (client cannot edit)
    `,
  })
  async updateTask(
    @WorkspaceId() workspaceId: string,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    // TODO: Phase 2 - get authorId from authenticated user
    return this.taskService.updateTask(workspaceId, taskId, dto, 'CLIENT');
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Complete task (client)',
    description: `
      Marks task as COMPLETED. Only allowed if current status is IN_REVIEW.
      
      After completion, automatically starts next QUEUED task if:
      - Subscription is ACTIVE
      - Active task limit not reached
    `,
  })
  async completeTask(
    @WorkspaceId() workspaceId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.completeTask(workspaceId, taskId);
  }

  @Post(':id/request-revision')
  @ApiOperation({
    summary: 'Request revision (client)',
    description: `
      Requests revision on a task in IN_REVIEW status.
      
      Behavior:
      - Moves task from IN_REVIEW back to IN_PROGRESS
      - Increments revisionNumber
      - Enforces active task limit
      - Creates revision log and comment
      - Sends Slack notification
    `,
  })
  async requestRevision(
    @WorkspaceId() workspaceId: string,
    @Param('id') taskId: string,
    @Body() dto: RequestRevisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskService.requestRevision(workspaceId, taskId, dto, user?.id);
  }

  @Post(':id/comments')
  @ApiOperation({
    summary: 'Create comment on task',
    description: 'Adds a comment or revision request to a task',
  })
  async createComment(
    @WorkspaceId() workspaceId: string,
    @Param('id') taskId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.taskService.createComment(workspaceId, taskId, dto, user?.id);
  }

  @Get(':id/comments')
  @ApiOperation({
    summary: 'List comments for task',
    description: 'Returns all comments and revision requests for a task',
  })
  async listComments(
    @WorkspaceId() workspaceId: string,
    @Param('id') taskId: string,
    @Query('kind') kind?: CommentKind,
  ) {
    return this.taskService.listComments(workspaceId, taskId, kind);
  }

  @Post('estimate')
  @ApiOperation({
    summary: 'Estimate task (AI advisor)',
    description: `
      Runs the AI task estimator on a task brief before submission.
      
      This endpoint:
      - Is FREE (does not consume AI credits)
      - Returns estimated effort (8-80 hours), SLA expectation (24-standardSlaHours), complexity, subtask suggestions
      - Provides feedback on whether task fits standard SLA window
      - Flags tasks that need admin review
      - Does NOT create a task entity (this is pre-submission advice)
      
      The estimator helps clients scope their tasks correctly and set realistic expectations.
    `,
  })
  async estimateTask(
    @WorkspaceId() workspaceId: string,
    @Body() dto: EstimateTaskDto,
  ): Promise<TaskEstimatorResponseDto> {
    return this.estimatorService.estimateTask(workspaceId, dto);
  }

  @Post(':id/duplicate')
  @ApiOperation({
    summary: 'Duplicate task',
    description: `
      Creates a copy of an existing task.
      
      The new task will have:
      - Same title (with " (Copy)" appended), description, category, brand
      - Status reset to QUEUED
      - revisionNumber reset to 0
      - Attachments copied (references, not files)
      - New timestamps
    `,
  })
  async duplicateTask(
    @WorkspaceId() workspaceId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.duplicateTask(workspaceId, taskId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete task (client, only if QUEUED)',
    description: 'Allows client to delete their own QUEUED tasks to keep the queue clean.',
  })
  async deleteTask(
    @WorkspaceId() workspaceId: string,
    @Param('id') taskId: string,
  ) {
    return this.taskService.deleteTask(workspaceId, taskId);
  }

  // ========================================
  // TASK DRAFTS
  // ========================================

  @Get('drafts/list')
  @ApiOperation({
    summary: 'List task drafts',
    description: 'Returns all saved task drafts for the workspace',
  })
  async listDrafts(@WorkspaceId() workspaceId: string) {
    return this.taskService.listDrafts(workspaceId);
  }

  @Post('drafts')
  @ApiOperation({
    summary: 'Save task draft',
    description: 'Creates or updates a task draft. Allows saving incomplete tasks without submitting to queue.',
  })
  async saveDraft(
    @WorkspaceId() workspaceId: string,
    @Body() dto: SaveTaskDraftDto,
  ) {
    return this.taskService.saveDraft(workspaceId, dto);
  }

  @Get('drafts/:id')
  @ApiOperation({
    summary: 'Get task draft',
    description: 'Returns a single task draft by ID',
  })
  async getDraft(
    @WorkspaceId() workspaceId: string,
    @Param('id') draftId: string,
  ) {
    return this.taskService.getDraft(workspaceId, draftId);
  }

  @Delete('drafts/:id')
  @ApiOperation({
    summary: 'Delete task draft',
    description: 'Removes a saved task draft',
  })
  async deleteDraft(
    @WorkspaceId() workspaceId: string,
    @Param('id') draftId: string,
  ) {
    return this.taskService.deleteDraft(workspaceId, draftId);
  }

  @Post('drafts/:id/submit')
  @ApiOperation({
    summary: 'Submit draft as task',
    description: 'Converts a saved draft into a real task and submits to queue',
  })
  async submitDraft(
    @WorkspaceId() workspaceId: string,
    @Param('id') draftId: string,
  ) {
    return this.taskService.submitDraft(workspaceId, draftId);
  }
}
