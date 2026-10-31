// Custom hooks for data fetching

import { useState, useEffect, useCallback } from "react";
import {
  fetchWorkspace,
  fetchTasks,
  fetchTask,
  fetchBrands,
  fetchTaskComments,
  TaskQueryParams,
  fetchCurrentUser,
  fetchPendingAdmins,
} from "./api";
import { Task, Brand, Workspace, TaskComment, CurrentUser, PendingAdminUser } from "./types";

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
  deps: any[] = []
): UseFetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
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
  }, [...deps, refetchTrigger]);

  return { data, loading, error, refetch };
}

// ========================================
// WORKSPACE HOOKS
// ========================================

export function useWorkspace() {
  return useFetch(() => fetchWorkspace());
}

// ========================================
// TASK HOOKS
// ========================================

export function useTasks(params?: TaskQueryParams) {
  return useFetch(() => fetchTasks(params), [
    params?.status,
    params?.search,
    params?.limit,
    params?.cursor,
  ]);
}

export function useTask(id: string | undefined) {
  return useFetch(
    () => {
      if (!id) throw new Error("Task ID is required");
      return fetchTask(id);
    },
    [id]
  );
}

export function useTaskComments(taskId: string | undefined) {
  return useFetch(
    () => {
      if (!taskId) throw new Error("Task ID is required");
      return fetchTaskComments(taskId);
    },
    [taskId]
  );
}

// ========================================
// BRAND HOOKS
// ========================================

export function useBrands() {
  return useFetch(() => fetchBrands());
}

// ========================================
// STUDIO (Admin) HOOKS
// ========================================

import {
  fetchStudioClients,
  fetchStudioClientDetail,
  fetchStudioTasks,
  StudioClient,
  StudioClientDetail,
  fetchStudioMetrics,
  StudioMetrics,
} from "./api";

export function useStudioClients() {
  return useFetch<StudioClient[]>(() => fetchStudioClients());
}

export function useStudioClientDetail(workspaceId: string | undefined) {
  return useFetch<StudioClientDetail>(
    () => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return fetchStudioClientDetail(workspaceId);
    },
    [workspaceId]
  );
}

export function useStudioTasks() {
  return useFetch<Task[]>(() => fetchStudioTasks());
}

export function useStudioMetrics() {
  return useFetch<StudioMetrics>(() => fetchStudioMetrics());
}

// ========================================
// USER HOOKS
// ========================================

export function useMe() {
  const { data, loading, error, refetch } = useFetch<CurrentUser>(() => fetchCurrentUser());
  return { me: data, loading, error, refetch };
}

export function usePendingAdmins(enabled: boolean) {
  const [data, setData] = useState<PendingAdminUser[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    fetchPendingAdmins()
      .then((result) => {
        setData(result);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      load();
    } else {
      setData(null);
      setError(null);
      setLoading(false);
    }
  }, [enabled, load]);

  return { data, loading, error, refetch: load, setData };
}
