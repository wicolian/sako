import { NotFoundException } from '@nestjs/common';
import { SubscriptionService } from '../src/subscription/subscription.service';
import { SubscriptionStatus } from '@prisma/client';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  // Mock workspace with active subscription
  const createMockWorkspace = (overrides: Partial<any> = {}) => ({
    id: 'ws_1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    subscription: {
      id: 'sub_1',
      workspaceId: 'ws_1',
      status: SubscriptionStatus.ACTIVE,
      stripeSubscriptionId: 'sub_stripe_123',
      planCode: 'CORE',
      pausedAt: null,
      pauseReason: null,
      totalPausedSeconds: 0,
      cancelAt: null,
      ...overrides.subscription,
    },
    plan: {
      code: 'CORE',
      activeTaskLimit: 1,
      ...overrides.plan,
    },
    ...overrides,
  });

  const prismaMock = {
    subscription: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    workspaceMember: {
      findFirst: jest.fn(),
    },
    task: {
      count: jest.fn(),
    },
  };

  const workspaceServiceMock = {
    getWorkspaceWithContext: jest.fn(),
    getEffectiveActiveTaskLimit: jest.fn().mockReturnValue(1),
    getEffectiveSlaSeconds: jest.fn().mockReturnValue(172800),
  };

  const analyticsMock = {
    trackSubscriptionPaused: jest.fn(),
    trackSubscriptionResumed: jest.fn(),
    trackSubscriptionCanceled: jest.fn(),
  };

  const notificationServiceMock = {
    notifySubscriptionPaused: jest.fn(),
    notifySubscriptionResumed: jest.fn(),
    notifySubscriptionCanceled: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SubscriptionService(
      prismaMock as any,
      workspaceServiceMock as any,
      analyticsMock as any,
      notificationServiceMock as any,
    );
  });

  describe('getSubscription', () => {
    it('returns subscription with derived values', async () => {
      const workspace = createMockWorkspace();
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);

      const result = await service.getSubscription('ws_1');

      expect(result.subscription).toBeDefined();
      expect(result.plan).toBeDefined();
      expect(result.derived.effectiveActiveTaskLimit).toBe(1);
      expect(result.derived.effectiveSlaSeconds).toBe(172800);
    });

    it('throws NotFoundException when no subscription exists', async () => {
      const workspace = createMockWorkspace({ subscription: null });
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);

      await expect(service.getSubscription('ws_1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('pauseSubscription', () => {
    it('pauses an active subscription', async () => {
      const workspace = createMockWorkspace();
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);
      prismaMock.subscription.update.mockResolvedValue({
        ...workspace.subscription,
        status: SubscriptionStatus.PAUSED,
        pausedAt: new Date(),
        pauseReason: 'User requested pause',
      });
      prismaMock.workspaceMember.findFirst.mockResolvedValue({
        userId: 'user_1',
        user: { id: 'user_1', email: 'test@example.com' },
      });

      const result = await service.pauseSubscription('ws_1', 'User requested pause');

      expect(result.subscription.status).toBe(SubscriptionStatus.PAUSED);
      expect(result.subscription.pausedAt).toBeDefined();
      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SubscriptionStatus.PAUSED,
            pauseReason: 'User requested pause',
          }),
        }),
      );
      expect(analyticsMock.trackSubscriptionPaused).toHaveBeenCalledWith('ws_1', 'User requested pause');
      expect(notificationServiceMock.notifySubscriptionPaused).toHaveBeenCalled();
    });

    it('is idempotent for already paused subscriptions', async () => {
      const workspace = createMockWorkspace({
        subscription: {
          status: SubscriptionStatus.PAUSED,
          pausedAt: new Date(),
        },
      });
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);

      const result = await service.pauseSubscription('ws_1');

      expect(result.alreadyPaused).toBe(true);
      expect(result.message).toContain('already paused');
      expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no subscription exists', async () => {
      const workspace = createMockWorkspace({ subscription: null });
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);

      await expect(service.pauseSubscription('ws_1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resumeSubscription', () => {
    it('resumes a paused subscription and calculates pause duration', async () => {
      const pausedAt = new Date(Date.now() - 3600000); // 1 hour ago
      const workspace = createMockWorkspace({
        subscription: {
          status: SubscriptionStatus.PAUSED,
          pausedAt,
          totalPausedSeconds: 0,
        },
      });
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);
      prismaMock.subscription.update.mockResolvedValue({
        ...workspace.subscription,
        status: SubscriptionStatus.ACTIVE,
        pausedAt: null,
        pauseReason: null,
        totalPausedSeconds: 3600, // ~1 hour
      });
      prismaMock.workspaceMember.findFirst.mockResolvedValue({
        userId: 'user_1',
        user: { id: 'user_1', email: 'test@example.com' },
      });

      const result = await service.resumeSubscription('ws_1');

      expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.subscription.pausedAt).toBeNull();
      expect(result.pauseDurationSeconds).toBeGreaterThan(0);
      expect(prismaMock.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SubscriptionStatus.ACTIVE,
            pausedAt: null,
            pauseReason: null,
          }),
        }),
      );
      expect(analyticsMock.trackSubscriptionResumed).toHaveBeenCalledWith('ws_1');
      expect(notificationServiceMock.notifySubscriptionResumed).toHaveBeenCalled();
    });

    it('throws NotFoundException when subscription is not paused', async () => {
      const workspace = createMockWorkspace({
        subscription: {
          status: SubscriptionStatus.ACTIVE,
        },
      });
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);

      await expect(service.resumeSubscription('ws_1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelSubscription', () => {
    it('cancels subscription and returns task counts', async () => {
      const workspace = createMockWorkspace();
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);
      prismaMock.subscription.update.mockResolvedValue({
        ...workspace.subscription,
        status: SubscriptionStatus.CANCEL_AT_PERIOD_END,
        cancelAt: new Date(),
      });
      prismaMock.task.count
        .mockResolvedValueOnce(2) // IN_PROGRESS
        .mockResolvedValueOnce(1); // IN_REVIEW
      prismaMock.workspaceMember.findFirst.mockResolvedValue({
        userId: 'user_1',
        user: { id: 'user_1', email: 'test@example.com' },
      });

      const result = await service.cancelSubscription('ws_1', 'No longer needed');

      expect(result.subscription.status).toBe(SubscriptionStatus.CANCEL_AT_PERIOD_END);
      expect(result.tasksToComplete.inProgress).toBe(2);
      expect(result.tasksToComplete.inReview).toBe(1);
      expect(result.message).toContain('3 tasks can still be completed');
      expect(analyticsMock.trackSubscriptionCanceled).toHaveBeenCalledWith('ws_1', 'No longer needed');
      expect(notificationServiceMock.notifySubscriptionCanceled).toHaveBeenCalled();
    });

    it('throws NotFoundException when no subscription exists', async () => {
      const workspace = createMockWorkspace({ subscription: null });
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);

      await expect(service.cancelSubscription('ws_1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('uncancelSubscription', () => {
    it('restores subscription to active status', async () => {
      const workspace = createMockWorkspace({
        subscription: {
          status: SubscriptionStatus.CANCEL_AT_PERIOD_END,
          cancelAt: new Date(),
        },
      });
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);
      prismaMock.subscription.update.mockResolvedValue({
        ...workspace.subscription,
        status: SubscriptionStatus.ACTIVE,
        cancelAt: null,
      });

      const result = await service.uncancelSubscription('ws_1');

      expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.subscription.cancelAt).toBeNull();
      expect(result.message).toContain('cancellation undone');
      expect(analyticsMock.trackSubscriptionResumed).toHaveBeenCalledWith('ws_1');
    });

    it('throws NotFoundException when no subscription exists', async () => {
      const workspace = createMockWorkspace({ subscription: null });
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);

      await expect(service.uncancelSubscription('ws_1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upgradeSubscription', () => {
    it('returns mailto link for Enterprise upgrade', async () => {
      const workspace = createMockWorkspace();
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);

      const result = await service.upgradeSubscription('ws_1', 'ENTERPRISE');

      expect(result.url).toContain('mailto:');
      expect(result.url).toContain('Enterprise');
    });

    it('returns portal action for existing subscription upgrades', async () => {
      const workspace = createMockWorkspace();
      workspaceServiceMock.getWorkspaceWithContext.mockResolvedValue(workspace);

      const result = await service.upgradeSubscription('ws_1', 'OPS');

      expect(result.action).toBe('PORTAL');
      expect(result.message).toContain('billing portal');
    });
  });
});

