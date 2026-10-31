import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

/**
 * Extract workspace ID from the authenticated user context.
 * Reads from x-workspace-id header (validated by WorkspaceMemberGuard).
 * Falls back to token workspace ID if present (for future JWT-based workspace context).
 */
export const WorkspaceId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<any>();
    
    // Try to get workspace ID from header (standard multi-workspace pattern)
    const headerWorkspaceId = request.headers['x-workspace-id'];
    const workspaceId = Array.isArray(headerWorkspaceId) 
      ? headerWorkspaceId[0] 
      : headerWorkspaceId;

    if (workspaceId && typeof workspaceId === 'string') {
      // WorkspaceMemberGuard will validate that the user has access to this workspace
      return workspaceId;
    }

    // Fallback to token-based workspace ID (if set by custom middleware)
    const tokenWorkspaceId =
      request.workspaceFromToken || request.user?.workspaceId;
    if (tokenWorkspaceId && typeof tokenWorkspaceId === 'string') {
      return tokenWorkspaceId;
    }

      throw new BadRequestException('Missing or invalid x-workspace-id header');
  },
);

/**
 * Optional workspace ID - returns null if not present
 */
export const OptionalWorkspaceId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<any>();
    
    // Try to get workspace ID from header (standard multi-workspace pattern)
    const headerWorkspaceId = request.headers['x-workspace-id'];
    const workspaceId = Array.isArray(headerWorkspaceId) 
      ? headerWorkspaceId[0] 
      : headerWorkspaceId;

    if (workspaceId && typeof workspaceId === 'string') {
      return workspaceId;
    }

    // Fallback to token-based workspace ID (if set by custom middleware)
    const tokenWorkspaceId =
      request.workspaceFromToken || request.user?.workspaceId;
    if (tokenWorkspaceId && typeof tokenWorkspaceId === 'string') {
      return tokenWorkspaceId;
    }

      return null;
  },
);
