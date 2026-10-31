import React, { useMemo, useState } from 'react';
import { ReviewAsset, ReviewAssetRevision, ReviewRevisionStatus } from '../types';
import { AnnotationThread } from './AnnotationThread';
import { clsx } from 'clsx';

interface AnnotationSidebarProps {
    activeAsset: ReviewAsset | null;
    activeRevision: ReviewAssetRevision | null;
    selectedAnnotationId: string | null;
    onSelectAnnotation: (id: string | null) => void;
    onSelectRevision: (revisionId: string) => void;
    onReply: (id: string, text: string) => void;
    onResolve: (id: string) => void;
    onUnresolve: (id: string) => void;
    onRequestChanges: (feedback: string) => Promise<void> | void;
    onMarkCompleted: () => Promise<void> | void;
    onAddGeneralComment: (text: string) => void;
    isAdmin?: boolean;
    onUploadRevision?: (assetId: string) => void;
    isRequestingChanges?: boolean;
    isMarkingCompleted?: boolean;
}

export const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
    activeAsset,
    activeRevision,
    selectedAnnotationId,
    onSelectAnnotation,
    onSelectRevision,
    onReply,
    onResolve,
    onUnresolve,
    onRequestChanges,
    onMarkCompleted,
    onAddGeneralComment,
    isAdmin,
    onUploadRevision,
    isRequestingChanges,
    isMarkingCompleted,
}) => {
    const [feedback, setFeedback] = useState('');
    const [generalComment, setGeneralComment] = useState('');

    const annotations = activeRevision?.annotations || [];
    const unresolvedCount = annotations.filter(a => !a.resolved).length;

    const sortedRevisions = useMemo(() => {
        if (!activeAsset) return [];
        return [...activeAsset.revisions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [activeAsset]);

    if (!activeAsset || !activeRevision) {
        return <div className="p-6 text-sm text-[color:var(--muted-foreground)]">Select an asset to see its revisions and feedback.</div>;
    }

    return (
        <div className="flex flex-col h-full bg-[color:var(--card)] border-l border-[color:var(--border)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-1">Revision timeline</p>
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{activeAsset.title}</p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => onUploadRevision?.(activeAsset.id)}
                        className="text-[12px] font-semibold text-blue-600 hover:text-blue-500"
                    >
                        Upload
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <section className="space-y-3">
                    {sortedRevisions.map(rev => (
                        <button
                            key={rev.id}
                            onClick={() => onSelectRevision(rev.id)}
                            className={clsx(
                                "w-full text-left rounded-2xl border p-3 transition-all",
                                rev.id === activeRevision.id
                                    ? "border-[color:var(--primary)]/40 bg-[color:var(--accent)] shadow-sm"
                                    : "border-[color:var(--border)] hover:border-[color:var(--primary)]/40 hover:bg-[color:var(--accent)]/60"
                            )}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[13px] font-semibold text-[color:var(--foreground)]">{rev.label}</span>
                                <span className={clsx(
                                    "px-2 py-0.5 rounded-full text-[11px] font-medium",
                                    badgeColor(rev.status)
                                )}>
                                    {rev.status.replace('_', ' ')}
                                </span>
                            </div>
                            <p className="text-[11px] text-[color:var(--muted-foreground)]">{new Date(rev.createdAt).toLocaleString()}</p>
                            {rev.reason && (
                                <p className="mt-2 text-[12px] text-[color:var(--muted-foreground)]">{rev.reason}</p>
                            )}
                        </button>
                    ))}
                </section>

                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Comments</p>
                            <p className="text-sm text-[color:var(--muted-foreground)]">{unresolvedCount} unresolved</p>
                        </div>
                        <div className="text-[11px] text-[color:var(--muted-foreground)]">{annotations.length} threads</div>
                    </div>

                    {annotations.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--background)]/60 p-4 text-center text-[12px] text-[color:var(--muted-foreground)]">
                            No comments yet — click on the asset to drop a pin or leave a timecode note.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {annotations.map(annotation => (
                                <AnnotationThread
                                    key={annotation.id}
                                    annotation={annotation}
                                    onReply={onReply}
                                    onResolve={onResolve}
                                    onUnresolve={onUnresolve}
                                    isActive={selectedAnnotationId === annotation.id}
                                    onSelect={() => onSelectAnnotation(annotation.id)}
                                />
                            ))}
                        </div>
                    )}

                    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 space-y-2">
                        <textarea
                            value={generalComment}
                            onChange={(e) => setGeneralComment(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]/40"
                            placeholder="Add a general comment..."
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={() => {
                                    if (!generalComment.trim()) return;
                                    onAddGeneralComment(generalComment.trim());
                                    setGeneralComment('');
                                }}
                                disabled={!generalComment.trim()}
                                className="px-3 py-1.5 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-xs font-semibold disabled:opacity-60"
                            >
                                Post comment
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <div className="border-t border-[color:var(--border)] p-4 space-y-3">
                <div>
                    <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-2 block">Request changes</label>
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border border-[color:var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]/30"
                        placeholder="Share what needs to change..."
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            if (!feedback.trim()) return;
                            onRequestChanges(feedback.trim());
                            setFeedback('');
                        }}
                        disabled={!feedback.trim() || isRequestingChanges}
                        className="flex-1 rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent)] px-3 py-2 text-[12px] font-semibold text-[color:var(--accent-foreground)] disabled:opacity-50"
                    >
                        {isRequestingChanges ? 'Sending...' : 'Request changes'}
                    </button>
                    <button
                        onClick={() => onMarkCompleted()}
                        disabled={isMarkingCompleted}
                        className="flex-1 rounded-2xl bg-[color:var(--primary)] px-3 py-2 text-[12px] font-semibold text-[color:var(--primary-foreground)] disabled:opacity-50"
                    >
                        {isMarkingCompleted ? 'Marking...' : 'Mark completed'}
                    </button>
                </div>
            </div>
        </div>
    );
};

function badgeColor(status: ReviewRevisionStatus) {
    switch (status) {
        case ReviewRevisionStatus.APPROVED:
            return 'bg-[color:var(--accent)] text-[color:var(--accent-foreground)]';
        case ReviewRevisionStatus.CHANGES_REQUESTED:
            return 'bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]';
        case ReviewRevisionStatus.IN_REVIEW:
            return 'bg-[color:var(--primary)]/10 text-[color:var(--primary)]';
        default:
            return 'bg-[color:var(--muted)] text-[color:var(--muted-foreground)]';
    }
}
