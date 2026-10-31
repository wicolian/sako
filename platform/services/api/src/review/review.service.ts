import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../common/notifications/notification.service';
import { ReviewAssetType, ReviewRevisionStatus, ReviewAnnotationKind, UserRole, WorkspaceRole } from '@prisma/client';
import { TaskGateway } from '../task/task.gateway';

export interface CreateAssetDto {
  type: ReviewAssetType;
  title: string;
  sourceUrl: string;
}

export interface CreateRevisionDto {
  label?: string;
  fileUrl?: string;
}

export interface CreateAnnotationDto {
  kind: ReviewAnnotationKind;
  text: string;
  payload: Record<string, any>; // { x, y, page } | { time } | { frameId }
  parentId?: string;
}

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private taskGateway: TaskGateway,
  ) { }

  /**
   * Get the review board for a task
   */
  async getReviewBoard(taskId: string, userId: string, isAdmin: boolean) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        workspace: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
        reviewAssets: {
          include: {
            revisions: {
              include: {
                annotations: {
                  include: {
                    replies: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check access - either admin or workspace member
    const isWorkspaceMember = task.workspace.members.some((member) => member.userId === userId);
    if (!isAdmin && !isWorkspaceMember) {
      throw new ForbiddenException('You do not have access to this task');
    }

    const assets = [...task.reviewAssets];

    // Ensure attachments are represented as review assets/revisions (attachments are canonical)
    for (const attachment of task.attachments) {
      const existingIndex = assets.findIndex((a) => a.sourceUrl === attachment.url);
      let asset = existingIndex >= 0 ? assets[existingIndex] : undefined;
      const authorId = this.getFallbackAuthorId(task, userId);

      if (!asset) {
        asset = await this.prisma.reviewAsset.create({
          data: {
            taskId: task.id,
            type: this.inferAssetTypeFromUrl(attachment.url),
            title: this.extractTitleFromUrl(attachment.url),
            sourceUrl: attachment.url,
            createdById: authorId,
            revisions: {
              create: {
                label: 'Rev 1',
                isCurrent: true,
                status: ReviewRevisionStatus.IN_REVIEW,
                fileUrl: attachment.url,
                createdById: authorId,
              },
            },
          },
          include: {
            revisions: {
              include: {
                annotations: {
                  include: {
                    replies: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        });
        assets.push(asset);
      } else if (!asset.revisions || asset.revisions.length === 0) {
        const revision = await this.prisma.reviewAssetRevision.create({
          data: {
            assetId: asset.id,
            label: 'Rev 1',
            isCurrent: true,
            status: ReviewRevisionStatus.IN_REVIEW,
            fileUrl: attachment.url,
            createdById: authorId,
          },
        });
        asset = {
          ...asset,
          revisions: [{ ...revision, annotations: [] }],
        } as any;
      }

      if (asset) {
        // Ensure exactly one current revision
        const hasCurrent = asset.revisions?.some((rev) => rev.isCurrent);
        if (!hasCurrent && asset.revisions && asset.revisions.length > 0) {
          const latestRevision = asset.revisions[0];
          await this.prisma.reviewAssetRevision.update({
            where: { id: latestRevision.id },
            data: { isCurrent: true },
          });
          latestRevision.isCurrent = true;
        }

        if (existingIndex >= 0) {
          assets[existingIndex] = asset;
        }
      }
    }

    const authorDirectory = await this.buildAuthorDirectory(task);

    return {
      taskId: task.id,
      taskTitle: task.title,
      taskStatus: task.status,
      assets: assets.map(asset => ({
        id: asset.id,
        type: asset.type,
        title: asset.title,
        sourceUrl: asset.sourceUrl,
        createdAt: asset.createdAt,
        revisions: asset.revisions.map(rev => ({
          id: rev.id,
          label: rev.label,
          isCurrent: rev.isCurrent,
          status: rev.status,
          fileUrl: rev.fileUrl,
          createdAt: rev.createdAt,
          annotations: rev.annotations.map(ann => this.mapAnnotationWithAuthor(ann as any, authorDirectory)),
        })),
        currentRevision: asset.revisions.find(r => r.isCurrent) || asset.revisions[0],
      })),
    };
  }

  /**
   * Create a new review asset for a task
   */
  async createAsset(taskId: string, dto: CreateAssetDto, userId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const asset = await this.prisma.reviewAsset.create({
      data: {
        taskId,
        type: dto.type,
        title: dto.title,
        sourceUrl: dto.sourceUrl,
        createdById: userId,
        revisions: {
          create: {
            label: 'v1',
            isCurrent: true,
            status: ReviewRevisionStatus.DRAFT,
            fileUrl: dto.sourceUrl,
            createdById: userId,
          },
        },
      },
      include: {
        revisions: true,
      },
    });

    this.logger.log(`Created review asset ${asset.id} for task ${taskId}`);
    this.taskGateway.sendToWorkspace(task.workspaceId, 'review:asset:created', asset);
    return asset;
  }

  /**
   * Create a new revision for an asset
   */
  async createRevision(assetId: string, dto: CreateRevisionDto, userId: string) {
    const asset = await this.prisma.reviewAsset.findUnique({
      where: { id: assetId },
      include: {
        revisions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Determine version label
    const existingCount = asset.revisions.length;
    const label = dto.label || `v${existingCount + 1}`;

    // Mark all existing revisions as not current
    await this.prisma.reviewAssetRevision.updateMany({
      where: { assetId },
      data: { isCurrent: false },
    });

    // Create new revision
    const revision = await this.prisma.reviewAssetRevision.create({
      data: {
        assetId,
        label,
        isCurrent: true,
        status: ReviewRevisionStatus.IN_REVIEW,
        fileUrl: dto.fileUrl || asset.sourceUrl,
        createdById: userId,
      },
    });

    this.logger.log(`Created revision ${revision.id} for asset ${assetId}`);

    const task = await this.prisma.task.findUnique({ where: { id: asset.taskId } });
    if (task) {
      this.taskGateway.sendToWorkspace(task.workspaceId, 'review:revision:created', revision);

      // Notify task creator about new revision uploaded
      if (task.createdById) {
        try {
          await this.notificationService.notifyNewRevisionUploaded(
            task.createdById,
            task.workspaceId,
            task.id,
            task.title,
            label,
            asset.title,
          );
        } catch (err) {
          this.logger.error(`Failed to send revision notification: ${err.message}`);
        }
      }
    }

    return revision;
  }

  /**
   * Create an annotation on a revision
   */
  async createAnnotation(revisionId: string, dto: CreateAnnotationDto, userId: string) {
    const revision = await this.prisma.reviewAssetRevision.findUnique({
      where: { id: revisionId },
      include: {
        asset: true,
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    const annotation = await this.prisma.reviewAnnotation.create({
      data: {
        taskId: revision.asset.taskId,
        assetId: revision.assetId,
        assetRevisionId: revisionId,
        authorId: userId,
        kind: dto.kind,
        text: dto.text,
        payload: dto.payload,
        parentId: dto.parentId,
      },
    });

    this.logger.log(`Created annotation ${annotation.id} on revision ${revisionId}`);

    const task = await this.prisma.task.findUnique({ where: { id: revision.asset.taskId } });
    if (task) {
      this.taskGateway.sendToWorkspace(task.workspaceId, 'review:annotation:created', annotation);

      // Notify about new review comment (skip if it's a reply - only notify for top-level comments)
      if (!dto.parentId && task.createdById) {
        try {
          // Get commenter details
          const commenter = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true, role: true },
          });
          const commenterName = commenter?.name || commenter?.email || 'Someone';
          const isAdminCommenter = commenter?.role === 'ADMIN' || commenter?.role === 'PENDING_ADMIN';
          const commentPreview = dto.text.length > 100 ? dto.text.slice(0, 100) + '...' : dto.text;

          await this.notificationService.notifyReviewComment(
            task.createdById,
            task.workspaceId,
            task.id,
            task.title,
            commenterName,
            commentPreview,
            isAdminCommenter,
          );
        } catch (err) {
          this.logger.error(`Failed to send review comment notification: ${err.message}`);
        }
      }
    }

    return annotation;
  }

  /**
   * Reply to an annotation
   */
  async replyToAnnotation(parentAnnotationId: string, text: string, userId: string) {
    const parent = await this.prisma.reviewAnnotation.findUnique({
      where: { id: parentAnnotationId },
    });

    if (!parent) {
      throw new NotFoundException('Parent annotation not found');
    }

    // Create reply using parent's context
    return this.createAnnotation(parent.assetRevisionId, {
      kind: parent.kind,
      text,
      payload: parent.payload as Record<string, any>, // Inherit position/context
      parentId: parentAnnotationId,
    }, userId);
  }

  /**
   * Resolve an annotation
   */
  async resolveAnnotation(annotationId: string, userId: string) {
    const annotation = await this.prisma.reviewAnnotation.findUnique({
      where: { id: annotationId },
    });

    if (!annotation) {
      throw new NotFoundException('Annotation not found');
    }

    const updated = await this.prisma.reviewAnnotation.update({
      where: { id: annotationId },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedById: userId,
      },
    });

    this.logger.log(`Resolved annotation ${annotationId}`);

    const task = await this.prisma.task.findUnique({ where: { id: annotation.taskId } });
    if (task) {
      this.taskGateway.sendToWorkspace(task.workspaceId, 'review:annotation:updated', updated);
    }

    return updated;
  }

  /**
   * Unresolve an annotation
   */
  async unresolveAnnotation(annotationId: string) {
    const annotation = await this.prisma.reviewAnnotation.findUnique({
      where: { id: annotationId },
    });

    if (!annotation) {
      throw new NotFoundException('Annotation not found');
    }

    const updated = await this.prisma.reviewAnnotation.update({
      where: { id: annotationId },
      data: {
        resolved: false,
        resolvedAt: null,
        resolvedById: null,
      },
    });

    this.logger.log(`Unresolved annotation ${annotationId}`);

    const task = await this.prisma.task.findUnique({ where: { id: annotation.taskId } });
    if (task) {
      this.taskGateway.sendToWorkspace(task.workspaceId, 'review:annotation:updated', updated);
    }

    return updated;
  }

  /**
   * Request changes on a revision
   */
  async requestChanges(revisionId: string, feedback: string, userId: string) {
    const revision = await this.prisma.reviewAssetRevision.findUnique({
      where: { id: revisionId },
      include: {
        asset: {
          include: {
            task: true,
          },
        },
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    // Update revision status
    await this.prisma.reviewAssetRevision.update({
      where: { id: revisionId },
      data: { status: ReviewRevisionStatus.CHANGES_REQUESTED },
    });

    // Create annotation for the feedback
    await this.prisma.reviewAnnotation.create({
      data: {
        taskId: revision.asset.taskId,
        assetId: revision.assetId,
        assetRevisionId: revisionId,
        authorId: userId,
        kind: ReviewAnnotationKind.EMBED_REF, // Generic comment
        text: feedback,
        payload: { type: 'change_request' },
        resolved: false,
      },
    });

    // Notify task creator about revision request
    if (revision.asset.task.createdById) {
      await this.notificationService.notifyRevisionRequested(
        revision.asset.task.createdById,
        revision.asset.task.workspaceId,
        revision.asset.task.id,
        revision.asset.task.title,
        feedback,
      );
    }

    this.logger.log(`Requested changes on revision ${revisionId}`);

    this.taskGateway.sendToWorkspace(revision.asset.task.workspaceId, 'review:revision:updated', {
      id: revisionId,
      status: ReviewRevisionStatus.CHANGES_REQUESTED,
    });

    return { success: true };
  }

  /**
   * Mark a revision as completed/approved
   */
  async markCompleted(revisionId: string, userId: string) {
    const revision = await this.prisma.reviewAssetRevision.findUnique({
      where: { id: revisionId },
      include: {
        asset: {
          include: {
            task: true,
          },
        },
      },
    });

    if (!revision) {
      throw new NotFoundException('Revision not found');
    }

    await this.prisma.reviewAssetRevision.update({
      where: { id: revisionId },
      data: { status: ReviewRevisionStatus.APPROVED },
    });

    this.logger.log(`Marked revision ${revisionId} as completed`);

    this.taskGateway.sendToWorkspace(revision.asset.task.workspaceId, 'review:revision:updated', {
      id: revisionId,
      status: ReviewRevisionStatus.APPROVED,
    });

    return { success: true };
  }

  private inferAssetTypeFromUrl(url: string): ReviewAssetType {
    // Strip query params from URL if present
    const cleanUrl = (url || '').split('?')[0].toLowerCase();
    if (cleanUrl.includes('figma.com')) return ReviewAssetType.FIGMA;
    if (cleanUrl.endsWith('.pdf')) return ReviewAssetType.PDF;
    if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.webm')) return ReviewAssetType.VIDEO;
    if (cleanUrl.endsWith('.json') || cleanUrl.endsWith('.lottie')) return ReviewAssetType.LOTTIE;
    if (cleanUrl.endsWith('.riv') || cleanUrl.includes('rive.app')) return ReviewAssetType.RIVE;
    if (cleanUrl.match(/\.(png|jpg|jpeg|gif|webp)$/)) return ReviewAssetType.IMAGE;
    return ReviewAssetType.EMBED;
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const parts = url.split('/');
      const last = parts[parts.length - 1];
      return decodeURIComponent(last || 'Asset');
    } catch {
      return 'Asset';
    }
  }

  private getFallbackAuthorId(task: any, userId: string): string {
    return task.createdById
      || userId
      || task.workspace.members.find((m: any) => m.role === 'OWNER')?.userId
      || task.workspace.members[0]?.userId;
  }

  private async buildAuthorDirectory(task: any) {
    const authorIds = new Set<string>();

    for (const asset of task.reviewAssets) {
      for (const revision of asset.revisions) {
        for (const annotation of revision.annotations) {
          if (annotation.authorId) {
            authorIds.add(annotation.authorId);
          }
          if ((annotation as any).replies) {
            for (const reply of (annotation as any).replies) {
              if (reply.authorId) {
                authorIds.add(reply.authorId);
              }
            }
          }
        }
      }
    }

    const directory = new Map<string, any>();

    for (const member of task.workspace.members) {
      if (member.user) {
        directory.set(member.userId, {
          id: member.userId,
          name: member.user.name,
          email: member.user.email,
          role: member.user.role as UserRole,
          workspaceRole: member.role as WorkspaceRole,
        });
      }
    }

    const missing = [...authorIds].filter(id => !directory.has(id));
    if (missing.length > 0) {
      const fallbackUsers = await this.prisma.user.findMany({
        where: {
          id: {
            in: missing,
          },
        },
      });
      for (const user of fallbackUsers) {
        directory.set(user.id, {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          workspaceRole: null,
        });
      }
    }

    return directory;
  }

  private mapAnnotationWithAuthor(annotation: any, directory: Map<string, any>) {
    return {
      id: annotation.id,
      kind: annotation.kind,
      text: annotation.text,
      payload: annotation.payload,
      resolved: annotation.resolved,
      createdAt: annotation.createdAt,
      resolvedAt: annotation.resolvedAt,
      parentId: annotation.parentId,
      authorId: annotation.authorId,
      author: directory.get(annotation.authorId) || {
        id: annotation.authorId,
        name: 'Reviewer',
        email: undefined,
        role: UserRole.CLIENT,
        workspaceRole: null,
      },
      replies: (annotation.replies || []).map((reply: any) => this.mapAnnotationWithAuthor(reply, directory)),
    };
  }
}
