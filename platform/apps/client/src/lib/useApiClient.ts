import { useAuth } from "@clerk/clerk-react";
import { apiFetch, ApiRequestOptions } from "./http";

export function useApiClient() {
    const { getToken } = useAuth();

    const apiClient = async <T,>(
        path: string,
        options: Omit<ApiRequestOptions, "clerkTokenGetter"> = {}
    ): Promise<T> => {
        const clerkTokenGetter = async () => {
            try {
                return await getToken();
            } catch (error) {
                console.error("Failed to get Clerk token:", error);
                return null;
            }
        };

        return apiFetch<T>(path, {
            ...options,
            clerkTokenGetter,
        });
    };

    return { apiFetch: apiClient };
}
