import React, { useState } from 'react';
import { ReviewAnnotation } from '../types';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';

interface AnnotationThreadProps {
    annotation: ReviewAnnotation;
    onReply: (id: string, text: string) => void;
    onResolve: (id: string) => void;
    onUnresolve: (id: string) => void;
    isActive?: boolean;
    onSelect?: () => void;
}

export const AnnotationThread: React.FC<AnnotationThreadProps> = ({
    annotation,
    onReply,
    onResolve,
    onUnresolve,
    isActive,
    onSelect,
}) => {
    const [replyText, setReplyText] = useState('');
    const [isReplying, setIsReplying] = useState(false);

    const handleSubmitReply = (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        onReply(annotation.id, replyText.trim());
        setReplyText('');
        setIsReplying(false);
    };

    const authorInitial = annotation.author?.name?.[0] || annotation.author?.email?.[0] || 'U';

    return (
        <div
            className={clsx(
                "rounded-2xl border p-3 space-y-2 transition-all",
                annotation.resolved
                    ? "border-[color:var(--border)] bg-[color:var(--background)]/70 text-[color:var(--muted-foreground)]"
                    : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]",
                isActive ? "ring-2 ring-[color:var(--ring)]/40" : "hover:border-[color:var(--ring)]/40"
            )}
            onClick={() => onSelect?.()}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-[color:var(--primary)]/15 text-[color:var(--primary)] flex items-center justify-center text-[12px] font-semibold">
                        {authorInitial}
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-[color:var(--foreground)]">{annotation.author?.name || 'Reviewer'}</p>
                        <p className="text-[11px] text-[color:var(--muted-foreground)]">{formatDistanceToNow(new Date(annotation.createdAt))} ago</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        annotation.resolved ? onUnresolve(annotation.id) : onResolve(annotation.id);
                    }}
                    className="text-[11px] font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                >
                    {annotation.resolved ? 'Reopen' : 'Resolve'}
                </button>
            </div>

            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{annotation.text}</p>

            {annotation.replies && annotation.replies.length > 0 && (
                <div className="ml-10 space-y-2">
                    {annotation.replies.map(reply => (
                        <div key={reply.id} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/70 p-2 text-[12px] text-[color:var(--muted-foreground)]">
                            <div className="flex items-center gap-2 text-[11px] text-[color:var(--muted-foreground)] mb-1">
                                <span>{reply.author?.name || 'Reviewer'}</span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(reply.createdAt))} ago</span>
                            </div>
                            <p>{reply.text}</p>
                        </div>
                    ))}
                </div>
            )}

            {isReplying ? (
                <form onSubmit={handleSubmitReply} className="space-y-2">
                    <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]/40"
                        placeholder="Write a reply..."
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsReplying(false)}
                            className="text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="rounded-full bg-[color:var(--primary)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--primary-foreground)]"
                        >
                            Reply
                        </button>
                    </div>
                </form>
            ) : (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsReplying(true);
                    }}
                    className="text-[11px] font-semibold text-[color:var(--primary)]"
                >
                    Reply
                </button>
            )}
        </div>
    );
};
