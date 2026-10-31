'use client';

/**
 * Agent Team Grid Component (Jan 2026)
 * 
 * Layout container for the five agent cards showing the team workflow.
 * 
 * @see PRD Part 3.3: Agent Team Grid Component
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AgentCard, type AgentName, type AgentStatus } from './agent-card';
import { ArrowRight } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface AgentState {
    status: AgentStatus;
    message?: string;
    summary?: string;
    data?: unknown;
}

export interface AgentTeamGridProps {
    agentStates: Record<AgentName, AgentState>;
    showConnectors?: boolean;
    className?: string;
}

// ============================================================================
// Agent Order
// ============================================================================

const AGENT_ORDER: AgentName[] = ['scout', 'guardian', 'creator', 'architect', 'ops'];

// ============================================================================
// Connector Component
// ============================================================================

function Connector({ active, completed }: { active: boolean; completed: boolean }) {
    return (
        <div className="hidden md:flex items-center justify-center px-1">
            <motion.div
                className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full',
                    completed && 'bg-green-500/20',
                    active && 'bg-blue-500/20',
                    !active && !completed && 'bg-muted'
                )}
                animate={active ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1, repeat: active ? Infinity : 0 }}
            >
                <ArrowRight className={cn(
                    'h-4 w-4',
                    completed && 'text-green-500',
                    active && 'text-blue-500',
                    !active && !completed && 'text-muted-foreground'
                )} />
            </motion.div>
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentTeamGrid({
    agentStates,
    showConnectors = true,
    className,
}: AgentTeamGridProps) {
    // Find the currently active agent
    const activeAgentIndex = AGENT_ORDER.findIndex(
        agent => agentStates[agent]?.status === 'working' || agentStates[agent]?.status === 'waiting'
    );

    return (
        <div className={cn('w-full', className)}>
            {/* Desktop Layout - Horizontal */}
            <div className="hidden md:flex items-stretch justify-center gap-2">
                {AGENT_ORDER.map((agent, index) => {
                    const state = agentStates[agent] || { status: 'idle' as const };
                    const isCompleted = state.status === 'complete';
                    const isActive = state.status === 'working' || state.status === 'waiting';
                    const showConnector = showConnectors && index < AGENT_ORDER.length - 1;

                    // Determine connector state
                    const connectorActive = activeAgentIndex === index;
                    const connectorCompleted = activeAgentIndex > index || (isCompleted && index < AGENT_ORDER.length - 1);

                    return (
                        <div key={agent} className="flex items-stretch">
                            <AgentCard
                                agent={agent}
                                status={state.status}
                                message={state.message}
                                summary={state.summary}
                                data={state.data}
                                className="w-40 flex-shrink-0"
                            />
                            {showConnector && (
                                <Connector
                                    active={connectorActive}
                                    completed={connectorCompleted}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Mobile Layout - Grid */}
            <div className="grid grid-cols-2 gap-4 md:hidden">
                {AGENT_ORDER.map((agent, index) => {
                    const state = agentStates[agent] || { status: 'idle' as const };

                    return (
                        <motion.div
                            key={agent}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={cn(
                                index === AGENT_ORDER.length - 1 && 'col-span-2 max-w-[200px] mx-auto'
                            )}
                        >
                            <AgentCard
                                agent={agent}
                                status={state.status}
                                message={state.message}
                                summary={state.summary}
                                data={state.data}
                            />
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================================
// Default State Helper
// ============================================================================

export function createDefaultAgentStates(): Record<AgentName, AgentState> {
    return {
        scout: { status: 'idle' },
        guardian: { status: 'idle' },
        creator: { status: 'idle' },
        architect: { status: 'idle' },
        ops: { status: 'idle' },
    };
}

// ============================================================================
// Exports
// ============================================================================

export { AGENT_ORDER };
