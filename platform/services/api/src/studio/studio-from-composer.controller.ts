import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiResponse } from '@nestjs/swagger';
import { StudioService } from './studio.service';
import { CreateTaskFromComposerDto } from './dto/from-composer.dto';
import { WorkspaceId } from '../common/decorators/workspace.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/clerk.config';

/**
 * Controller for creating Studio tasks from Composer.
 * This is separate from the main StudioController because it requires
 * standard workspace authentication (not SuperAdmin).
 */
@ApiTags('Studio - Composer Integration')
@ApiSecurity('workspace-header')
@Controller('studio/tasks')
export class StudioFromComposerController {
  constructor(private studioService: StudioService) {}

  @Post('from-composer')
  @ApiOperation({
    summary: 'Create a Studio task from a Composer draft',
    description: `
      Creates a new Studio task linked to an existing Composer draft.
      
      **Requirements:**
      - User must be authenticated and have workspace access
      - Workspace must have a Studio plan (Core, Ops, or Enterprise)
      - The Composer draft must belong to the same workspace
      
      **Behavior:**
      - Task will be created with status IN_PROGRESS if slots are available, otherwise QUEUED
      - The Composer draft will be linked to the task for reference
      - Slack notification will be sent if workspace has Slack integration
      
      **Error Codes:**
      - PLAN_DOES_NOT_INCLUDE_STUDIO: Workspace plan is Composer Free/Pro only
      - NOT_FOUND: Composer draft not found or doesn't belong to workspace
    `,
  })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 403, description: 'Plan does not include Studio access' })
  @ApiResponse({ status: 404, description: 'Composer draft not found' })
  async createTaskFromComposer(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateTaskFromComposerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studioService.createTaskFromComposer(workspaceId, dto, user?.id);
  }
}



