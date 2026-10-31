import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ReviewBoard as SharedReviewBoard, ReviewBoardData, ReviewBoardTransport } from '@sako/review-ui';
import { analytics } from '../../lib/analytics';
import { apiFetch } from '../../lib/http';

interface StudioReviewBoardProps {
  taskId: string;
  workspaceId: string;
  onRefresh?: () => void;
}

export const StudioReviewBoard: React.FC<StudioReviewBoardProps> = ({
  taskId,
  workspaceId,
  onRefresh,
}) => {
  const [data, setData] = useState<ReviewBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [targetAssetId, setTargetAssetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReviewBoard = async () => {
    try {
      setLoading(true);
      const result = await apiFetch<ReviewBoardData>(`/tasks/${taskId}/review-board`, {
        workspaceIdOverride: workspaceId,
      });
      setData(result);
      analytics.adminTaskOpened(taskId, workspaceId);
    } catch (err: any) {
      setError(err.message || 'Failed to load review board');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewBoard();
  }, [taskId, workspaceId]);

  const handleUploadRevision = async () => {
    if (!targetAssetId) return;
    
    // Validate based on mode
    if (uploadMode === 'url' && !uploadUrl.trim()) return;
    if (uploadMode === 'file' && !uploadFile) return;

    setSubmitting(true);
    try {
      if (uploadMode === 'file' && uploadFile) {
        // Upload file directly via FormData
        const formData = new FormData();
        formData.append('file', uploadFile);
        
        await apiFetch(`/assets/${targetAssetId}/revisions/upload`, {
          method: 'POST',
          body: formData as any,
          workspaceIdOverride: workspaceId,
        });
      } else {
        // Use URL mode
        await apiFetch(`/assets/${targetAssetId}/revisions`, {
          method: 'POST',
          body: JSON.stringify({ fileUrl: uploadUrl.trim() }),
          workspaceIdOverride: workspaceId,
        });
      }
      
      await fetchReviewBoard();
      setUploadUrl('');
      setUploadFile(null);
      setShowUploadModal(false);
      analytics.adminRevisionUploaded(taskId, targetAssetId);
      onRefresh?.();
    } catch (err: any) {
      alert(err.message || 'Failed to upload revision');
    } finally {
      setSubmitting(false);
    }
  };

  const transport = useMemo<ReviewBoardTransport>(() => ({
    createAnnotation: (revisionId, payload, text, kind) =>
      apiFetch(`/revisions/${revisionId}/annotations`, {
        method: 'POST',
        body: JSON.stringify({ payload, text, kind }),
        workspaceIdOverride: workspaceId,
      }),
    replyToAnnotation: (annotationId, text) =>
      apiFetch(`/annotations/${annotationId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ text }),
        workspaceIdOverride: workspaceId,
      }),
    resolveAnnotation: (annotationId) =>
      apiFetch(`/annotations/${annotationId}/resolve`, {
        method: 'PATCH',
        workspaceIdOverride: workspaceId,
      }),
    unresolveAnnotation: (annotationId) =>
      apiFetch(`/annotations/${annotationId}/unresolve`, {
        method: 'PATCH',
        workspaceIdOverride: workspaceId,
      }),
    requestChanges: (revisionId, feedback) =>
      apiFetch(`/revisions/${revisionId}/request-changes`, {
        method: 'POST',
        body: JSON.stringify({ feedback }),
        workspaceIdOverride: workspaceId,
      }),
    markCompleted: (revisionId) =>
      apiFetch(`/revisions/${revisionId}/mark-completed`, {
        method: 'POST',
        workspaceIdOverride: workspaceId,
      }),
  }), [workspaceId]);

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
    <div className="w-full h-[720px] lg:h-[800px] relative">
      <SharedReviewBoard
        taskId={taskId}
        initialData={data}
        transport={transport}
        currentUser={{
          id: 'admin',
          name: 'Admin',
        }}
        isAdmin={true}
        onUploadRevision={(assetId) => {
          setTargetAssetId(assetId);
          setShowUploadModal(true);
        }}
        onReviewStateChanged={async () => {
          await fetchReviewBoard();
          onRefresh?.();
        }}
      />

      {/* Upload Modal Overlay */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[color:var(--card)] border border-[color:var(--border)] p-6 rounded-2xl w-[420px] shadow-xl">
            <h3 className="text-[16px] font-semibold text-[color:var(--foreground)] mb-4">Upload new revision</h3>
            
            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setUploadMode('file')}
                className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-medium transition ${
                  uploadMode === 'file'
                    ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                    : 'bg-[color:var(--muted)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]'
                }`}
              >
                Upload File
              </button>
              <button
                onClick={() => setUploadMode('url')}
                className={`flex-1 px-3 py-2 rounded-lg text-[12px] font-medium transition ${
                  uploadMode === 'url'
                    ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                    : 'bg-[color:var(--muted)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]'
                }`}
              >
                Paste URL
              </button>
            </div>
            
            {uploadMode === 'file' ? (
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.pdf,.mov,.mp4,.webm,.json,.riv"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-6 rounded-xl bg-[color:var(--background)] border-2 border-dashed border-[color:var(--border)] text-center cursor-pointer hover:border-[color:var(--primary)]/50 transition"
                >
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 text-[color:var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[13px] text-[color:var(--foreground)]">{uploadFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-8 h-8 mx-auto text-[color:var(--muted-foreground)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <p className="text-[13px] text-[color:var(--muted-foreground)]">Click to select file</p>
                      <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">PNG, JPG, PDF, MP4, WebM, Lottie, Rive</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <input
                type="url"
                value={uploadUrl}
                onChange={(e) => setUploadUrl(e.target.value)}
                placeholder="Enter file URL (e.g. https://...)"
                className="w-full px-3 py-2.5 rounded-xl bg-[color:var(--background)] border border-[color:var(--border)] text-[13px] text-[color:var(--foreground)] mb-4 focus:outline-none focus:ring-2 focus:ring-[color:var(--ring)]/30"
              />
            )}
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadUrl('');
                }}
                className="px-3 py-1.5 rounded-full text-[12px] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadRevision}
                disabled={(uploadMode === 'file' ? !uploadFile : !uploadUrl.trim()) || submitting}
                className="px-4 py-1.5 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[12px] hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Uploading...' : 'Upload Revision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
