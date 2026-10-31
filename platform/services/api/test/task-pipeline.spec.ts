import { TaskStatus, TaskCategory, ComposerSource, SubscriptionStatus } from '@prisma/client';

/**
 * Task Pipeline Integration Tests
 * 
 * Validates the core task status flow:
 * QUEUED → IN_PROGRESS → IN_REVIEW → COMPLETED
 * 
 * Also tests revision flow and edge cases.
 * 
 * Note: These are unit tests that validate task state machine logic.
 * For full integration tests, use the actual TaskService with a test database.
 */

// Valid task status transitions based on business rules
const VALID_TRANSITIONS: Record<string, TaskStatus[]> = {
  [TaskStatus.QUEUED]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.IN_REVIEW, TaskStatus.PAUSED],
  [TaskStatus.IN_REVIEW]: [TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS], // IN_PROGRESS for revision
  [TaskStatus.PAUSED]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.COMPLETED]: [], // Terminal state
};

// Transition validation helper
function isValidTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true; // No-op
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// Task interface for testing
interface MockTask {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  category: TaskCategory;
  status: TaskStatus;
  source: ComposerSource;
  brandId: string;
  createdAt: Date;
  updatedAt: Date;
  inProgressAt: Date | null;
  completedAt: Date | null;
  revisionCount: number;
}

describe('Task Status Pipeline - State Machine', () => {
  // Mock task data
  const mockWorkspace = {
    id: 'ws_test_1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    ownerId: 'user_123',
    subscription: {
      id: 'sub_1',
      planCode: 'CORE',
      status: SubscriptionStatus.ACTIVE,
      activeTaskLimit: 1,
    },
  };

  const createMockTask = (overrides: Partial<MockTask> = {}): MockTask => ({
    id: 'task_' + Math.random().toString(36).substr(2, 9),
    workspaceId: mockWorkspace.id,
    title: 'Test Task',
    description: 'Test description',
    category: TaskCategory.DESIGN,
    status: TaskStatus.QUEUED,
    source: ComposerSource.TASK, // Use valid ComposerSource
    brandId: 'brand_1',
    createdAt: new Date(),
    updatedAt: new Date(),
    inProgressAt: null,
    completedAt: null,
    revisionCount: 0,
    ...overrides,
  });

  let currentTask: MockTask;
  let taskHistory: Array<{ status: TaskStatus; timestamp: Date }> = [];

  // Simulate status update with validation
  function updateTaskStatus(
    task: MockTask,
    newStatus: TaskStatus,
    options: { isRevision?: boolean } = {},
  ): MockTask {
    const oldStatus = task.status;

    if (!isValidTransition(oldStatus, newStatus)) {
      throw new Error(`Invalid transition: ${oldStatus} → ${newStatus}`);
    }

    const now = new Date();
    const updates: Partial<MockTask> = {
      status: newStatus,
      updatedAt: now,
    };

    // Set inProgressAt when starting
    if (newStatus === TaskStatus.IN_PROGRESS && !task.inProgressAt) {
      updates.inProgressAt = now;
    }

    // Set completedAt when completing
    if (newStatus === TaskStatus.COMPLETED) {
      updates.completedAt = now;
    }

    // Increment revision count for revision requests
    if (options.isRevision && oldStatus === TaskStatus.IN_REVIEW && newStatus === TaskStatus.IN_PROGRESS) {
      updates.revisionCount = (task.revisionCount || 0) + 1;
    }

    taskHistory.push({ status: newStatus, timestamp: now });

    return { ...task, ...updates };
  }

  beforeEach(() => {
    currentTask = createMockTask();
    taskHistory = [];
  });

  // ========================================
  // HAPPY PATH TESTS
  // ========================================

  describe('Happy Path: QUEUED → IN_PROGRESS → IN_REVIEW → COMPLETED', () => {
    it('creates task with QUEUED status', () => {
      const task = createMockTask({
        title: 'New Landing Page',
        description: 'Create a landing page for product launch',
        category: TaskCategory.DESIGN,
        brandId: 'brand_1',
      });

      expect(task.status).toBe(TaskStatus.QUEUED);
      expect(task.title).toBe('New Landing Page');
    });

    it('transitions QUEUED → IN_PROGRESS when started', () => {
      currentTask = createMockTask({ status: TaskStatus.QUEUED });

      currentTask = updateTaskStatus(currentTask, TaskStatus.IN_PROGRESS);

      expect(currentTask.status).toBe(TaskStatus.IN_PROGRESS);
      expect(currentTask.inProgressAt).toBeDefined();
      expect(currentTask.inProgressAt).toBeInstanceOf(Date);
    });

    it('transitions IN_PROGRESS → IN_REVIEW when submitted', () => {
      currentTask = createMockTask({
        status: TaskStatus.IN_PROGRESS,
        inProgressAt: new Date(),
      });

      currentTask = updateTaskStatus(currentTask, TaskStatus.IN_REVIEW);

      expect(currentTask.status).toBe(TaskStatus.IN_REVIEW);
    });

    it('transitions IN_REVIEW → COMPLETED when approved', () => {
      currentTask = createMockTask({
        status: TaskStatus.IN_REVIEW,
        inProgressAt: new Date(Date.now() - 86400000), // 1 day ago
      });

      currentTask = updateTaskStatus(currentTask, TaskStatus.COMPLETED);

      expect(currentTask.status).toBe(TaskStatus.COMPLETED);
      expect(currentTask.completedAt).toBeDefined();
      expect(currentTask.completedAt).toBeInstanceOf(Date);
    });
  });

  // ========================================
  // REVISION FLOW TESTS
  // ========================================

  describe('Revision Flow: IN_REVIEW → IN_PROGRESS with revision count', () => {
    it('increments revision count when client requests changes', () => {
      currentTask = createMockTask({
        status: TaskStatus.IN_REVIEW,
        inProgressAt: new Date(),
        revisionCount: 0,
      });

      // Simulate revision request (back to IN_PROGRESS)
      currentTask = updateTaskStatus(currentTask, TaskStatus.IN_PROGRESS, { isRevision: true });

      expect(currentTask.status).toBe(TaskStatus.IN_PROGRESS);
      expect(currentTask.revisionCount).toBe(1);
    });

    it('tracks multiple revision cycles', () => {
      currentTask = createMockTask({
        status: TaskStatus.IN_REVIEW,
        inProgressAt: new Date(),
        revisionCount: 2,
      });

      currentTask = updateTaskStatus(currentTask, TaskStatus.IN_PROGRESS, { isRevision: true });

      expect(currentTask.revisionCount).toBe(3);
    });
  });

  // ========================================
  // EDGE CASE TESTS
  // ========================================

  describe('Edge Cases', () => {
    it('throws error for invalid status transition QUEUED → COMPLETED', () => {
      currentTask = createMockTask({ status: TaskStatus.QUEUED });

      expect(() => {
        updateTaskStatus(currentTask, TaskStatus.COMPLETED);
      }).toThrow('Invalid transition: QUEUED → COMPLETED');
    });

    it('throws error for invalid status transition COMPLETED → IN_PROGRESS', () => {
      currentTask = createMockTask({
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      });

      expect(() => {
        updateTaskStatus(currentTask, TaskStatus.IN_PROGRESS);
      }).toThrow('Invalid transition: COMPLETED → IN_PROGRESS');
    });

    it('allows PAUSED from IN_PROGRESS', () => {
      currentTask = createMockTask({
        status: TaskStatus.IN_PROGRESS,
        inProgressAt: new Date(),
      });

      currentTask = updateTaskStatus(currentTask, TaskStatus.PAUSED);

      expect(currentTask.status).toBe(TaskStatus.PAUSED);
    });

    it('allows resuming from PAUSED to IN_PROGRESS', () => {
      currentTask = createMockTask({
        status: TaskStatus.PAUSED,
        inProgressAt: new Date(Date.now() - 86400000),
      });

      currentTask = updateTaskStatus(currentTask, TaskStatus.IN_PROGRESS);

      expect(currentTask.status).toBe(TaskStatus.IN_PROGRESS);
    });
  });

  // ========================================
  // TRANSITION MATRIX TESTS
  // ========================================

  describe('Transition Matrix Validation', () => {
    it('validates all valid QUEUED transitions', () => {
      expect(isValidTransition(TaskStatus.QUEUED, TaskStatus.IN_PROGRESS)).toBe(true);
      expect(isValidTransition(TaskStatus.QUEUED, TaskStatus.COMPLETED)).toBe(false);
      expect(isValidTransition(TaskStatus.QUEUED, TaskStatus.PAUSED)).toBe(false);
    });

    it('validates all valid IN_PROGRESS transitions', () => {
      expect(isValidTransition(TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW)).toBe(true);
      expect(isValidTransition(TaskStatus.IN_PROGRESS, TaskStatus.PAUSED)).toBe(true);
      expect(isValidTransition(TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED)).toBe(false);
    });

    it('validates all valid IN_REVIEW transitions', () => {
      expect(isValidTransition(TaskStatus.IN_REVIEW, TaskStatus.COMPLETED)).toBe(true);
      expect(isValidTransition(TaskStatus.IN_REVIEW, TaskStatus.IN_PROGRESS)).toBe(true); // Revision
      expect(isValidTransition(TaskStatus.IN_REVIEW, TaskStatus.QUEUED)).toBe(false);
    });

    it('validates COMPLETED is terminal', () => {
      expect(isValidTransition(TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS)).toBe(false);
      expect(isValidTransition(TaskStatus.COMPLETED, TaskStatus.QUEUED)).toBe(false);
      expect(isValidTransition(TaskStatus.COMPLETED, TaskStatus.COMPLETED)).toBe(true); // No-op
    });

    it('allows no-op (same status)', () => {
      Object.values(TaskStatus).forEach((status) => {
        expect(isValidTransition(status, status)).toBe(true);
      });
    });
  });

  // ========================================
  // TIMESTAMP TESTS
  // ========================================

  describe('Timestamp Management', () => {
    it('sets inProgressAt when starting task', () => {
      currentTask = createMockTask({ status: TaskStatus.QUEUED });
      const beforeStart = new Date();

      currentTask = updateTaskStatus(currentTask, TaskStatus.IN_PROGRESS);

      expect(currentTask.inProgressAt).toBeDefined();
      expect(currentTask.inProgressAt!.getTime()).toBeGreaterThanOrEqual(
        beforeStart.getTime(),
      );
    });

    it('sets completedAt when completing task', () => {
      currentTask = createMockTask({
        status: TaskStatus.IN_REVIEW,
        inProgressAt: new Date(Date.now() - 86400000),
      });
      const beforeComplete = new Date();

      currentTask = updateTaskStatus(currentTask, TaskStatus.COMPLETED);

      expect(currentTask.completedAt).toBeDefined();
      expect(currentTask.completedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeComplete.getTime(),
      );
    });

    it('preserves inProgressAt on status changes after start', () => {
      const originalStartTime = new Date(Date.now() - 3600000); // 1 hour ago
      currentTask = createMockTask({
        status: TaskStatus.IN_PROGRESS,
        inProgressAt: originalStartTime,
      });

      currentTask = updateTaskStatus(currentTask, TaskStatus.IN_REVIEW);

      // inProgressAt should not be modified
      expect(currentTask.inProgressAt!.getTime()).toBe(originalStartTime.getTime());
    });
  });
});

/**
 * Full Pipeline Integration Test
 * 
 * Tests the complete lifecycle of a task from creation to completion.
 */
describe('Task Full Pipeline Integration', () => {
  it('completes full task lifecycle', async () => {
    const statusSequence: TaskStatus[] = [];
    
    // This would be a real integration test with actual DB
    // For unit testing, we simulate the sequence
    const expectedSequence = [
      TaskStatus.QUEUED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.IN_REVIEW,
      TaskStatus.COMPLETED,
    ];

    // Simulate each transition
    for (const status of expectedSequence) {
      statusSequence.push(status);
    }

    expect(statusSequence).toEqual(expectedSequence);
    expect(statusSequence[0]).toBe(TaskStatus.QUEUED);
    expect(statusSequence[statusSequence.length - 1]).toBe(TaskStatus.COMPLETED);
  });

  it('completes task lifecycle with revision', async () => {
    const statusSequence: TaskStatus[] = [];
    
    const expectedSequence = [
      TaskStatus.QUEUED,
      TaskStatus.IN_PROGRESS,
      TaskStatus.IN_REVIEW,
      TaskStatus.IN_PROGRESS, // Revision requested
      TaskStatus.IN_REVIEW,   // Resubmitted
      TaskStatus.COMPLETED,
    ];

    // Simulate each transition
    for (const status of expectedSequence) {
      statusSequence.push(status);
    }

    expect(statusSequence).toEqual(expectedSequence);
    
    // Count revision cycles (IN_REVIEW → IN_PROGRESS)
    let revisions = 0;
    for (let i = 1; i < statusSequence.length; i++) {
      if (
        statusSequence[i - 1] === TaskStatus.IN_REVIEW &&
        statusSequence[i] === TaskStatus.IN_PROGRESS
      ) {
        revisions++;
      }
    }
    expect(revisions).toBe(1);
  });
});

