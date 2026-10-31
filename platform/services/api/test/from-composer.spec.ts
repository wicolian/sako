import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudioService } from '../src/studio/studio.service';
import { TaskStatus, TaskCategory, ComposerSource, SubscriptionStatus } from '@prisma/client';
import { CreateTaskFromComposerDto } from '../src/studio/dto/from-composer.dto';

// Mock workspace with Studio access (Core plan)
const createStudioWorkspace = (planCode = 'CORE') => ({
  id: 'ws_1',
  name: 'Test Workspace',
  subscription: {
    id: 'sub_1',
    status: SubscriptionStatus.ACTIVE,
    planCode,
    activeTaskLimit: 2,
  },
  plan: {
    activeTaskLimit: 2,
  },
});

// Mock workspace without Studio access (Composer Free)
const createComposerOnlyWorkspace = (planCode = 'COMPOSER_FREE') => ({
  id: 'ws_2',
  name: 'Composer Workspace',
  subscription: {
    id: 'sub_2',
    status: SubscriptionStatus.ACTIVE,
    planCode,
    activeTaskLimit: 0, // Composer plans don't have active task limits
  },
  plan: null,
});

// Mock AI draft
const createMockDraft = (workspaceId: string) => ({
  id: 'draft_1',
  workspaceId,
  brandId: 'brand_1',
  primaryHeadline: 'Test Headline',
  variantLabel: 'Variant A',
  html: '<html>test</html>',
  brand: { id: 'brand_1', name: 'Test Brand' },
  publishedPages: [],
});

describe('StudioService.createTaskFromComposer', () => {
  const prismaMock = {
    workspace: { findUnique: jest.fn() },
    task: { create: jest.fn(), count: jest.fn() },
    aiDraft: { findFirst: jest.fn() },
  };

  const slackServiceMock = {
    notifyTaskStatusChanged: jest.fn(),
  };

  let service: StudioService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StudioService(
      prismaMock as any,
      slackServiceMock as any,
    );
  });

  describe('Plan access validation', () => {
    it('allows task creation for CORE plan', async () => {
      const workspace = createStudioWorkspace('CORE');
      const draft = createMockDraft(workspace.id);

      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      prismaMock.aiDraft.findFirst.mockResolvedValue(draft);
      prismaMock.task.count.mockResolvedValue(0); // No active tasks
      prismaMock.task.create.mockResolvedValue({
        id: 'task_new',
        title: 'Test Task',
        status: TaskStatus.IN_PROGRESS,
        source: ComposerSource.COMPOSER_STANDALONE,
        workspace: { id: workspace.id, name: workspace.name, slug: 'test' },
        brand: draft.brand,
      });

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: draft.id,
        title: 'Test Task',
      };

      const result = await service.createTaskFromComposer(workspace.id, dto, 'user_1');

      expect(result.task).toBeDefined();
      expect(result.task.status).toBe(TaskStatus.IN_PROGRESS);
      expect(prismaMock.task.create).toHaveBeenCalled();
    });

    it('allows task creation for OPS plan', async () => {
      const workspace = createStudioWorkspace('OPS');
      const draft = createMockDraft(workspace.id);

      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      prismaMock.aiDraft.findFirst.mockResolvedValue(draft);
      prismaMock.task.count.mockResolvedValue(0);
      prismaMock.task.create.mockResolvedValue({
        id: 'task_new',
        status: TaskStatus.IN_PROGRESS,
        source: ComposerSource.COMPOSER_STANDALONE,
        workspace: { id: workspace.id },
        brand: null,
      });

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: draft.id,
      };

      const result = await service.createTaskFromComposer(workspace.id, dto);

      expect(result.task).toBeDefined();
      expect(prismaMock.task.create).toHaveBeenCalled();
    });

    it('allows task creation for ENTERPRISE plan', async () => {
      const workspace = createStudioWorkspace('ENTERPRISE');
      const draft = createMockDraft(workspace.id);

      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      prismaMock.aiDraft.findFirst.mockResolvedValue(draft);
      prismaMock.task.count.mockResolvedValue(0);
      prismaMock.task.create.mockResolvedValue({
        id: 'task_new',
        status: TaskStatus.IN_PROGRESS,
        source: ComposerSource.COMPOSER_STANDALONE,
        workspace: { id: workspace.id },
        brand: null,
      });

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: draft.id,
      };

      const result = await service.createTaskFromComposer(workspace.id, dto);

      expect(result.task).toBeDefined();
    });

    it('throws ForbiddenException for COMPOSER_FREE plan', async () => {
      const workspace = createComposerOnlyWorkspace('COMPOSER_FREE');
      
      prismaMock.workspace.findUnique.mockResolvedValue(workspace);

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: 'draft_1',
      };

      await expect(service.createTaskFromComposer(workspace.id, dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.task.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for COMPOSER_PRO plan', async () => {
      const workspace = createComposerOnlyWorkspace('COMPOSER_PRO');
      
      prismaMock.workspace.findUnique.mockResolvedValue(workspace);

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: 'draft_1',
      };

      await expect(service.createTaskFromComposer(workspace.id, dto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.task.create).not.toHaveBeenCalled();
    });

    it('includes correct error code in ForbiddenException', async () => {
      const workspace = createComposerOnlyWorkspace('COMPOSER_FREE');
      
      prismaMock.workspace.findUnique.mockResolvedValue(workspace);

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: 'draft_1',
      };

      try {
        await service.createTaskFromComposer(workspace.id, dto);
        fail('Expected ForbiddenException');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.response?.code).toBe('PLAN_DOES_NOT_INCLUDE_STUDIO');
      }
    });
  });

  describe('Draft validation', () => {
    it('throws NotFoundException when draft does not exist', async () => {
      const workspace = createStudioWorkspace();
      
      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      prismaMock.aiDraft.findFirst.mockResolvedValue(null);

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: 'non_existent_draft',
      };

      await expect(service.createTaskFromComposer(workspace.id, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when draft belongs to different workspace', async () => {
      const workspace = createStudioWorkspace();
      
      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      // Draft findFirst returns null because workspace ID doesn't match
      prismaMock.aiDraft.findFirst.mockResolvedValue(null);

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: 'draft_from_other_workspace',
      };

      await expect(service.createTaskFromComposer(workspace.id, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Task status based on capacity', () => {
    it('creates task as IN_PROGRESS when under active task limit', async () => {
      const workspace = createStudioWorkspace();
      workspace.subscription!.activeTaskLimit = 2;
      const draft = createMockDraft(workspace.id);

      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      prismaMock.aiDraft.findFirst.mockResolvedValue(draft);
      prismaMock.task.count.mockResolvedValue(1); // 1 of 2 slots used
      prismaMock.task.create.mockResolvedValue({
        id: 'task_new',
        status: TaskStatus.IN_PROGRESS,
        source: ComposerSource.COMPOSER_STANDALONE,
        workspace: { id: workspace.id },
        brand: null,
      });

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: draft.id,
      };

      const result = await service.createTaskFromComposer(workspace.id, dto);

      expect(result.task.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('creates task as QUEUED when at active task limit', async () => {
      const workspace = createStudioWorkspace();
      workspace.subscription!.activeTaskLimit = 2;
      const draft = createMockDraft(workspace.id);

      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      prismaMock.aiDraft.findFirst.mockResolvedValue(draft);
      prismaMock.task.count.mockResolvedValue(2); // 2 of 2 slots used
      prismaMock.task.create.mockResolvedValue({
        id: 'task_new',
        status: TaskStatus.QUEUED,
        source: ComposerSource.COMPOSER_STANDALONE,
        workspace: { id: workspace.id },
        brand: null,
      });

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: draft.id,
      };

      const result = await service.createTaskFromComposer(workspace.id, dto);

      expect(result.task.status).toBe(TaskStatus.QUEUED);
      expect(result.message).toContain('queued');
    });
  });

  describe('Task data', () => {
    it('sets source to COMPOSER_STANDALONE', async () => {
      const workspace = createStudioWorkspace();
      const draft = createMockDraft(workspace.id);

      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      prismaMock.aiDraft.findFirst.mockResolvedValue(draft);
      prismaMock.task.count.mockResolvedValue(0);
      
      let capturedData: any = null;
      prismaMock.task.create.mockImplementation(({ data }) => {
        capturedData = data;
        return Promise.resolve({
          id: 'task_new',
          status: TaskStatus.IN_PROGRESS,
          source: data.source,
          workspace: { id: workspace.id },
          brand: null,
        });
      });

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: draft.id,
      };

      await service.createTaskFromComposer(workspace.id, dto);

      expect(capturedData.source).toBe(ComposerSource.COMPOSER_STANDALONE);
    });

    // Note: composerDraftId was removed from Task model - draft linkage is via source field

    it('uses draft headline as task title when no title provided', async () => {
      const workspace = createStudioWorkspace();
      const draft = createMockDraft(workspace.id);
      draft.primaryHeadline = 'AI Generated Headline';

      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      prismaMock.aiDraft.findFirst.mockResolvedValue(draft);
      prismaMock.task.count.mockResolvedValue(0);
      
      let capturedData: any = null;
      prismaMock.task.create.mockImplementation(({ data }) => {
        capturedData = data;
        return Promise.resolve({
          id: 'task_new',
          title: data.title,
          status: TaskStatus.IN_PROGRESS,
          workspace: { id: workspace.id },
          brand: null,
        });
      });

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: draft.id,
        // No title provided
      };

      await service.createTaskFromComposer(workspace.id, dto);

      expect(capturedData.title).toBe('AI Generated Headline');
    });

    it('uses provided title over draft headline', async () => {
      const workspace = createStudioWorkspace();
      const draft = createMockDraft(workspace.id);
      draft.primaryHeadline = 'AI Generated Headline';

      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      prismaMock.aiDraft.findFirst.mockResolvedValue(draft);
      prismaMock.task.count.mockResolvedValue(0);
      
      let capturedData: any = null;
      prismaMock.task.create.mockImplementation(({ data }) => {
        capturedData = data;
        return Promise.resolve({
          id: 'task_new',
          title: data.title,
          status: TaskStatus.IN_PROGRESS,
          workspace: { id: workspace.id },
          brand: null,
        });
      });

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: draft.id,
        title: 'Custom Task Title',
      };

      await service.createTaskFromComposer(workspace.id, dto);

      expect(capturedData.title).toBe('Custom Task Title');
    });
  });

  describe('Notifications', () => {
    it('sends Slack notification on task creation', async () => {
      const workspace = createStudioWorkspace();
      const draft = createMockDraft(workspace.id);

      prismaMock.workspace.findUnique.mockResolvedValue(workspace);
      prismaMock.aiDraft.findFirst.mockResolvedValue(draft);
      prismaMock.task.count.mockResolvedValue(0);
      prismaMock.task.create.mockResolvedValue({
        id: 'task_new',
        title: 'Test Task',
        status: TaskStatus.IN_PROGRESS,
        source: ComposerSource.COMPOSER_STANDALONE,
        workspace: { id: workspace.id },
        brand: null,
      });

      const dto: CreateTaskFromComposerDto = {
        composerDraftId: draft.id,
        title: 'Test Task',
      };

      await service.createTaskFromComposer(workspace.id, dto);

      expect(slackServiceMock.notifyTaskStatusChanged).toHaveBeenCalledWith(
        workspace.id,
        'task_new',
        'Test Task',
        'NEW',
        TaskStatus.IN_PROGRESS,
      );
    });
  });
});



