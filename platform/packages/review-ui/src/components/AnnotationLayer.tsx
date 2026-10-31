import React, { useRef, useState } from 'react';
import { ReviewAnnotation, ReviewAnnotationKind } from '../types';
import { AnnotationPayload } from '../schemas/annotations';
import { clsx } from 'clsx';

interface AnnotationLayerProps {
    annotations: ReviewAnnotation[];
    onAddAnnotation: (payload: AnnotationPayload, text: string, kind: ReviewAnnotationKind) => void;
    children: React.ReactNode;
    annotationKind: ReviewAnnotationKind;
    selectedAnnotationId?: string | null;
    onSelectAnnotation?: (id: string) => void;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
    annotations,
    onAddAnnotation,
    children,
    annotationKind,
    selectedAnnotationId,
    onSelectAnnotation,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pendingPoint, setPendingPoint] = useState<{ x: number; y: number } | null>(null);
    const [draftText, setDraftText] = useState('');

    const handleClick = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        // Avoid click when interacting with composer
        if ((e.target as HTMLElement).closest('[data-annotation-composer="true"]')) {
            return;
        }
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Normalize click position into 0–100% of the rendered surface
        const xPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100));

        setPendingPoint({ x: xPercent, y: yPercent });
        setDraftText('');
    };

    const handleSubmit = () => {
        if (!pendingPoint || !draftText.trim()) return;
        onAddAnnotation(
            { x: pendingPoint.x, y: pendingPoint.y },
            draftText.trim(),
            annotationKind
        );
        setPendingPoint(null);
        setDraftText('');
    };

    const toPercent = (value: number) => {
        // Support both 0–1 and 0–100 inputs defensively
        if (!Number.isFinite(value)) return 0;
        if (value <= 1 && value >= 0) return value * 100;
        return value;
    };

    return (
        <div className="relative inline-block w-full h-full" ref={containerRef} onClick={handleClick}>
            <div className="select-none w-full h-full flex items-center justify-center">
                {children}
            </div>
            {annotations.map((ann, index) => {
                if (!ann.payload || typeof ann.payload.x === 'undefined' || typeof ann.payload.y === 'undefined') {
                    return null;
                }
                return (
                    <button
                        key={ann.id}
                        type="button"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelectAnnotation?.(ann.id);
                        }}
                        className={clsx(
                            "absolute w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center text-xs font-semibold transition-transform z-10",
                            ann.resolved ? "bg-zinc-400 text-white" : "bg-[color:var(--primary)] text-white",
                            selectedAnnotationId === ann.id ? "ring-2 ring-white scale-110 -translate-x-1/2 -translate-y-1/2" : "hover:scale-110 -translate-x-1/2 -translate-y-1/2"
                        )}
                        style={{ left: `${toPercent(ann.payload.x)}%`, top: `${toPercent(ann.payload.y)}%` }}
                    >
                        {index + 1}
                    </button>
                );
            })}

            {pendingPoint && (
                <div
                    className="absolute z-20"
                    style={{ left: `${pendingPoint.x}%`, top: `${pendingPoint.y}%` }}
                >
                    <div
                        className="relative -translate-x-1/2 -translate-y-full min-w-[260px]"
                        data-annotation-composer="true"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-xl p-3 space-y-2">
                            <textarea
                                value={draftText}
                                onChange={(e) => setDraftText(e.target.value)}
                                rows={3}
                                className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-[13px] text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]/30 placeholder:text-[color:var(--muted-foreground)]"
                                placeholder="Leave feedback for this spot..."
                                autoFocus
                            />
                            <div className="flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPendingPoint(null);
                                        setDraftText('');
                                    }}
                                    className="text-[12px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!draftText.trim()}
                                    onClick={handleSubmit}
                                    className="px-4 py-1.5 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[12px] font-semibold disabled:opacity-50"
                                >
                                    Post
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="absolute inset-0 cursor-crosshair pointer-events-none" />
        </div>
    );
};
