import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { computeSlaFields } from '../common/utils/sla.util';
import { TaskStatus } from '@prisma/client';

interface SlaPerformanceMetrics {
  /** On-time completion rate as a percentage (0-100) */
  onTimeRate: number;
  /** Average turnaround time in hours for completed tasks */
  averageTurnaroundHours: number;
  /** Total tasks completed in the period */
  tasksCompletedThisMonth: number;
  /** Number of SLA credits issued in the period */
  slaCreditsIssuedThisMonth: number;
  /** Number of tasks currently at risk (< 6h remaining) */
  tasksAtRisk: number;
  /** Number of tasks currently late */
  tasksLate: number;
  /** Period this data covers (ISO date string) */
  periodStart: string;
  periodEnd: string;
}

@ApiTags('Admin Metrics')
@Controller('admin/metrics')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth()
export class AdminMetricsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/v1/admin/metrics/sla-performance
   * Returns SLA performance metrics for the studio
   */
  @Get('sla-performance')
  @ApiOperation({
    summary: 'Get SLA performance metrics',
    description: 'Returns on-time rate, average turnaround, credits issued, and at-risk tasks',
  })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default: 30)' })
  async getSlaPerformance(@Query('days') days?: string): Promise<SlaPerformanceMetrics> {
    const lookbackDays = parseInt(days || '30', 10);
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - lookbackDays);
    periodStart.setHours(0, 0, 0, 0);

    // Get completed tasks in the period
    const completedTasks = await this.prisma.task.findMany({
      where: {
        status: TaskStatus.COMPLETED,
        completedAt: { gte: periodStart },
      },
      include: {
        workspace: {
          include: {
            subscription: true,
          },
        },
      },
    });

    // Calculate on-time rate and average turnaround
    let onTimeCount = 0;
    let totalTurnaroundSeconds = 0;
    let validTurnaroundCount = 0;

    for (const task of completedTasks) {
      // Compute SLA fields at completion time
      const completedAt = task.completedAt || now;
      const subscriptionPause = task.workspace?.subscription?.pausedAt
        ? {
            pausedAt: task.workspace.subscription.pausedAt,
            totalPausedSeconds: task.workspace.subscription.totalPausedSeconds ?? 0,
          }
        : undefined;

      const slaFields = computeSlaFields(task, completedAt, subscriptionPause);

      if (!slaFields.slaIsLate) {
        onTimeCount++;
      }

      // Calculate turnaround time
      if (task.inProgressAt && task.completedAt) {
        const turnaround = (task.completedAt.getTime() - new Date(task.inProgressAt).getTime()) / 1000;
        // Subtract client wait time for accurate turnaround
        const effectiveTurnaround = turnaround - (task.totalClientWaitSeconds ?? 0);
        if (effectiveTurnaround > 0) {
          totalTurnaroundSeconds += effectiveTurnaround;
          validTurnaroundCount++;
        }
      }
    }

    const onTimeRate = completedTasks.length > 0 
      ? Math.round((onTimeCount / completedTasks.length) * 100 * 10) / 10 
      : 100;

    const averageTurnaroundHours = validTurnaroundCount > 0
      ? Math.round((totalTurnaroundSeconds / validTurnaroundCount / 3600) * 10) / 10
      : 0;

    // Count SLA credits issued in the period
    const slaCreditsIssued = await this.prisma.dayCreditHistory.count({
      where: {
        action: 'SLA_REFUND',
        createdAt: { gte: periodStart },
      },
    });

    // Get current at-risk and late tasks
    const inProgressTasks = await this.prisma.task.findMany({
      where: {
        status: TaskStatus.IN_PROGRESS,
        inProgressAt: { not: null },
      },
      include: {
        workspace: {
          include: {
            subscription: true,
          },
        },
      },
    });

    let tasksAtRisk = 0;
    let tasksLate = 0;
    const SIX_HOURS_SECONDS = 6 * 60 * 60;

    for (const task of inProgressTasks) {
      const subscriptionPause = task.workspace?.subscription?.pausedAt
        ? {
            pausedAt: task.workspace.subscription.pausedAt,
            totalPausedSeconds: task.workspace.subscription.totalPausedSeconds ?? 0,
          }
        : undefined;

      const slaFields = computeSlaFields(task, now, subscriptionPause);

      if (slaFields.slaIsLate) {
        tasksLate++;
      } else if ((slaFields.slaRemainingSeconds ?? 0) <= SIX_HOURS_SECONDS) {
        tasksAtRisk++;
      }
    }

    return {
      onTimeRate,
      averageTurnaroundHours,
      tasksCompletedThisMonth: completedTasks.length,
      slaCreditsIssuedThisMonth: slaCreditsIssued,
      tasksAtRisk,
      tasksLate,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
    };
  }
}


