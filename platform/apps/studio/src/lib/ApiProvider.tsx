import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { registerTokenGetter } from './http';

interface ApiContextValue {
    getToken: () => Promise<string | null>;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
    const { getToken } = useAuth();

    const value: ApiContextValue = {
        getToken: async () => {
            try {
                return await getToken();
            } catch (error) {
                console.error('Failed to get Clerk token:', error);
                return null;
            }
        },
    };

    // Set global token getter
    useEffect(() => {
        registerTokenGetter(async () => {
            try {
                return await getToken();
            } catch {
                return null;
            }
        });
    }, [getToken]);

    return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}

export function useApiToken() {
    const context = useContext(ApiContext);
    if (!context) {
        throw new Error('useApiToken must be used within ApiProvider');
    }
    return context;
}
