import { useState, useEffect, useRef } from 'react';
import {
    ReviewBoardData,
    ReviewAsset,
    ReviewAssetRevision,
    ReviewAnnotation,
    ReviewRevisionStatus,
    ReviewBoardTransport,
    ReviewAuthor,
} from '../types';
import { AnnotationPayload } from '../schemas/annotations';
import { ReviewAnnotationKind } from '../types';



interface UseReviewBoardOptions {
    transport: ReviewBoardTransport;
    onReviewStateChanged?: () => Promise<void> | void;
}

export const useReviewBoard = (
    initialData: ReviewBoardData,
    socket: any,
    currentUser: { id: string; name?: string | null; avatarUrl?: string | null },
    options: UseReviewBoardOptions
) => {
    const [assets, setAssets] = useState<ReviewAsset[]>(initialData.assets);
    const [activeAssetId, setActiveAssetId] = useState<string | null>(
        initialData.assets.length > 0 ? initialData.assets[0].id : null
    );
    const [activeRevisionId, setActiveRevisionId] = useState<string | null>(
        initialData.assets.length > 0 ? initialData.assets[0].currentRevision?.id || initialData.assets[0].revisions[0]?.id || null : null
    );
    const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
    const [statusLoading, setStatusLoading] = useState({ request: false, approve: false });

    const authorDirectory = useRef<Record<string, ReviewAuthor>>(
        buildAuthorDirectory(initialData.assets, currentUser)
    );

    const activeAsset = assets.find(a => a.id === activeAssetId) || null;
    const activeRevision = activeAsset?.revisions.find(r => r.id === activeRevisionId) || activeAsset?.revisions[0] || null;

    useEffect(() => {
        setAssets(initialData.assets);
        if (initialData.assets.length > 0) {
            setActiveAssetId(initialData.assets[0].id);
            setActiveRevisionId(initialData.assets[0].currentRevision?.id || initialData.assets[0].revisions[0]?.id || null);
        } else {
            setActiveAssetId(null);
            setActiveRevisionId(null);
        }
        setSelectedAnnotationId(null);
        authorDirectory.current = buildAuthorDirectory(initialData.assets, currentUser);
    }, [initialData, currentUser]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        const onAssetCreated = (asset: ReviewAsset) => {
            setAssets(prev => [...prev, asset]);
        };

        const onRevisionCreated = (revision: ReviewAssetRevision & { assetId: string }) => {
            setAssets(prev => prev.map(a => {
                if (a.id === revision.assetId) {
                    // Add revision and set as current if needed
                    const newRevisions = [revision, ...a.revisions];
                    return { ...a, revisions: newRevisions, currentRevision: revision.isCurrent ? revision : a.currentRevision };
                }
                return a;
            }));
        };

        const onAnnotationCreated = (annotation: ReviewAnnotation & { assetRevisionId: string, assetId: string }) => {
            setAssets(prev => prev.map(a => {
                if (a.id === annotation.assetId) {
                    return {
                        ...a,
                        revisions: a.revisions.map(r => {
                            if (r.id === annotation.assetRevisionId) {
                                if (annotation.parentId) {
                                    return {
                                        ...r,
                                        annotations: r.annotations.map(ann => {
                                            if (ann.id === annotation.parentId) {
                                                return {
                                                    ...ann,
                                                    replies: [...(ann.replies || []), ensureAuthorMeta(annotation, authorDirectory.current, currentUser)]
                                                };
                                            }
                                            return ann;
                                        })
                                    };
                                }
                                return { ...r, annotations: [...r.annotations, ensureAuthorMeta(annotation, authorDirectory.current, currentUser)] };
                            }
                            return r;
                        })
                    };
                }
                return a;
            }));
        };

        const onAnnotationUpdated = (annotation: ReviewAnnotation & { assetRevisionId: string, assetId: string }) => {
            setAssets(prev => prev.map(a => {
                if (a.id === annotation.assetId) {
                    return {
                        ...a,
                        revisions: a.revisions.map(r => {
                            if (r.id === annotation.assetRevisionId) {
                                const enrichedAnnotation = ensureAuthorMeta(annotation, authorDirectory.current, currentUser);
                                if (annotation.parentId) {
                                    return {
                                        ...r,
                                        annotations: r.annotations.map(ann => {
                                            if (ann.id === annotation.parentId) {
                                                return {
                                                    ...ann,
                                                    replies: ann.replies?.map(rep => rep.id === annotation.id ? enrichedAnnotation : rep)
                                                };
                                            }
                                            return ann;
                                        })
                                    };
                                }

                                return {
                                    ...r,
                                    annotations: r.annotations.map(ann => ann.id === annotation.id ? enrichedAnnotation : ann)
                                };
                            }
                            return r;
                        })
                    };
                }
                return a;
            }));
        };

        const onRevisionUpdated = (update: { id: string, status: ReviewRevisionStatus }) => {
            setAssets(prev => prev.map(a => ({
                ...a,
                revisions: a.revisions.map(r => r.id === update.id ? { ...r, status: update.status } : r)
            })));
        };

        socket.on('review:asset:created', onAssetCreated);
        socket.on('review:revision:created', onRevisionCreated);
        socket.on('review:annotation:created', onAnnotationCreated);
        socket.on('review:annotation:updated', onAnnotationUpdated);
        socket.on('review:revision:updated', onRevisionUpdated);

        return () => {
            socket.off('review:asset:created', onAssetCreated);
            socket.off('review:revision:created', onRevisionCreated);
            socket.off('review:annotation:created', onAnnotationCreated);
            socket.off('review:annotation:updated', onAnnotationUpdated);
            socket.off('review:revision:updated', onRevisionUpdated);
        };
    }, [socket]);

    const selectAsset = (assetId: string) => {
        setActiveAssetId(assetId);
        setSelectedAnnotationId(null);
        const asset = assets.find(a => a.id === assetId);
        if (asset) {
            setActiveRevisionId(asset.currentRevision?.id || asset.revisions[0]?.id || null);
        }
    };

    const addAnnotation = async (payload: AnnotationPayload, text: string, kind: ReviewAnnotationKind) => {
        if (!activeRevision) return;
        try {
            await options.transport.createAnnotation(activeRevision.id, payload, text, kind);
        } catch (e) {
            console.error('[ReviewBoard] Failed to create annotation', e);
        }
    };

    const replyToAnnotation = async (annotationId: string, text: string) => {
        try {
            await options.transport.replyToAnnotation(annotationId, text);
        } catch (e) {
            console.error('[ReviewBoard] Failed to reply to annotation', e);
        }
    };

    const resolveAnnotation = async (annotationId: string) => {
        try {
            await options.transport.resolveAnnotation(annotationId);
        } catch (e) {
            console.error('[ReviewBoard] Failed to resolve annotation', e);
        }
    };

    const unresolveAnnotation = async (annotationId: string) => {
        try {
            await options.transport.unresolveAnnotation(annotationId);
        } catch (e) {
            console.error('[ReviewBoard] Failed to unresolve annotation', e);
        }
    };

    const requestChanges = async (feedback: string) => {
        if (!activeRevision || !feedback.trim()) return;
        setStatusLoading(prev => ({ ...prev, request: true }));
        try {
            await options.transport.requestChanges(activeRevision.id, feedback);
            await options.onReviewStateChanged?.();
        } catch (e) {
            console.error('[ReviewBoard] Failed to request changes', e);
        } finally {
            setStatusLoading(prev => ({ ...prev, request: false }));
        }
    };

    const markCompleted = async () => {
        if (!activeRevision) return;
        setStatusLoading(prev => ({ ...prev, approve: true }));
        try {
            await options.transport.markCompleted(activeRevision.id);
            await options.onReviewStateChanged?.();
        } catch (e) {
            console.error('[ReviewBoard] Failed to approve revision', e);
        } finally {
            setStatusLoading(prev => ({ ...prev, approve: false }));
        }
    };

    const selectRevision = (revisionId: string) => {
        setActiveRevisionId(revisionId);
        setSelectedAnnotationId(null);
    };

    return {
        state: {
            assets,
            activeAsset,
            activeRevision,
            selectedAnnotationId,
            isRequestingChanges: statusLoading.request,
            isMarkingApproved: statusLoading.approve,
        },
        actions: {
            selectAsset,
            selectRevision,
            selectAnnotation: setSelectedAnnotationId,
            addAnnotation,
            replyToAnnotation,
            resolveAnnotation,
            unresolveAnnotation,
            requestChanges,
            markCompleted,
        }
    };
};

function buildAuthorDirectory(assets: ReviewAsset[], currentUser: { id: string; name?: string | null; avatarUrl?: string | null }) {
    const directory: Record<string, ReviewAuthor> = {};
    if (currentUser) {
        directory[currentUser.id] = {
            id: currentUser.id,
            name: currentUser.name,
            avatarUrl: currentUser.avatarUrl,
        };
    }
    for (const asset of assets) {
        for (const revision of asset.revisions) {
            for (const annotation of revision.annotations) {
                if (annotation.author) {
                    directory[annotation.author.id] = annotation.author;
                }
                if (annotation.replies) {
                    for (const reply of annotation.replies) {
                        if (reply.author) {
                            directory[reply.author.id] = reply.author;
                        }
                    }
                }
            }
        }
    }
    return directory;
}

function ensureAuthorMeta(annotation: ReviewAnnotation, directory: Record<string, ReviewAuthor>, currentUser: { id: string; name?: string | null; avatarUrl?: string | null }) {
    let enriched: ReviewAnnotation = annotation;
    const authorId = annotation.author?.id || annotation.authorId;
    if (authorId && !annotation.author) {
        const known = directory[authorId];
        if (known) {
            enriched = { ...annotation, author: known };
        } else if (authorId === currentUser.id) {
            const me: ReviewAuthor = {
                id: currentUser.id,
                name: currentUser.name,
                avatarUrl: currentUser.avatarUrl,
            };
            directory[currentUser.id] = me;
            enriched = { ...annotation, author: me };
        } else {
            enriched = { ...annotation };
        }
    } else if (annotation.author) {
        directory[annotation.author.id] = annotation.author;
    }

    if (annotation.replies && annotation.replies.length) {
        const replies = annotation.replies.map(reply => ensureAuthorMeta(reply, directory, currentUser));
        if (replies !== annotation.replies) {
            enriched = { ...enriched, replies };
        }
    }

    return enriched;
}
