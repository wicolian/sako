import { TaskService } from '../src/task/task.service';
import { WorkspaceService } from '../src/workspace/workspace.service';
import { ActiveTaskLimitReachedException } from '../src/common/exceptions/business.exceptions';
import { TaskStatus, SubscriptionStatus } from '@prisma/client';

const createWorkspace = () => ({
  id: 'ws_1',
  subscription: {
    id: 'sub_1',
    status: SubscriptionStatus.ACTIVE,
  },
  plan: {
    activeTaskLimit: 1,
  },
});

describe('TaskService active slot enforcement', () => {
  const prismaMock = {
    task: {
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  const workspaceService = {
    getWorkspaceWithContext: jest.fn(),
    getEffectiveActiveTaskLimit: jest.fn(),
  } as unknown as WorkspaceService;

  let service: TaskService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TaskService(
      prismaMock as any,
      workspaceService,
      undefined as any, // mailService
      { sendToWorkspace: jest.fn() } as any, // taskGateway
      undefined as any, // slackService
      { get: jest.fn() } as any, // configService
      { burnDayCreditForWorkspace: jest.fn() } as any, // dayCreditBurnService
      { trackWorkspaceEvent: jest.fn() } as any, // analytics
      { notifyTaskInProgress: jest.fn(), notifyTaskInReview: jest.fn(), notifyTaskCompleted: jest.fn() } as any, // notificationService
    );
    (service as any).getTask = jest
      .fn()
      .mockResolvedValue({ id: 'task_a', status: TaskStatus.QUEUED, workspaceId: 'ws_1' });
    (workspaceService.getWorkspaceWithContext as jest.Mock).mockResolvedValue(createWorkspace());
    (workspaceService.getEffectiveActiveTaskLimit as jest.Mock).mockReturnValue(1);
  });

  it('throws when trying to start a task beyond the active slot limit', async () => {
    (prismaMock.task.count as jest.Mock).mockResolvedValue(1);

    await expect(service.startTaskAsAdmin('ws_1', 'task_b')).rejects.toBeInstanceOf(
      ActiveTaskLimitReachedException,
    );
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it('allows starting a task when under the active slot limit', async () => {
    (prismaMock.task.count as jest.Mock).mockResolvedValue(0);
    (prismaMock.task.update as jest.Mock).mockResolvedValue({
      id: 'task_a',
      status: TaskStatus.IN_PROGRESS,
    });

    const result = await service.startTaskAsAdmin('ws_1', 'task_a');

    expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    expect(prismaMock.task.update).toHaveBeenCalled();
  });
});
