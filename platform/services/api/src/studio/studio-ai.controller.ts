import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Controller('studio/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(WorkspaceRole.OWNER)
export class StudioAiController {
    constructor(private prisma: PrismaService) { }

    @Get('tasks-summary')
    async getTasksSummary() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const tasks = await this.prisma.task.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: {
                id: true,
                structuredBriefJson: true,
                revisionNumber: true,
                estimatedEffortHours: true,
                inProgressAt: true,
                completedAt: true,
                category: true,
            }
        });

        const totalTasks = tasks.length;
        const tasksWithStructuredBrief = tasks.filter(t => t.structuredBriefJson).length;

        // Breakdown by primaryAssetType
        const assetTypeCounts: Record<string, number> = {};
        tasks.forEach(t => {
            if (t.structuredBriefJson) {
                const brief = t.structuredBriefJson as any;
                const type = brief.primaryAssetType || 'unknown';
                assetTypeCounts[type] = (assetTypeCounts[type] || 0) + 1;
            }
        });
        const assetTypeBreakdown = Object.entries(assetTypeCounts).map(([type, count]) => ({ primaryAssetType: type, count }));

        // Avg revisions
        const avgRevisionCount = totalTasks ? tasks.reduce((sum, t) => sum + t.revisionNumber, 0) / totalTasks : 0;

        // Estimator stats
        const tasksWithEstimateAndActual = tasks.filter(t => t.estimatedEffortHours && t.inProgressAt && t.completedAt);
        const estimatorStats = {
            sampleSize: tasksWithEstimateAndActual.length,
            averageEstimatedEffortHours: 0,
            averageActualTurnaroundHours: 0,
            averageAbsoluteErrorHours: 0,
        };

        if (tasksWithEstimateAndActual.length > 0) {
            let totalEst = 0;
            let totalActual = 0;
            let totalError = 0;

            tasksWithEstimateAndActual.forEach(t => {
                const est = t.estimatedEffortHours!;
                const actualMs = new Date(t.completedAt!).getTime() - new Date(t.inProgressAt!).getTime();
                const actualHours = actualMs / (1000 * 60 * 60);

                totalEst += est;
                totalActual += actualHours;
                totalError += Math.abs(est - actualHours);
            });

            estimatorStats.averageEstimatedEffortHours = totalEst / tasksWithEstimateAndActual.length;
            estimatorStats.averageActualTurnaroundHours = totalActual / tasksWithEstimateAndActual.length;
            estimatorStats.averageAbsoluteErrorHours = totalError / tasksWithEstimateAndActual.length;
        }

        return {
            totalTasks,
            tasksWithStructuredBrief,
            percentWithStructuredBrief: totalTasks ? (tasksWithStructuredBrief / totalTasks) * 100 : 0,
            assetTypeBreakdown,
            avgRevisionCount,
            estimatorStats,
        };
    }

    @Get('recent-estimates')
    async getRecentEstimates() {
        const snapshots = await this.prisma.taskEstimateSnapshot.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: {
                task: {
                    select: {
                        revisionNumber: true,
                        inProgressAt: true,
                        completedAt: true,
                    }
                },
                workspace: {
                    select: { name: true }
                }
            }
        });

        return snapshots.map(s => {
            let actualTurnaroundHours: number | undefined;
            if (s.task?.inProgressAt && s.task?.completedAt) {
                const ms = new Date(s.task.completedAt).getTime() - new Date(s.task.inProgressAt).getTime();
                actualTurnaroundHours = ms / (1000 * 60 * 60);
            }

            const brief = s.structuredBriefJson as any;

            return {
                snapshotId: s.id,
                taskId: s.taskId,
                workspaceName: s.workspace.name,
                brandName: s.brandName,
                goal: brief?.goal,
                audience: brief?.audience,
                primaryAssetType: brief?.primaryAssetType,
                estimatedEffortHours: s.estimatedEffortHoursRaw,
                actualTurnaroundHours,
                revisionCount: s.task?.revisionNumber,
                createdAt: s.createdAt,
            };
        });
    }
}
