import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { useWorkspaceContext } from '../../lib/WorkspaceProvider';
import { apiFetch } from '../../lib/http';
import { SUPPORT_EMAIL } from '../../lib/config';
import { setCustomerCookie } from '../../lib/cookies';

export const BillingSuccessPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isLoaded, isSignedIn } = useAuth();
    const { refresh } = useWorkspaceContext();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState<'loading' | 'delayed' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Waiting for authentication...');
    const [error, setError] = useState<string | null>(null);
    const pollCount = useRef(0);
    const maxPolls = 30; // 30 polls * 2s = 60s timeout
    const hasAttemptedRecovery = useRef(false);

    useEffect(() => {
        if (!sessionId) {
            navigate('/');
            return;
        }

        // Wait for Clerk to be fully loaded
        if (!isLoaded) {
            return;
        }

        // User must be signed in
        if (!isSignedIn) {
            setError('Not signed in. Please sign in and try again.');
            setStatus('error');
            return;
        }

        setMessage('Verifying payment...');

        // Poll for workspace creation
        const checkWorkspace = async () => {
            pollCount.current += 1;

            try {
                const workspace = await refresh({ throwOnError: true });
                if (workspace) {
                    setCustomerCookie();
                    setMessage('Payment successful! Redirecting...');
                    setStatus('success');

                    // Mark lead as converted (fire-and-forget)
                    fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/marketing/mark-converted`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                    }).catch(() => { /* Silent failure */ });

                    setTimeout(() => {
                        navigate('/');
                    }, 1500);
                    return;
                }

                // Should not reach here since NO_WORKSPACE throws
                if (pollCount.current >= maxPolls) {
                    setMessage('Setup is taking longer than expected.');
                    setStatus('delayed');
                    return;
                }

                setTimeout(checkWorkspace, 2000);
            } catch (err: any) {
                const errorCode = err?.code;
                const statusCode = err?.status;

                // Auth errors
                if (statusCode === 401) {
                    setError('Authentication failed. Please sign out and sign in again.');
                    setStatus('error');
                    return;
                }

                // NO_WORKSPACE = workspace hasn't been created yet
                if (errorCode === 'NO_WORKSPACE' || statusCode === 404) {
                    // First few polls: keep trying
                    if (pollCount.current < 5) {
                        setTimeout(checkWorkspace, 2000);
                        return;
                    }

                    // After 10 seconds, try recovery
                    if (pollCount.current === 5 && !hasAttemptedRecovery.current) {
                        setMessage('Webhook is delayed. Attempting recovery...');
                        setStatus('delayed');
                        hasAttemptedRecovery.current = true;
                        await attemptRecovery();
                        return;
                    }

                    // Check if we've exceeded max polls
                    if (pollCount.current >= maxPolls) {
                        setMessage('Workspace setup is taking longer than expected.');
                        setStatus('delayed');
                        return;
                    }

                    // Keep polling
                    setMessage('Setup is in progress...');
                    setTimeout(checkWorkspace, 2000);
                    return;
                }

                // For any other error, stop polling and show error
                setError(

                    err?.message || 'An unexpected error occurred');
                setStatus('error');
                return;
            }
        };

        const attemptRecovery = async () => {
            try {
                const result = await apiFetch<{ status: string; workspaceId?: string; message: string }>(
                    '/stripe/recover-session',
                    {
                        method: 'POST',
                        body: JSON.stringify({ sessionId }),
                        skipWorkspace: true,
                    }
                );

                if (result.status === 'completed' && result.workspaceId) {
                    setCustomerCookie();
                    setMessage('Workspace recovered! Redirecting...');
                    setStatus('success');
                    setTimeout(() => {
                        navigate('/');
                    }, 1000);
                } else if (result.status === 'processing') {
                    setMessage(result.message || 'Still processing. Continuing to check...');
                    setTimeout(checkWorkspace, 3000);
                } else {
                    setMessage(result.message || 'Unknown recovery status');
                    setStatus('delayed');
                }
            } catch (err: any) {
                console.error('[BillingSuccess] Recovery failed:', err);
                setMessage('Recovery attempt unsuccessful. Continuing to check...');
                setTimeout(checkWorkspace, 3000);
            }
        };

        // Start polling
        checkWorkspace();
    }, [sessionId, navigate, isLoaded, isSignedIn, refresh]);

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center text-[color:var(--foreground)]">
                <div className="text-center max-w-md p-6">
                    <div className="text-red-500 text-4xl mb-4">⚠️</div>
                    <h2 className="text-xl font-medium mb-4">Setup Issue</h2>
                    <p className="text-[color:var(--muted-foreground)] mb-6">{error}</p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full px-4 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded hover:bg-[color:var(--primary)]/90 font-medium transition"
                        >
                            Retry Setup
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full px-4 py-2 bg-[color:var(--card)] text-[color:var(--foreground)] rounded hover:bg-[color:var(--accent)] border border-[color:var(--border)] transition"
                        >
                            Go to Dashboard
                        </button>
                        <button
                            onClick={() => window.open(`mailto:${SUPPORT_EMAIL}?subject=Billing Setup Issue&body=Session ID: ${sessionId}`, '_blank')}
                            className="w-full px-4 py-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] text-sm transition"
                        >
                            Contact Support
                        </button>
                    </div>
                    <p className="text-xs text-[color:var(--muted-foreground)] mt-4">Session: {sessionId}</p>
                </div>
            </div>
        );
    }

    if (status === 'delayed') {
        return (
            <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center text-[color:var(--foreground)]">
                <div className="text-center max-w-md p-6">
                    <div className="text-yellow-500 text-4xl mb-4">⏳</div>
                    <h2 className="text-xl font-medium mb-4">Setup In Progress</h2>
                    <p className="text-[color:var(--muted-foreground)] mb-6">{message}</p>
                    <p className="text-[color:var(--muted-foreground)] text-sm mb-6">
                        We're finalizing your subscription. This can sometimes take a few moments.
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full px-4 py-2 bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded hover:bg-[color:var(--primary)]/90 font-medium transition"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full px-4 py-2 bg-[color:var(--card)] text-[color:var(--foreground)] rounded hover:bg-[color:var(--accent)] border border-[color:var(--border)] transition"
                        >
                            Go to Dashboard
                        </button>
                        <button
                            onClick={() => window.open(`mailto:${SUPPORT_EMAIL}?subject=Billing Setup Delayed&body=Session ID: ${sessionId}`, '_blank')}
                            className="w-full px-4 py-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] text-sm transition"
                        >
                            Contact Support
                        </button>
                    </div>
                    <p className="text-xs text-[color:var(--muted-foreground)] mt-4">Session: {sessionId}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[color:var(--background)] flex items-center justify-center text-[color:var(--foreground)]">
            <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                <h2 className="text-xl font-medium">{message}</h2>
                <p className="text-[color:var(--muted-foreground)] mt-2">Please wait while we set up your workspace.</p>
                {isLoaded && isSignedIn && pollCount.current > 0 && (
                    <p className="text-[color:var(--muted-foreground)] text-sm mt-4">Poll attempt {pollCount.current}/{maxPolls}</p>
                )}
                {!isLoaded && (
                    <p className="text-[color:var(--muted-foreground)] text-sm mt-4">Loading authentication...</p>
                )}
            </div>
        </div>
    );
};
