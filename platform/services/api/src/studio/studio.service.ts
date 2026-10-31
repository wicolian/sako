import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceNotFoundException } from '../common/exceptions/business.exceptions';
import { TaskStatus, TaskCategory, ComposerSource } from '@prisma/client';
import { hasStudioAccess, PlanCode } from '../billing/plan.config';
import { CreateTaskFromComposerDto } from './dto/from-composer.dto';
import { SlackService } from '../slack/slack.service';

@Injectable()
export class StudioService {
  private readonly logger = new Logger(StudioService.name);

  constructor(
    private prisma: PrismaService,
    private slackService: SlackService,
  ) { }

  /**
   * Get list of all workspaces (clients) with summary data
   * For studio dashboard
   */
  async listClients() {
    const workspaces = await this.prisma.workspace.findMany({
      include: {
        plan: true,
        subscription: true,
        _count: {
          select: {
            tasks: {
              where: {
                status: TaskStatus.IN_PROGRESS,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      workspaces.map(async (workspace) => {
        const queuedCount = await this.prisma.task.count({
          where: {
            workspaceId: workspace.id,
            status: TaskStatus.QUEUED,
          },
        });

        const activeDayCredit = await this.prisma.dayCredit.findFirst({
          where: {
            workspaceId: workspace.id,
            periodEnd: { gte: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });

        const activeAiCredit = await this.prisma.aICredit.findFirst({
          where: {
            workspaceId: workspace.id,
            periodEnd: { gte: new Date() },
          },
          orderBy: { createdAt: 'desc' },
        });

        return {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          planCode: workspace.plan?.code,
          subscriptionStatus: workspace.subscription?.status,
          activeTaskCount: workspace._count.tasks,
          queuedTaskCount: queuedCount,
          dayCredits: activeDayCredit
            ? {
              used: activeDayCredit.usedCredits,
              total: activeDayCredit.totalCredits,
            }
            : null,
          aiCredits: activeAiCredit
            ? {
              used: activeAiCredit.usedCredits,
              total: activeAiCredit.totalCredits,
            }
            : null,
        };
      }),
    );
  }

  /**
   * Get detailed view of a specific workspace/client
   * For studio client detail page
   */
  async getClientDetail(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        plan: true,
        subscription: true,
      },
    });

    if (!workspace) {
      throw new WorkspaceNotFoundException(workspaceId);
    }

    // Get task counts by status
    const taskCounts = await this.prisma.task.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: true,
    });

    const countsByStatus = taskCounts.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    // Get recent tasks (last 10)
    const recentTasks = await this.prisma.task.findMany({
      where: { workspaceId },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get credit summaries
    const dayCredits = await this.prisma.dayCredit.findMany({
      where: {
        workspaceId,
        periodEnd: { gte: new Date() },
      },
      orderBy: { periodEnd: 'asc' },
    });

    const aiCredits = await this.prisma.aICredit.findMany({
      where: {
        workspaceId,
        periodEnd: { gte: new Date() },
      },
      orderBy: { periodEnd: 'asc' },
    });

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        timezone: workspace.timezone,
      },
      plan: workspace.plan,
      subscription: workspace.subscription,
      taskCounts: {
        queued: countsByStatus[TaskStatus.QUEUED] || 0,
        inProgress: countsByStatus[TaskStatus.IN_PROGRESS] || 0,
        inReview: countsByStatus[TaskStatus.IN_REVIEW] || 0,
        completed: countsByStatus[TaskStatus.COMPLETED] || 0,
        paused: countsByStatus[TaskStatus.PAUSED] || 0,
      },
      recentTasks,
      credits: {
        dayCredits: dayCredits.map((dc) => ({
          total: dc.totalCredits,
          used: dc.usedCredits,
          remaining: dc.totalCredits - dc.usedCredits,
          periodEnd: dc.periodEnd,
        })),
        aiCredits: aiCredits.map((ac) => ({
          total: ac.totalCredits,
          used: ac.usedCredits,
          remaining: ac.totalCredits - ac.usedCredits,
          periodEnd: ac.periodEnd,
        })),
      },
    };
  }

  /**
   * Get tasks across workspaces (or scoped to workspace via header)
   * For studio tasks list view
   */
  async listTasks(workspaceId?: string) {
    const where = workspaceId ? { workspaceId } : {};

    return this.prisma.task.findMany({
      where,
      take: 100, // limit for now
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
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
      orderBy: [
        { status: 'asc' }, // prioritize IN_PROGRESS, IN_REVIEW
        { updatedAt: 'desc' },
      ],
    });
  }

  async getTaskById(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        brand: true, // Include all brand fields for admin view
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
        estimateSnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
    });

    if (!task) {
      throw new WorkspaceNotFoundException(taskId);
    }

    return task;
  }

  /**
   * Aggregated metrics across all workspaces for Studio dashboard
   */
  async getAggregatedMetrics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Completed tasks in last 30 days
    const completedTasks = await this.prisma.task.findMany({
      where: {
        status: TaskStatus.COMPLETED,
        completedAt: { gte: thirtyDaysAgo },
      },
      select: {
        inProgressAt: true,
        completedAt: true,
        revisionNumber: true,
      },
    });

    const tasksCompletedLast30Days = completedTasks.length;

    // Average turnaround time (in hours)
    let totalSlaSeconds = 0;
    let slaCount = 0;
    let firstPassCount = 0;

    for (const t of completedTasks) {
      if (t.inProgressAt && t.completedAt) {
        const durationSeconds =
          (t.completedAt.getTime() - t.inProgressAt.getTime()) / 1000;
        totalSlaSeconds += durationSeconds;
        slaCount++;
      }
      if (t.revisionNumber === 0) {
        firstPassCount++;
      }
    }

    const averageTurnaroundHours =
      slaCount > 0 && !isNaN(totalSlaSeconds)
        ? Math.round((totalSlaSeconds / slaCount / 3600) * 10) / 10
        : null;

    const rawFpar =
      tasksCompletedLast30Days > 0
        ? Math.round((firstPassCount / tasksCompletedLast30Days) * 100)
        : null;

    const firstPassAcceptanceRate =
      rawFpar !== null ? Math.min(100, Math.max(0, rawFpar)) : null;

    return {
      tasksCompletedLast30Days,
      averageTurnaroundHours,
      firstPassAcceptanceRate,
    };
  }

  /**
   * Create a Studio task from a Composer draft
   * Only available for Studio plans (Core/Ops/Enterprise)
   */
  async createTaskFromComposer(
    workspaceId: string,
    dto: CreateTaskFromComposerDto,
    userId?: string,
  ) {
    this.logger.log(`Creating task from Composer draft ${dto.composerDraftId} for workspace ${workspaceId}`);

    // 1. Get workspace with subscription info
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        subscription: true,
        plan: true,
      },
    });

    if (!workspace) {
      throw new WorkspaceNotFoundException(workspaceId);
    }

    // 2. Validate Studio access
    const planCode = (workspace.subscription?.planCode || 'COMPOSER_FREE') as PlanCode;
    if (!hasStudioAccess(planCode)) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Your plan does not include Studio access. Upgrade to Core, Ops, or Enterprise to send Composer designs to the Studio.',
        code: 'PLAN_DOES_NOT_INCLUDE_STUDIO',
        errorCode: 'PLAN_DOES_NOT_INCLUDE_STUDIO',
      });
    }

    // 3. Fetch the Composer draft and validate it belongs to this workspace
    const draft = await this.prisma.aiDraft.findFirst({
      where: {
        id: dto.composerDraftId,
        workspaceId,
      },
      include: {
        brand: true,
      },
    });

    if (!draft) {
      throw new NotFoundException('Composer draft not found or does not belong to this workspace');
    }

    // 4. Check active task limit
    const activeTaskLimit = workspace.subscription?.activeTaskLimit ?? workspace.plan?.activeTaskLimit ?? 1;
    const activeTaskCount = await this.prisma.task.count({
      where: {
        workspaceId,
        status: TaskStatus.IN_PROGRESS,
      },
    });

    // Determine initial status based on capacity
    const initialStatus = activeTaskCount < activeTaskLimit ? TaskStatus.IN_PROGRESS : TaskStatus.QUEUED;

    // 5. Export URL is set via Composer's published page (if any)
    // PublishedPage model now lives in sako-composer; URL passed in DTO if needed
    const composerExportUrl: string | null = null;

    // 6. Determine brand ID (from DTO or draft)
    const brandId = dto.brandId || draft.brandId;

    // 7. Build task title and description
    const taskTitle = dto.title || draft.primaryHeadline || draft.variantLabel || 'Design from Composer';
    const taskDescription = dto.description || 
      `Design generated in Composer.\n\n${dto.expectedOutput ? `Expected Output: ${dto.expectedOutput}` : 'Please review the AI-generated design and produce final production assets.'}`;

    // 8. Create the task
    const task = await this.prisma.task.create({
      data: {
        workspaceId,
        brandId,
        title: taskTitle,
        description: taskDescription,
        category: TaskCategory.DESIGN,
        status: initialStatus,
        source: ComposerSource.COMPOSER_STANDALONE,
        composerExportUrl,
        createdById: userId || null,
        aiDraftRequested: true,
        aiDraftStatus: 'READY',
        aiDraftSelectedId: dto.composerDraftId, // Links to the AiDraft record
        inProgressAt: initialStatus === TaskStatus.IN_PROGRESS ? new Date() : null,
      },
      include: {
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        brand: {
          select: { id: true, name: true },
        },
      },
    });

    this.logger.log(`Created task ${task.id} from Composer draft ${dto.composerDraftId}, status: ${initialStatus}`);

    // 9. Send Slack notification if workspace has Slack integration
    try {
      await this.slackService.notifyTaskStatusChanged(
        workspaceId,
        task.id,
        taskTitle,
        'NEW',
        initialStatus,
      );
    } catch (err) {
      this.logger.warn(`Failed to send Slack notification for task ${task.id}: ${err}`);
    }

    return {
      task,
      message: initialStatus === TaskStatus.IN_PROGRESS
        ? 'Task created and started! Your Sako designers are now working on it.'
        : 'Task queued! It will start once your current tasks are completed.',
    };
  }
}
