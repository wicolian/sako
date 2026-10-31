// API client hook with Clerk authentication
// This is the ONLY way to make authenticated API calls in the client app

import { useAuth } from '@clerk/clerk-react';
import { useCallback } from 'react';
import { API_BASE_URL } from '../lib/config';
import { resolveWorkspaceId } from '../lib/workspace-store';

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public body?: any,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export interface ApiRequestOptions {
    method?: string;
    body?: any;
    skipAuth?: boolean;
    skipWorkspace?: boolean;
    workspaceId?: string | null;
}

/**
 * Hook that provides an authenticated API client
 * MUST be used within ClerkProvider context
 * All API calls automatically include the user's Clerk JWT token
 */
export function useApiClient() {
    const { isLoaded, isSignedIn, getToken } = useAuth();

    const call = useCallback(
        async <T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
            const url = `${API_BASE_URL}${path}`;

            // Ensure Clerk is loaded
            if (!isLoaded) {
                throw new ApiError('Clerk not loaded yet', 0, null, 'CLERK_NOT_LOADED');
            }

            // Get token if auth is required
            let token: string | null = null;
            if (!options.skipAuth) {
                if (!isSignedIn) {
                    throw new ApiError('Not signed in', 401, null, 'NOT_SIGNED_IN');
                }

                try {
                    token = await getToken();
                } catch (err) {
                    throw new ApiError('Failed to get authentication token', 401, null, 'TOKEN_FETCH_FAILED');
                }
            }

            // Build headers  
            const headers: Record<string, string> = {};

            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const workspaceId = await resolveWorkspaceId({
                override: options.workspaceId,
                skip: options.skipWorkspace,
            });

            if (workspaceId) {
                headers['x-workspace-id'] = workspaceId;
            }

            // Add Content-Type for JSON payloads
            if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            }

            // Make request
            try {
                const fetchOptions: RequestInit = {
                    method: options.method || 'GET',
                    headers,
                };

                if (options.body) {
                    if (options.body instanceof FormData) {
                        fetchOptions.body = options.body;
                    } else {
                        fetchOptions.body = JSON.stringify(options.body);
                    }
                }

                const response = await fetch(url, fetchOptions);

                // Handle non-OK responses
                if (!response.ok) {
                    let errorBody: any;
                    const contentType = response.headers.get('content-type');

                    if (contentType?.includes('application/json')) {
                        try {
                            errorBody = await response.json();
                        } catch (e) {
                            errorBody = await response.text();
                        }
                    } else {
                        errorBody = await response.text();
                    }

                    const error = new ApiError(
                        errorBody?.message || `HTTP ${response.status}: ${response.statusText}`,
                        response.status,
                        errorBody,
                        errorBody?.code
                    );

                    throw error;
                }

                // Handle 204 No Content
                if (response.status === 204) {
                    return undefined as T;
                }

                // Parse JSON response
                const contentType = response.headers.get('content-type');
                if (contentType?.includes('application/json')) {
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
                    error instanceof Error ? error.message : 'Network request failed',
                    0
                );
            }
        },
        [isLoaded, isSignedIn, getToken]
    );

    return {
        call,
        isReady: isLoaded && isSignedIn,
        isLoaded,
        isSignedIn,
    };
}
