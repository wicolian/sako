/**
 * Workspace Resolution Utilities
 * 
 * Provides helpers for resolving and validating workspace coimport { Database } from '@/lib/supabase/types'

type WorkspaceMemberRow = Database['public']['Tables']['workspace_members']['Row']
type WorkspaceSettingsRow = Database['public']['Tables']['workspace_settings']['Row']
ntext.
 * Replaces hardcoded DEMO_WORKSPACE_ID with session-based workspace resolution.
 */

import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Header keys for workspace context (set by middleware)
export const WORKSPACE_ID_HEADER = 'x-workspace-id'
export const USER_ID_HEADER = 'x-user-id'
export const USER_ROLE_HEADER = 'x-user-role'

export type WorkspaceMemberRole = 'admin' | 'reviewer' | 'member'

export interface WorkspaceContext {
  workspaceId: string
  userId: string
  role: WorkspaceMemberRole
}

/**
 * Extract workspace ID from request headers (set by middleware)
 * Throws if workspace context is not available
 */
export function getWorkspaceId(request: Request | NextRequest): string {
  const workspaceId = request.headers.get(WORKSPACE_ID_HEADER)
  if (!workspaceId) {
    throw new WorkspaceError('Workspace not found in request context', 'WORKSPACE_NOT_FOUND')
  }
  return workspaceId
}

/**
 * Extract user ID from request headers (set by middleware)
 * Throws if user context is not available
 */
export function getUserId(request: Request | NextRequest): string {
  const userId = request.headers.get(USER_ID_HEADER)
  if (!userId) {
    throw new WorkspaceError('User context not found. Please sign in.', 'USER_NOT_FOUND')
  }
  return userId
}

/**
 * Extract full workspace context from request headers
 */
export function getWorkspaceContext(request: Request | NextRequest): WorkspaceContext {
  const workspaceId = request.headers.get(WORKSPACE_ID_HEADER)
  const userId = request.headers.get(USER_ID_HEADER)
  const role = request.headers.get(USER_ROLE_HEADER) as WorkspaceMemberRole | null

  if (!workspaceId || !userId) {
    throw new WorkspaceError('Workspace context not found', 'CONTEXT_NOT_FOUND')
  }

  return {
    workspaceId,
    userId,
    role: role || 'member',
  }
}

/**
 * Get workspace ID from request headers
 * Throws if workspace context is not available (user should be redirected to onboarding)
 * 
 * @deprecated Use getWorkspaceId() instead. This function exists only for API route migration.
 */
export function getWorkspaceIdWithFallback(request: Request | NextRequest): string {
  const workspaceId = request.headers.get(WORKSPACE_ID_HEADER)
  if (!workspaceId) {
    // In 2026, we no longer silently fall back - this indicates a middleware issue
    // or the user needs to complete onboarding
    console.error('[Workspace] Missing workspace context - middleware may not be configured')
    throw new WorkspaceError(
      'Workspace context not found. Please complete onboarding.',
      'WORKSPACE_NOT_FOUND'
    )
  }
  return workspaceId
}

/**
 * Get user ID from request headers with fallback behavior
 * Throws if user context is not available
 * 
 * @deprecated Use getUserId() instead. This function exists only for API route migration.
 */
export function getUserIdWithFallback(request: Request | NextRequest): string {
  const userId = request.headers.get(USER_ID_HEADER)
  if (!userId) {
    console.error('[Workspace] Missing user context - middleware may not be configured')
    throw new WorkspaceError(
      'User context not found. Please sign in.',
      'USER_NOT_FOUND'
    )
  }
  return userId
}

/**
 * Check if user has required role in workspace
 */
export function hasRole(context: WorkspaceContext, requiredRoles: WorkspaceMemberRole[]): boolean {
  return requiredRoles.includes(context.role)
}

/**
 * Check if user can approve claims (admin or reviewer)
 */
export function canApproveClaims(context: WorkspaceContext): boolean {
  return hasRole(context, ['admin', 'reviewer'])
}

/**
 * Check if user can manage workspace settings (admin only)
 */
export function canManageWorkspace(context: WorkspaceContext): boolean {
  return hasRole(context, ['admin'])
}

/**
 * Resolve workspace membership for a user
 * Used by middleware to populate workspace context
 * Returns null if user has no workspace - should be redirected to onboarding
 */
export async function resolveWorkspaceMembership(userId: string): Promise<{
  workspaceId: string
  role: WorkspaceMemberRole
} | null> {
  const supabase = createServiceClient()

  const { data: membership, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !membership) {
    // User has no workspace - they should complete onboarding
    return null
  }

  return {
    workspaceId: membership.workspace_id,
    role: membership.role as WorkspaceMemberRole,
  }
}

/**
 * Get workspace settings for a workspace
 */
export async function getWorkspaceSettings(workspaceId: string) {
  const supabase = createServiceClient()

  const { data: settings, error } = await supabase
    .from('workspace_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    // Return default settings if not found
    return {
      forbidden_phrases: [],
      brand_colors: null,
      brand_typography: null,
      brand_logo_url: null,
      industry: null,
      brand_voice: null,
    }
  }

  return settings
}

/**
 * Get workspace context from Next.js headers (for Server Components).
 * Middleware injects x-workspace-id, x-user-id, x-user-role into headers.
 */
export async function getWorkspaceFromHeaders(): Promise<WorkspaceContext | null> {
  const { headers } = await import('next/headers')
  const headerStore = await headers()

  const workspaceId = headerStore.get(WORKSPACE_ID_HEADER)
  const userId = headerStore.get(USER_ID_HEADER)
  const role = headerStore.get(USER_ROLE_HEADER) as WorkspaceMemberRole | null

  if (!workspaceId || !userId) {
    return null
  }

  return {
    workspaceId,
    userId,
    role: role ?? 'member',
  }
}

/**
 * Custom error class for workspace-related errors
 */
export class WorkspaceError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'WorkspaceError'
    this.code = code
  }
}

/**
 * Handle workspace errors in API routes
 */
export function handleWorkspaceError(error: unknown): Response {
  if (error instanceof WorkspaceError) {
    return new Response(
      JSON.stringify({ error: error.message, code: error.code }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }
  throw error
}
