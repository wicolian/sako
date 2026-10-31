import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface MeWorkspace {
    id: string;
    name: string;
    slug: string;
    role: 'OWNER' | 'SUBMITTER' | 'MEMBER' | 'VIEWER';
}

export interface MeResponse {
    id: string;
    email: string;
    name?: string;
    role: 'CLIENT' | 'PENDING_ADMIN' | 'ADMIN';
    isSuperAdmin: boolean;
    workspaces: MeWorkspace[];
}

export function useMe() {
    const [me, setMe] = useState<MeResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { call, isReady } = useApiClient();

    useEffect(() => {
        let cancelled = false;

        async function load() {
            // Wait for Clerk to be ready
            if (!isReady) {
                return;
            }

            setLoading(true);
            try {
                const res = await call<MeResponse>('/users/me');
                if (!cancelled) {
                    setMe(res);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err as Error);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [call, isReady]);

    return { me, loading, error };
}
