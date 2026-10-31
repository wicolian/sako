// Custom hooks for data fetching

import { useState, useEffect, useCallback } from "react";
import {
  fetchTasks,
  fetchTask,
  fetchBrands,
  fetchTaskComments,
  fetchMetrics,
  fetchDashboardData,
  TaskQueryParams,
  WorkspaceMetrics,
  DashboardData,
} from "./api";
import { Task, Brand, TaskComment } from "./types";
import { useWorkspaceContext } from "./WorkspaceProvider";

// ========================================
// GENERIC FETCH HOOK
// ========================================

interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useFetch<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = [],
  options?: { enabled?: boolean }
): UseFetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const enabled = options?.enabled ?? true;

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setLoading(true);
      setError(null);
      setData(null);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    fetchFn()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [...deps, refetchTrigger, enabled]);

  return { data, loading, error, refetch };
}

// ========================================
// WORKSPACE HOOKS
// ========================================

export function useWorkspace() {
  const { workspace, loading, error, refresh, ready, workspaceId } = useWorkspaceContext();
  return {
    data: workspace,
    workspaceId,
    ready,
    loading,
    error,
    refetch: () => {
      void refresh().catch(() => { /* errors handled in context */ });
    }
  };
}

export function useMetrics() {
  const { ready, loading: workspaceLoading, error: workspaceError, refresh, workspace } = useWorkspaceContext();
  const fetchState = useFetch<WorkspaceMetrics>(
    () => fetchMetrics(),
    [workspace?.id],
    { enabled: ready && !!workspace?.id }
  );

  return {
    data: fetchState.data,
    loading: workspaceLoading || fetchState.loading,
    error: workspaceError || fetchState.error,
    refetch: () => {
      if (!ready || !workspace?.id) {
        void refresh().catch(() => { /* handled in context */ });
        return;
      }
      fetchState.refetch();
    },
  };
}

// ========================================
// TASK HOOKS
// ========================================

export function useTasks(params?: TaskQueryParams) {
  const { ready, loading: workspaceLoading, error: workspaceError, refresh, workspace } = useWorkspaceContext();
  const fetchState = useFetch(
    () => fetchTasks(params),
    [
      params?.status,
      params?.search,
      params?.limit,
      params?.cursor,
      workspace?.id,
    ],
    { enabled: ready && !!workspace?.id }
  );

  return {
    data: fetchState.data,
    loading: workspaceLoading || fetchState.loading,
    error: workspaceError || fetchState.error,
    refetch: () => {
      if (!ready || !workspace?.id) {
        void refresh().catch(() => { /* handled in context */ });
        return;
      }
      fetchState.refetch();
    },
  };
}

export function useTask(id: string | undefined) {
  const { ready, loading: workspaceLoading, error: workspaceError, refresh, workspace } = useWorkspaceContext();
  const fetchState = useFetch(
    () => {
      if (!id) throw new Error("Task ID is required");
      return fetchTask(id);
    },
    [id, workspace?.id],
    { enabled: ready && !!workspace?.id && !!id }
  );

  return {
    data: fetchState.data,
    loading: workspaceLoading || fetchState.loading,
    error: workspaceError || fetchState.error,
    refetch: () => {
      if (!ready || !workspace?.id) {
        void refresh().catch(() => { /* handled in context */ });
        return;
      }
      fetchState.refetch();
    },
  };
}

export function useTaskComments(taskId: string | undefined) {
  const { ready, loading: workspaceLoading, error: workspaceError, refresh, workspace } = useWorkspaceContext();
  const fetchState = useFetch(
    () => {
      if (!taskId) throw new Error("Task ID is required");
      return fetchTaskComments(taskId);
    },
    [taskId, workspace?.id],
    { enabled: ready && !!workspace?.id && !!taskId }
  );

  return {
    data: fetchState.data,
    loading: workspaceLoading || fetchState.loading,
    error: workspaceError || fetchState.error,
    refetch: () => {
      if (!ready || !workspace?.id) {
        void refresh().catch(() => { /* handled in context */ });
        return;
      }
      fetchState.refetch();
    },
  };
}

// ========================================
// BRAND HOOKS
// ========================================

export function useBrands() {
  const { ready, loading: workspaceLoading, error: workspaceError, refresh, workspace } = useWorkspaceContext();
  const fetchState = useFetch(
    () => fetchBrands(),
    [workspace?.id],
    { enabled: ready && !!workspace?.id }
  );

  return {
    data: fetchState.data,
    loading: workspaceLoading || fetchState.loading,
    error: workspaceError || fetchState.error,
    refetch: () => {
      if (!ready || !workspace?.id) {
        void refresh().catch(() => { /* handled in context */ });
        return;
      }
      fetchState.refetch();
    },
  };
}

// ========================================
// DASHBOARD HOOKS (AGGREGATE)
// ========================================

export function useDashboard() {
  const { ready, loading: workspaceLoading, error: workspaceError, refresh, workspace } = useWorkspaceContext();
  const fetchState = useFetch<DashboardData>(
    () => fetchDashboardData(),
    [workspace?.id],
    { enabled: ready && !!workspace?.id }
  );

  return {
    data: fetchState.data,
    loading: workspaceLoading || fetchState.loading,
    error: workspaceError || fetchState.error,
    refetch: () => {
      if (!ready || !workspace?.id) {
        void refresh().catch(() => { /* handled in context */ });
        return;
      }
      fetchState.refetch();
    },
  };
}
