import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { fetchWorkspace, fetchWorkspaceList, fetchMe, MeResponse } from './api';
import { Workspace, WorkspaceRole } from './types';
import { getStoredWorkspaceId, registerWorkspaceGetter, setStoredWorkspaceId } from './workspace-store';

// Role-based permissions
export interface Permissions {
  canManageSettings: boolean;      // Access settings, billing, team management
  canPauseSubscription: boolean;   // Pause/resume/cancel subscription
  canCreateTasks: boolean;         // Create new tasks
  canReviewTasks: boolean;         // Approve/request revisions on tasks
  canViewTasks: boolean;           // View task details
  canManageTeam: boolean;          // Invite/remove team members
  canAccessBilling: boolean;       // View/manage billing
  isOwner: boolean;
  isViewer: boolean;
}

function getPermissionsForRole(role: WorkspaceRole | string): Permissions {
  switch (role) {
    case 'OWNER':
      return {
        canManageSettings: true,
        canPauseSubscription: true,
        canCreateTasks: true,
        canReviewTasks: true,
        canViewTasks: true,
        canManageTeam: true,
        canAccessBilling: true,
        isOwner: true,
        isViewer: false,
      };
    case 'SUBMITTER':
    case 'MEMBER':
      return {
        canManageSettings: false,
        canPauseSubscription: false,
        canCreateTasks: true,
        canReviewTasks: true,
        canViewTasks: true,
        canManageTeam: false,
        canAccessBilling: false,
        isOwner: false,
        isViewer: false,
      };
    case 'VIEWER':
      return {
        canManageSettings: false,
        canPauseSubscription: false,
        canCreateTasks: false,
        canReviewTasks: false,
        canViewTasks: true,
        canManageTeam: false,
        canAccessBilling: false,
        isOwner: false,
        isViewer: true,
      };
    default:
      // Default to viewer permissions for unknown roles
      return {
        canManageSettings: false,
        canPauseSubscription: false,
        canCreateTasks: false,
        canReviewTasks: false,
        canViewTasks: true,
        canManageTeam: false,
        canAccessBilling: false,
        isOwner: false,
        isViewer: true,
      };
  }
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
  workspaceId: string | null;
  me: MeResponse | null;
  meLoading: boolean;
  meError: Error | null;
  loading: boolean;
  error: Error | null;
  ready: boolean;
  refresh: (options?: { throwOnError?: boolean }) => Promise<Workspace | null>;
  switchWorkspace: (id: string) => Promise<void>;
  currentRole: WorkspaceRole | null;
  permissions: Permissions;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Array<{ id: string; name: string; slug: string; role: string }>>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const ready = !!workspace && !loading && isLoaded && isSignedIn && !error;

  const refresh = useCallback(async (options?: { throwOnError?: boolean }): Promise<Workspace | null> => {
    if (!isLoaded || !isSignedIn) {
      setWorkspace(null);
      setWorkspaces([]);
      setMe(null);
      setStoredWorkspaceId(null);
      setMeLoading(false);
      return null;
    }

    setLoading(true);
    setMeLoading(true);
    setError(null);
    setMeError(null);

    try {
      const storedId = getStoredWorkspaceId();

      // Optimization: Fetch /users/me, workspace list, and workspace details in parallel
      // This saves ~500-1000ms by avoiding sequential network calls
      if (storedId) {
        const [meResult, listResult, workspaceResult] = await Promise.allSettled([
          fetchMe(),
          fetchWorkspaceList(),
          fetchWorkspace(),
        ]);

        // Process /users/me result
        if (meResult.status === 'fulfilled') {
          setMe(meResult.value);
        } else {
          setMeError(meResult.reason instanceof Error ? meResult.reason : new Error(String(meResult.reason)));
        }
        setMeLoading(false);

        // Process list result
        let list: Array<{ id: string; name: string; slug: string; role: string }> = [];
        if (listResult.status === 'fulfilled') {
          list = listResult.value;
          setWorkspaces(list);
        }

        // Process workspace result
        if (workspaceResult.status === 'fulfilled') {
          const result = workspaceResult.value;
          setWorkspace(result);

          // Update stored ID to match what we actually got
          if (result.id !== storedId) {
            setStoredWorkspaceId(result.id);
          }

          return result;
        }

        // Workspace fetch failed - maybe stored ID was invalid
        // Fall through to sequential logic to pick a valid workspace
        if (list.length > 0) {
          const newTargetId = list[0].id;
          setStoredWorkspaceId(newTargetId);
          const result = await fetchWorkspace();
          setWorkspace(result);
          return result;
        }

        // Re-throw the workspace error if we couldn't recover
        throw workspaceResult.reason;
      }

      // No stored ID - fetch /users/me and list in parallel, then workspace
      const [meResult, listResult] = await Promise.allSettled([
        fetchMe(),
        fetchWorkspaceList(),
      ]);

      // Process /users/me result
      if (meResult.status === 'fulfilled') {
        setMe(meResult.value);
      } else {
        setMeError(meResult.reason instanceof Error ? meResult.reason : new Error(String(meResult.reason)));
      }
      setMeLoading(false);

      // Process list result
      let list: Array<{ id: string; name: string; slug: string; role: string }> = [];
      if (listResult.status === 'fulfilled') {
        list = listResult.value;
        setWorkspaces(list);
      }

      // Set default workspace if we have a list
      if (list.length > 0) {
        setStoredWorkspaceId(list[0].id);
      }

      // Fetch workspace details
      const result = await fetchWorkspace();
      setWorkspace(result);
      setStoredWorkspaceId(result.id);

      return result;
    } catch (err: any) {
      const typedError = err instanceof Error ? err : new Error(String(err?.message || err));
      setError(typedError);
      setWorkspace(null);

      if (options?.throwOnError) {
        throw typedError;
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  const switchWorkspace = useCallback(async (id: string) => {
    setStoredWorkspaceId(id);
    // Force a hard reload to ensure all app state (Apollo, SWR, etc if used) is clean
    // Or just refresh() if we are confident. 
    // Given the app structure, refresh() updates the context, and components depending on it will re-render.
    // However, if there are other components fetching data without listening to context (just reading localStorage), they might be stale.
    // But apiFetch reads localStorage dynamically. So subsequent fetches will be correct.
    await refresh();
  }, [refresh]);

  useEffect(() => {
    registerWorkspaceGetter(() => workspace?.id ?? getStoredWorkspaceId());
  }, [workspace?.id]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setWorkspace(null);
      setMe(null);
      setMeLoading(false);
      setStoredWorkspaceId(null);
      return;
    }

    refresh();
  }, [isLoaded, isSignedIn, refresh]);

  // Get current workspace's role from the list
  const currentWorkspaceId = workspace?.id ?? getStoredWorkspaceId();
  const currentWorkspaceEntry = workspaces.find(w => w.id === currentWorkspaceId);
  const currentRole = (currentWorkspaceEntry?.role as WorkspaceRole) || null;
  const permissions = getPermissionsForRole(currentRole || 'VIEWER');

  const value = useMemo<WorkspaceContextValue>(() => ({
    workspace,
    workspaces,
    workspaceId: currentWorkspaceId,
    me,
    meLoading: meLoading || !isLoaded,
    meError,
    loading: loading || !isLoaded,
    error,
    ready,
    refresh,
    switchWorkspace,
    currentRole,
    permissions,
  }), [workspace, workspaces, currentWorkspaceId, me, meLoading, meError, loading, isLoaded, error, ready, refresh, switchWorkspace, currentRole, permissions]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspaceContext must be used within WorkspaceProvider');
  }
  return ctx;
}
