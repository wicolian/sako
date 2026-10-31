import { DayCreditBurnService } from '../src/credits/day-credit-burn.service';
import { SubscriptionStatus } from '@prisma/client';

describe('DayCreditBurnService', () => {
  const now = new Date('2024-05-01T10:00:00Z');

  const subscription = {
    id: 'sub_1',
    workspaceId: 'ws_1',
    status: SubscriptionStatus.ACTIVE,
    lastDayCreditBurnAt: null as Date | null,
  };

  const dayCredit = {
    id: 'dc_1',
    workspaceId: 'ws_1',
    totalCredits: 30,
    usedCredits: 0,
    periodStart: new Date('2024-05-01T00:00:00Z'),
    periodEnd: new Date('2024-05-31T00:00:00Z'),
  };

  const workspace = {
    id: 'ws_1',
    timezone: 'UTC',
    subscription,
  };

  const prismaMock: any = {
    subscription: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
    dayCredit: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    dayCreditHistory: {
      create: jest.fn(),
    },
    $transaction: (operations: Promise<any>[]) => Promise.all(operations),
  };

  let service: DayCreditBurnService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.lastDayCreditBurnAt = null;
    dayCredit.usedCredits = 0;
    prismaMock.subscription.findMany.mockResolvedValue([subscription]);
    prismaMock.subscription.findUnique.mockImplementation(({ where: { id, workspaceId } }) => {
      if ((id && id === subscription.id) || (workspaceId && workspaceId === subscription.workspaceId)) {
        return Promise.resolve(subscription);
      }
      return Promise.resolve(null);
    });
    prismaMock.subscription.update.mockImplementation(({ data }) => {
      Object.assign(subscription, data);
      return Promise.resolve(subscription);
    });
    prismaMock.workspace.findUnique.mockResolvedValue(workspace);
    prismaMock.dayCredit.findFirst.mockResolvedValue(dayCredit);
    prismaMock.dayCredit.update.mockImplementation(({ data }) => {
      dayCredit.usedCredits += data.usedCredits.increment;
      return Promise.resolve(dayCredit);
    });
    service = new DayCreditBurnService(prismaMock);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('burns a credit and updates the subscription timestamp', async () => {
    const burned = await service.burnDayCreditForWorkspace('ws_1');

    expect(burned).toBe(true);
    expect(dayCredit.usedCredits).toBe(1);
    expect(subscription.lastDayCreditBurnAt).not.toBeNull();
  });

  it('is idempotent within the same day', async () => {
    await service.burnDayCreditForWorkspace('ws_1');
    const second = await service.burnDayCreditForWorkspace('ws_1');

    expect(second).toBe(false);
    expect(dayCredit.usedCredits).toBe(1);
  });

  it('burns across all active subscriptions', async () => {
    const stats = await service.burnForAllActiveSubscriptions();

    expect(stats.processed).toBe(1);
    expect(stats.burned).toBe(1);
    expect(stats.skipped).toBe(0);
  });
});
