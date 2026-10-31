const WORKSPACE_STORAGE_KEY = 'sako-current-workspace-id';

type WorkspaceGetter = () => string | null | Promise<string | null>;

let workspaceGetter: WorkspaceGetter | null = null;

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

export function registerWorkspaceGetter(getter: WorkspaceGetter) {
  workspaceGetter = getter;
}

export function setStoredWorkspaceId(id: string | null) {
  const storage = getStorage();
  if (!storage) return;

  if (!id) {
    storage.removeItem(WORKSPACE_STORAGE_KEY);
    return;
  }

  storage.setItem(WORKSPACE_STORAGE_KEY, id);
}

export function getStoredWorkspaceId(): string | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    return storage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function resolveWorkspaceId(options?: {
  override?: string | null;
  skip?: boolean;
}): Promise<string | null> {
  if (options?.skip) {
    return null;
  }

  if (options && 'override' in options && options.override !== undefined) {
    return options.override;
  }

  if (workspaceGetter) {
    try {
      const value = await workspaceGetter();
      if (value) return value;
    } catch (err) {
      console.warn('[workspace-store] Failed to resolve workspace from getter', err);
    }
  }

  return getStoredWorkspaceId();
}
