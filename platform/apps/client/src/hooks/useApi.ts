// API helper hooks using useApiClient
// These provide a clean interface for common API operations

import { useCallback } from 'react';
import { useApiClient } from './useApiClient';
import type { Workspace } from '../lib/types';

interface WorkspaceApiResponse {
    workspace: {
        id: string;
        name: string;
        slug: string;
        timezone: string;
        createdAt: string;
        updatedAt: string;
    };
    plan: Workspace['plan'];
    subscription: Workspace['subscription'];
    derived: {
        activeTaskLimit: number;
        effectiveSlaSeconds: number;
    };
    counts: {
        activeTasks: number;
        queuedTasks: number;
    };
    currentDayCredit: {
        total: number;
        used: number;
        remaining: number;
        periodStart: string;
        periodEnd: string;
    } | null;
    credits: {
        dayCredits: Array<{
            total: number;
            used: number;
            remaining: number;
            periodEnd: string;
        }>;
        aiCredits: Array<{
            total: number;
            used: number;
            remaining: number;
            periodEnd: string;
        }>;
    };
}

/**
 * Hook to fetch current workspace through /workspace/me
 */
export function useWorkspaceApi() {
    const { call } = useApiClient();

    const fetchWorkspace = useCallback(async (): Promise<Workspace> => {
        const response = await call<WorkspaceApiResponse>('/workspace/me', { skipWorkspace: true });

        const currentDayCredit = response.currentDayCredit || response.credits.dayCredits[0];
        const latestAiCredit = response.credits.aiCredits[0];

        return {
            id: response.workspace.id,
            name: response.workspace.name,
            slug: response.workspace.slug,
            timezone: response.workspace.timezone,
            createdAt: response.workspace.createdAt,
            updatedAt: response.workspace.updatedAt,
            plan: response.plan ?? undefined,
            subscription: response.subscription ?? undefined,
            effectiveActiveTaskLimit: response.derived.activeTaskLimit,
            effectiveSlaSeconds: response.derived.effectiveSlaSeconds,
            taskCounts: {
                total: response.counts.activeTasks + response.counts.queuedTasks,
                queued: response.counts.queuedTasks,
                inProgress: response.counts.activeTasks,
                inReview: 0,
                completed: 0,
            },
            dayCredit: currentDayCredit
                ? {
                    id: `${response.workspace.id}-day-credit`,
                    workspaceId: response.workspace.id,
                    totalCredits: currentDayCredit.total,
                    usedCredits: currentDayCredit.used,
                    periodStart: (currentDayCredit as any).periodStart || currentDayCredit.periodEnd,
                    periodEnd: currentDayCredit.periodEnd,
                }
                : undefined,
            aiCredit: latestAiCredit
                ? {
                    id: `${response.workspace.id}-ai-credit`,
                    workspaceId: response.workspace.id,
                    totalCredits: latestAiCredit.total,
                    usedCredits: latestAiCredit.used,
                    periodStart: latestAiCredit.periodEnd,
                    periodEnd: latestAiCredit.periodEnd,
                }
                : undefined,
        };
    }, [call]);

    return { fetchWorkspace };
}

/**
 * Hook for Stripe operations
 */
export function useStripeApi() {
    const { call } = useApiClient();

    /**
     * Create a checkout session for redirect mode
     */
    const createCheckoutSession = useCallback(async (payload: {
        planCode: string;
        billingInterval: 'MONTHLY' | 'YEARLY';
        successUrl: string;
        cancelUrl: string;
    }): Promise<{ sessionId: string; url: string }> => {
        return call('/stripe/create-checkout-session', {
            method: 'POST',
            body: { ...payload, embedded: false },
            skipWorkspace: true,
        });
    }, [call]);

    /**
     * Create a checkout session for embedded mode
     */
    const createEmbeddedCheckoutSession = useCallback(async (payload: {
        planCode: string;
        billingInterval: 'MONTHLY' | 'YEARLY';
        returnUrl: string;
    }): Promise<{ sessionId: string; clientSecret: string }> => {
        return call('/stripe/create-checkout-session', {
            method: 'POST',
            body: { ...payload, embedded: true },
            skipWorkspace: true,
        });
    }, [call]);

    const createPortalSession = useCallback(async (returnUrl?: string): Promise<{ url: string }> => {
        return call('/stripe/create-portal-session', {
            method: 'POST',
            body: { returnUrl },
        });
    }, [call]);

    return {
        createCheckoutSession,
        createEmbeddedCheckoutSession,
        createPortalSession,
    };
}
