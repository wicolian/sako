import React, { useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useWorkspaceContext } from '../lib/WorkspaceProvider';
import { setCustomerCookie } from '../lib/cookies';

export const AppShellGate = ({ children }: { children: JSX.Element }) => {
    const { 
        me, 
        meLoading, 
        meError, 
        loading: workspaceLoading, 
        error: workspaceError, 
        workspace, 
        refresh: refreshWorkspace, 
        ready 
    } = useWorkspaceContext();

    // Retry state for post-checkout race condition
    const [retryCount, setRetryCount] = useState(0);
    const [isRetrying, setIsRetrying] = useState(false);
    const maxRetries = 5;
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-retry when user has no workspace (might be post-checkout)
    useEffect(() => {
        if (
            !meLoading && 
            !workspaceLoading && 
            me?.role === 'CLIENT' && 
            (!me.workspaces || me.workspaces.length === 0) &&
            retryCount < maxRetries &&
            !isRetrying
        ) {
            setIsRetrying(true);
            retryTimeoutRef.current = setTimeout(async () => {
                try {
                    await refreshWorkspace();
                } catch {
                    // Error handled in context
                }
                setRetryCount(prev => prev + 1);
                setIsRetrying(false);
            }, 2000); // Retry every 2 seconds
        }

        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, [me, meLoading, workspaceLoading, retryCount, isRetrying, refreshWorkspace]);

    useEffect(() => {
        if (ready && workspace) {
            setCustomerCookie();
        }
    }, [ready, workspace]);

    // Show single loading state while both me and workspace load in parallel
    if (meLoading || workspaceLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-sm text-zinc-500 gap-2">
                <div className="animate-spin w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full"></div>
                <span>Loading your account...</span>
            </div>
        );
    }

    // If /me fails for some reason, handle generic errors
    if (meError) {
        const apiError = meError as any;

        if (apiError.status === 401 && apiError.message === 'No authorization token provided') {
            return <Navigate to="/sign-in" replace />;
        }

        if (apiError.status === 500 && apiError.message === 'Authentication failed due to a server error') {
            return <div className="flex items-center justify-center h-screen text-sm text-red-500">Server error, contact support.</div>;
        }

        return <div className="flex items-center justify-center h-screen text-sm text-red-500">Something went wrong loading your account.</div>;
    }

    if (!me) {
        return <div className="flex items-center justify-center h-screen text-sm text-zinc-500">Unable to load your account.</div>;
    }

    // If user is CLIENT with no workspaces, they need to complete checkout
    if (me.role === 'CLIENT' && (!me.workspaces || me.workspaces.length === 0)) {
        // Check if they're coming from a checkout (might be waiting for webhook)
        // If they have a recent checkout session in URL or localStorage, show loading and retry
        const urlParams = new URLSearchParams(window.location.search);
        const hasCheckoutSession = urlParams.get('session_id') || 
                                  window.location.pathname === '/billing/success';
        
        if (hasCheckoutSession && retryCount < maxRetries) {
            // They just completed checkout, wait for webhook to create workspace
            return (
                <div className="flex flex-col items-center justify-center h-screen text-sm text-zinc-500 gap-3">
                    <div className="animate-spin w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full"></div>
                    <span>Setting up your workspace...</span>
                    <span className="text-xs text-zinc-600">This may take a few seconds after payment</span>
                </div>
            );
        }
        
        // No checkout session, they need to go to pricing page
        return <Navigate to="/pricing" replace />;
    }

    if (workspaceError) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-3 text-sm text-red-500">
                <div>Failed to load workspace: {workspaceError.message}</div>
                <button
                    onClick={() => refreshWorkspace().catch(() => { /* handled in context */ })}
                    className="px-4 py-2 rounded border border-current text-[13px]"
                >
                    Retry workspace load
                </button>
            </div>
        );
    }

    if (!ready || !workspace) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-3 text-sm text-zinc-500">
                <div>No workspace found yet.</div>
                <button
                    onClick={() => refreshWorkspace().catch(() => { /* handled in context */ })}
                    className="px-4 py-2 rounded border border-current text-[13px]"
                >
                    Retry workspace load
                </button>
            </div>
        );
    }

    // If they have at least one workspace, allow the actual app shell to render
    return children;
};
