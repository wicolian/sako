'use client';

/**
 * Guardian Review Modal (Jan 2026)
 * 
 * Modal for human review of Guardian-flagged claims.
 * 
 * @see PRD Part 4.1: Guardian Review Modal
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle, XCircle, Edit3, ArrowRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// ============================================================================
// Types
// ============================================================================

export interface FlaggedClaim {
    index: number;
    text: string;
    risk: 'high' | 'medium' | 'low';
    reason: string;
    suggestion?: string;
    evidence?: Array<{ title: string; url?: string }>;
}

export interface ClaimDecision {
    claimIndex: number;
    decision: 'use_suggestion' | 'keep_original' | 'edit';
    editedText?: string;
}

export interface GuardianReviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    claims: FlaggedClaim[];
    sessionId: string;
    onSubmit: (decisions: ClaimDecision[]) => Promise<void>;
    isSubmitting?: boolean;
}

// ============================================================================
// Risk Badge
// ============================================================================

function RiskBadge({ risk }: { risk: FlaggedClaim['risk'] }) {
    return (
        <span className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full',
            risk === 'high' && 'bg-destructive/10 text-destructive  ',
            risk === 'medium' && 'bg-amber-500/10 text-amber-500  ',
            risk === 'low' && 'bg-blue-500/10 text-blue-500  '
        )}>
            {risk} risk
        </span>
    );
}

// ============================================================================
// Claim Review Card
// ============================================================================

interface ClaimReviewCardProps {
    claim: FlaggedClaim;
    decision: ClaimDecision | undefined;
    onDecision: (decision: ClaimDecision) => void;
}

function ClaimReviewCard({ claim, decision, onDecision }: ClaimReviewCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(claim.text);

    const handleUseSuggestion = () => {
        onDecision({
            claimIndex: claim.index,
            decision: 'use_suggestion',
        });
    };

    const handleKeepOriginal = () => {
        onDecision({
            claimIndex: claim.index,
            decision: 'keep_original',
        });
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        onDecision({
            claimIndex: claim.index,
            decision: 'edit',
            editedText,
        });
        setIsEditing(false);
    };

    const isDecided = decision !== undefined;

    return (
        <div className={cn(
            'p-4 rounded-lg border transition-colors',
            isDecided ? 'bg-muted/50 border-muted' : 'bg-card border-border'
        )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <RiskBadge risk={claim.risk} />
                {isDecided && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1 text-sm text-emerald-500"
                    >
                        <CheckCircle className="h-4 w-4" />
                        <span>Decided</span>
                    </motion.div>
                )}
            </div>

            {/* Original Claim */}
            <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-1">Original claim:</p>
                <p className={cn(
                    'text-sm p-2 rounded bg-red-50  border-l-2 border-red-500',
                    isDecided && 'opacity-60'
                )}>
                    "{claim.text}"
                </p>
            </div>

            {/* Risk Reason */}
            <div className="flex items-start gap-2 mb-3 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-500 flex-shrink-0" />
                <p>{claim.reason}</p>
            </div>

            {/* Suggestion (if available) */}
            {claim.suggestion && (
                <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-1">Guardian's suggestion:</p>
                    <p className={cn(
                        'text-sm p-2 rounded bg-green-50  border-l-2 border-green-500',
                        isDecided && 'opacity-60'
                    )}>
                        "{claim.suggestion}"
                    </p>
                </div>
            )}

            {/* Edit Mode */}
            <AnimatePresence>
                {isEditing && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-4"
                    >
                        <p className="text-xs text-muted-foreground mb-1">Your edited version:</p>
                        <Textarea
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            className="min-h-[80px]"
                            placeholder="Enter your revised claim..."
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setIsEditing(false);
                                    setEditedText(claim.text);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={!editedText.trim()}
                            >
                                Save Edit
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action Buttons */}
            {!isDecided && !isEditing && (
                <div className="flex flex-wrap gap-2">
                    {claim.suggestion && (
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleUseSuggestion}
                            className="gap-1"
                        >
                            <CheckCircle className="h-3 w-3" />
                            Use Suggestion
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleKeepOriginal}
                        className="gap-1"
                    >
                        <XCircle className="h-3 w-3" />
                        Keep Original
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEdit}
                        className="gap-1"
                    >
                        <Edit3 className="h-3 w-3" />
                        Edit
                    </Button>
                </div>
            )}

            {/* Decision Summary */}
            {isDecided && (
                <p className="text-sm text-muted-foreground">
                    Decision: {
                        decision.decision === 'use_suggestion' ? 'Using Guardian\'s suggestion' :
                            decision.decision === 'keep_original' ? 'Keeping original' :
                                `Using edited version: "${decision.editedText}"`
                    }
                </p>
            )}
        </div>
    );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export function GuardianReviewModal({
    open,
    onOpenChange,
    claims,
    sessionId,
    onSubmit,
    isSubmitting = false,
}: GuardianReviewModalProps) {
    const [decisions, setDecisions] = useState<Map<number, ClaimDecision>>(new Map());

    const handleDecision = (decision: ClaimDecision) => {
        setDecisions(prev => {
            const next = new Map(prev);
            next.set(decision.claimIndex, decision);
            return next;
        });
    };

    const allDecided = claims.every(claim => decisions.has(claim.index));

    const handleSubmit = async () => {
        const decisionsArray = Array.from(decisions.values());
        await onSubmit(decisionsArray);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-yellow-500/10">
                            <Shield className="h-6 w-6 text-yellow-500" />
                        </div>
                        <div>
                            <DialogTitle>Guardian Needs Your Input</DialogTitle>
                            <DialogDescription>
                                Review the following claims before we continue. Your decisions help ensure compliance.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Claims List */}
                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                    {claims.map((claim) => (
                        <ClaimReviewCard
                            key={claim.index}
                            claim={claim}
                            decision={decisions.get(claim.index)}
                            onDecision={handleDecision}
                        />
                    ))}
                </div>

                {/* Footer */}
                <DialogFooter className="border-t pt-4">
                    <div className="flex items-center justify-between w-full">
                        <p className="text-sm text-muted-foreground">
                            {decisions.size} of {claims.length} claims reviewed
                        </p>
                        <Button
                            onClick={handleSubmit}
                            disabled={!allDecided || isSubmitting}
                            className="gap-2"
                        >
                            {isSubmitting ? (
                                <>Processing...</>
                            ) : (
                                <>
                                    Continue
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
