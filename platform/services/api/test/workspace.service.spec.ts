import { WorkspaceService } from '../src/workspace/workspace.service';
import { SubscriptionStatus } from '@prisma/client';

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  const createMockWorkspace = (overrides: any = {}) => ({
    id: 'ws_1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    timezone: 'UTC',
    hasOnboarded: true,
    subscription: {
      id: 'sub_1',
      status: SubscriptionStatus.ACTIVE,
      planCode: 'CORE',
      activeTaskLimit: 1,
      slaSeconds: 172800,
    },
    plan: {
      code: 'CORE',
      activeTaskLimit: 1,
    },
    planOverride: null,
    members: [],
    ...overrides,
  });

  const prismaMock = {
    workspace: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workspaceMember: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    workspaceInvite: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    brand: {
      count: jest.fn(),
    },
    task: {
      count: jest.fn(),
    },
    dayCredit: {
      findFirst: jest.fn(),
    },
    aICredit: {
      findFirst: jest.fn(),
    },
  };

  const notificationServiceMock = {
    notifyWorkspaceInvite: jest.fn(),
  };

  const dayCreditBurnServiceMock = {
    burnCreditsForWorkspace: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn().mockReturnValue('mock_value'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkspaceService(
      prismaMock as any,
      dayCreditBurnServiceMock as any,
      configServiceMock as any,
      notificationServiceMock as any,
    );
  });

  describe('getEffectiveActiveTaskLimit', () => {
    it('uses subscription activeTaskLimit when set', () => {
      const workspace = createMockWorkspace({
        subscription: {
          activeTaskLimit: 3,
        },
        plan: {
          activeTaskLimit: 1,
        },
      });

      const result = service.getEffectiveActiveTaskLimit(workspace);

      expect(result).toBe(3);
    });

    it('uses plan activeTaskLimit as fallback', () => {
      const workspace = createMockWorkspace({
        subscription: {
          activeTaskLimit: null,
        },
        plan: {
          activeTaskLimit: 2,
        },
      });

      const result = service.getEffectiveActiveTaskLimit(workspace);

      expect(result).toBe(2);
    });

    it('uses planOverride when available', () => {
      const workspace = createMockWorkspace({
        planOverride: {
          customActiveTaskLimit: 5,
        },
        subscription: {
          activeTaskLimit: 1,
        },
      });

      const result = service.getEffectiveActiveTaskLimit(workspace);

      expect(result).toBe(5);
    });

    it('returns default of 1 when nothing is set', () => {
      const workspace = createMockWorkspace({
        subscription: null,
        plan: null,
      });

      const result = service.getEffectiveActiveTaskLimit(workspace);

      expect(result).toBe(1);
    });
  });

  describe('getEffectiveSlaSeconds', () => {
    it('uses subscription slaSeconds when set', () => {
      const workspace = createMockWorkspace({
        subscription: {
          slaSeconds: 86400, // 24 hours
        },
      });

      const result = service.getEffectiveSlaSeconds(workspace);

      expect(result).toBe(86400);
    });

    it('uses planOverride customTatSeconds when available', () => {
      const workspace = createMockWorkspace({
        planOverride: {
          customTatSeconds: 43200, // 12 hours
        },
      });

      const result = service.getEffectiveSlaSeconds(workspace);

      expect(result).toBe(43200);
    });

    it('returns default 48h when nothing is set', () => {
      const workspace = createMockWorkspace({
        subscription: {
          slaSeconds: null,
        },
        planOverride: null,
      });

      const result = service.getEffectiveSlaSeconds(workspace);

      expect(result).toBe(172800); // 48 hours
    });
  });
});

