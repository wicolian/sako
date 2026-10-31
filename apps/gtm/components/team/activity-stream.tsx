'use client';

/**
 * Activity Stream Component (Jan 2026)
 * 
 * Real-time log of what the AI team is doing.
 * 
 * @see PRD Part 3.4: Activity Stream Component
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    Search,
    Shield,
    PenTool,
    Layout,
    Rocket,
    Info,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AgentName } from './agent-card';

// ============================================================================
// Types
// ============================================================================

export interface ActivityEntry {
    id: string;
    timestamp: Date;
    agent?: AgentName | 'system';
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    details?: string;
    expandable?: boolean;
}

export interface ActivityStreamProps {
    activities: ActivityEntry[];
    className?: string;
    maxHeight?: string;
}

// ============================================================================
// Agent Icons
// ============================================================================

const AGENT_ICONS: Record<AgentName | 'system', LucideIcon> = {
    scout: Search,
    guardian: Shield,
    creator: PenTool,
    architect: Layout,
    ops: Rocket,
    system: Sparkles,
};

const AGENT_COLORS: Record<AgentName | 'system', string> = {
    scout: 'text-blue-500',
    guardian: 'text-yellow-500',
    creator: 'text-purple-500',
    architect: 'text-orange-500',
    ops: 'text-green-500',
    system: 'text-primary',
};

// ============================================================================
// Type Icons
// ============================================================================

function TypeIcon({ type }: { type: ActivityEntry['type'] }) {
    switch (type) {
        case 'success':
            return <CheckCircle className="h-3 w-3 text-green-500" />;
        case 'warning':
            return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
        case 'error':
            return <XCircle className="h-3 w-3 text-red-500" />;
        default:
            return <Info className="h-3 w-3 text-muted-foreground" />;
    }
}

// ============================================================================
// Activity Item
// ============================================================================

function ActivityItem({ activity }: { activity: ActivityEntry }) {
    const AgentIcon = activity.agent ? AGENT_ICONS[activity.agent] : Info;
    const agentColor = activity.agent ? AGENT_COLORS[activity.agent] : 'text-muted-foreground';

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-start gap-3 py-2 px-3 hover:bg-muted/50 rounded-lg transition-colors"
        >
            {/* Agent Icon */}
            <div className={cn('mt-0.5 p-1.5 rounded-full bg-muted', agentColor)}>
                <AgentIcon className="h-3 w-3" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                        {formatTime(activity.timestamp)}
                    </span>
                    <TypeIcon type={activity.type} />
                </div>
                <p className="text-sm text-foreground mt-0.5">{activity.message}</p>
                {activity.details && (
                    <p className="text-xs text-muted-foreground mt-1">{activity.details}</p>
                )}
            </div>
        </motion.div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function ActivityStream({
    activities,
    className,
    maxHeight = '300px',
}: ActivityStreamProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new activities
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [activities]);

    return (
        <div className={cn('w-full', className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2 px-3">
                <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
                <span className="text-xs text-muted-foreground">
                    {activities.length} event{activities.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Activity List */}
            <div
                ref={containerRef}
                className={cn(
                    'overflow-y-auto border rounded-lg bg-card/50',
                )}
                style={{ maxHeight }}
            >
                {activities.length === 0 ? (
                    <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
                        Activity will appear here...
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {activities.map((activity) => (
                            <ActivityItem key={activity.id} activity={activity} />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Helper Functions
// ============================================================================

export function createActivityEntry(
    message: string,
    options: Partial<Omit<ActivityEntry, 'id' | 'timestamp' | 'message'>> = {}
): ActivityEntry {
    return {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        type: 'info',
        message,
        ...options,
    };
}
