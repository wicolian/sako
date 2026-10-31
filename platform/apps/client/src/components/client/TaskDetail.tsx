import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from '../Icon';
import { useTask, useTaskComments } from '../../lib/hooks';
import { completeTask, addTaskComment, uploadAttachment, deleteAttachment, deleteTask } from '../../lib/api';
import { apiFetch } from '../../lib/http';
import { getSocket } from '../../lib/socket';
import { Task, AssetType, TaskStatus } from '../../lib/types';
import { setNewTaskPrefill } from '../../lib/new-task-prefill';
import { formatSlaStatus, getSlaColorClasses } from '../../lib/sla-utils';
import { features, COMPOSER_URL } from '../../lib/config';
import { analytics } from '../../lib/analytics';
import { ReviewBoard } from './review/ReviewBoard';
import { TaskDetailSkeleton } from '../skeletons/TaskDetailSkeleton';

/**
 * Compute live SLA remaining seconds based on current time
 */
function computeLiveSlaRemaining(task: Task, now: number): { remainingSeconds: number; isLate: boolean } | null {
  if (!task.inProgressAt || task.status === 'COMPLETED' || task.status === 'QUEUED') {
    return null; // Use server-provided values for non-active tasks
  }
  
  // If waiting on client (IN_REVIEW) or paused, SLA is frozen - use server value
  if (task.status === 'IN_REVIEW' || task.status === 'PAUSED') {
    return task.slaRemainingSeconds != null 
      ? { remainingSeconds: task.slaRemainingSeconds, isLate: task.slaIsLate ?? false }
      : null;
  }
  
  // For IN_PROGRESS, calculate live
  const inProgressAt = new Date(task.inProgressAt).getTime();
  const elapsedMs = now - inProgressAt;
  const totalClientWaitMs = (task.totalClientWaitSeconds ?? 0) * 1000;
  const effectiveElapsedMs = Math.max(0, elapsedMs - totalClientWaitMs);
  const effectiveElapsedSeconds = Math.floor(effectiveElapsedMs / 1000);
  
  const remainingSeconds = task.slaSeconds - effectiveElapsedSeconds;
  return { remainingSeconds, isLate: remainingSeconds < 0 };
}

// Type for review board assets (deliverables)
interface ReviewAsset {
  id: string;
  type: string;
  title: string;
  sourceUrl: string;
}

interface TaskDetailProps {
  taskId: string;
  onNavigate: (route: string) => void;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({ taskId, onNavigate }) => {
  const { data: task, loading, error, refetch } = useTask(taskId);
  const { data: comments, refetch: refetchComments } = useTaskComments(taskId);
  const [activeTab, setActiveTab] = useState<AssetType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [commentText, setCommentText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadsDisabled, setUploadsDisabled] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewAssets, setReviewAssets] = useState<ReviewAsset[]>([]);
  
  // Live ticking timer state - updates every second when task is in progress
  const [now, setNow] = useState(Date.now());
  
  // Tick timer every second for active tasks
  useEffect(() => {
    if (!task || task.status !== 'IN_PROGRESS') return;
    
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [task?.status, task?.id]);
  
  // Compute live SLA values
  const liveSla = useMemo(() => {
    if (!task) return null;
    return computeLiveSlaRemaining(task, now);
  }, [task, now]);

  // Fetch review board assets for download buttons when task is in review or completed
  useEffect(() => {
    if (!task || (task.status !== 'IN_REVIEW' && task.status !== 'COMPLETED')) {
      setReviewAssets([]);
      return;
    }

    const fetchReviewAssets = async () => {
      try {
        const data = await apiFetch<{ assets: ReviewAsset[] }>(`/tasks/${taskId}/review-board`);
        setReviewAssets(data.assets || []);
      } catch (err) {
        console.error('Failed to fetch review assets:', err);
        setReviewAssets([]);
      }
    };

    fetchReviewAssets();
  }, [task?.status, taskId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTaskUpdate = (updatedTask: Task) => {
      if (updatedTask.id === taskId) {
        refetch();
      }
    };

    socket.on('task:updated', handleTaskUpdate);

    return () => {
      socket.off('task:updated', handleTaskUpdate);
    };
  }, [taskId, refetch]);

  // Loading state
  if (loading) {
    return <TaskDetailSkeleton />;
  }

  // Error or not found
  if (error || !task) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <button onClick={() => onNavigate('/tasks')} className="inline-flex items-center gap-1 text-[12px] text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)] mb-4">
          <Icon name="chevron-right" className="h-3 w-3 rotate-180" />
          Back to tasks
        </button>
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
          <p className="text-[13px] text-red-600 dark:text-red-400 mb-2">
            {error ? 'Failed to load task' : 'Task not found'}
          </p>
          {error && <p className="text-[12px] text-[color:var(--muted-foreground)]">{error.message}</p>}
        </div>
      </div>
    );
  }

  const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
    'QUEUED': { color: 'bg-[color:var(--muted)] border-[color:var(--border)] text-[color:var(--foreground)]', label: 'Queued' },
    'IN_PROGRESS': { color: 'bg-[color:var(--primary)]/10 border-[color:var(--primary)]/60 text-[color:var(--primary)]', label: 'In Progress' },
    'IN_REVIEW': { color: 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300', label: 'In Review' },
    'COMPLETED': { color: 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300', label: 'Completed' },
    'PAUSED': { color: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300', label: 'Paused' },
  };

  const handleCompleteTask = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await completeTask(taskId);
      await refetch();
    } catch (err) {
      alert(`Failed to complete task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addTaskComment(taskId, { body: commentText, kind: 'COMMENT' });
      setCommentText('');
      await refetchComments();
    } catch (err) {
      alert(`Failed to post comment: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    
    // Track upload started
    analytics.fileUploadStarted(taskId, file.type || 'unknown');
    
    try {
      await uploadAttachment(taskId, file);
      analytics.fileUploadCompleted(taskId, file.type || 'unknown', true);
      await refetch();
    } catch (err: any) {
      analytics.fileUploadCompleted(taskId, file.type || 'unknown', false);
      // Check for specific error codes
      if (err.status === 503 || err.body?.code === 'UPLOADS_DISABLED') {
        setUploadsDisabled(true);
        setUploadError('File uploads are not enabled in this environment. You can share links in comments instead.');
      } else if (err.status === 404) {
        setUploadError('Task not found.');
      } else {
        // Generic error
        const message = err.message || err.body?.message || 'Failed to upload file. Please try again.';
        setUploadError(message);
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;
    try {
      await deleteAttachment(attachmentId);
      await refetch();
    } catch (err) {
      alert(`Failed to delete attachment: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteTask = async () => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) return;
    try {
      await deleteTask(taskId);
      onNavigate('/tasks');
    } catch (err) {
      alert(`Failed to delete task: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDuplicateTask = () => {
    if (!task) return;
    setNewTaskPrefill({
      title: task.title,
      description: task.description,
      category: task.category,
      brandId: task.brandId,
      useAI: task.useAI,
      sourceTaskId: task.id,
      sourceTaskTitle: task.title,
    });
    onNavigate(`/tasks/new?from=${task.id}`);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimestamp = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return formatDate(dateStr);
  };

  const getAttachmentType = (url: string): 'image' | 'design' | 'video' | 'other' => {
    const cleanUrl = url.split('?')[0];
    const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'image';
    if (['fig', 'sketch', 'xd'].includes(ext)) return 'design';
    if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
    return 'other';
  };

  const getAttachmentLabel = (type: ReturnType<typeof getAttachmentType>) => {
    if (type === 'image') return 'Image preview';
    if (type === 'design') return 'Design file';
    if (type === 'video') return 'Video file';
    return 'Document';
  };

  // Determine which asset types are available (legacy support)
  const availableAssetTypes = task.assets ? Array.from(new Set(task.assets.map(a => a.type))) : [];
  const defaultTab = availableAssetTypes.includes('video') ? 'video' :
    availableAssetTypes.includes('image') ? 'image' :
      availableAssetTypes.includes('figma') ? 'figma' : null;

  const currentTab = activeTab || defaultTab;

  const slaHours = task.displaySlaHours ?? (task.slaSeconds ? Math.round(task.slaSeconds / 3600) : null);

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
      {/* Back navigation */}
      <button onClick={() => onNavigate('/tasks')} className="inline-flex items-center gap-1 text-[12px] text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)] mb-4">
        <Icon name="chevron-right" className="h-3 w-3 rotate-180" />
        Back to tasks
      </button>

      {/* Status banner */}
      {task.aiEligible === false && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-4 py-3 text-[13px] text-red-900 dark:text-red-200 flex items-center justify-between">
          <div>
            <strong>Scope Rejected.</strong> {task.aiIneligibleReason || 'This task has been rejected by the studio.'}
          </div>
          {task.status === 'QUEUED' && (
            <button onClick={handleDeleteTask} className="text-red-700 hover:text-red-900 underline">
              Delete Task
            </button>
          )}
        </div>
      )}
      {task.status === 'QUEUED' && task.aiEligible !== false && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 px-4 py-3 text-[13px] text-blue-900 dark:text-blue-200">
          <strong>This task has not started.</strong> You can still edit the brief or add context.
        </div>
      )}
      {task.status === 'IN_PROGRESS' && (
        <div className="mb-4 rounded-xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 px-4 py-3 text-[13px] text-[color:var(--primary)]">
          <div className="flex items-center gap-3">
            {/* Pod Avatar */}
            {task.assignedTo ? (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-[color:var(--primary)] flex items-center justify-center text-[12px] font-semibold text-[color:var(--primary-foreground)] ring-2 ring-[color:var(--primary)]/30">
                  {(task.assignedTo.name || task.assignedTo.email)[0].toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="h-8 w-8 rounded-full bg-[color:var(--muted)] flex items-center justify-center">
                <Icon name="users" className="h-4 w-4 text-[color:var(--muted-foreground)]" />
              </div>
            )}
            <div className="flex-1">
              <strong>Your pod is working on this.</strong>
              {task.assignedTo && (
                <span className="ml-1 text-[12px] opacity-80">
                  Assigned to {task.assignedTo.name || task.assignedTo.email.split('@')[0]}
                </span>
              )}
              <p className="text-[11px] opacity-70 mt-0.5">Review surface will open once it's in review.</p>
            </div>
          </div>
        </div>
      )}
      {task.status === 'COMPLETED' && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 px-4 py-3 text-[13px] text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
          <span><strong>This task is completed.</strong> You can duplicate it as a new task if you need another round.</span>
          <button onClick={handleDuplicateTask} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-700 text-white text-[12px] hover:bg-emerald-800 transition">
            Duplicate task
          </button>
        </div>
      )}
      {task.status === 'PAUSED' && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-4 py-3 text-[13px] text-red-900 dark:text-red-200">
          <strong>This task is paused</strong> because your workspace is paused or out of day credits.
        </div>
      )}

      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">{task.title}</h1>
            {task.brand && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[color:var(--card)] border border-[color:var(--border)] text-[11px] text-[color:var(--foreground)]">
                {task.brand.name}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[color:var(--card)] border border-[color:var(--border)] text-[11px] text-[color:var(--foreground)]">
              {task.category === 'DESIGN' ? 'Design' : 'Motion'}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] ${statusConfig[task.status].color}`}>
              {statusConfig[task.status].label}
            </span>
            {task.revisionNumber > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300">
                Rev {task.revisionNumber}
              </span>
            )}
          </div>
          <div className="text-[11px] text-[color:var(--muted-foreground)]">
            Status: {statusConfig[task.status].label}
            {task.revisionNumber > 0 && <> · Rev #{task.revisionNumber}</>}
            {slaHours != null && <> · SLA {slaHours}h</>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 text-[12px]">
          <span className="text-[color:var(--muted-foreground)]">Created <strong className="text-[color:var(--foreground)]">{formatDate(task.createdAt)}</strong></span>
          {task.status === 'IN_PROGRESS' && task.inProgressAt && slaHours != null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300">
              {slaHours}h SLA
            </span>
          )}
        </div>
      </header>

      {/* Layout: 2-column when in review/completed (brief left, review board takes rest), 3-column otherwise */}
      <div className={`grid gap-5 ${(task.status === 'IN_REVIEW' || task.status === 'COMPLETED') ? 'lg:grid-cols-[320px_1fr]' : 'lg:grid-cols-[320px_1fr_380px]'}`}>
        {/* LEFT PANEL - Brief & Meta */}
        <div className="space-y-4">
          {/* Brief */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Brief</p>
            <p className="text-[13px] text-[color:var(--foreground)] leading-relaxed whitespace-pre-wrap">{task.description}</p>

            {/* Optional goals list if present on task */}
            {task.goals && task.goals.length > 0 && (
              <div className="pt-3 border-t border-dashed border-[color:var(--border)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-2">Key goals</p>
                <ul className="space-y-1.5 text-[12px] text-[color:var(--foreground)]">
                  {task.goals.map((goal) => (
                    <li key={goal} className="flex gap-2">
                      <span className="text-[color:var(--primary)]">•</span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reference links if present */}
            {task.referenceLinksJson && Array.isArray(task.referenceLinksJson) && task.referenceLinksJson.length > 0 && (
              <div className="pt-3 border-t border-dashed border-[color:var(--border)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-2">Reference links</p>
                <ul className="space-y-1.5 text-[12px]">
                  {task.referenceLinksJson.map((link: { url: string; type?: string }, idx: number) => (
                    <li key={idx}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[color:var(--primary)] hover:underline truncate"
                      >
                        <Icon name="external-link" className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{link.url}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 space-y-3 text-[12px]">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Meta</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-[color:var(--muted-foreground)]">Created on</span>
                <span className="text-[color:var(--foreground)]">{formatDate(task.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[color:var(--muted-foreground)]">Last updated</span>
                <span className="text-[color:var(--foreground)]">{formatTimestamp(task.updatedAt)}</span>
              </div>
              {task.revisionNumber > 0 && (
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted-foreground)]">Revision</span>
                  <span className="text-amber-900 dark:text-amber-300">Rev {task.revisionNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[color:var(--muted-foreground)]">Standard SLA</span>
                <span className="text-[color:var(--foreground)]">{Math.round(task.slaSeconds / 3600)}h</span>
              </div>
              {task.displaySlaHours != null && (
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted-foreground)]">Estimated SLA</span>
                  <span className="text-[color:var(--foreground)]">{task.displaySlaHours}h</span>
                </div>
              )}
            </div>
          </div>

          {/* SLA Status Block - Show for in-progress and completed tasks */}
          {(task.status === 'IN_PROGRESS' || task.status === 'COMPLETED' || task.slaIsLate) && task.inProgressAt && (() => {
            // Use live values for IN_PROGRESS, server values otherwise
            const remainingSeconds = liveSla?.remainingSeconds ?? task.slaRemainingSeconds ?? 0;
            const isLate = liveSla?.isLate ?? task.slaIsLate ?? false;
            const elapsedSeconds = task.status === 'IN_PROGRESS' && liveSla
              ? task.slaSeconds - remainingSeconds
              : (task.slaElapsedSeconds ?? 0);
            
            // Format time with hours and minutes for precision
            const formatTimeDetailed = (seconds: number) => {
              const absSeconds = Math.abs(seconds);
              const hours = Math.floor(absSeconds / 3600);
              const minutes = Math.floor((absSeconds % 3600) / 60);
              const secs = Math.floor(absSeconds % 60);
              if (hours > 0) {
                return `${hours}h ${minutes}m`;
              }
              return `${minutes}m ${secs}s`;
            };
            
            return (
              <div className={`bg-[color:var(--card)] rounded-2xl border shadow-sm p-4 space-y-3 ${getSlaColorClasses(task).border}`}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">SLA Status</p>
                  {task.status === 'IN_PROGRESS' && !isLate && (
                    <span className="sla-timer-pulse inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[color:var(--muted-foreground)]">Status</span>
                    <span className={`font-medium ${getSlaColorClasses(task).text}`}>
                      {formatSlaStatus(task)}
                    </span>
                  </div>
                  {elapsedSeconds > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[color:var(--muted-foreground)]">Time elapsed</span>
                      <span className="text-[color:var(--foreground)] font-mono text-[11px]">
                        {formatTimeDetailed(elapsedSeconds)}
                      </span>
                    </div>
                  )}
                  {!isLate && task.status !== 'COMPLETED' && (
                    <div className="flex justify-between">
                      <span className="text-[color:var(--muted-foreground)]">Time remaining</span>
                      <span className={`font-mono text-[11px] ${task.status === 'IN_PROGRESS' ? 'sla-timer-active' : ''} ${
                        remainingSeconds < 6 * 3600 ? 'text-amber-600 dark:text-amber-400' : 'text-[color:var(--foreground)]'
                      }`}>
                        {formatTimeDetailed(remainingSeconds)}
                      </span>
                    </div>
                  )}
                  {isLate && (
                    <div className="flex justify-between">
                      <span className="text-[color:var(--muted-foreground)]">Overdue by</span>
                      <span className="font-mono text-[11px] text-red-600 dark:text-red-400">
                        {formatTimeDetailed(Math.abs(remainingSeconds))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* AI Estimator Info - Show if any estimator data exists */}
          {(task.estimatedEffortHours || task.displaySlaHours || task.flagForAdminReview || task.useAI || task.aiIneligibleReason || task.aiEligible === false || typeof task.fits48hWindow === 'boolean' || (task.estimateSnapshots && task.estimateSnapshots.length > 0)) && (() => {
            const snapshot = task.estimateSnapshots?.[0];
            const complexity = snapshot?.complexity;
            const suggestedSubtasks = snapshot?.suggestedSubtasksJson || [];
            const missingInfoQuestions = snapshot?.missingInfoJson || [];
            
            return (
            <div className="bg-[color:var(--accent)] rounded-2xl border border-[color:var(--border)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium text-[color:var(--foreground)]">AI Estimator</p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">Ran at task creation</p>
                </div>
                {complexity && (
                  <span className={`inline-flex items-center h-7 px-3 rounded-full text-[11px] ${
                    complexity === 'simple'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : complexity === 'complex'
                        ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
                  }`}>
                    {complexity === 'simple' && '✓ Simple'}
                    {complexity === 'complex' && '⚠ Complex'}
                    {complexity === 'unsupported' && '✗ Unsupported'}
                  </span>
                )}
                {!complexity && !task.aiEligible && (
                  <span className="inline-flex items-center h-7 px-3 rounded-full text-[11px] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
                    AI Ineligible
                  </span>
                )}
              </div>
              
              <div className="space-y-2 text-[12px]">
                {task.estimatedEffortHours != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted-foreground)]">Estimated effort:</span>
                    <span className="font-medium text-[color:var(--foreground)]">~{task.estimatedEffortHours} hours</span>
                  </div>
                )}
                {task.displaySlaHours != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted-foreground)]">Delivery expectation:</span>
                    <span className="font-medium text-[color:var(--foreground)]">24–{task.displaySlaHours}h</span>
                  </div>
                )}
                {typeof task.fits48hWindow === 'boolean' && !task.fits48hWindow && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
                    <strong>⚠ May not fit standard window.</strong> {snapshot?.recommendedSplitCount && snapshot.recommendedSplitCount > 1 && `Consider splitting into ${snapshot.recommendedSplitCount} subtasks.`}
                  </div>
                )}
                {task.flagForAdminReview && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 px-3 py-2 text-[11px] text-blue-900 dark:text-blue-200">
                    <strong>📋 Flagged for review:</strong> {snapshot?.flagReason || 'Needs admin attention'}
                  </div>
                )}
              </div>

              {suggestedSubtasks.length > 0 && (
                <div className="space-y-1.5 text-[12px]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Suggested subtasks</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[color:var(--muted-foreground)]">
                    {suggestedSubtasks.map((subtask, idx) => (
                      <li key={idx}>{subtask}</li>
                    ))}
                  </ul>
                </div>
              )}

              {missingInfoQuestions.length > 0 && (
                <div className="space-y-1.5 text-[12px]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Questions to improve brief</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[color:var(--muted-foreground)]">
                    {missingInfoQuestions.map((question, idx) => (
                      <li key={idx}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}

              {snapshot?.aiHelpRecommended && (
                <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-[11px] text-[color:var(--muted-foreground)]">
                  <p className="flex items-center gap-1.5">
                    <Icon name="sparkles" className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                    <span className="font-medium text-[color:var(--foreground)]">AI can help:</span> {snapshot.aiHelpReason}
                  </p>
                </div>
              )}

              {task.aiIneligibleReason && (
                <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-3 py-2 text-[11px] text-red-900 dark:text-red-200">
                  <span className="font-semibold">Ineligibility reason: </span>
                  {task.aiIneligibleReason}
                </div>
              )}

              {task.useAI && (
                <div className="flex items-center justify-end pt-1 border-t border-dashed border-[color:var(--border)]">
                  <p className="text-[11px] text-[color:var(--muted-foreground)] flex items-center gap-1">
                    <Icon name="sparkles" className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                    AI assistance enabled
                  </p>
                </div>
              )}
            </div>
            );
          })()}

          {/* Open in Composer */}
          {task.brandId && task.status !== 'COMPLETED' && (
            <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Icon name="sparkles" className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[color:var(--foreground)]">AI Composer</p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">Generate designs with AI</p>
                </div>
              </div>
              <p className="text-[12px] text-[color:var(--muted-foreground)] mb-3">
                Create AI-powered designs in Composer and send them back to this task when ready.
              </p>
              <button
                onClick={() => window.open(COMPOSER_URL, '_blank')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-[13px] font-medium hover:opacity-90 transition"
              >
                <Icon name="sparkles" className="h-4 w-4" />
                Open Composer
              </button>
            </div>
          )}

          {/* Attachments */}
          {features.uploads && task.status !== 'IN_REVIEW' && (
            <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Attachments</p>
                {!uploadsDisabled && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="inline-flex items-center gap-1 text-[11px] text-[color:var(--primary)] hover:underline disabled:opacity-50"
                    >
                      <Icon name="upload" className="h-3 w-3" />
                      Add
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </>
                )}
              </div>
              {uploadsDisabled && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
                  File uploads aren't enabled in this environment. You can share links in comments instead.
                </div>
              )}
              {uploadError && !uploadsDisabled && (
                <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-3 py-2 text-[11px] text-red-900 dark:text-red-200">
                  {uploadError}
                </div>
              )}
              {isUploading && <p className="text-[11px] text-[color:var(--muted-foreground)]">Uploading...</p>}
              <div className="space-y-2">
                {!task.attachments || task.attachments.length === 0 ? (
                  <p className="text-[12px] text-[color:var(--muted-foreground)] italic">No attachments</p>
                ) : (
                  task.attachments.map(attachment => (
                    <div key={attachment.id} className="flex items-center justify-between group">
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[12px] text-[color:var(--foreground)] hover:underline truncate"
                      >
                        <Icon name="paperclip" className="h-3 w-3 text-[color:var(--muted-foreground)]" />
                        <span className="truncate max-w-[180px]">{attachment.url.split('/').pop()}</span>
                      </a>
                      <button
                        onClick={() => handleDeleteAttachment(attachment.id)}
                        className="opacity-0 group-hover:opacity-100 text-[color:var(--muted-foreground)] hover:text-red-500 transition text-[10px]"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE PANEL - Review Surface (takes full width when IN_REVIEW or COMPLETED) */}
        <div className="space-y-4">
          {(task.status === 'IN_REVIEW' || task.status === 'COMPLETED') ? (
            <>
            <ReviewBoard 
              taskId={taskId}
                readOnly={task.status === 'COMPLETED'}
              onReviewStateChanged={async () => {
                await refetch();
                await refetchComments();
              }}
            />
              {/* Deliverables Download Section */}
              {reviewAssets.length > 0 && (
                <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-3">
                    Deliverables ({reviewAssets.length})
                  </p>
                  <div className="grid gap-2">
                    {reviewAssets.map((asset, index) => (
                      <div key={asset.id} className="flex items-center justify-between p-2 rounded-lg bg-[color:var(--accent)] group">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Icon name="file" className="h-4 w-4 text-[color:var(--muted-foreground)] flex-shrink-0" />
                          <span className="text-[12px] text-[color:var(--foreground)] truncate">
                            {asset.title || `Deliverable ${index + 1}`}
                          </span>
                          <span className="text-[11px] text-[color:var(--muted-foreground)]">
                            {asset.type?.toUpperCase() || ''}
                          </span>
                        </div>
                        <a
                          href={asset.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => analytics.fileDownloadClicked(taskId, asset.type || 'unknown', asset.title || 'unknown')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[11px] hover:opacity-90 transition"
                          title="Open in new tab"
                        >
                          <Icon name="external-link" className="h-3.5 w-3.5" />
                          Open
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
              <Icon name="layout" className="h-10 w-10 text-[color:var(--muted)] mx-auto mb-3" />
              <p className="text-[13px] text-[color:var(--muted-foreground)] mb-1">No review surface yet</p>
              <p className="text-[12px] text-[color:var(--muted-foreground)]">Deliverables will appear here once the task is in review.</p>
            </div>
          )}
        </div>

        {/* RIGHT PANEL - Comments (only shown when NOT in review/completed, since review board has its own sidebar) */}
        {task.status !== 'IN_REVIEW' && task.status !== 'COMPLETED' && (
          <div className="space-y-4">
            {/* Comments thread */}
            <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Comments</p>
                <span className="text-[11px] text-[color:var(--muted-foreground)]">{comments?.length || 0} comments</span>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {!comments || comments.length === 0 ? (
                  <p className="text-[12px] text-[color:var(--muted-foreground)] text-center py-4">No comments yet</p>
                ) : (
                  comments.map(comment => (
                    <div key={comment.id} className="flex gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-[color:var(--muted)] overflow-hidden flex-shrink-0 flex items-center justify-center text-[11px] font-medium text-[color:var(--muted-foreground)]">
                        {(comment.authorName || comment.author?.name || comment.author?.email || 'U')[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] font-medium text-[color:var(--foreground)]">
                            {comment.authorName || comment.author?.name || comment.author?.email || 'User'}
                            {comment.authorRole && (
                              <span className="ml-1 text-[10px] uppercase tracking-wide text-[color:var(--muted-foreground)]">
                                ({comment.authorRole})
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-[color:var(--muted-foreground)]">{formatTimestamp(comment.createdAt)}</span>
                          {comment.kind === 'REVISION_REQUEST' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10px] text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300">
                              Revision Request
                            </span>
                          )}
                          {comment.kind === 'ADMIN_DECISION' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 border border-blue-300 text-[10px] text-blue-900 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300">
                              Admin Decision
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-[color:var(--foreground)] whitespace-pre-wrap">{comment.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {task.status !== 'PAUSED' && task.status !== 'COMPLETED' && (
                <div className="pt-3 border-t border-dashed border-[color:var(--border)]">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment or drop a link"
                    className="w-full px-3 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--primary)] resize-none placeholder:text-[color:var(--muted-foreground)]"
                    rows={3}
                  ></textarea>
                  <div className="flex items-center justify-end mt-2">
                    <button
                      onClick={handlePostComment}
                      disabled={!commentText.trim() || isSubmitting}
                      className="inline-flex items-center px-3 py-1.5 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[12px] hover:opacity-90 transition disabled:opacity-50"
                    >
                      Post comment
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
