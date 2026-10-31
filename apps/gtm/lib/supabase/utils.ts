/**
 * Supabase Utility Functions
 */

import { NextRequest } from 'next/server';
import { createServiceClient } from './service';

/**
 * Get workspace ID from request with fallback to first available workspace
 */
export async function getWorkspaceIdWithFallback(
  request: NextRequest
): Promise<string | null> {
  // First try to get from query params
  const workspaceId = request.nextUrl.searchParams.get('workspace_id');
  if (workspaceId) {
    return workspaceId;
  }
  
  // Try to get from auth header and find user's workspace
  const supabase = createServiceClient();
  const authHeader = request.headers.get('authorization');
  
  if (authHeader) {
    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (user) {
      // Get user's first workspace
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      
      if (membership) {
        return membership.workspace_id;
      }
    }
  }
  
  return null;
}

/**
 * Get user ID from request
 */
export async function getUserIdFromRequest(
  request: NextRequest
): Promise<string | null> {
  const supabase = createServiceClient();
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return null;
  }
  
  const { data: { user } } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  
  return user?.id || null;
}

/**
 * Verify workspace membership
 */
export async function verifyWorkspaceMembership(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const supabase = createServiceClient();
  
  const { data } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single();
  
  return !!data;
}

/**
 * Get workspace by ID
 */
export async function getWorkspace(workspaceId: string) {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();
  
  if (error) {
    return null;
  }
  
  return data;
}
