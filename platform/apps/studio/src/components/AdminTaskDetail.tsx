import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { useTask, useTaskComments } from '../lib/hooks';
import { TaskComment } from '../lib/types';
import { formatSlaStatus, getSlaColorClasses, getSlaStatusChip } from '../lib/sla-utils';
import { StudioReviewBoard } from './review/StudioReviewBoard';
import { ComposerSection } from './ComposerSection';
import { ComposerPreview } from './ComposerPreview';
import { ReviewAssetType } from '@prisma/client';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useRive } from '@rive-app/react-canvas';

interface AdminTaskDetailProps {
  taskId: string;
  onNavigate: (route: string) => void;
}

export const AdminTaskDetail: React.FC<AdminTaskDetailProps> = ({ taskId, onNavigate }) => {
  const { data: task, loading, error, refetch } = useTask(taskId);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [deliverableFile, setDeliverableFile] = useState<File | null>(null);
  const [deliverableType, setDeliverableType] = useState<ReviewAssetType>('IMAGE');
  const [isUploadingDeliverable, setIsUploadingDeliverable] = useState(false);
  const [brandDetailsOpen, setBrandDetailsOpen] = useState(false);
  
  // Link deliverable state
  const [deliverableLink, setDeliverableLink] = useState('');
  const [deliverableLinkType, setDeliverableLinkType] = useState<ReviewAssetType>('EMBED');
  const [isAddingLink, setIsAddingLink] = useState(false);

  // Fetch comments - use admin endpoint to bypass subscription check
  useEffect(() => {
    let cancelled = false;
    const loadComments = async () => {
      setIsLoadingComments(true);
      try {
        const { apiFetch } = await import('../lib/http');
        // Use admin endpoint to bypass subscription guard
        const data = await apiFetch(`/studio/tasks/${taskId}/comments`, {
          method: 'GET',
          skipWorkspace: true,
        });
        if (!cancelled) setComments(data);
      } catch (err) {
        console.error('Failed to fetch comments', err);
      } finally {
        if (!cancelled) setIsLoadingComments(false);
      }
    };
    loadComments();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading task...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-[13px] text-red-500">Task not found</p>
      </div>
    );
  }

  const brand = task.brand;
  const workspace = task.workspace;
  const workspaceIdForTask = task.workspaceId || workspace?.id;
  const slaHours = task.displaySlaHours ?? Math.round(task.slaSeconds / 3600);
  const showComposerContext = task.source === 'COMPOSER_STANDALONE' || !!task.composerDraftId;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isPostingComment) return;
    setIsPostingComment(true);
    try {
      const { apiFetch } = await import('../lib/http');
      // Use admin endpoint to bypass subscription guard
      const created = await apiFetch(`/studio/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: newComment.trim() }),
        skipWorkspace: true,
      });
      setNewComment('');
      setComments((prev) => [...prev, created]);
    } catch (err) {
      alert('Failed to add comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleMarkAiIneligible = async () => {
    const reason = window.prompt('Reason for marking this task as AI ineligible (optional)') || undefined;
    try {
      const { apiFetch } = await import('../lib/http');
      await apiFetch(`/admin/tasks/${taskId}/mark-ai-ineligible`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
        skipWorkspace: true,
      });
      await refetch();
    } catch (err) {
      alert('Failed to mark AI ineligible');
    }
  };

  const handleApproveScope = async () => {
    const message = window.prompt('Optional message for client (e.g., "Looks great, starting work!")') || undefined;
    try {
      const { apiFetch } = await import('../lib/http');
      await apiFetch(`/admin/tasks/${taskId}/approve-scope`, {
        method: 'POST',
        body: JSON.stringify({ message }),
        skipWorkspace: true,
      });
      await refetch();
      alert('Task scope approved successfully');
    } catch (err) {
      alert('Failed to approve scope: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleRejectScope = async () => {
    const reason = window.prompt('Reason for rejecting this task (required):');
    if (!reason || !reason.trim()) {
      alert('Reason is required to reject scope');
      return;
    }
    try {
      const { apiFetch } = await import('../lib/http');
      await apiFetch(`/admin/tasks/${taskId}/reject-scope`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
        skipWorkspace: true,
      });
      await refetch();
      alert('Task scope rejected');
    } catch (err) {
      alert('Failed to reject scope: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDuplicateTask = async () => {
    if (!window.confirm('Duplicate this task into the queue?')) return;
    try {
      const { apiFetch } = await import('../lib/http');
      const newTask = await apiFetch(`/admin/tasks/${taskId}/duplicate`, {
        method: 'POST',
        skipWorkspace: true,
      });
      alert('Task duplicated successfully!');
      onNavigate(`/studio/tasks/${newTask.id}`);
    } catch (err) {
      alert('Failed to duplicate task');
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) return;
    try {
      const { apiFetch } = await import('../lib/http');
      await apiFetch(`/admin/tasks/${taskId}`, {
        method: 'DELETE',
        skipWorkspace: true,
      });
      onNavigate('/studio/tasks');
    } catch (err) {
      alert('Failed to delete task: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
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
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleStartTask = async () => {
    try {
      const { apiFetch } = await import('../lib/http');
      await apiFetch(`/admin/tasks/${taskId}/start`, {
        method: 'POST',
        skipWorkspace: true,
      });
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start task');
    }
  };

  const handleSendToReview = async () => {
    try {
      const { apiFetch } = await import('../lib/http');
      await apiFetch(`/admin/tasks/${taskId}/review`, {
        method: 'POST',
        skipWorkspace: true,
      });
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send to review');
    }
  };

  const handleCompleteTask = async () => {
    try {
      const { apiFetch } = await import('../lib/http');
      await apiFetch(`/admin/tasks/${taskId}/complete`, {
        method: 'POST',
        skipWorkspace: true,
      });
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete task');
    }
  };

  const handleCreateDeliverable = async () => {
    if (!deliverableFile) return;
    setIsUploadingDeliverable(true);
    try {
      const { apiFetch } = await import('../lib/http');
      const formData = new FormData();
      formData.append('file', deliverableFile);
      formData.append('type', deliverableType);

      await apiFetch(`/admin/tasks/${taskId}/deliverables`, {
        method: 'POST',
        body: formData as any,
        skipWorkspace: true,
      });
      setDeliverableFile(null);
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload deliverable');
    } finally {
      setIsUploadingDeliverable(false);
    }
  };

  const handleAddLinkDeliverable = async () => {
    if (!deliverableLink.trim()) return;
    setIsAddingLink(true);
    try {
      const { apiFetch } = await import('../lib/http');
      
      // Auto-detect type from URL
      let detectedType = deliverableLinkType;
      if (deliverableLink.includes('figma.com')) {
        detectedType = 'FIGMA';
      } else if (deliverableLink.includes('lottie.host') || deliverableLink.includes('lottiefiles.com') || deliverableLink.endsWith('.json') || deliverableLink.endsWith('.lottie')) {
        detectedType = 'LOTTIE';
      } else if (deliverableLink.includes('rive.app') || deliverableLink.includes('cdn.rive.app') || deliverableLink.endsWith('.riv')) {
        detectedType = 'RIVE';
      } else if (deliverableLink.match(/\.(mp4|mov|webm)(\?|$)/i) || deliverableLink.includes('youtube.com') || deliverableLink.includes('vimeo.com')) {
        detectedType = 'VIDEO';
      } else if (deliverableLink.includes('drive.google.com')) {
        detectedType = 'EMBED';
      }

      await apiFetch(`/admin/tasks/${taskId}/deliverables/link`, {
        method: 'POST',
        body: JSON.stringify({
          url: deliverableLink.trim(),
          type: detectedType,
        }),
        skipWorkspace: true,
      });
      setDeliverableLink('');
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add link deliverable');
    } finally {
      setIsAddingLink(false);
    }
  };

  // Helper to get Figma embed URL
  const getFigmaEmbedUrl = (url: string) => {
    // Convert Figma design URL to embed URL
    // https://www.figma.com/design/XXX -> https://www.figma.com/embed?embed_host=share&url=...
    try {
      const encodedUrl = encodeURIComponent(url);
      return `https://www.figma.com/embed?embed_host=share&url=${encodedUrl}`;
    } catch {
      return null;
    }
  };

  // Helper to detect link type
  const detectLinkType = (url: string): 'figma' | 'lottie' | 'rive' | 'video' | 'other' => {
    if (url.includes('figma.com')) return 'figma';
    if (url.includes('lottie.host') || url.includes('lottiefiles.com') || url.endsWith('.json') || url.endsWith('.lottie')) return 'lottie';
    if (url.includes('rive.app') || url.includes('cdn.rive.app') || url.endsWith('.riv')) return 'rive';
    if (url.match(/\.(mp4|mov|webm)(\?|$)/i) || url.includes('youtube.com') || url.includes('vimeo.com')) return 'video';
    return 'other';
  };

  const linkType = deliverableLink ? detectLinkType(deliverableLink) : null;

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6">
      {/* Back navigation */}
      <button onClick={() => onNavigate('/studio/tasks')} className="inline-flex items-center gap-1 text-[12px] text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)] mb-4">
        <Icon name="chevron-right" className="h-3 w-3 rotate-180" />
        Back to tasks
      </button>

      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h1 className="text-[18px] font-semibold text-[color:var(--card-foreground)]">{task.title}</h1>
            {workspace && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[color:var(--accent)] text-[11px] text-[color:var(--accent-foreground)]">
                {workspace.name}
              </span>
            )}
            {brand && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[color:var(--accent)] text-[11px] text-[color:var(--accent-foreground)]">
                {brand.name}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[color:var(--accent)] text-[11px] text-[color:var(--accent-foreground)] capitalize">
              {task.category.toLowerCase()}
            </span>
            {task.revisionNumber > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-[11px] text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300">
                Rev #{task.revisionNumber}
              </span>
            )}
            {(task.source === 'COMPOSER_STANDALONE' || task.composerDraftId) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 border border-violet-300 text-[11px] text-violet-900 dark:bg-violet-900/30 dark:border-violet-700 dark:text-violet-300">
                <Icon name="sparkles" className="h-3 w-3" />
                From Composer
              </span>
            )}
            {(task.status === 'IN_PROGRESS' || task.slaIsLate) && (() => {
              const slaChip = getSlaStatusChip(task);
              return (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] ${slaChip.className}`}>
                  {slaChip.label}
                </span>
              );
            })()}
          </div>
          <p className="text-[11px] text-[color:var(--muted-foreground)]">
            Status: {task.status.replace('_', ' ')}
            {slaHours && <> · {formatSlaStatus(task)}</>}
          </p>
        </div>

        {/* Actions and Status controller */}
        <div className="flex items-center gap-2">
          {(task.status === 'QUEUED' || task.status === 'PAUSED') && (
            <button
              type="button"
              onClick={handleStartTask}
              className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-[11px] hover:bg-[color:var(--accent)]"
            >
              Start
            </button>
          )}
          {task.status === 'IN_PROGRESS' && (
            <button
              type="button"
              onClick={handleSendToReview}
              className="inline-flex items-center gap-1 rounded-md bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-3 py-1.5 text-[11px] font-medium hover:opacity-90"
            >
              Send to Review
            </button>
          )}
          {task.status === 'IN_REVIEW' && (
            <button
              type="button"
              onClick={handleCompleteTask}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-500 text-white px-3 py-1.5 text-[11px] font-medium hover:bg-emerald-600"
            >
              Mark Completed
            </button>
          )}
          <button
            type="button"
            onClick={handleDuplicateTask}
            className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-[11px] hover:bg-[color:var(--accent)]"
          >
            Duplicate
          </button>
          {task.status === 'QUEUED' && (
            <button
              type="button"
              onClick={handleDeleteTask}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700 hover:bg-red-100"
            >
              Delete
            </button>
          )}
        </div>
      </header>

      {/* Layout: 2-column when in review (brief left, review board takes rest), 3-column otherwise */}
      <div className={`grid gap-5 ${task.status === 'IN_REVIEW' ? 'lg:grid-cols-[320px_1fr]' : 'lg:grid-cols-[320px_1fr_380px]'}`}>
        {/* LEFT PANEL - Brief & Context */}
        <div className="space-y-4">
          {/* Brief */}
          {(task.brief || task.description) && (
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Brief</p>
              <p className="text-[13px] text-[color:var(--card-foreground)] leading-relaxed whitespace-pre-wrap">{task.brief || task.description}</p>

              {task.goals && task.goals.length > 0 && (
                <div className="pt-3 border-t border-dashed border-[color:var(--border)]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-2">Key goals</p>
                  <ul className="space-y-1.5 text-[12px] text-[color:var(--card-foreground)]">
                    {task.goals.map((goal, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-[color:var(--primary)]">•</span>
                        <span>{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reference links */}
              {task.referenceLinksJson && task.referenceLinksJson.length > 0 && (
                <div className="pt-3 border-t border-dashed border-[color:var(--border)]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-2">Reference links</p>
                  <ul className="space-y-1.5 text-[12px]">
                    {task.referenceLinksJson.map((link, idx) => (
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
          )}

          {/* Attachments */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Attachments</p>
              <div className="space-y-2">
                {task.attachments.map(attachment => (
                  <div key={attachment.id} className="flex items-center gap-2">
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[12px] text-[color:var(--foreground)] hover:underline truncate"
                    >
                      <Icon name="paperclip" className="h-3 w-3 text-[color:var(--muted-foreground)]" />
                      <span className="truncate">{attachment.url.split('/').pop()}</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brand Details - Collapsible */}
          {brand && (
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl overflow-hidden">
              <button
                onClick={() => setBrandDetailsOpen(!brandDetailsOpen)}
                className="w-full p-4 flex items-center justify-between hover:bg-[color:var(--accent)]/50 transition"
              >
                <div className="flex items-center gap-3">
                  {brand.logoUrl ? (
                    <img src={brand.logoUrl} alt={brand.name} className="h-8 w-8 rounded-lg object-contain bg-white border border-[color:var(--border)]" />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-[color:var(--accent)] flex items-center justify-center text-[12px] font-semibold text-[color:var(--foreground)]">
                      {brand.name[0]}
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Brand</p>
                    <p className="text-[13px] font-medium text-[color:var(--foreground)]">{brand.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Quick color preview */}
                  {(brand.primaryColor || brand.colorsJson?.primary) && (
                    <div className="flex gap-1">
                      {brand.primaryColor && <div className="h-4 w-4 rounded-full border border-[color:var(--border)]" style={{ backgroundColor: brand.primaryColor }} />}
                      {brand.secondaryColor && <div className="h-4 w-4 rounded-full border border-[color:var(--border)]" style={{ backgroundColor: brand.secondaryColor }} />}
                      {brand.accentColor && <div className="h-4 w-4 rounded-full border border-[color:var(--border)]" style={{ backgroundColor: brand.accentColor }} />}
                    </div>
                  )}
                  <Icon name="chevron-right" className={`h-4 w-4 text-[color:var(--muted-foreground)] transition-transform ${brandDetailsOpen ? 'rotate-90' : ''}`} />
                </div>
              </button>
              
              {brandDetailsOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-[color:var(--border)]">
                  {/* Tone Tags */}
                  {brand.toneTags && brand.toneTags.length > 0 && (
                    <div className="pt-3">
                      <p className="text-[11px] text-[color:var(--muted-foreground)] mb-2">Tone</p>
                      <div className="flex flex-wrap gap-1">
                        {brand.toneTags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[10px] text-[color:var(--muted-foreground)]">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Brand Colors */}
                  {(brand.primaryColor || brand.secondaryColor || brand.accentColor || brand.colorsJson) && (
                    <div className="pt-3 border-t border-dashed border-[color:var(--border)]">
                      <p className="text-[11px] text-[color:var(--muted-foreground)] mb-2">Colors</p>
                      <div className="flex flex-wrap gap-3">
                        {brand.primaryColor && (
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg border border-[color:var(--border)]" style={{ backgroundColor: brand.primaryColor }} />
                            <div>
                              <p className="text-[10px] text-[color:var(--muted-foreground)]">Primary</p>
                              <p className="text-[11px] font-mono text-[color:var(--foreground)]">{brand.primaryColor}</p>
                            </div>
                          </div>
                        )}
                        {brand.secondaryColor && (
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg border border-[color:var(--border)]" style={{ backgroundColor: brand.secondaryColor }} />
                            <div>
                              <p className="text-[10px] text-[color:var(--muted-foreground)]">Secondary</p>
                              <p className="text-[11px] font-mono text-[color:var(--foreground)]">{brand.secondaryColor}</p>
                            </div>
                          </div>
                        )}
                        {brand.accentColor && (
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg border border-[color:var(--border)]" style={{ backgroundColor: brand.accentColor }} />
                            <div>
                              <p className="text-[10px] text-[color:var(--muted-foreground)]">Accent</p>
                              <p className="text-[11px] font-mono text-[color:var(--foreground)]">{brand.accentColor}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Typography */}
                  {brand.typographyJson && (brand.typographyJson.headingFont || brand.typographyJson.bodyFont) && (
                    <div className="pt-3 border-t border-dashed border-[color:var(--border)]">
                      <p className="text-[11px] text-[color:var(--muted-foreground)] mb-2">Typography</p>
                      <div className="grid grid-cols-2 gap-3 text-[12px]">
                        {brand.typographyJson.headingFont && (
                          <div>
                            <p className="text-[10px] text-[color:var(--muted-foreground)]">Heading</p>
                            <p className="font-medium text-[color:var(--foreground)]" style={{ fontFamily: brand.typographyJson.headingFont }}>
                              {brand.typographyJson.headingFont}
                            </p>
                          </div>
                        )}
                        {brand.typographyJson.bodyFont && (
                          <div>
                            <p className="text-[10px] text-[color:var(--muted-foreground)]">Body</p>
                            <p className="font-medium text-[color:var(--foreground)]" style={{ fontFamily: brand.typographyJson.bodyFont }}>
                              {brand.typographyJson.bodyFont}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Guidelines */}
                  {(brand.guidelines || brand.voiceGuidelines || brand.guidelineUrl) && (
                    <div className="pt-3 border-t border-dashed border-[color:var(--border)]">
                      <p className="text-[11px] text-[color:var(--muted-foreground)] mb-2">Guidelines</p>
                      {brand.voiceGuidelines && (
                        <p className="text-[12px] text-[color:var(--foreground)] whitespace-pre-wrap mb-2">{brand.voiceGuidelines}</p>
                      )}
                      {brand.guidelines && !brand.voiceGuidelines && (
                        <p className="text-[12px] text-[color:var(--foreground)] whitespace-pre-wrap mb-2">{brand.guidelines}</p>
                      )}
                      {brand.guidelineUrl && (
                        <a href={brand.guidelineUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[color:var(--primary)] hover:underline flex items-center gap-1">
                          <Icon name="external-link" className="h-3 w-3" />
                          View full brand guidelines
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Structured Brief */}
          {task.structuredBriefJson && (
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Structured Brief</p>
              <div className="space-y-3 text-[12px]">
                {task.structuredBriefJson.goal && (
                  <div>
                    <span className="text-[color:var(--muted-foreground)] block mb-1">Goal</span>
                    <span className="text-[color:var(--foreground)]">{task.structuredBriefJson.goal}</span>
                  </div>
                )}
                {task.structuredBriefJson.audience && (
                  <div>
                    <span className="text-[color:var(--muted-foreground)] block mb-1">Audience</span>
                    <span className="text-[color:var(--foreground)]">{task.structuredBriefJson.audience}</span>
                  </div>
                )}
                {task.structuredBriefJson.funnelStage && (
                  <div>
                    <span className="text-[color:var(--muted-foreground)] block mb-1">Funnel Stage</span>
                    <span className="text-[color:var(--foreground)]">{task.structuredBriefJson.funnelStage}</span>
                  </div>
                )}
                {task.structuredBriefJson.primaryAssetType && (
                  <div>
                    <span className="text-[color:var(--muted-foreground)] block mb-1">Primary Asset Type</span>
                    <span className="text-[color:var(--foreground)]">{task.structuredBriefJson.primaryAssetType}</span>
                  </div>
                )}
                {task.structuredBriefJson.keyMessage && (
                  <div>
                    <span className="text-[color:var(--muted-foreground)] block mb-1">Key Message</span>
                    <span className="text-[color:var(--foreground)]">{task.structuredBriefJson.keyMessage}</span>
                  </div>
                )}
                {task.structuredBriefJson.tone && (
                  <div>
                    <span className="text-[color:var(--muted-foreground)] block mb-1">Tone</span>
                    <span className="text-[color:var(--foreground)]">{task.structuredBriefJson.tone}</span>
                  </div>
                )}
                {task.structuredBriefJson.sections && task.structuredBriefJson.sections.length > 0 && (
                  <div>
                    <span className="text-[color:var(--muted-foreground)] block mb-1">Sections</span>
                    <div className="flex flex-wrap gap-1">
                      {task.structuredBriefJson.sections.map((s, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-[color:var(--accent)] text-[color:var(--foreground)] text-[11px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Estimator - Show if any estimator data exists */}
          {(() => {
            const snapshot = task.estimateSnapshots?.[0];
            const effort = task.estimatedEffortHours ?? snapshot?.estimatedEffortHours;
            const suggestedSla = task.displaySlaHours ?? snapshot?.displaySlaHours;
            const fits48h = typeof task.fits48hWindow === 'boolean' ? task.fits48hWindow : snapshot?.fits48hWindow;
            const showPanel = effort != null || suggestedSla != null || task.flagForAdminReview || task.useAI || task.aiIneligibleReason || task.aiEligible === false || typeof fits48h === 'boolean';

            if (!showPanel) return null;

            return (
              <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">AI Estimator</p>
                  {!task.aiEligible && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] text-red-700">
                      AI Ineligible
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 text-[12px] md:grid-cols-3">
                  {effort != null && (
                    <div>
                      <div className="text-[11px] text-[color:var(--muted-foreground)]">Estimated Effort</div>
                      <div className="font-medium">{effort} hours</div>
                    </div>
                  )}
                  {suggestedSla != null && (
                    <div>
                      <div className="text-[11px] text-[color:var(--muted-foreground)]">Suggested TAT</div>
                      <div className="font-medium">{suggestedSla} hours</div>
                    </div>
                  )}
                  {typeof fits48h === 'boolean' && (
                    <div>
                      <div className="text-[11px] text-[color:var(--muted-foreground)]">Fits 48h Window</div>
                      <div className="font-medium">{fits48h ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                </div>
                {task.flagForAdminReview && (
                  <p className="mt-3 rounded-md bg-amber-50 p-2 text-[11px] text-amber-900">
                    ⚠ AI flagged this task for admin review.
                  </p>
                )}
                {task.aiIneligibleReason && (
                  <p className="mt-3 rounded-md bg-slate-50 p-2 text-[11px] text-[color:var(--foreground)]">
                    <span className="font-semibold">Ineligibility reason: </span>
                    {task.aiIneligibleReason}
                  </p>
                )}
                {/* Admin scope decision buttons */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleApproveScope}
                    className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition"
                  >
                    ✅ Approve Scope
                  </button>
                  <button
                    onClick={handleRejectScope}
                    className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-100 transition"
                  >
                    ❌ Reject Scope
                  </button>
                </div>
              </div>
            );
          })()}

          {/* AI Composer */}
          {showComposerContext && (
            <ComposerSection task={task} />
          )}

          {/* Task Metadata */}
          <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Task Info</p>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[color:var(--muted-foreground)]">Created</span>
                <span className="text-[color:var(--foreground)]">{formatTimestamp(task.createdAt)}</span>
              </div>
              {task.inProgressAt && (
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted-foreground)]">Started</span>
                  <span className="text-[color:var(--foreground)]">{formatTimestamp(task.inProgressAt)}</span>
                </div>
              )}
              {task.completedAt && (
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted-foreground)]">Completed</span>
                  <span className="text-[color:var(--foreground)]">{formatTimestamp(task.completedAt)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[color:var(--muted-foreground)]">SLA</span>
                <span className="text-[color:var(--foreground)]">{slaHours} hours</span>
              </div>
              {task.slaRemainingSeconds != null && task.status === 'IN_PROGRESS' && (
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted-foreground)]">Time remaining</span>
                  <span className={`font-medium ${task.slaIsLate ? 'text-red-600' : 'text-[color:var(--foreground)]'}`}>
                    {task.slaIsLate ? 'Overdue' : `${Math.round(task.slaRemainingSeconds / 3600)}h`}
                  </span>
                </div>
              )}
              {task.slaElapsedSeconds != null && (
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted-foreground)]">Elapsed</span>
                  <span className="text-[color:var(--foreground)]">{Math.round(task.slaElapsedSeconds / 3600)}h</span>
                </div>
              )}
            </div>
          </div>

          {/* Workspace Info */}
          {workspace && (
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Workspace</p>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[color:var(--muted-foreground)]">Name</span>
                  <span className="text-[color:var(--foreground)]">{workspace.name}</span>
                </div>
                {workspace.subscription && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[color:var(--muted-foreground)]">Plan</span>
                      <span className="text-[color:var(--foreground)]">{workspace.subscription.planCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[color:var(--muted-foreground)]">Status</span>
                      <span className={`${workspace.subscription.status === 'ACTIVE' ? 'text-emerald-600' : workspace.subscription.status === 'PAUSED' ? 'text-amber-600' : 'text-red-600'}`}>
                        {workspace.subscription.status}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE PANEL - Files & Deliverables */}
        <div className="space-y-4">
          {/* Composer Preview - Show for tasks created from Composer */}
          {showComposerContext && (
            <ComposerPreview
              composerDraftId={task.composerDraftId}
              composerExportUrl={task.composerExportUrl}
              workspaceId={task.workspaceId}
            />
          )}

          {(task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW') && (
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Add deliverable</p>
              </div>
              
              {/* Link input section */}
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[color:var(--foreground)]">Add by link</p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={deliverableLink}
                    onChange={(e) => setDeliverableLink(e.target.value)}
                    placeholder="Paste Figma, Lottie, or any URL (Ctrl+L in Figma to copy)"
                    className="flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-[12px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)]"
                  />
                  <button
                    type="button"
                    onClick={handleAddLinkDeliverable}
                    disabled={!deliverableLink.trim() || isAddingLink}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-4 py-2 text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {isAddingLink ? 'Adding…' : 'Add link'}
                  </button>
                </div>
                {/* Live preview based on link type */}
                {deliverableLink && linkType === 'figma' && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-[color:var(--border)] bg-white">
                    <iframe
                      src={getFigmaEmbedUrl(deliverableLink) || ''}
                      className="w-full h-[300px]"
                      allowFullScreen
                    />
                  </div>
                )}
                {deliverableLink && linkType === 'lottie' && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-[color:var(--border)] bg-[color:var(--background)] p-4 flex items-center justify-center">
                    <DotLottieReact
                      src={deliverableLink}
                      loop
                      autoplay
                      style={{ width: '100%', maxWidth: '400px', height: '300px' }}
                    />
                  </div>
                )}
                {deliverableLink && linkType === 'rive' && (
                  <div className="mt-3 rounded-lg overflow-hidden border border-[color:var(--border)] bg-[color:var(--background)] p-4">
                    <RivePreview src={deliverableLink} />
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-[color:var(--border)] pt-4">
                <p className="text-[12px] font-medium text-[color:var(--foreground)] mb-2">Or upload file</p>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_120px] gap-2 items-center">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,.pdf,.mov,.mp4,.webm,.json,.riv"
                    onChange={(e) => setDeliverableFile(e.target.files?.[0] || null)}
                    className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-[12px] text-[color:var(--foreground)]"
                  />
                  <select
                    value={deliverableType}
                    onChange={(e) => setDeliverableType(e.target.value as ReviewAssetType)}
                    className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-[12px] text-[color:var(--foreground)]"
                  >
                    <option value="IMAGE">Image</option>
                    <option value="VIDEO">Video</option>
                    <option value="PDF">PDF</option>
                    <option value="EMBED">Other</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateDeliverable}
                    disabled={!deliverableFile || isUploadingDeliverable}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] px-3 py-2 text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {isUploadingDeliverable ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>
              
              <p className="text-[11px] text-[color:var(--muted-foreground)]">
                Deliverables appear as Rev 1 in the review board for clients.
              </p>
            </div>
          )}

          {/* Review Board - shown when task is IN_REVIEW */}
          {task.status === 'IN_REVIEW' && workspaceIdForTask && (
            <StudioReviewBoard
              taskId={taskId}
              workspaceId={workspaceIdForTask}
              onRefresh={refetch}
            />
          )}

          {/* Client files (attachments) */}
          {task.attachments && task.attachments.length > 0 ? (
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Client files</p>
              </div>
              <div className="space-y-2">
                {task.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-3 py-2 hover:border-[color:var(--primary)] transition"
                  >
                    <Icon name="paperclip" className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[color:var(--card-foreground)] truncate">{attachment.url.split('/').pop()}</p>
                      <p className="text-[11px] text-[color:var(--muted-foreground)]">Uploaded {new Date(attachment.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Icon name="external-link" className="h-4 w-4 text-[color:var(--muted-foreground)]" />
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-6 text-center space-y-2">
              <Icon name="folder" className="h-8 w-8 text-[color:var(--accent)] mx-auto" />
              <p className="text-[12px] text-[color:var(--muted-foreground)]">No client files yet</p>
            </div>
          )}
        </div>
        {/* RIGHT PANEL - Assignment & Internal (only shown when NOT in review) */}
        {task.status !== 'IN_REVIEW' && (
          <div className="space-y-4">
            {/* Assignment */}
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Assignment</p>

              <div>
                <label className="text-[11px] text-[color:var(--muted-foreground)] mb-2 block">Assignee</label>
                <div className="flex items-center gap-2 bg-[color:var(--background)] border border-[color:var(--border)] rounded-lg px-3 py-2">
                  <div className="h-6 w-6 rounded-full bg-[color:var(--primary)] flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-[color:var(--primary-foreground)]">SK</span>
                  </div>
                  <span className="text-[12px] text-[color:var(--card-foreground)]">Sako</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[color:var(--muted-foreground)] mb-2 block">Priority</label>
                <div className="flex gap-2">
                  {(['low', 'normal', 'high', 'rush'] as const).map(priority => (
                    <button
                      key={priority}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] transition capitalize ${task.priority === priority
                        ? priority === 'rush' ? 'bg-red-500 text-white' : priority === 'high' ? 'bg-emerald-500 text-white' : 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                        : 'bg-[color:var(--background)] border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]'
                        }`}
                    >
                      {priority}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Revision history */}
            {task.revisions && task.revisions.length > 0 && (
              <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Revision history</p>
                <div className="space-y-3 text-[12px]">
                  {task.revisions.slice().reverse().map((rev, i) => (
                    <div key={rev.id} className="flex gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center border-2 ${i === 0 ? 'bg-[color:var(--primary)]/10 border-[color:var(--primary)]' : 'bg-[color:var(--muted)] border-[color:var(--accent)]'
                          }`}>
                          {rev.status === 'completed' && <Icon name="check" className={`h-3 w-3 ${i === 0 ? 'text-[color:var(--primary)]' : 'text-[color:var(--muted-foreground)]'}`} />}
                          {rev.status === 'in-progress' && <div className={`h-2 w-2 rounded-full ${i === 0 ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--muted-foreground)]'}`}></div>}
                        </div>
                        {i < task.revisions.length - 1 && <div className="flex-1 w-px bg-[color:var(--border)] min-h-[20px]"></div>}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-[color:var(--card-foreground)]">Rev {rev.number} {i === 0 && '· Current'}</p>
                        <p className="text-[color:var(--muted-foreground)]">{rev.summary}</p>
                        <p className="text-[11px] text-[color:var(--muted-foreground)] mt-1">{rev.requestedBy} · {rev.requestedAt}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] text-[12px] text-[color:var(--card-foreground)] hover:bg-[color:var(--accent)] transition">
                  <Icon name="rotate-cw" className="h-3.5 w-3.5" />
                  Start revision
                </button>
              </div>
            )}


            {/* Comments */}
            <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Comments</p>
                <span className="text-[11px] text-[color:var(--muted-foreground)]">{comments.length} comments</span>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {isLoadingComments ? (
                  <p className="text-[12px] text-[color:var(--muted-foreground)] text-center py-4">Loading comments…</p>
                ) : comments.length === 0 ? (
                  <p className="text-[12px] text-[color:var(--muted-foreground)] text-center py-4">No comments yet</p>
                ) : (
                  comments.map((comment) => (
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
                        </div>
                        <p className="text-[13px] text-[color:var(--foreground)] whitespace-pre-wrap">{comment.body}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="pt-2 border-t border-dashed border-[color:var(--border)]">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--input)] text-[12px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)]/30 resize-none"
                  rows={2}
                />
                <div className="flex items-center justify-end mt-2">
                  <button
                    type="submit"
                    disabled={!newComment.trim() || isPostingComment}
                    className="inline-flex items-center px-3 py-1.5 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[12px] hover:opacity-90 transition disabled:opacity-50"
                  >
                    Post comment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Rive Preview Component
const RivePreview: React.FC<{ src: string }> = ({ src }) => {
  const { RiveComponent } = useRive({
    src,
    autoplay: true,
  });

  return (
    <div className="flex items-center justify-center" style={{ width: '100%', height: '300px' }}>
      <RiveComponent style={{ width: '100%', height: '100%', maxWidth: '400px' }} />
    </div>
  );
};
