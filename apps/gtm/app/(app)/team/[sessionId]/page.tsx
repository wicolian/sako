'use client'

import { Suspense } from 'react'

;

/**
 * Team Session Page (Jan 2026)
 * 
 * View in-progress or completed team sessions.
 * 
 * @see PRD Part 5.3: Team Session Page
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    AgentTeamGrid,
    createDefaultAgentStates,
    type AgentState,
} from '@/components/team/agent-team-grid';
import {
    ActivityStream,
    createActivityEntry,
    type ActivityEntry,
} from '@/components/team/activity-stream';
import { GuardianReviewModal, type ClaimDecision, type FlaggedClaim } from '@/components/team/guardian-review-modal';
import { CampaignPreview, type CampaignOutput } from '@/components/team/campaign-preview';
import { DeploySelector, type Provider } from '@/components/team/deploy-selector';
import type { AgentName } from '@/components/team/agent-card';

// ============================================================================
// Types
// ============================================================================

interface SessionData {
    id: string;
    phase: string;
    needsApproval: boolean;
    approvalRequestId?: string;
    flaggedClaims?: Array<{ text: string; risk: string; reason?: string; suggestion?: string }>;
    brandData?: {
        name: string;
        industry?: string;
        claims?: Array<{ text: string; type?: string }>;
    };
    agentStates?: Record<string, { complete?: boolean; summary?: string }>;
    outputData?: CampaignOutput;
    startedAt: string;
    completedAt?: string;
    error?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function TeamSessionPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const sessionId = params.sessionId as string;
    const showReview = searchParams.get('review') === 'true';

    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [session, setSession] = useState<SessionData | null>(null);
    const [agentStates, setAgentStates] = useState<Record<AgentName, AgentState>>(
        createDefaultAgentStates()
    );
    const [activities, setActivities] = useState<ActivityEntry[]>([]);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [flaggedClaims, setFlaggedClaims] = useState<FlaggedClaim[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);

    // Load session data
    const loadSession = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/team/${sessionId}/continue`);

            if (!response.ok) {
                throw new Error('Failed to load session');
            }

            const data = await response.json() as SessionData;
            setSession(data);

            // Update agent states from session data
            if (data.agentStates) {
                const newStates = createDefaultAgentStates();
                for (const [agent, state] of Object.entries(data.agentStates)) {
                    const agentKey = agent.replace('_complete', '').replace('_summary', '') as AgentName;
                    if (state.complete) {
                        newStates[agentKey] = {
                            status: 'complete',
                            summary: state.summary,
                        };
                    }
                }

                // Set current phase agent
                if (data.phase && data.phase !== 'ready' && data.phase !== 'error' && data.phase !== 'review') {
                    const currentAgent = data.phase as AgentName;
                    if (newStates[currentAgent]) {
                        newStates[currentAgent].status = 'working';
                    }
                }

                if (data.phase === 'review') {
                    newStates.guardian = { status: 'waiting', message: 'Needs your input' };
                }

                setAgentStates(newStates);
            }

            // Show review modal if needed, populating flagged claims from the approval request
            if (data.needsApproval && showReview) {
                if (data.flaggedClaims && data.flaggedClaims.length > 0) {
                    setFlaggedClaims(
                        data.flaggedClaims.map((c, i) => ({
                            index: i,
                            text: c.text,
                            risk: (c.risk === 'high' || c.risk === 'medium' || c.risk === 'low')
                                ? c.risk
                                : 'medium',
                            reason: c.reason ?? `Flagged as ${c.risk} risk by Guardian`,
                            suggestion: c.suggestion,
                        }))
                    );
                }
                setReviewModalOpen(true);
            }

            // Add activity entry
            setActivities([
                createActivityEntry(`Loaded session: ${data.brandData?.name || 'Campaign'}`, {
                    agent: 'system',
                    type: 'info',
                }),
            ]);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [sessionId, showReview]);

    useEffect(() => {
        loadSession();
    }, [loadSession]);

    // Load providers
    useEffect(() => {
        async function loadProviders() {
            try {
                const response = await fetch('/api/providers/connected');
                if (response.ok) {
                    const data = await response.json();
                    setProviders(data.providers || []);
                }
            } catch {
                // Ignore provider loading errors
            }
        }
        loadProviders();
    }, []);

    // Handle review submission
    const handleReviewSubmit = async (decisions: ClaimDecision[]) => {
        setIsSubmittingReview(true);
        try {
            const response = await fetch(`/api/team/${sessionId}/continue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decisions }),
            });

            if (!response.ok) {
                throw new Error('Failed to submit review');
            }

            // Close modal and reload
            setReviewModalOpen(false);

            // Start reading SSE stream for remaining agents
            // (Similar to main team page logic)
            loadSession();

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsSubmittingReview(false);
        }
    };

    // Handle deploy
    const handleDeploy = async (providerId: string) => {
        const response = await fetch(`/api/team/${sessionId}/deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId }),
        });

        if (!response.ok) {
            throw new Error('Deployment failed');
        }

        return response.json();
    };

    // Handle download
    const handleDownload = async () => {
        const response = await fetch(`/api/team/${sessionId}/download`);

        if (!response.ok) {
            throw new Error('Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `campaign-${sessionId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    };

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Error state
    if (error || !session) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <p className="text-red-500">{error || 'Session not found'}</p>
                <Button asChild>
                    <Link href="/team">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Team
                    </Link>
                </Button>
            </div>
        );
    }

    const isComplete = session.phase === 'ready' || session.phase === 'deployed';
    const hasError = session.phase === 'error';
    const needsReview = session.needsApproval;

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/team">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">
                                {session.brandData?.name || 'Campaign'}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {session.brandData?.industry || 'Marketing Campaign'}
                            </p>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={loadSession}
                        className="gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>

                {/* Agent Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <AgentTeamGrid agentStates={agentStates} />
                </motion.div>

                {/* In Progress State */}
                {!isComplete && !hasError && !needsReview && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="max-w-2xl mx-auto"
                    >
                        <ActivityStream activities={activities} maxHeight="300px" />
                    </motion.div>
                )}

                {/* Needs Review State */}
                {needsReview && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-8"
                    >
                        <p className="text-lg mb-4">Guardian needs your input on some claims.</p>
                        <Button onClick={() => setReviewModalOpen(true)}>
                            Review Claims
                        </Button>
                    </motion.div>
                )}

                {/* Error State */}
                {hasError && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-8"
                    >
                        <p className="text-red-500 mb-4">{session.error || 'An error occurred'}</p>
                        <Button variant="outline" onClick={() => router.push('/team')}>
                            Try Again
                        </Button>
                    </motion.div>
                )}

                {/* Complete State */}
                {isComplete && session.outputData && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* Campaign Preview */}
                        <CampaignPreview
                            campaign={session.outputData}
                            sessionId={sessionId}
                            onEdit={() => router.push(`/editor/${sessionId}`)}
                        />

                        {/* Deploy Selector */}
                        <div className="border-t pt-8">
                            <h2 className="text-xl font-semibold mb-4">Deploy Your Campaign</h2>
                            <DeploySelector
                                sessionId={sessionId}
                                providers={providers}
                                campaignHtml={session.outputData.landingPage.html}
                                onDeploy={handleDeploy}
                                onDownload={handleDownload}
                            />
                        </div>
                    </motion.div>
                )}

                {/* Guardian Review Modal */}
                <GuardianReviewModal
                    open={reviewModalOpen}
                    onOpenChange={setReviewModalOpen}
                    claims={flaggedClaims}
                    sessionId={sessionId}
                    onSubmit={handleReviewSubmit}
                    isSubmitting={isSubmittingReview}
                />
            </div>
        </div>
    );
}


export default function TeamSessionPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <TeamSessionPage />
    </Suspense>
  )
}
