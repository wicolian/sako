import { createServerSupabaseClient } from './server'

// Server-side auth helpers - only use in server components, route handlers, or server actions
// This file uses next/headers and cannot be imported on the client

// Get current user (server-side)
export async function getServerUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getServerSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Get user's real workspace membership.
 * Returns null if the user has no workspace — callers must redirect to onboarding.
 * Never auto-assigns a demo/default workspace (that would silently pollute shared state).
 */
export async function getUserWorkspace(userId: string): Promise<{ workspaceId: string; role: string } | null> {
  const supabase = await createServerSupabaseClient()

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)
    .single()

  if (!membership) return null

  return {
    workspaceId: membership.workspace_id,
    role: membership.role,
  }
}

// Get current user with workspace context. Returns null if user is unauthenticated
// or has no workspace (i.e. needs onboarding).
export async function getAuthContext() {
  const user = await getServerUser()
  if (!user) return null

  const workspace = await getUserWorkspace(user.id)
  if (!workspace) return null

  return {
    user,
    workspaceId: workspace.workspaceId,
    role: workspace.role,
  }
}
