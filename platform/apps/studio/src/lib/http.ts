// HTTP client for API requests

import { API_BASE_URL, DEMO_WORKSPACE_ID } from "./config";
import { getStoredAuth } from "./auth";

let tokenGetter: (() => Promise<string | null>) | null = null;

export function registerTokenGetter(getter: () => Promise<string | null>) {
  tokenGetter = getter;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipWorkspace?: boolean;
  workspaceIdOverride?: string | null;
  clerkTokenGetter?: () => Promise<string | null>;
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const { skipAuth, skipWorkspace, workspaceIdOverride, clerkTokenGetter, headers: customHeaders, ...fetchOptions } = options;

  const headers: Record<string, string> = {};

  const auth = typeof window !== "undefined" ? getStoredAuth() : null;

  // Studio endpoints (/studio/*) don't require workspace headers - skip by default for those paths
  const isStudioPath = path.startsWith('/studio');
  const shouldSkipWorkspace = skipWorkspace || isStudioPath;

  const allowWorkspaceHeaderFallback =
    import.meta.env.DEV ||
    import.meta.env.VITE_ALLOW_WORKSPACE_FALLBACK === "true";

  const workspaceId =
    workspaceIdOverride ??
    auth?.workspaceId ??
    (!shouldSkipWorkspace && allowWorkspaceHeaderFallback ? DEMO_WORKSPACE_ID : null);

  if (!shouldSkipWorkspace && workspaceId) {
    headers["x-workspace-id"] = workspaceId;
  }

  // Use Clerk token with priority: explicit getter > global getter > stored auth
  if (!skipAuth) {
    let token: string | null = null;

    if (clerkTokenGetter) {
      token = await clerkTokenGetter();
    } else {
      // Try global Clerk token first
      if (tokenGetter) {
        try {
          token = await tokenGetter();
        } catch (e) {
          console.error("Failed to get token from registered getter", e);
          token = null;
        }
      } else if (auth?.token) {
        // Fall back to stored JWT auth
        token = auth.token;
      }
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Add Content-Type for requests with body
  if (fetchOptions.body && !headers["Content-Type"] && !(fetchOptions.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Merge with user-provided headers
  if (customHeaders) {
    if (customHeaders instanceof Headers) {
      customHeaders.forEach((value, key) => {
        headers[key] = value as string;
      });
    } else if (Array.isArray(customHeaders)) {
      customHeaders.forEach(([key, value]) => {
        headers[key] = value as string;
      });
    } else {
      Object.assign(headers, customHeaders as Record<string, string>);
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // Handle non-OK responses
    if (!response.ok) {
      let errorBody: any;
      const contentType = response.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        try {
          errorBody = await response.json();
        } catch (e) {
          errorBody = await response.text();
        }
      } else {
        errorBody = await response.text();
      }

      throw new ApiError(
        errorBody?.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    // Parse JSON response
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await response.json();
    }

    // Return text for non-JSON responses
    return (await response.text()) as unknown as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network errors, etc.
    throw new ApiError(
      error instanceof Error ? error.message : "Network request failed",
      0
    );
  }
}
