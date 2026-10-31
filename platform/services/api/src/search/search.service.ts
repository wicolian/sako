import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchResult {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    category: string;
    workspaceId: string;
    workspaceName?: string;
    createdAt: Date;
  }>;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Search for tasks and workspaces
   * @param query - Search query string
   * @param scope - 'client' for user's workspaces only, 'studio' for all (admin only)
   * @param userId - Current user's ID (for client scope)
   * @param limit - Max results per category
   */
  async search(
    query: string,
    scope: 'client' | 'studio',
    userId?: string,
    limit: number = 10,
  ): Promise<SearchResult> {
    if (!query || query.trim().length < 2) {
      return { tasks: [], workspaces: [] };
    }

    const searchTerm = query.trim();
    
    // Build workspace filter based on scope
    let workspaceIds: string[] | undefined;
    
    if (scope === 'client' && userId) {
      // Client scope: only search within user's workspaces
      const memberships = await this.prisma.workspaceMember.findMany({
        where: { userId },
        select: { workspaceId: true },
      });
      workspaceIds = memberships.map(m => m.workspaceId);
      
      if (workspaceIds.length === 0) {
        return { tasks: [], workspaces: [] };
      }
    }
    // Studio scope: search all (no workspace filter)

    // Search tasks
    const tasks = await this.prisma.task.findMany({
      where: {
        AND: [
          workspaceIds ? { workspaceId: { in: workspaceIds } } : {},
          {
            OR: [
              { title: { contains: searchTerm, mode: 'insensitive' } },
              { description: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        ],
      },
      include: {
        workspace: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Search workspaces
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        AND: [
          workspaceIds ? { id: { in: workspaceIds } } : {},
          {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { slug: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    this.logger.debug(`Search for "${searchTerm}" (scope: ${scope}) returned ${tasks.length} tasks, ${workspaces.length} workspaces`);

    return {
      tasks: tasks.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description.substring(0, 200),
        status: t.status,
        category: t.category,
        workspaceId: t.workspaceId,
        workspaceName: t.workspace?.name,
        createdAt: t.createdAt,
      })),
      workspaces,
    };
  }
}

