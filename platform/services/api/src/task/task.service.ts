import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { MailService } from '../common/mail/mail.service';
import { TaskGateway } from './task.gateway';
import { SlackService } from '../slack/slack.service';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from '../common/analytics/analytics.service';
import { NotificationService } from '../common/notifications/notification.service';
import * as Sentry from '@sentry/nestjs';
import {
  SubscriptionPausedException,
  SubscriptionCanceledException,
  InvalidTaskTransitionException,
  CategoryNotAllowedException,
  TaskNotFoundException,
  ActiveTaskLimitReachedException,
} from '../common/exceptions/business.exceptions';
import { CreateTaskDto, UpdateTaskDto, CreateCommentDto, TaskQueryDto, SaveTaskDraftDto } from './dto/task.dto';
import { TaskStatus, SubscriptionStatus, PlanCode, TaskCategory, CommentKind, TaskScope } from '@prisma/client';
import { DayCreditBurnService } from '../credits/day-credit-burn.service';
import { computeSlaFields } from '../common/utils/sla.util';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private prisma: PrismaService,
    private workspaceService: WorkspaceService,
    private mailService: MailService,
    private taskGateway: TaskGateway,
    private slackService: SlackService,
    private configService: ConfigService,
    private dayCreditBurnService: DayCreditBurnService,
    private analytics: AnalyticsService,
    private notificationService: NotificationService,
  ) { }

  /**
   * Validate task transition based on actor
   */
  private validateTaskTransition(
    currentStatus: TaskStatus,
    newStatus: TaskStatus,
    actor: 'CLIENT' | 'STUDIO',
  ) {
    // Allow same status (no-op)
    if (currentStatus === newStatus) return;

    if (actor === 'STUDIO') {
      // Studio can do almost anything except maybe COMPLETED -> IN_PROGRESS?
      // Prompt says:
      // - QUEUED -> IN_PROGRESS
      // - IN_PROGRESS -> IN_REVIEW
      // - IN_REVIEW -> IN_PROGRESS (rework)
      // - IN_PROGRESS <-> PAUSED
      // - PAUSED -> IN_PROGRESS

      // Explicitly allowed studio transitions:
      const allowed = [
        // Forward
        { from: TaskStatus.QUEUED, to: TaskStatus.IN_PROGRESS },
        { from: TaskStatus.IN_PROGRESS, to: TaskStatus.IN_REVIEW },
        { from: TaskStatus.IN_REVIEW, to: TaskStatus.COMPLETED }, // Admin manual completion
        // Backward / Rework
        { from: TaskStatus.IN_REVIEW, to: TaskStatus.IN_PROGRESS },
        // Pause/Resume
        { from: TaskStatus.IN_PROGRESS, to: TaskStatus.PAUSED },
        { from: TaskStatus.PAUSED, to: TaskStatus.IN_PROGRESS },
        // Admin override (fix mistakes)
        { from: TaskStatus.COMPLETED, to: TaskStatus.IN_REVIEW }, // Re-open?
      ];

      // For now, let's implement the strict rules requested:
      // "Only Studio can: Move QUEUED -> IN_PROGRESS, IN_PROGRESS -> IN_REVIEW, IN_REVIEW -> IN_PROGRESS, IN_PROGRESS <-> PAUSED"
      // It doesn't explicitly say Studio CANNOT complete, but Client CAN.
      // Usually Studio admin can do everything. I'll allow Studio to do logical flows.

      return; // Studio is trusted for now, or apply strict rules if desired.
      // Let's apply strict rules to catch frontend bugs.

      /*
      if (currentStatus === TaskStatus.QUEUED && newStatus !== TaskStatus.IN_PROGRESS) {
         throw new InvalidTaskTransitionException(taskId, currentStatus, newStatus);
      }
      */
    }

    if (actor === 'CLIENT') {
      // Client strictly limited
      // Allowed: IN_REVIEW -> COMPLETED
      // Allowed: IN_REVIEW -> IN_PROGRESS (Request Revision - handled specially)

      if (currentStatus === TaskStatus.IN_REVIEW && newStatus === TaskStatus.COMPLETED) {
        return; // OK
      }

      // Revision request is handled via field edit or comment, effectively changing status to IN_PROGRESS.
      // If client sends status=IN_PROGRESS explicitly from IN_REVIEW, treat as revision request?
      if (currentStatus === TaskStatus.IN_REVIEW && newStatus === TaskStatus.IN_PROGRESS) {
        return; // OK, will be handled as revision
      }

      throw new BadRequestException(
        `Clients cannot move tasks from ${currentStatus} to ${newStatus}. Only Studio can manage active workflows.`
      );
    }
  }

  /**
   * Log lifecycle event
   */
  private async logLifecycleEvent(params: {
    taskId: string;
    kind: string;
    fromStatus?: TaskStatus;
    toStatus?: TaskStatus;
    actorRole: 'client' | 'admin';
    actorId?: string;
    metadata?: any;
  }) {
    try {
      await this.prisma.taskLifecycleEvent.create({
        data: {
          taskId: params.taskId,
          kind: params.kind,
          fromStatus: params.fromStatus,
          toStatus: params.toStatus,
          actorRole: params.actorRole,
          metadata: params.metadata ?? {},
        },
      });
    } catch (e) {
      console.error('Failed to log lifecycle event', e);
    }
  }

  /**
   * Helper to send Slack notifications
   */
  private async notifySlack(workspaceId: string, message: string, channelId?: string | null) {
    try {
      const integration = await this.prisma.slackIntegration.findFirst({
        where: { workspaceId },
      });

      if (!integration) return;

      // Determine channel
      // Priority: Explicit channelId -> Integration default channel -> Env var default -> fallback
      let channel = channelId || integration.defaultChannelId;
      if (!channel) {
        channel = this.configService.get<string>('SLACK_DEFAULT_CHANNEL_ID') || null;
      }

      if (channel) {
        await this.slackService.postMessage(channel, message, integration.botAccessToken);
      }
    } catch (e) {
      // Swallow errors to not break task flow
      console.error('Failed to send Slack notification', e);
    }
  }

  private getTaskLink(taskId: string): string {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return `<${frontendUrl}/studio/tasks/${taskId}|Open Task>`;
  }

  private async burnDayCreditSlot(workspaceId: string) {
    if (!this.dayCreditBurnService) {
      return;
    }
    try {
      await this.dayCreditBurnService.burnDayCreditForWorkspace(workspaceId);
    } catch (error) {
      console.error(`Failed to burn day credit for workspace ${workspaceId}`, error instanceof Error ? error.message : error);
    }
  }

  /**
   * Helper to enrich task with computed SLA fields
   */
  private enrichTaskWithSla(task: any) {
    if (!task) return task;

    const computed = computeSlaFields(task, new Date());

    // Determine slaStatus based on remaining time percentage
    let slaStatus = 'ON_TRACK';
    if (computed.slaIsLate) {
      slaStatus = 'LATE';
    } else if (
      computed.slaRemainingSeconds !== null &&
      computed.slaElapsedSeconds !== null &&
      task.slaSeconds > 0
    ) {
      const percentRemaining = computed.slaRemainingSeconds / task.slaSeconds;
      if (percentRemaining < 0.2) { // Less than 20% time left
        slaStatus = 'AT_RISK';
      }
    }

    return {
      ...task,
      computedSlaHours: computed.slaHours,
      slaRemainingSeconds: computed.slaRemainingSeconds,
      slaElapsedSeconds: computed.slaElapsedSeconds,
      slaIsLate: computed.slaIsLate,
      slaStatus,
      isWaitingOnClient: computed.isWaitingOnClient,
    };
  }

  /**
   * List tasks for workspace with filters and pagination
   */
  async listTasks(workspaceId: string, query: TaskQueryDto) {
    const { status, search, limit = 20, cursor, sort = 'desc' } = query;

    const where: any = { workspaceId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tasks = await this.prisma.task.findMany({
      where,
      take: limit + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
      orderBy: { createdAt: sort },
    });

    const hasMore = tasks.length > limit;
    const items = hasMore ? tasks.slice(0, -1) : tasks;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items: items.map(t => this.enrichTaskWithSla(t)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Get task detail by ID (scoped to workspace)
   */
  async getTask(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        workspaceId,
      },
      include: {
        brand: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        revisions: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { revisionIndex: 'asc' },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
        estimateSnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!task) {
      throw new TaskNotFoundException(taskId);
    }

    return this.enrichTaskWithSla(task);
  }

  /**
   * Create task (client)
   * RULE: enforce subscription status, category validation, active task limits
   */
  async createTask(workspaceId: string, dto: CreateTaskDto, createdById?: string) {
    // 1. Fetch workspace with subscription and plan
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);

    // 2. Check subscription status
    // PAUSED and fully CANCELED block creation.
    // CANCEL_AT_PERIOD_END behaves like ACTIVE (user has full access until period ends).
    if (workspace.subscription?.status === SubscriptionStatus.PAUSED) {
      throw new SubscriptionPausedException(workspaceId);
    }
    if (workspace.subscription?.status === SubscriptionStatus.CANCELED) {
      throw new SubscriptionCanceledException(workspaceId);
    }

    // 3. Validate category against plan + subscription mode + taskScope
    await this.validateCategory(workspace, dto.category);

    // 4. Set SLA from subscription or default (48h = 172800s)
    const slaSeconds = workspace.subscription?.slaSeconds ?? 172800;

    // 5. Handle AI credits and Task Creation atomically
    const task = await this.prisma.$transaction(async (tx) => {
      // Check if AI should be used and deduct credits
      let useAI = dto.useAI || false;

      if (useAI) {
        const now = new Date();
        const aiCredit = await tx.aICredit.findFirst({
          where: { workspaceId, periodEnd: { gte: now } },
          orderBy: { periodEnd: 'asc' },
        });

        if (!aiCredit) {
          // If no credit record exists, assume 0 credits
          throw new BadRequestException('No AI credits available. Please contact support to add AI credits to your workspace.');
        }

        const remainingCredits = aiCredit.totalCredits - aiCredit.usedCredits;
        if (remainingCredits <= 0) {
          throw new BadRequestException('Insufficient AI credits. You have 0 AI credits remaining.');
        }

        // Deduct 1 AI credit
        await tx.aICredit.update({
          where: { id: aiCredit.id },
          data: { usedCredits: { increment: 1 } },
        });
      }

      // 6. Create task with status = QUEUED
      const createdTask = await tx.task.create({
        data: {
          workspaceId,
          title: dto.title,
          description: dto.description,
          category: dto.category,
          brandId: dto.brandId,
          status: TaskStatus.QUEUED,
          slaSeconds,
          createdById,
          useAI, // Store the useAI flag
          aiEligible: true, // Default to eligible, can be changed by admin
          structuredBriefJson: dto.structuredBriefJson ?? undefined,
          referenceLinksJson: dto.referenceLinksJson ?? undefined,
          deliverablesJson: dto.deliverablesJson ?? undefined,
        },
        include: {
          brand: true,
        },
      });

      // Emit event
      this.taskGateway.sendToWorkspace(workspaceId, 'task:created', createdTask);

      // Log creation event
      // We do this inside the transaction or after? 
      // Using prisma service directly is fine as it's just logging.
      // But we are inside a transaction `tx`. To be safe, let's use tx for logging if we want strict consistency,
      // but logLifecycleEvent uses this.prisma. Let's just log it here using tx manually or call helper after.
      // Calling helper after transaction is safer for "eventual" logging and avoids locking issues if any.

      return createdTask;
    });

    // Link the most recent orphan estimate snapshot to this task
    // Find snapshot created within last 5 minutes with matching workspace + title (no taskId yet)
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const matchingSnapshot = await this.prisma.taskEstimateSnapshot.findFirst({
        where: {
          workspaceId,
          taskId: null,
          title: dto.title,
          createdAt: { gte: fiveMinutesAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (matchingSnapshot) {
        await this.prisma.taskEstimateSnapshot.update({
          where: { id: matchingSnapshot.id },
          data: { taskId: task.id },
        });

        // Also update task with estimator fields from snapshot
        await this.prisma.task.update({
          where: { id: task.id },
          data: {
            estimatedEffortHours: matchingSnapshot.estimatedEffortHoursRaw,
            displaySlaHours: matchingSnapshot.displaySlaHoursRaw,
            fits48hWindow: matchingSnapshot.fits48hWindow,
            flagForAdminReview: matchingSnapshot.flagForAdminReview,
          },
        });
      }
    } catch (e) {
      // Don't fail task creation if snapshot linking fails
      console.error('Failed to link estimate snapshot to task:', e);
    }

    // Log creation event
    await this.logLifecycleEvent({
      taskId: task.id,
      kind: 'task_created',
      toStatus: TaskStatus.QUEUED,
      actorRole: 'client',
      actorId: createdById,
    });

    // Notify Slack
    this.notifySlack(
      workspaceId,
      `New Sako task created: *${task.title}* (status: ${task.status}) ${this.getTaskLink(task.id)}`,
      task.slackChannelId
    );

    // Track TaskCreated analytics event
    this.analytics.trackWorkspaceEvent(workspaceId, 'TaskCreated', {
      taskId: task.id,
      category: task.category,
      planCode: workspace.subscription?.planCode,
      useAI: task.useAI,
      createdById,
    });

    // Add Sentry breadcrumb for task creation
    Sentry.addBreadcrumb({
      category: 'task',
      message: `Task created: ${task.title}`,
      level: 'info',
      data: {
        taskId: task.id,
        workspaceId,
        category: task.category,
        status: task.status,
      },
    });

    // Send notification to task creator (in-app + email via NotificationService)
    if (createdById) {
      try {
        await this.notificationService.notifyTaskCreated(
          createdById,
          workspaceId,
          task.id,
          task.title,
        );
      } catch (err) {
        console.error('[TaskService] Failed to send task created notification:', err);
      }
    }

    return task;
  }

  /**
   * Update task (client/admin)
   *
   * Two modes:
   * 1) Status transition (used by Kanban drag-and-drop in client & studio)
   *    - QUEUED -> IN_PROGRESS  : uses startTaskAsAdmin (enforces active limits + subscription)
   *    - IN_PROGRESS -> IN_REVIEW: uses moveToReview
   *    - IN_REVIEW -> COMPLETED : uses completeTask (also auto-starts next queued task)
   *    - Any other transition: InvalidTaskTransitionException
   *
   * 2) Field edits (title/description/category/brand)
   *    - Only allowed if current status is QUEUED or IN_REVIEW
   *    - If IN_REVIEW, treated as a revision request (increments revisionNumber, logs revision, creates comment)
   */
  async updateTask(
    workspaceId: string,
    taskId: string,
    dto: UpdateTaskDto,
    actor: 'CLIENT' | 'STUDIO', // Added actor
    authorId?: string
  ) {
    const task = await this.getTask(workspaceId, taskId);

    // --- 1) Handle status transitions for Kanban drag-and-drop ---
    if (dto.status && dto.status !== task.status) {
      // Validate transition permissions first
      this.validateTaskTransition(task.status, dto.status, actor);

      const nextStatus = dto.status;

      // QUEUED -> IN_PROGRESS
      if (task.status === TaskStatus.QUEUED && nextStatus === TaskStatus.IN_PROGRESS) {
        return this.startTaskAsAdmin(workspaceId, taskId);
      }

      // IN_PROGRESS -> IN_REVIEW
      if (task.status === TaskStatus.IN_PROGRESS && nextStatus === TaskStatus.IN_REVIEW) {
        return this.moveToReview(workspaceId, taskId);
      }

      // IN_REVIEW -> COMPLETED
      if (task.status === TaskStatus.IN_REVIEW && nextStatus === TaskStatus.COMPLETED) {
        return this.completeTask(workspaceId, taskId);
      }

      // IN_REVIEW -> IN_PROGRESS (Revision Request / Rework)
      if (task.status === TaskStatus.IN_REVIEW && nextStatus === TaskStatus.IN_PROGRESS) {
        // If client, it's a revision request (handled via field edit logic below usually, but drag support here)
        // Logic implies we just set it back to IN_PROGRESS.
        // Use requestRevision if we want to increment version? Or just simple move?
        // If client drags to "In Progress" (if they had such column), we treat as revision.
        if (actor === 'CLIENT') {
          return this.requestRevision(workspaceId, taskId, dto, authorId);
        }
        // If studio drags back, it's internal rework.
        // Calculate time spent waiting for client feedback (for SLA pause)
        const now = new Date();
        let additionalWaitSeconds = 0;
        if (task.inReviewAt) {
          additionalWaitSeconds = Math.floor((now.getTime() - new Date(task.inReviewAt).getTime()) / 1000);
        }
        const updatedTask = await this.prisma.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.IN_PROGRESS,
            inProgressAt: now,
            inReviewAt: null, // Clear review timestamp
            totalClientWaitSeconds: { increment: additionalWaitSeconds }, // Accumulate client wait time for SLA
          }
        });
        this.taskGateway.sendToWorkspace(workspaceId, 'task:updated', updatedTask);
        this.notifySlack(workspaceId, `Task updated: *${updatedTask.title}* moved back to *IN_PROGRESS* ${this.getTaskLink(taskId)}`, updatedTask.slackChannelId);
        return updatedTask;
      }

      // PAUSED <-> IN_PROGRESS
      if ((task.status === TaskStatus.IN_PROGRESS && nextStatus === TaskStatus.PAUSED) ||
        (task.status === TaskStatus.PAUSED && nextStatus === TaskStatus.IN_PROGRESS)) {

        // Check limit if resuming to IN_PROGRESS?
        if (nextStatus === TaskStatus.IN_PROGRESS) {
          // Enforce limit
          const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);
          const activeTaskLimit = this.workspaceService.getEffectiveActiveTaskLimit(workspace);
          const currentActiveCount = await this.prisma.task.count({
            where: {
              workspaceId,
              status: { in: [TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] },
            },
          });
          if (currentActiveCount >= activeTaskLimit) {
            throw new ActiveTaskLimitReachedException(currentActiveCount, activeTaskLimit);
          }
        }

        const updatedTask = await this.prisma.task.update({
          where: { id: taskId },
          data: { status: nextStatus }
        });

        // Log pause/unpause
        await this.logLifecycleEvent({
          taskId,
          kind: nextStatus === TaskStatus.PAUSED ? 'task_paused' : 'task_unpaused',
          fromStatus: task.status,
          toStatus: nextStatus,
          actorRole: actor === 'CLIENT' ? 'client' : 'admin',
          actorId: authorId,
        });
        this.taskGateway.sendToWorkspace(workspaceId, 'task:updated', updatedTask);
        this.notifySlack(workspaceId, `Task updated: *${updatedTask.title}* is now *${nextStatus}* ${this.getTaskLink(taskId)}`, updatedTask.slackChannelId);
        // Note: Day credits are burned once per day via scheduler, not per task transition
        return updatedTask;
      }

      // Any other attempted transition is invalid
      throw new InvalidTaskTransitionException(taskId, task.status, nextStatus);
    }

    // --- 2) Field edits (no status change) ---

    // Only allow edits in QUEUED or IN_REVIEW
    if (task.status !== TaskStatus.QUEUED && task.status !== TaskStatus.IN_REVIEW) {
      // Unless Admin? Admin can edit whenever.
      if (actor === 'CLIENT') {
        throw new InvalidTaskTransitionException(
          taskId,
          task.status,
          'EDIT (only allowed in QUEUED or IN_REVIEW)',
        );
      }
    }

    // If IN_REVIEW, this is a revision request
    if (task.status === TaskStatus.IN_REVIEW) {
      return this.requestRevision(workspaceId, taskId, dto, authorId);
    }

    // Simple update for QUEUED tasks
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        brandId: dto.brandId,
      },
    });

    this.taskGateway.sendToWorkspace(workspaceId, 'task:updated', updatedTask);
    return updatedTask;
  }

  /**
   * Request revision (client editing IN_REVIEW task)
   * RULE: move status back to IN_PROGRESS, increment revisionNumber, log revision, create revision comment
   * RULE: enforce active task limit when moving to IN_PROGRESS
   */
  async requestRevision(
    workspaceId: string,
    taskId: string,
    dto: UpdateTaskDto,
    authorId?: string,
  ) {
    const task = await this.getTask(workspaceId, taskId);

    // Check active task limit before moving to IN_PROGRESS
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);
    const activeTaskLimit = this.workspaceService.getEffectiveActiveTaskLimit(workspace);
    const currentActiveCount = await this.prisma.task.count({
      where: {
        workspaceId,
        status: { in: [TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] },
      },
    });

    // Exclude the current task if it's already counted as active (IN_REVIEW)
    const adjustedActiveCount = task.status === TaskStatus.IN_REVIEW ? currentActiveCount - 1 : currentActiveCount;

    if (adjustedActiveCount >= activeTaskLimit) {
      throw new ActiveTaskLimitReachedException(currentActiveCount, activeTaskLimit);
    }

    // Increment revision number
    const newRevisionNumber = task.revisionNumber + 1;
    const feedback = (dto as any)?.feedback as string | undefined;

    // Calculate time spent waiting for client feedback (for SLA pause)
    const now = new Date();
    let additionalWaitSeconds = 0;
    if (task.inReviewAt) {
      additionalWaitSeconds = Math.floor((now.getTime() - new Date(task.inReviewAt).getTime()) / 1000);
    }

    // Update task and create revision log in a transaction
    const updatedTask = await this.prisma.$transaction(async (tx) => {
      // Update task - move back to IN_PROGRESS and increment revision
      const t = await tx.task.update({
        where: { id: taskId },
        data: {
          title: dto.title ?? task.title,
          description: dto.description ?? task.description,
          category: dto.category ?? task.category,
          brandId: dto.brandId !== undefined ? dto.brandId : task.brandId,
          status: TaskStatus.IN_PROGRESS, // Move back to IN_PROGRESS
          revisionNumber: newRevisionNumber,
          inProgressAt: new Date(), // Reset progress timestamp
          inReviewAt: null, // Clear review timestamp
          totalClientWaitSeconds: { increment: additionalWaitSeconds }, // Accumulate client wait time for SLA
        },
      });

      // Create revision log
      await tx.taskRevision.create({
        data: {
          taskId,
          authorId,
          revisionIndex: newRevisionNumber,
          payloadJson: JSON.parse(JSON.stringify({
            changes: Object.fromEntries(
              Object.entries(dto || {}).filter(([key]) => key !== 'feedback')
            ),
            previousVersion: {
              title: task.title,
              description: task.description,
              category: task.category,
              brandId: task.brandId,
            },
          })),
        },
      });

      // Create revision request comment
      await tx.taskComment.create({
        data: {
          taskId,
          authorId,
          kind: CommentKind.REVISION_REQUEST,
          body: feedback?.trim()
            ? feedback.trim()
            : `Revision requested (v${newRevisionNumber})`,
        },
      });

      // Log lifecycle event
      await tx.taskLifecycleEvent.create({
        data: {
          taskId,
          kind: 'task_revision_requested',
          fromStatus: TaskStatus.IN_REVIEW,
          toStatus: TaskStatus.IN_PROGRESS,
          actorRole: 'client',
          metadata: { revisionNumber: newRevisionNumber },
        }
      });

      return t;
    });

    this.taskGateway.sendToWorkspace(workspaceId, 'task:updated', updatedTask);

    // Notify Slack about revision
    this.notifySlack(
      workspaceId,
      `Task revision requested: *${updatedTask.title}* moved back to *IN_PROGRESS* (Revision #${newRevisionNumber}) ${this.getTaskLink(taskId)}`,
      updatedTask.slackChannelId
    );

    // Send notification about revision request
    if (authorId) {
      try {
        await this.notificationService.notifyRevisionRequested(
          authorId,
          workspaceId,
          taskId,
          task.title,
          feedback,
        );
      } catch (err) {
        console.error('[TaskService] Failed to send revision notification:', err);
      }
    }

    return updatedTask;
  }

  /**
   * Complete task (client)
   * RULE: only allowed if status == IN_REVIEW
   * RULE: auto-start next queued task if slot opens
   */
  async completeTask(workspaceId: string, taskId: string) {
    const task = await this.getTask(workspaceId, taskId);

    if (task.status !== TaskStatus.IN_REVIEW) {
      throw new InvalidTaskTransitionException(taskId, task.status, TaskStatus.COMPLETED);
    }

    // Calculate time spent waiting for client feedback (for SLA pause)
    const now = new Date();
    let additionalWaitSeconds = 0;
    if (task.inReviewAt) {
      additionalWaitSeconds = Math.floor((now.getTime() - new Date(task.inReviewAt).getTime()) / 1000);
    }

    // Mark as completed
    const completedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: now,
        inReviewAt: null, // Clear review timestamp
        totalClientWaitSeconds: { increment: additionalWaitSeconds }, // Accumulate client wait time for SLA
      },
    });

    await this.logLifecycleEvent({
      taskId,
      kind: 'task_completed',
      fromStatus: TaskStatus.IN_REVIEW,
      toStatus: TaskStatus.COMPLETED,
      actorRole: 'client',
    });

    this.taskGateway.sendToWorkspace(workspaceId, 'task:updated', completedTask);

    // Notify Slack
    this.notifySlack(
      workspaceId,
      `Task updated: *${completedTask.title}* is now *COMPLETED* ${this.getTaskLink(taskId)}`,
      completedTask.slackChannelId
    );

    // Send email notification
    if (task.createdById) {
      const creator = await this.prisma.user.findUnique({ where: { id: task.createdById } });
      if (creator) {
        await this.mailService.sendTaskStatusUpdateEmail(
          creator.email,
          task.title,
          'COMPLETED',
          task.id
        );
      }
    }

    // Track TaskCompleted analytics event
    this.analytics.trackWorkspaceEvent(workspaceId, 'TaskCompleted', {
      taskId,
      category: task.category,
      revisionNumber: task.revisionNumber,
    });

    // Add Sentry breadcrumb for task status change
    Sentry.addBreadcrumb({
      category: 'task',
      message: `Task completed: ${task.title}`,
      level: 'info',
      data: {
        taskId,
        workspaceId,
        fromStatus: TaskStatus.IN_REVIEW,
        toStatus: TaskStatus.COMPLETED,
      },
    });

    // Send notification to task creator that task is completed
    if (task.createdById) {
      try {
        await this.notificationService.notifyTaskCompleted(
          task.createdById,
          workspaceId,
          taskId,
          task.title,
        );
      } catch (err) {
        console.error('[TaskService] Failed to send task completed notification:', err);
      }
    }

    // Check for SLA miss and issue credit automatically
    const slaFields = computeSlaFields({
      ...task,
      completedAt: now,
      totalClientWaitSeconds: (task.totalClientWaitSeconds ?? 0) + additionalWaitSeconds,
    }, now);
    
    let slaCreditIssued = false;
    if (slaFields.slaIsLate && !task.slaCreditIssuedAt) {
      try {
        const result = await this.dayCreditBurnService.issueSlaCredit(
          workspaceId,
          taskId,
          task.title,
        );
        
        if (result.credited) {
          slaCreditIssued = true;
          
          // Mark the task as having been credited (prevent double-crediting)
          await this.prisma.task.update({
            where: { id: taskId },
            data: { slaCreditIssuedAt: now },
          });
          
          // Notify the user about the SLA credit
          if (task.createdById) {
            await this.notificationService.notifySlaCreditIssued(
              task.createdById,
              workspaceId,
              taskId,
              task.title,
            );
          }
          
          // Track SLA miss analytics
          this.analytics.trackWorkspaceEvent(workspaceId, 'SlaCreditIssued', {
            taskId,
            hoursLate: Math.abs(Math.floor((slaFields.slaRemainingSeconds ?? 0) / 3600)),
          });
          
          this.logger.log(`SLA credit issued for late task: ${task.title} (${taskId})`);
        }
      } catch (err) {
        console.error('[TaskService] Failed to issue SLA credit:', err);
        // Don't fail the task completion if credit issuance fails
      }
    }

    // Auto-start next queued task (disabled per requirements: only admin starts tasks)
    // await this.autoStartNextQueuedTask(workspaceId);

    return { success: true, message: 'Task completed', slaCreditIssued };
  }

  /**
   * Create comment on task
   */
  async createComment(workspaceId: string, taskId: string, dto: CreateCommentDto, authorId?: string) {
    // Verify task exists and belongs to workspace
    const task = await this.getTask(workspaceId, taskId);

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId,
        authorId,
        body: dto.body,
        kind: dto.kind ?? CommentKind.COMMENT,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Emit websocket event for real-time updates
    this.taskGateway.sendToWorkspace(workspaceId, 'comment:created', { taskId, comment });

    // Send Slack notification for new comments
    const authorName = comment.author?.name || comment.author?.email || 'Someone';
    const truncatedBody = dto.body.length > 200 ? dto.body.substring(0, 197) + '...' : dto.body;
    this.notifySlack(
      workspaceId,
      `💬 New comment on *${task.title}* by ${authorName}:\n"${truncatedBody}"\n${this.getTaskLink(taskId)}`,
      task.slackChannelId
    );

    // Send notification to task creator about new comment (unless they are the author)
    if (task.createdById && task.createdById !== authorId) {
      try {
        await this.notificationService.notifyTaskComment(
          task.createdById,
          workspaceId,
          taskId,
          task.title,
          authorName,
          truncatedBody,
        );
      } catch (err) {
        console.error('[TaskService] Failed to send comment notification:', err);
      }
    }

    return comment;
  }

  /**
   * List comments for task
   */
  async listComments(workspaceId: string, taskId: string, kind?: CommentKind) {
    // Verify task exists and belongs to workspace
    await this.getTask(workspaceId, taskId);

    const comments = await this.prisma.taskComment.findMany({
      where: {
        taskId,
        ...(kind && { kind }),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map((comment) => ({
      ...comment,
      authorRole: comment.author?.role ?? 'CLIENT',
      authorName: comment.author?.name || comment.author?.email || 'User',
    }));
  }

  /**
   * ADMIN: Start task (QUEUED or PAUSED -> IN_PROGRESS)
   * RULE: enforce active task limit
   * RULE: subscription must be ACTIVE or CANCEL_AT_PERIOD_END (user still has access until period ends)
   * RULE: task must be QUEUED or PAUSED
   */
  async startTaskAsAdmin(workspaceId: string, taskId: string) {
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);

    // Check subscription allows work (ACTIVE or CANCEL_AT_PERIOD_END - user paid for this period)
    const allowedStatuses: SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCEL_AT_PERIOD_END];
    if (!workspace.subscription?.status || !allowedStatuses.includes(workspace.subscription.status)) {
      throw new BadRequestException('Subscription must be ACTIVE to start tasks');
    }

    // Get task and verify status
    const task = await this.getTask(workspaceId, taskId);
    if (task.status !== TaskStatus.QUEUED && task.status !== TaskStatus.PAUSED) {
      throw new InvalidTaskTransitionException(taskId, task.status, TaskStatus.IN_PROGRESS);
    }

    // Check active task limit
    const activeTaskLimit = this.workspaceService.getEffectiveActiveTaskLimit(workspace);
    const currentActiveCount = await this.prisma.task.count({
      where: {
        workspaceId,
        status: { in: [TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] },
      },
    });

    if (currentActiveCount >= activeTaskLimit) {
      throw new ActiveTaskLimitReachedException(currentActiveCount, activeTaskLimit);
    }

    // Start task
    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.IN_PROGRESS,
        inProgressAt: new Date(),
      },
    });

    await this.logLifecycleEvent({
      taskId,
      kind: 'task_started',
      fromStatus: task.status,
      toStatus: TaskStatus.IN_PROGRESS,
      actorRole: 'admin',
    });

    // Track TaskStatusChanged analytics event
    this.analytics.trackWorkspaceEvent(workspaceId, 'TaskStatusChanged', {
      taskId,
      fromStatus: task.status,
      toStatus: TaskStatus.IN_PROGRESS,
      actorRole: 'admin',
    });

    // Add Sentry breadcrumb for task start
    Sentry.addBreadcrumb({
      category: 'task',
      message: `Task started: ${task.title}`,
      level: 'info',
      data: {
        taskId,
        workspaceId,
        fromStatus: task.status,
        toStatus: TaskStatus.IN_PROGRESS,
      },
    });

    this.taskGateway.sendToWorkspace(workspaceId, 'task:updated', updatedTask);

    // Notify Slack
    this.notifySlack(
      workspaceId,
      `Task updated: *${updatedTask.title}* is now *IN_PROGRESS* ${this.getTaskLink(taskId)}`,
      updatedTask.slackChannelId
    );

    // Send notification to task creator that work has started (in-app + email via NotificationService)
    if (task.createdById) {
      try {
        await this.notificationService.notifyTaskInProgress(
          task.createdById,
          workspaceId,
          taskId,
          task.title,
        );
      } catch (err) {
        console.error('[TaskService] Failed to send task in progress notification:', err);
      }
    }

    // Note: Day credits are burned once per day via scheduler, not per task transition
    return updatedTask;
  }

  /**
   * ADMIN: Move task to review (IN_PROGRESS -> IN_REVIEW)
   */
  async moveToReview(workspaceId: string, taskId: string) {
    console.log(`[moveToReview] Starting transition for task ${taskId} in workspace ${workspaceId}`);
    const task = await this.getTask(workspaceId, taskId);

    console.log(`[moveToReview] Current status: ${task.status}`);
    if (task.status !== TaskStatus.IN_PROGRESS) {
      console.error(`[moveToReview] Invalid transition: task ${taskId} is ${task.status}, not IN_PROGRESS`);
      throw new InvalidTaskTransitionException(taskId, task.status, TaskStatus.IN_REVIEW);
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.IN_REVIEW,
        inReviewAt: new Date(), // Record when task entered review for SLA pause calculation
      },
    });

    await this.logLifecycleEvent({
      taskId,
      kind: 'task_moved_to_review',
      fromStatus: TaskStatus.IN_PROGRESS,
      toStatus: TaskStatus.IN_REVIEW,
      actorRole: 'admin',
    });

    // Track TaskStatusChanged analytics event
    this.analytics.trackWorkspaceEvent(workspaceId, 'TaskStatusChanged', {
      taskId,
      fromStatus: TaskStatus.IN_PROGRESS,
      toStatus: TaskStatus.IN_REVIEW,
      actorRole: 'admin',
    });

    // Add Sentry breadcrumb for task status change
    Sentry.addBreadcrumb({
      category: 'task',
      message: `Task moved to review: ${task.title}`,
      level: 'info',
      data: {
        taskId,
        workspaceId,
        fromStatus: TaskStatus.IN_PROGRESS,
        toStatus: TaskStatus.IN_REVIEW,
      },
    });

    // Send notification to task creator that task is ready for review (in-app + email via NotificationService)
    if (task.createdById) {
      try {
        await this.notificationService.notifyTaskInReview(
          task.createdById,
          workspaceId,
          taskId,
          task.title,
        );
      } catch (err) {
        console.error('[TaskService] Failed to send task in review notification:', err);
      }
    }

    console.log(`[moveToReview] Successfully moved task ${taskId} to IN_REVIEW`);
    this.taskGateway.sendToWorkspace(workspaceId, 'task:updated', updatedTask);

    // Notify Slack
    this.notifySlack(
      workspaceId,
      `Task updated: *${updatedTask.title}* is now *IN_REVIEW* ${this.getTaskLink(taskId)}`,
      updatedTask.slackChannelId
    );

    return updatedTask;
  }

  /**
   * Auto-start next queued task
   * RULE: stress test 1 - fill active slots when one completes
   * RULE: stress test 4 - don't auto-start if subscription is CANCELED (fully ended)
   * RULE: CANCEL_AT_PERIOD_END still allows work until billing period ends
   */
  async autoStartNextQueuedTask(workspaceId: string): Promise<void> {
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);

    // Allow work for ACTIVE or CANCEL_AT_PERIOD_END (user paid for this period)
    const allowedStatuses: SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCEL_AT_PERIOD_END];
    if (!workspace.subscription?.status || !allowedStatuses.includes(workspace.subscription.status)) {
      console.log(`[autoStart] Subscription not ACTIVE for workspace ${workspaceId}, skipping`);
      return;
    }

    // Get effective active task limit
    const activeTaskLimit = this.workspaceService.getEffectiveActiveTaskLimit(workspace);

    // Count current IN_PROGRESS tasks
    const currentActiveCount = await this.prisma.task.count({
      where: {
        workspaceId,
        status: TaskStatus.IN_PROGRESS,
      },
    });

    // If at or over limit, don't start new task
    if (currentActiveCount >= activeTaskLimit) {
      console.log(`[autoStart] Active task limit reached (${currentActiveCount}/${activeTaskLimit})`);
      return;
    }

    // Find earliest QUEUED task
    const nextTask = await this.prisma.task.findFirst({
      where: {
        workspaceId,
        status: TaskStatus.QUEUED,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!nextTask) {
      console.log(`[autoStart] No queued tasks to start`);
      return;
    }

    // Start the task
    const updatedTask = await this.prisma.task.update({
      where: { id: nextTask.id },
      data: {
        status: TaskStatus.IN_PROGRESS,
        inProgressAt: new Date(),
      },
    });

    console.log(`[autoStart] Started task ${nextTask.id} for workspace ${workspaceId}`);

    // Notify Slack
    this.notifySlack(
      workspaceId,
      `Task updated: *${updatedTask.title}* is now *IN_PROGRESS* (Auto-started) ${this.getTaskLink(updatedTask.id)}`,
      updatedTask.slackChannelId
    );

    // Note: Day credits are burned once per day via scheduler, not per task transition
  }

  /**
   * Mark task as AI ineligible
   */
  async markAiIneligible(workspaceId: string, taskId: string, reason?: string) {
    const task = await this.getTask(workspaceId, taskId);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          aiEligible: false,
          aiIneligibleReason: reason || 'Marked as AI ineligible by admin',
          useAI: false, // Also disable useAI if it was set
        },
      });

      // Create admin decision comment
      await tx.taskComment.create({
        data: {
          taskId,
          kind: CommentKind.COMMENT,
          body: `❌ **AI Ineligible**: ${reason || 'Marked as AI ineligible by admin'}`,
        },
      });

      return updatedTask;
    });

    this.taskGateway.sendToWorkspace(workspaceId, 'task:updated', result);

    // Notify Slack
    this.notifySlack(
      workspaceId,
      `❌ Task marked AI ineligible: *${task.title}*\nReason: ${reason || 'Admin decision'}\n${this.getTaskLink(taskId)}`,
      task.slackChannelId
    );

    return result;
  }

  /**
   * ADMIN: Approve task scope
   * Marks task as AI eligible and creates admin decision comment
   */
  async approveTaskScope(
    workspaceId: string,
    taskId: string,
    message?: string,
    authorId?: string
  ) {
    const task = await this.getTask(workspaceId, taskId);

    // Update task eligibility in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Mark as eligible
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          aiEligible: true,
          aiIneligibleReason: null,
        },
      });

      // Create admin decision comment
      await tx.taskComment.create({
        data: {
          taskId,
          authorId,
          kind: CommentKind.ADMIN_DECISION,
          body: `✅ **Scope Approved**: ${message || 'This task has been approved and can proceed.'}`,
        },
      });

      return updatedTask;
    });

    this.taskGateway.sendToWorkspace(workspaceId, 'task:updated', result);

    // Notify Slack
    this.notifySlack(
      workspaceId,
      `✅ Task scope approved: *${task.title}*\n${message || 'Task approved to proceed'}\n${this.getTaskLink(taskId)}`,
      task.slackChannelId
    );

    return result;
  }

  /**
   * ADMIN: Reject task scope
   * Marks task as AI ineligible with reason and creates admin decision comment
   */
  async rejectTaskScope(
    workspaceId: string,
    taskId: string,
    reason: string,
    authorId?: string
  ) {
    const task = await this.getTask(workspaceId, taskId);

    // Update task eligibility in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Mark as ineligible
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          aiEligible: false,
          aiIneligibleReason: reason,
        },
      });

      // Create admin decision comment
      await tx.taskComment.create({
        data: {
          taskId,
          authorId,
          kind: CommentKind.ADMIN_DECISION,
          body: `❌ **Scope Rejected**: ${reason}`,
        },
      });

      return updatedTask;
    });

    this.taskGateway.sendToWorkspace(workspaceId, 'task:updated', result);

    // Notify Slack
    this.notifySlack(
      workspaceId,
      `❌ Task scope rejected: *${task.title}*\nReason: ${reason}\n${this.getTaskLink(taskId)}`,
      task.slackChannelId
    );

    return result;
  }

  /**
   * Duplicate task
   * Creates a copy of an existing task in QUEUED status
   */
  async duplicateTask(workspaceId: string, taskId: string) {
    const originalTask = await this.getTask(workspaceId, taskId);

    // Validate category against current plan (in case plan changed)
    const workspace = await this.workspaceService.getWorkspaceWithContext(workspaceId);
    await this.validateCategory(workspace, originalTask.category);

    // Create duplicate with attachments in transaction
    const duplicatedTask = await this.prisma.$transaction(async (tx) => {
      // Create new task
      const newTask = await tx.task.create({
        data: {
          workspaceId: originalTask.workspaceId,
          brandId: originalTask.brandId,
          title: `${originalTask.title} (Copy)`,
          description: originalTask.description,
          category: originalTask.category,
          status: TaskStatus.QUEUED,
          createdById: originalTask.createdById,
          slaSeconds: originalTask.slaSeconds,
          revisionNumber: 0,
          // Copy AI/estimator fields
          estimatedEffortHours: originalTask.estimatedEffortHours,
          displaySlaHours: originalTask.displaySlaHours,
          fits48hWindow: originalTask.fits48hWindow,
          flagForAdminReview: originalTask.flagForAdminReview,
          aiEligible: originalTask.aiEligible,
          aiIneligibleReason: originalTask.aiIneligibleReason,
          useAI: false, // Reset useAI flag
        },
      });

      // Copy attachments (references only, not files)
      if (originalTask.attachments && originalTask.attachments.length > 0) {
        await tx.attachment.createMany({
          data: originalTask.attachments.map(att => ({
            taskId: newTask.id,
            url: att.url,
            kind: att.kind,
          })),
        });
      }

      return newTask;
    });

    this.taskGateway.sendToWorkspace(workspaceId, 'task:created', duplicatedTask);

    // Notify Slack
    this.notifySlack(
      workspaceId,
      `Task duplicated: *${duplicatedTask.title}* created from *${originalTask.title}* ${this.getTaskLink(duplicatedTask.id)}`
    );

    return duplicatedTask;
  }

  /**
   * Delete task (only if QUEUED)
   */
  async deleteTask(workspaceId: string, taskId: string) {
    const task = await this.getTask(workspaceId, taskId);

    if (task.status !== TaskStatus.QUEUED) {
      throw new BadRequestException('Only QUEUED tasks can be deleted.');
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    this.notifySlack(workspaceId, `🗑️ Task deleted: *${task.title}*`, task.slackChannelId);

    return { success: true };
  }

  /**
   * Validate category against plan and taskScope.
   * 
   * All Studio plans (CORE, OPS, ENTERPRISE) allow both Design + Motion.
   * The subscription.mode field is deprecated and no longer enforced.
   */
  private async validateCategory(workspace: any, category: TaskCategory) {
    const plan = workspace.plan;

    if (!plan) {
      throw new BadRequestException('Workspace has no plan assigned');
    }

    // Check TaskScope if defined (for future extensibility)
    // Currently all plans have FULL scope (Design + Motion)
    if (plan.taskScope) {
      if (plan.taskScope === TaskScope.DESIGN_ONLY && category !== TaskCategory.DESIGN) {
        throw new BadRequestException('Your current plan is design-only. Motion tasks are not allowed on this plan.');
      }
      if (plan.taskScope === TaskScope.MOTION_ONLY && category !== TaskCategory.MOTION) {
        throw new BadRequestException('Your current plan is motion-only. Design tasks are not allowed on this plan.');
      }
    }

    // Check if category is in plan's allowed categories (Legacy/Granular check)
    if (plan.allowedCategories && plan.allowedCategories.length > 0 && !plan.allowedCategories.includes(category)) {
      throw new CategoryNotAllowedException(category, plan.code);
    }
  }

  // ========================================
  // TASK DRAFTS
  // ========================================

  /**
   * List all task drafts for a workspace
   */
  async listDrafts(workspaceId: string) {
    const drafts = await this.prisma.taskDraft.findMany({
      where: { workspaceId },
      orderBy: { lastEditedAt: 'desc' },
    });
    return drafts;
  }

  /**
   * Save a task draft (create or update)
   */
  async saveDraft(workspaceId: string, dto: any) {
    const { id, ...data } = dto;

    if (id) {
      // Update existing draft
      const existing = await this.prisma.taskDraft.findFirst({
        where: { id, workspaceId },
      });

      if (!existing) {
        throw new BadRequestException('Draft not found');
      }

      return this.prisma.taskDraft.update({
        where: { id },
        data: {
          ...data,
          lastEditedAt: new Date(),
        },
      });
    }

    // Create new draft
    return this.prisma.taskDraft.create({
      data: {
        workspaceId,
        ...data,
        lastEditedAt: new Date(),
      },
    });
  }

  /**
   * Get a single draft by ID
   */
  async getDraft(workspaceId: string, draftId: string) {
    const draft = await this.prisma.taskDraft.findFirst({
      where: { id: draftId, workspaceId },
    });

    if (!draft) {
      throw new BadRequestException('Draft not found');
    }

    return draft;
  }

  /**
   * Delete a task draft
   */
  async deleteDraft(workspaceId: string, draftId: string) {
    const draft = await this.prisma.taskDraft.findFirst({
      where: { id: draftId, workspaceId },
    });

    if (!draft) {
      throw new BadRequestException('Draft not found');
    }

    await this.prisma.taskDraft.delete({
      where: { id: draftId },
    });

    return { success: true };
  }

  /**
   * Convert a draft into a task and submit to queue
   */
  async submitDraft(workspaceId: string, draftId: string) {
    const draft = await this.getDraft(workspaceId, draftId);

    // Validate required fields
    if (!draft.title || draft.title.trim().length < 4) {
      throw new BadRequestException('Draft must have a title (at least 4 characters) to submit');
    }
    if (!draft.description || draft.description.trim().length < 10) {
      throw new BadRequestException('Draft must have a description (at least 10 characters) to submit');
    }

    // Create task from draft
    const createDto: CreateTaskDto = {
      title: draft.title,
      description: draft.description,
      category: draft.category || TaskCategory.DESIGN,
      brandId: draft.brandId || undefined,
      useAI: draft.useAI,
      structuredBriefJson: draft.structuredBriefJson,
      referenceLinksJson: draft.referenceLinksJson,
      deliverablesJson: draft.deliverablesJson,
    };

    const task = await this.createTask(workspaceId, createDto);

    // Delete draft after successful submission
    await this.prisma.taskDraft.delete({
      where: { id: draftId },
    });

    return task;
  }
}
