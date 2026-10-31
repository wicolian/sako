import React, { useMemo, useState, useCallback } from 'react';
import { ReviewBoardData, ReviewAnnotationKind, ReviewBoardTransport, ReviewAssetType, ReviewAnnotation } from './types';
import { AnnotationPayload } from './schemas/annotations';
import { AssetViewer } from './components/AssetViewer';
import { useReviewBoard } from './hooks/useReviewBoard';
import { clsx } from 'clsx';
import { Maximize2, Download, X, ExternalLink } from 'lucide-react';

interface ReviewBoardProps {
    taskId: string;
    initialData: ReviewBoardData;
    currentUser: { id: string; name?: string | null; avatarUrl?: string | null };
    transport: ReviewBoardTransport;
    socket?: any;
    onBack?: () => void;
    isAdmin?: boolean;
    readOnly?: boolean;
    onUploadRevision?: (assetId: string) => void;
    onReviewStateChanged?: () => Promise<void> | void;
}

// Asset type tab configuration
const ASSET_TYPE_TABS: { type: ReviewAssetType | 'all'; label: string }[] = [
    { type: 'all', label: 'All' },
    { type: ReviewAssetType.IMAGE, label: 'Images' },
    { type: ReviewAssetType.PDF, label: 'PDF' },
    { type: ReviewAssetType.VIDEO, label: 'Video' },
    { type: ReviewAssetType.FIGMA, label: 'Figma' },
    { type: ReviewAssetType.EMBED, label: 'Embeds' },
    { type: ReviewAssetType.LOTTIE, label: 'Motion' },
];

export const ReviewBoard: React.FC<ReviewBoardProps> = ({
    initialData,
    currentUser,
    transport,
    socket,
    onBack: _onBack,
    isAdmin,
    readOnly = false,
    onUploadRevision,
    onReviewStateChanged,
}) => {
    const { state, actions } = useReviewBoard(initialData, socket, currentUser, {
        transport,
        onReviewStateChanged,
    });

    const { activeAsset, activeRevision, assets, selectedAnnotationId, isMarkingApproved, isRequestingChanges } = state;
    const [activeTypeTab, setActiveTypeTab] = useState<ReviewAssetType | 'all'>('all');
    const [generalComment, setGeneralComment] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Get current asset URL for download/fullscreen
    const currentAssetUrl = activeRevision?.fileUrl || activeAsset?.sourceUrl || '';

    const handleDownload = useCallback(() => {
        if (!currentAssetUrl) return;
        // Open in new tab - CORS prevents fetch for cross-origin files
        window.open(currentAssetUrl, '_blank');
    }, [currentAssetUrl]);

    const openFullscreen = useCallback(() => {
        setIsFullscreen(true);
        document.body.style.overflow = 'hidden';
    }, []);

    const closeFullscreen = useCallback(() => {
        setIsFullscreen(false);
        document.body.style.overflow = '';
    }, []);

    // Get available tabs based on assets
    const availableTabs = useMemo(() => {
        const types = new Set(assets.map(a => a.type));
        return ASSET_TYPE_TABS.filter(tab => {
            if (tab.type === 'all') return true;
            if (tab.type === ReviewAssetType.LOTTIE) return types.has(ReviewAssetType.LOTTIE) || types.has(ReviewAssetType.RIVE);
            return types.has(tab.type);
        });
    }, [assets]);

    // Get annotations with pin numbers for the pinned feedback section
    const pinnedAnnotations = useMemo(() => {
        if (!activeRevision) return [];
        return activeRevision.annotations
            .filter(a => a.payload && typeof a.payload.x !== 'undefined' && typeof a.payload.y !== 'undefined')
            .map((a, idx) => ({ ...a, pinNumber: idx + 1 }));
    }, [activeRevision]);

    // Sorted revisions for the sidebar
    const sortedRevisions = useMemo(() => {
        if (!activeAsset) return [];
        return [...activeAsset.revisions].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [activeAsset]);

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const handleAddGeneralComment = () => {
        if (!generalComment.trim()) return;
        actions.addAnnotation({ type: 'general' } as AnnotationPayload, generalComment.trim(), ReviewAnnotationKind.EMBED_REF);
        setGeneralComment('');
    };

    // If no assets, show empty state
    if (assets.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)]">
                <div className="text-center p-8">
                    <div className="w-12 h-12 rounded-full bg-[color:var(--muted)] flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-[color:var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p className="text-[13px] text-[color:var(--muted-foreground)]">No assets to review yet</p>
                    <p className="text-[12px] text-[color:var(--muted-foreground)] mt-1">Assets will appear here once uploaded.</p>
                </div>
            </div>
        );
    }

    return (
        <>
        <div className="flex h-full w-full bg-[color:var(--background)] overflow-hidden rounded-2xl border border-[color:var(--border)]">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Asset Type Tabs */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--card)]">
                    {availableTabs.map(tab => (
                        <button
                            key={tab.type}
                            onClick={() => {
                                setActiveTypeTab(tab.type);
                                // Select first asset of this type if current isn't in filtered
                                const filtered = tab.type === 'all' ? assets :
                                    tab.type === ReviewAssetType.LOTTIE ? assets.filter(a => a.type === ReviewAssetType.LOTTIE || a.type === ReviewAssetType.RIVE) :
                                        assets.filter(a => a.type === tab.type);
                                if (filtered.length > 0 && activeAsset && !filtered.find(a => a.id === activeAsset.id)) {
                                    actions.selectAsset(filtered[0].id);
                                }
                            }}
                            className={clsx(
                                "px-4 py-2 rounded-lg text-[13px] font-medium transition-all",
                                activeTypeTab === tab.type
                                    ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                                    : "bg-[color:var(--muted)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Canvas Area */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[color:var(--muted)]/30">
                    {/* Toolbar with instruction text and actions */}
                    <div className="flex items-center justify-between px-4 py-2">
                        <div className="text-[12px] text-[color:var(--muted-foreground)]">
                            {activeAsset?.type === ReviewAssetType.VIDEO
                                ? 'Click anywhere on the timeline to drop feedback at a timecode'
                                : 'Click a pin to focus its thread'}
                        </div>
                        {activeAsset && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={openFullscreen}
                                    className="p-2 rounded-lg hover:bg-[color:var(--accent)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition"
                                    title="Full screen"
                                >
                                    <Maximize2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="p-2 rounded-lg hover:bg-[color:var(--accent)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition"
                                    title="Download / Open in new tab"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Asset Viewer */}
                    <div className="flex-1 px-4 pb-4 min-h-0">
                        <div className="w-full h-full rounded-xl overflow-hidden bg-[color:var(--card)] border border-[color:var(--border)] shadow-sm">
                            {activeAsset && activeRevision ? (
                                <AssetViewer
                                    asset={activeAsset}
                                    revision={activeRevision}
                                    onAddAnnotation={actions.addAnnotation}
                                    onSelectAnnotation={(id) => actions.selectAnnotation(id)}
                                    selectedAnnotationId={selectedAnnotationId}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[13px] text-[color:var(--muted-foreground)]">
                                    Select an asset to start reviewing.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Pinned Feedback Section - for image assets */}
                    {activeAsset && (activeAsset.type === ReviewAssetType.IMAGE || activeAsset.type === ReviewAssetType.PDF) && pinnedAnnotations.length > 0 && (
                        <div className="px-4 pb-4">
                            <div className="bg-[color:var(--card)] rounded-xl border border-[color:var(--border)] p-4">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-3">Pinned Feedback</p>
                                <div className="space-y-3">
                                    {pinnedAnnotations.map((ann) => (
                                        <PinnedFeedbackItem
                                            key={ann.id}
                                            annotation={ann}
                                            pinNumber={ann.pinNumber}
                                            isSelected={selectedAnnotationId === ann.id}
                                            onClick={() => actions.selectAnnotation(ann.id)}
                                            formatTimeAgo={formatTimeAgo}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Timecoded Feedback Section - for video assets */}
                    {activeAsset && activeAsset.type === ReviewAssetType.VIDEO && activeRevision && activeRevision.annotations.length > 0 && (
                        <div className="px-4 pb-4">
                            <div className="bg-[color:var(--card)] rounded-xl border border-[color:var(--border)] p-4">
                                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-3">Timecoded Feedback</p>
                                <div className="space-y-3">
                                    {activeRevision.annotations.map((ann) => (
                                        <TimecodedFeedbackItem
                                            key={ann.id}
                                            annotation={ann}
                                            isSelected={selectedAnnotationId === ann.id}
                                            onClick={() => actions.selectAnnotation(ann.id)}
                                            formatTimeAgo={formatTimeAgo}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar */}
            <div className="w-[380px] flex-shrink-0 flex flex-col bg-[color:var(--card)] border-l border-[color:var(--border)]">
                {/* Revision History */}
                <div className="p-4 border-b border-[color:var(--border)]">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-3">Revision History</p>
                    <div className="space-y-2">
                        {sortedRevisions.map((rev, idx) => (
                            <button
                                key={rev.id}
                                onClick={() => actions.selectRevision(rev.id)}
                                className={clsx(
                                    "w-full text-left rounded-xl p-3 transition-all",
                                    rev.id === activeRevision?.id
                                        ? "bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/30"
                                        : "bg-[color:var(--muted)]/50 border border-transparent hover:bg-[color:var(--accent)]"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={clsx(
                                        "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                                        rev.id === activeRevision?.id
                                            ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                                            : "bg-[color:var(--muted)] text-[color:var(--muted-foreground)]"
                                    )}>
                                        {rev.status === 'APPROVED' ? (
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <span className="text-[10px] font-semibold">{sortedRevisions.length - idx}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[13px] font-medium text-[color:var(--foreground)]">
                                                {rev.label}{idx === 0 ? ' · Current' : ''}
                                            </span>
                                        </div>
                                        {rev.reason && (
                                            <p className="text-[12px] text-[color:var(--muted-foreground)] mt-1 line-clamp-2">{rev.reason}</p>
                                        )}
                                        <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">
                                            {formatTimeAgo(rev.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Upload button for admin */}
                    {isAdmin && activeAsset && (
                        <button
                            onClick={() => onUploadRevision?.(activeAsset.id)}
                            className="w-full mt-3 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[color:var(--muted)] text-[color:var(--foreground)] text-[12px] font-medium hover:bg-[color:var(--accent)] transition"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Upload new revision
                        </button>
                    )}
                </div>

                {/* Actions - Only show for clients (not admins or in readOnly mode) */}
                {!readOnly && !isAdmin && (
                <div className="p-4 border-b border-[color:var(--border)] space-y-2">
                    <button
                        onClick={() => {
                            const text = window.prompt('Enter your feedback for this revision:');
                            if (text?.trim()) {
                                actions.requestChanges(text.trim());
                            }
                        }}
                        disabled={isRequestingChanges}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {isRequestingChanges ? 'Sending...' : 'Request changes'}
                    </button>
                    <button
                        onClick={() => actions.markCompleted()}
                        disabled={isMarkingApproved}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] text-[13px] font-medium hover:bg-[color:var(--accent)] transition disabled:opacity-50"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {isMarkingApproved ? 'Marking...' : 'Mark as completed'}
                    </button>
                </div>
                )}

                {/* Comments Section */}
                <div className="flex-1 flex flex-col min-h-0 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Comments</p>
                        <span className="text-[11px] text-[color:var(--muted-foreground)]">{activeRevision?.annotations.length || 0} comments</span>
                    </div>

                    {/* Comments list */}
                    <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                        {activeRevision?.annotations.map((ann) => (
                            <CommentItem
                                key={ann.id}
                                annotation={ann}
                                isSelected={selectedAnnotationId === ann.id}
                                onClick={() => actions.selectAnnotation(ann.id)}
                                formatTimeAgo={formatTimeAgo}
                            />
                        ))}
                        {(!activeRevision?.annotations || activeRevision.annotations.length === 0) && (
                            <p className="text-[12px] text-[color:var(--muted-foreground)] text-center py-4">No comments yet</p>
                        )}
                    </div>

                    {/* Add comment */}
                    <div className="pt-3 border-t border-dashed border-[color:var(--border)]">
                        <textarea
                            value={generalComment}
                            onChange={(e) => setGeneralComment(e.target.value)}
                            placeholder="Add a comment or drop a link"
                            className="w-full px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)] resize-none placeholder:text-[color:var(--muted-foreground)]"
                            rows={3}
                        />
                        <div className="flex items-center justify-between mt-2">
                            <button className="inline-flex items-center gap-1 text-[12px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                Attach
                            </button>
                            <button
                                onClick={handleAddGeneralComment}
                                disabled={!generalComment.trim()}
                                className="inline-flex items-center px-4 py-1.5 rounded-lg bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[12px] font-medium hover:opacity-90 transition disabled:opacity-50"
                            >
                                Post comment
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

            {/* Fullscreen Modal */}
            {isFullscreen && activeAsset && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
                    {/* Fullscreen header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-700">
                        <div className="text-white text-[14px] font-medium truncate flex-1 mr-4">
                            {activeAsset.title}
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={currentAssetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                                title="Open in new tab"
                            >
                                <ExternalLink className="w-5 h-5" />
                            </a>
                            <button
                                onClick={handleDownload}
                                className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                                title="Download"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            <button
                                onClick={closeFullscreen}
                                className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    {/* Fullscreen content */}
                    <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
                        {activeAsset.type === ReviewAssetType.IMAGE && (
                            <img src={currentAssetUrl} alt={activeAsset.title} className="max-w-full max-h-full object-contain" />
                        )}
                        {activeAsset.type === ReviewAssetType.PDF && (
                            <iframe src={currentAssetUrl} className="w-full h-full bg-white" title={activeAsset.title} />
                        )}
                        {activeAsset.type === ReviewAssetType.VIDEO && (
                            <video src={currentAssetUrl} controls className="max-w-full max-h-full" />
                        )}
                        {(activeAsset.type === ReviewAssetType.FIGMA || activeAsset.type === ReviewAssetType.EMBED) && (
                            <iframe src={currentAssetUrl} className="w-full h-full" title={activeAsset.title} allowFullScreen />
                        )}
                        {(activeAsset.type === ReviewAssetType.LOTTIE || activeAsset.type === ReviewAssetType.RIVE) && (
                            <div className="text-white text-center">
                                <p>Animation preview not available in fullscreen</p>
                                <a href={currentAssetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline mt-2 inline-block">
                                    Open in new tab →
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

// Pinned Feedback Item Component
const PinnedFeedbackItem: React.FC<{
    annotation: ReviewAnnotation & { pinNumber: number };
    pinNumber: number;
    isSelected: boolean;
    onClick: () => void;
    formatTimeAgo: (date: string) => string;
}> = ({ annotation, pinNumber, isSelected, onClick, formatTimeAgo }) => {
    const authorName = annotation.author?.name || 'User';

    return (
        <button
            onClick={onClick}
            className={clsx(
                "w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all",
                isSelected
                    ? "bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/30"
                    : "bg-[color:var(--muted)]/50 border border-transparent hover:bg-[color:var(--accent)]"
            )}
        >
            <div className={clsx(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-semibold",
                isSelected
                    ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                    : "bg-[color:var(--muted)] text-[color:var(--muted-foreground)] border border-[color:var(--border)]"
            )}>
                {pinNumber}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-medium text-[color:var(--foreground)]">{authorName}</span>
                    {annotation.kind && (
                        <span className="px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[10px] text-[color:var(--muted-foreground)]">
                            {annotation.kind.toLowerCase().replace('_', ' ')}
                        </span>
                    )}
                    <span className="text-[11px] text-[color:var(--muted-foreground)]">{formatTimeAgo(annotation.createdAt)}</span>
                </div>
                <p className="text-[12px] text-[color:var(--foreground)] line-clamp-2">{annotation.text}</p>
            </div>
        </button>
    );
};

// Timecoded Feedback Item Component
const TimecodedFeedbackItem: React.FC<{
    annotation: ReviewAnnotation;
    isSelected: boolean;
    onClick: () => void;
    formatTimeAgo: (date: string) => string;
}> = ({ annotation, isSelected, onClick, formatTimeAgo }) => {
    const authorName = annotation.author?.name || 'User';
    const timecode = annotation.payload?.time != null
        ? `${Math.floor(annotation.payload.time / 60).toString().padStart(2, '0')}:${Math.floor(annotation.payload.time % 60).toString().padStart(2, '0')}`
        : null;

    return (
        <button
            onClick={onClick}
            className={clsx(
                "w-full text-left flex items-start gap-3 p-3 rounded-xl transition-all",
                isSelected
                    ? "bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/30"
                    : "bg-[color:var(--muted)]/50 border border-transparent hover:bg-[color:var(--accent)]"
            )}
        >
            {timecode && (
                <div className={clsx(
                    "px-2 py-1 rounded-lg flex-shrink-0 text-[11px] font-mono font-semibold",
                    isSelected
                        ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                )}>
                    {timecode}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-medium text-[color:var(--foreground)]">{authorName}</span>
                    <span className="text-[11px] text-[color:var(--muted-foreground)]">{formatTimeAgo(annotation.createdAt)}</span>
                </div>
                <p className="text-[12px] text-[color:var(--foreground)] line-clamp-2">{annotation.text}</p>
            </div>
        </button>
    );
};

// Comment Item Component
const CommentItem: React.FC<{
    annotation: ReviewAnnotation;
    isSelected: boolean;
    onClick: () => void;
    formatTimeAgo: (date: string) => string;
}> = ({ annotation, isSelected, onClick, formatTimeAgo }) => {
    const authorName = annotation.author?.name || 'User';
    const avatarInitial = authorName[0]?.toUpperCase() || 'U';

    return (
        <button
            onClick={onClick}
            className={clsx(
                "w-full text-left flex gap-3 p-2 rounded-xl transition-all",
                isSelected ? "bg-[color:var(--accent)]" : "hover:bg-[color:var(--muted)]/50"
            )}
        >
            <div className="w-8 h-8 rounded-full bg-[color:var(--muted)] flex items-center justify-center flex-shrink-0">
                {annotation.author?.avatarUrl ? (
                    <img src={annotation.author.avatarUrl} alt={authorName} className="w-full h-full rounded-full object-cover" />
                ) : (
                    <span className="text-[12px] font-medium text-[color:var(--muted-foreground)]">{avatarInitial}</span>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[12px] font-medium text-[color:var(--foreground)]">{authorName}</span>
                    <span className="text-[11px] text-[color:var(--muted-foreground)]">{formatTimeAgo(annotation.createdAt)}</span>
                </div>
                <p className="text-[12px] text-[color:var(--foreground)] line-clamp-2">{annotation.text}</p>
            </div>
        </button>
    );
};
