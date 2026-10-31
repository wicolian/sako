'use client';

/**
 * Agent Card Component (Jan 2026)
 * 
 * Displays individual agent status with visual feedback for the AI Marketing Team.
 * 
 * @see PRD Part 3.2: Agent Card Component
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    Search,
    Shield,
    PenTool,
    Layout,
    Rocket,
    CheckCircle2,
    AlertCircle,
    Clock,
    Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type AgentName = 'scout' | 'guardian' | 'creator' | 'architect' | 'ops';
export type AgentStatus = 'idle' | 'working' | 'complete' | 'error' | 'waiting';

export interface AgentCardProps {
    agent: AgentName;
    status: AgentStatus;
    message?: string;
    summary?: string;
    data?: unknown;
    className?: string;
}

// ============================================================================
// Agent Configuration
// ============================================================================

interface AgentConfig {
    name: string;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
    defaultMessage: string;
}

const AGENT_CONFIGS: Record<AgentName, AgentConfig> = {
    scout: {
        name: 'Scout',
        icon: Search,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500',
        defaultMessage: 'Research & Evidence',
    },
    guardian: {
        name: 'Guardian',
        icon: Shield,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500',
        defaultMessage: 'Compliance Review',
    },
    creator: {
        name: 'Creator',
        icon: PenTool,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500',
        defaultMessage: 'Content Writing',
    },
    architect: {
        name: 'Architect',
        icon: Layout,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500',
        defaultMessage: 'Design Selection',
    },
    ops: {
        name: 'Ops',
        icon: Rocket,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500',
        defaultMessage: 'Deployment Prep',
    },
};

// ============================================================================
// Status Icons
// ============================================================================

function StatusIcon({ status, className }: { status: AgentStatus; className?: string }) {
    switch (status) {
        case 'working':
            return <Loader2 className={cn('animate-spin', className)} />;
        case 'complete':
            return <CheckCircle2 className={cn('text-green-500', className)} />;
        case 'error':
            return <AlertCircle className={cn('text-red-500', className)} />;
        case 'waiting':
            return <Clock className={cn('text-yellow-500', className)} />;
        default:
            return null;
    }
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentCard({
    agent,
    status,
    message,
    summary,
    data,
    className,
}: AgentCardProps) {
    const config = AGENT_CONFIGS[agent];
    const Icon = config.icon;

    const isActive = status === 'working' || status === 'waiting';
    const isComplete = status === 'complete';
    const isError = status === 'error';
    const isIdle = status === 'idle';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'relative flex flex-col items-center p-6 rounded-xl border-2 transition-all duration-300',
                'bg-card',
                // Status-based styling
                isIdle && 'border-border opacity-60',
                isActive && cn(config.borderColor, 'shadow-lg'),
                isComplete && 'border-green-500 shadow-md',
                isError && 'border-red-500 shadow-md',
                className
            )}
        >
            {/* Pulse animation for working state */}
            {isActive && (
                <motion.div
                    className={cn(
                        'absolute inset-0 rounded-xl',
                        config.bgColor
                    )}
                    animate={{
                        opacity: [0.3, 0.1, 0.3],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            )}

            {/* Agent Icon */}
            <div className={cn(
                'relative z-10 p-4 rounded-full mb-3',
                isIdle ? 'bg-muted' : config.bgColor
            )}>
                <Icon className={cn(
                    'h-8 w-8',
                    isIdle ? 'text-muted-foreground' : config.color
                )} />

                {/* Status badge */}
                {!isIdle && (
                    <div className="absolute -top-1 -right-1">
                        <StatusIcon status={status} className="h-5 w-5" />
                    </div>
                )}
            </div>

            {/* Agent Name */}
            <h3 className={cn(
                'relative z-10 font-semibold text-lg mb-1',
                isIdle ? 'text-muted-foreground' : 'text-foreground'
            )}>
                {config.name}
            </h3>

            {/* Status Message */}
            <p className={cn(
                'relative z-10 text-sm text-center',
                isIdle ? 'text-muted-foreground' : 'text-muted-foreground'
            )}>
                {status === 'idle' && 'Standing by'}
                {status === 'working' && (message || 'Working...')}
                {status === 'waiting' && (message || 'Needs your input')}
                {status === 'complete' && 'Done'}
                {status === 'error' && (message || 'Error occurred')}
            </p>

            {/* Summary (shown when complete) */}
            {isComplete && summary && (
                <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="relative z-10 text-xs text-center text-muted-foreground mt-2 px-2"
                >
                    {summary}
                </motion.p>
            )}
        </motion.div>
    );
}

// ============================================================================
// Exports
// ============================================================================

export { AGENT_CONFIGS };
