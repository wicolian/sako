import React, { useState, useEffect, useMemo } from 'react';
import { ReviewBoard as SharedReviewBoard, ReviewBoardData, ReviewBoardTransport } from '@sako/review-ui';
import { apiFetch } from '../../../lib/http';
import { getSocket } from '../../../lib/socket';
import { useUser } from '@clerk/clerk-react';

interface ReviewBoardProps {
  taskId: string;
  readOnly?: boolean;
  onReviewStateChanged?: () => Promise<void>;
}

export const ReviewBoard: React.FC<ReviewBoardProps> = ({
  taskId,
  readOnly = false,
  onReviewStateChanged,
}) => {
  const [data, setData] = useState<ReviewBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();
  const socket = getSocket();

  const transport = useMemo<ReviewBoardTransport>(() => ({
    createAnnotation: (revisionId, payload, text, kind) =>
      apiFetch(`/revisions/${revisionId}/annotations`, {
        method: 'POST',
        body: JSON.stringify({ payload, text, kind }),
      }),
    replyToAnnotation: (annotationId, text) =>
      apiFetch(`/annotations/${annotationId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      }),
    resolveAnnotation: (annotationId) =>
      apiFetch(`/annotations/${annotationId}/resolve`, {
        method: 'PATCH',
      }),
    unresolveAnnotation: (annotationId) =>
      apiFetch(`/annotations/${annotationId}/unresolve`, {
        method: 'PATCH',
      }),
    requestChanges: (revisionId, feedback) =>
      apiFetch(`/revisions/${revisionId}/request-changes`, {
        method: 'POST',
        body: JSON.stringify({ feedback }),
      }),
    markCompleted: (revisionId) =>
      apiFetch(`/revisions/${revisionId}/mark-completed`, {
        method: 'POST',
      }),
  }), [taskId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await apiFetch<ReviewBoardData>(`/tasks/${taskId}/review-board`);
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load review board');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [taskId]);

  if (loading) {
    return (
      <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
        <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading review board…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-4 text-[13px] text-red-700 dark:text-red-200">
        {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="w-full h-[720px] lg:h-[800px]">
      <SharedReviewBoard
        taskId={taskId}
        initialData={data}
        transport={transport}
        currentUser={{
          id: user?.id || 'unknown',
          name: user?.fullName || user?.primaryEmailAddress?.emailAddress || 'User',
          avatarUrl: user?.imageUrl,
        }}
        socket={socket}
        readOnly={readOnly}
        onReviewStateChanged={onReviewStateChanged}
      />
    </div>
  );
};
