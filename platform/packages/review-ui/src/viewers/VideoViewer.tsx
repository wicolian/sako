import React, { useRef, useState } from 'react';
import { clsx } from 'clsx';
import { ReviewAnnotation, ReviewAnnotationKind } from '../types';

interface VideoViewerProps {
    src: string;
    annotations: ReviewAnnotation[];
    onAddAnnotation: (payload: { time: number }, text: string) => void;
    onSelectAnnotation?: (id: string) => void;
    selectedAnnotationId?: string | null;
}

export const VideoViewer: React.FC<VideoViewerProps> = ({
    src,
    annotations,
    onAddAnnotation,
    onSelectAnnotation,
    selectedAnnotationId,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isComposing, setIsComposing] = useState(false);
    const [draft, setDraft] = useState('');

    const timeAnnotations = annotations.filter(
        (ann) => ann.kind === ReviewAnnotationKind.VIDEO_TIME && typeof ann.payload?.time === 'number'
    );

    const handleAddTimecode = () => {
        if (!draft.trim()) return;
        onAddAnnotation({ time: Number(currentTime.toFixed(2)) }, draft.trim());
        setDraft('');
        setIsComposing(false);
    };

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 bg-[color:var(--background)] rounded-2xl overflow-hidden shadow-lg">
                <video
                    ref={videoRef}
                    src={src}
                    controls
                    className="w-full h-full"
                    onTimeUpdate={(event) => setCurrentTime((event.target as HTMLVideoElement).currentTime)}
                />
            </div>

            <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Timecode markers</p>
                        <p className="text-sm text-[color:var(--muted-foreground)]">{timeAnnotations.length} comments</p>
                    </div>
                    <button
                        type="button"
                        className="text-[12px] font-semibold text-[color:var(--primary)]"
                        onClick={() => setIsComposing((prev) => !prev)}
                    >
                        {isComposing ? 'Close' : 'Add note'}
                    </button>
                </div>

                {isComposing && (
                    <div className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/70 p-3">
                        <div className="text-[12px] text-[color:var(--muted-foreground)]">Current time: {formatTime(currentTime)}</div>
                        <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={3}
                            className="w-full rounded-xl border border-[color:var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]/40"
                            placeholder="Add feedback for this moment..."
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setDraft('');
                                    setIsComposing(false);
                                }}
                                className="text-[11px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!draft.trim()}
                                onClick={handleAddTimecode}
                                className="rounded-full bg-[color:var(--primary)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--primary-foreground)] disabled:opacity-60"
                            >
                                Post
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {timeAnnotations.length === 0 && (
                        <div className="rounded-xl border border-dashed border-[color:var(--border)] px-3 py-2 text-[12px] text-[color:var(--muted-foreground)]">
                            No timecode comments yet.
                        </div>
                    )}
                    {timeAnnotations
                        .sort((a, b) => (a.payload.time || 0) - (b.payload.time || 0))
                        .map((annotation) => (
                            <button
                                type="button"
                                key={annotation.id}
                                className={clsx(
                                    "w-full rounded-xl border px-3 py-2 text-left transition-all",
                                    selectedAnnotationId === annotation.id
                                        ? "border-[color:var(--primary)]/40 bg-[color:var(--accent)]"
                                        : "border-[color:var(--border)] hover:border-[color:var(--primary)]/40 hover:bg-[color:var(--accent)]/60"
                                )}
                                onClick={() => {
                                    if (videoRef.current && typeof annotation.payload?.time === 'number') {
                                        videoRef.current.currentTime = annotation.payload.time;
                                    }
                                    onSelectAnnotation?.(annotation.id);
                                }}
                            >
                                <div className="flex items-center gap-2 text-[11px] font-semibold text-[color:var(--primary)]">
                                    <span>{formatTime(annotation.payload.time)}</span>
                                    {annotation.author?.name && (
                                        <>
                                            <span className="text-[color:var(--muted-foreground)]/60">•</span>
                                            <span className="text-[color:var(--muted-foreground)]">{annotation.author.name}</span>
                                        </>
                                    )}
                                </div>
                                <p className="text-[12px] text-[color:var(--muted-foreground)]">{annotation.text}</p>
                            </button>
                        ))}
                </div>
            </div>
        </div>
    );
};

function formatTime(seconds: number = 0) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

