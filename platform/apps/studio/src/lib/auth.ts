export interface StoredAuth {
  token: string;
  workspaceId: string;
  workspaceSlug: string;
  userId: string;
  userEmail: string;
  role: string;
}

const STORAGE_KEY = 'sako-studio-auth';

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

export function getStoredAuth(): StoredAuth | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function setStoredAuth(data: StoredAuth) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearStoredAuth() {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  const auth = getStoredAuth();
  return Boolean(auth?.token && auth.workspaceId);
}


