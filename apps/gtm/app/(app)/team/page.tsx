'use client'

import { Suspense } from 'react'

;

/**
 * Team Landing Page (Jan 2026)
 * 
 * Main entry point for the AI Marketing Team experience.
 * User pastes URL → Watches 5 agents work → Gets deployable campaign.
 * 
 * @see PRD Part 3.1: Team Landing Page
 */

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { AgentName } from '@/components/team/agent-card';

// ============================================================================
// Types
// ============================================================================

interface StreamEvent {
    type: string;
    timestamp: string;
    agent?: AgentName;
    message?: string;
    summary?: string;
    phase?: string;
    data?: unknown;
    claims?: Array<{ text: string; risk: string; reason: string; suggestion?: string }>;
    approvalId?: string;
    recoverable?: boolean;
    sessionId?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function TeamPage() {
    const router = useRouter();
    const [url, setUrl] = useState('');
    const [urlError, setUrlError] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [agentStates, setAgentStates] = useState<Record<AgentName, AgentState>>(
        createDefaultAgentStates()
    );
    const [activities, setActivities] = useState<ActivityEntry[]>([]);
    const [campaignReady, setCampaignReady] = useState(false);
    const [needsReview, setNeedsReview] = useState(false);
    const [approvalData, setApprovalData] = useState<{
        approvalId: string;
        claims: Array<{ text: string; risk: string; reason: string; suggestion?: string }>;
    } | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Validate URL format
    const validateUrl = (value: string): boolean => {
        if (!value.trim()) {
            setUrlError('Please enter a URL');
            return false;
        }
        try {
            const parsed = new URL(value);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                setUrlError('URL must start with http:// or https://');
                return false;
            }
            setUrlError(null);
            return true;
        } catch {
            setUrlError('Please enter a valid URL (e.g., https://example.com)');
            return false;
        }
    };

    // Add activity entry
    const addActivity = useCallback((
        message: string,
        options: Partial<Omit<ActivityEntry, 'id' | 'timestamp' | 'message'>> = {}
    ) => {
        setActivities(prev => [...prev, createActivityEntry(message, options)]);
    }, []);

    // Update agent state
    const updateAgent = useCallback((
        agent: AgentName,
        update: Partial<AgentState>
    ) => {
        setAgentStates(prev => ({
            ...prev,
            [agent]: { ...prev[agent], ...update },
        }));
    }, []);

    // Handle SSE event
    const handleEvent = useCallback((event: StreamEvent) => {
        switch (event.type) {
            case 'phase_start':
                addActivity(`Starting: ${event.message || event.phase}`, {
                    agent: 'system',
                    type: 'info',
                });
                break;

            case 'phase_complete':
                addActivity(`Completed: ${event.phase}`, {
                    agent: 'system',
                    type: 'success',
                });
                break;

            case 'agent_start':
                if (event.agent) {
                    updateAgent(event.agent, {
                        status: 'working',
                        message: event.message,
                    });
                    addActivity(event.message || `${event.agent} started`, {
                        agent: event.agent,
                        type: 'info',
                    });
                }
                break;

            case 'agent_complete':
                if (event.agent) {
                    updateAgent(event.agent, {
                        status: 'complete',
                        summary: event.summary,
                        data: event.data,
                    });
                    addActivity(event.summary || `${event.agent} completed`, {
                        agent: event.agent,
                        type: 'success',
                    });
                }
                break;

            case 'hitl_required':
                if (event.agent) {
                    updateAgent(event.agent, {
                        status: 'waiting',
                        message: 'Needs your input',
                    });
                }
                setNeedsReview(true);
                setApprovalData({
                    approvalId: event.approvalId || '',
                    claims: event.claims || [],
                });
                addActivity('Guardian needs your input on some claims', {
                    agent: 'guardian',
                    type: 'warning',
                });
                break;

            case 'campaign_ready':
                setCampaignReady(true);
                addActivity('Campaign is ready!', {
                    agent: 'system',
                    type: 'success',
                });
                break;

            case 'error':
                if (event.agent) {
                    updateAgent(event.agent, {
                        status: 'error',
                        message: event.message,
                    });
                }
                addActivity(event.message || 'An error occurred', {
                    agent: event.agent || 'system',
                    type: 'error',
                });
                if (!event.recoverable) {
                    setIsRunning(false);
                }
                break;

            case 'stream_complete':
                if (!needsReview && !campaignReady) {
                    // Stream ended without campaign ready - might be an issue
                }
                setIsRunning(false);
                break;
        }
    }, [addActivity, updateAgent, needsReview, campaignReady]);

    // Start the team
    const startTeam = async () => {
        if (!validateUrl(url)) return;

        // Reset state
        setIsRunning(true);
        setCampaignReady(false);
        setNeedsReview(false);
        setApprovalData(null);
        setAgentStates(createDefaultAgentStates());
        setActivities([]);

        addActivity('Starting your AI Marketing Team...', { agent: 'system' });

        try {
            abortControllerRef.current = new AbortController();

            const response = await fetch('/api/team/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start team');
            }

            // Get session ID from header
            const sid = response.headers.get('X-Session-Id');
            if (sid) setSessionId(sid);

            // Read SSE stream
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response stream');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const event = JSON.parse(line.slice(6)) as StreamEvent;
                            handleEvent(event);
                        } catch (e) {
                            console.error('Failed to parse event:', e);
                        }
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                addActivity('Team run cancelled', { agent: 'system', type: 'warning' });
            } else {
                addActivity(
                    error instanceof Error ? error.message : 'Something went wrong',
                    { agent: 'system', type: 'error' }
                );
            }
            setIsRunning(false);
        }
    };

    // Cancel the run
    const cancelRun = () => {
        abortControllerRef.current?.abort();
        setIsRunning(false);
    };

    // Navigate to session detail
    const viewCampaign = () => {
        if (sessionId) {
            router.push(`/team/${sessionId}`);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 bg-background text-foreground">
            <div className="container mx-auto px-4 py-12 max-w-6xl">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-sm font-medium">AI Marketing Team</span>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        Your AI Marketing Team
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Paste your URL. Watch your team work. Deploy in minutes.
                    </p>
                </motion.div>

                {/* URL Input */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="max-w-2xl mx-auto mb-12"
                >
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="url"
                                placeholder="https://yourcompany.com"
                                value={url}
                                onChange={(e) => {
                                    setUrl(e.target.value);
                                    if (urlError) validateUrl(e.target.value);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isRunning) startTeam();
                                }}
                                disabled={isRunning}
                                className={cn(
                                    'pl-10 h-14 text-lg',
                                    urlError && 'border-red-500 focus-visible:ring-red-500'
                                )}
                            />
                        </div>

                        {isRunning ? (
                            <Button
                                variant="outline"
                                onClick={cancelRun}
                                className="h-14 px-6"
                            >
                                Cancel
                            </Button>
                        ) : (
                            <Button
                                onClick={startTeam}
                                disabled={!url.trim()}
                                className="h-14 px-8 gap-2"
                            >
                                Start Your Team
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {urlError && (
                        <p className="text-sm text-red-500 mt-2">{urlError}</p>
                    )}
                </motion.div>

                {/* Agent Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-8"
                >
                    <AgentTeamGrid
                        agentStates={agentStates}
                        showConnectors={true}
                    />
                </motion.div>

                {/* Activity Stream (shown when running or has activities) */}
                <AnimatePresence>
                    {activities.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="max-w-2xl mx-auto"
                        >
                            <ActivityStream
                                activities={activities}
                                maxHeight="250px"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Campaign Ready CTA */}
                <AnimatePresence>
                    {campaignReady && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
                        >
                            <Button
                                onClick={viewCampaign}
                                size="lg"
                                className="shadow-2xl gap-2"
                            >
                                <Sparkles className="h-5 w-5" />
                                View Your Campaign
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Needs Review Modal Trigger */}
                <AnimatePresence>
                    {needsReview && approvalData && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
                        >
                            <Button
                                onClick={() => {
                                    if (sessionId) {
                                        router.push(`/team/${sessionId}?review=true`);
                                    }
                                }}
                                size="lg"
                                variant="outline"
                                className="shadow-2xl gap-2 border-yellow-500 text-amber-500 hover:bg-yellow-50"
                            >
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                >
                                    ⚡
                                </motion.div>
                                Guardian Needs Your Input
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Agent Descriptions (for first-time users) */}
                {!isRunning && activities.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="mt-16 max-w-4xl mx-auto"
                    >
                        <h2 className="text-center text-sm font-medium text-muted-foreground mb-6">
                            MEET YOUR TEAM
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
                            <div>
                                <div className="text-2xl mb-2">🔍</div>
                                <h3 className="font-medium">Scout</h3>
                                <p className="text-xs text-muted-foreground">Researches evidence</p>
                            </div>
                            <div>
                                <div className="text-2xl mb-2">🛡️</div>
                                <h3 className="font-medium">Guardian</h3>
                                <p className="text-xs text-muted-foreground">Validates compliance</p>
                            </div>
                            <div>
                                <div className="text-2xl mb-2">✍️</div>
                                <h3 className="font-medium">Creator</h3>
                                <p className="text-xs text-muted-foreground">Writes the copy</p>
                            </div>
                            <div>
                                <div className="text-2xl mb-2">📐</div>
                                <h3 className="font-medium">Architect</h3>
                                <p className="text-xs text-muted-foreground">Selects templates</p>
                            </div>
                            <div>
                                <div className="text-2xl mb-2">🚀</div>
                                <h3 className="font-medium">Ops</h3>
                                <p className="text-xs text-muted-foreground">Prepares deployment</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}


export default function TeamPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <TeamPage />
    </Suspense>
  )
}
