import React, { useState, useEffect } from 'react';
import { Icon } from '../Icon';
import { useBrands, useWorkspace } from '../../lib/hooks';
import { useWorkspaceContext } from '../../lib/WorkspaceProvider';
import { createTask, estimateTask, EstimateTaskPayload, callIntakeAI, uploadAttachment, saveTaskDraft, TaskDraft, getTaskDraft } from '../../lib/api';
import { TaskCategory, TaskEstimatorResponse, StructuredBrief } from '../../lib/types';
import { features } from '../../config/features';
import { consumeNewTaskPrefill } from '../../lib/new-task-prefill';
import { analytics } from '../../lib/analytics';

interface TaskCreateProps {
  onNavigate: (route: string) => void;
}

export const TaskCreate: React.FC<TaskCreateProps> = ({ onNavigate }) => {
  const { data: brands, loading: brandsLoading } = useBrands();
  const { data: workspace } = useWorkspace();
  const { permissions } = useWorkspaceContext();

  // Redirect viewers - they can't create tasks
  if (!permissions.canCreateTasks) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
          <Icon name="lock" className="h-12 w-12 text-[color:var(--muted-foreground)] mx-auto mb-4" />
          <h2 className="text-[18px] font-semibold text-[color:var(--foreground)] mb-2">View-only access</h2>
          <p className="text-[13px] text-[color:var(--muted-foreground)] mb-4">
            You have viewer access to this workspace. Only members and owners can create tasks.
          </p>
          <button
            onClick={() => onNavigate('/tasks')}
            className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition"
          >
            View tasks instead
          </button>
        </div>
      </div>
    );
  }

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [category, setCategory] = useState<TaskCategory>('DESIGN');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [referenceLinks, setReferenceLinks] = useState<string[]>(['', '']);
  const [useAI, setUseAI] = useState(true);
  const [useAIAssistance, setUseAIAssistance] = useState(true);
  const [wantsFigmaFile, setWantsFigmaFile] = useState(true);
  const [wantsDriveLink, setWantsDriveLink] = useState(false);
  const [wantsVideoRef, setWantsVideoRef] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Structured Brief State
  const [structuredBrief, setStructuredBrief] = useState<StructuredBrief>({
    goal: '',
    audience: '',
    funnelStage: 'unknown',
    primaryAssetType: 'other',
    keyMessage: '',
    tone: '',
    sections: [],
  });
  const [isIntakeLoading, setIsIntakeLoading] = useState(false);

  // Estimator state
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimate, setEstimate] = useState<TaskEstimatorResponse | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [lastEstimatePayload, setLastEstimatePayload] = useState<EstimateTaskPayload | null>(null);
  const [prefillSource, setPrefillSource] = useState<{ title: string; taskId?: string } | null>(null);

  // Draft state
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    // Track TaskCreateOpened analytics event
    if (workspace?.id) {
      analytics.taskCreateOpened(workspace.id);
    }

    // Check for draft ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const draftId = urlParams.get('draftId');
    if (draftId) {
      loadDraft(draftId);
      return;
    }

    const prefill = consumeNewTaskPrefill();
    if (prefill) {
      setTitle(prefill.title);
      setDescription(prefill.description);
      setCategory(prefill.category);
      setSelectedBrand(prefill.brandId || '');
      setUseAI(prefill.useAI ?? true);
      setPrefillSource({
        title: prefill.sourceTaskTitle || prefill.title,
        taskId: prefill.sourceTaskId,
      });
      setEstimate(null);
      setEstimateError(null);
      setLastEstimatePayload(null);
    }
  }, [workspace?.id]);

  const loadDraft = async (draftId: string) => {
    try {
      const draft = await getTaskDraft(draftId);
      setCurrentDraftId(draft.id);
      setTitle(draft.title || '');
      setDescription(draft.description || '');
      setCategory(draft.category || 'DESIGN');
      setSelectedBrand(draft.brandId || '');
      setUseAI(draft.useAI ?? true);
      if (draft.structuredBriefJson) {
        setStructuredBrief(draft.structuredBriefJson as StructuredBrief);
      }
      if (draft.referenceLinksJson && Array.isArray(draft.referenceLinksJson)) {
        setReferenceLinks(draft.referenceLinksJson as string[]);
      }
      setLastSavedAt(new Date(draft.lastEditedAt));
    } catch (err) {
      console.error('Failed to load draft:', err);
      setError('Failed to load draft');
    }
  };

  const addReferenceLink = () => {
    setReferenceLinks([...referenceLinks, '']);
  };

  const removeReferenceLink = (index: number) => {
    setReferenceLinks(referenceLinks.filter((_, i) => i !== index));
  };

  const updateReferenceLink = (index: number, value: string) => {
    const updated = [...referenceLinks];
    updated[index] = value;
    setReferenceLinks(updated);
  };

  const buildEstimatorPayload = (): EstimateTaskPayload => ({
    title: title.trim(),
    description: description.trim(),
    category,
    brandId: selectedBrand || undefined,
  });

  const isSamePayload = (a: EstimateTaskPayload | null, b: EstimateTaskPayload) => {
    if (!a) return false;
    return (
      a.title === b.title &&
      a.description === b.description &&
      a.category === b.category &&
      (a.brandId || '') === (b.brandId || '')
    );
  };

  const requestEstimate = async (payload: EstimateTaskPayload) => {
    setIsEstimating(true);
    try {
      const response = await estimateTask(payload);
      setEstimate(response);
      setLastEstimatePayload(payload);
      return response;
    } finally {
      setIsEstimating(false);
    }
  };

  const handleEstimate = async () => {
    if (!title.trim() || title.length < 4) {
      setEstimateError('Please enter a title (at least 4 characters)');
      return;
    }
    if (!description.trim() || description.length < 10) {
      setEstimateError('Please enter a description (at least 10 characters)');
      return;
    }

    setEstimateError(null);

    try {
      await requestEstimate(buildEstimatorPayload());
    } catch (err) {
      setEstimateError('Estimator failed. You can still submit the task normally.');
    }
  };

  const handleIntake = async () => {
    if (!description.trim()) {
      setError('Please enter a description first to structure.');
      return;
    }
    setIsIntakeLoading(true);
    setError(null);
    try {
      const result = await callIntakeAI({
        description,
        title,
        brandId: selectedBrand || undefined,
        context,
        referenceLinks: referenceLinks.filter(l => l),
      });
      setStructuredBrief({
        goal: result.goal,
        audience: result.audience,
        funnelStage: result.funnelStage,
        primaryAssetType: result.primaryAssetType,
        keyMessage: result.keyMessage,
        tone: result.tone || '',
        sections: result.sections || [],
      });
      return result;
    } catch (e) {
      setError('Failed to structure brief. Please try again.');
      throw e;
    } finally {
      setIsIntakeLoading(false);
    }
  };

  // Combined Structure & Estimate action (runs both in one click)
  const handleStructureAndEstimate = async () => {
    if (!title.trim() || title.length < 4) {
      setError('Please enter a title (at least 4 characters)');
      return;
    }
    if (!description.trim() || description.length < 10) {
      setError('Please enter a description (at least 10 characters)');
      return;
    }

    setError(null);
    setEstimateError(null);
    setIsIntakeLoading(true);

    try {
      // Step 1: Structure the brief with AI
      await callIntakeAI({
        description,
        title,
        brandId: selectedBrand || undefined,
        context,
        referenceLinks: referenceLinks.filter(l => l),
      }).then(result => {
        setStructuredBrief({
          goal: result.goal,
          audience: result.audience,
          funnelStage: result.funnelStage,
          primaryAssetType: result.primaryAssetType,
          keyMessage: result.keyMessage,
          tone: result.tone || '',
          sections: result.sections || [],
        });
      }).catch(() => {
        // Continue even if structuring fails - it's optional
        console.log('Brief structuring skipped - continuing with estimate');
      });

      // Step 2: Run the estimator
      setIsIntakeLoading(false);
      setIsEstimating(true);
      try {
        await requestEstimate(buildEstimatorPayload());
        analytics.structureBriefUsed(title, true);
        analytics.aiEstimatorUsed(title, true);
      } catch (err) {
        setEstimateError('Estimator failed. You can still submit the task normally.');
        analytics.aiEstimatorUsed(title, false);
      }
    } catch (e) {
      setError('Failed to process brief. Please try again.');
      analytics.structureBriefUsed(title, false);
    } finally {
      setIsIntakeLoading(false);
      setIsEstimating(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const estimatorPayload = buildEstimatorPayload();
    const needsFreshEstimate =
      !estimate || !isSamePayload(lastEstimatePayload, estimatorPayload);

    let estimatorResult = estimate;

    if (needsFreshEstimate) {
      setEstimateError(null);
      try {
        estimatorResult = await requestEstimate(estimatorPayload);
      } catch (err) {
        if (useAI) {
          setError('AI estimator must run successfully before submitting when AI is enabled. Please update your brief or try again.');
          setIsSubmitting(false);
          return;
        }
        setEstimateError('Estimator is unavailable right now. Submitting without a preview.');
      }
    }

    if (estimatorResult && useAI) {
      if (estimatorResult.complexity === 'unsupported' || !estimatorResult.isAiSupported) {
        const confirmUnsupported = window.confirm(
          'AI estimator marked this task as unsupported for AI. Continue anyway? Consider turning off "Use AI" to avoid credit usage.'
        );
        if (!confirmUnsupported) {
          setIsSubmitting(false);
          return;
        }
      } else if (estimatorResult.complexity === 'complex' || estimatorResult.flagForAdminReview) {
        const confirmComplex = window.confirm(
          'This task was flagged as complex and may require admin review. Continue with submission?'
        );
        if (!confirmComplex) {
          setIsSubmitting(false);
          return;
        }
      }
    }

    try {
      const task = await createTask({
        title: title.trim(),
        description: description.trim(),
        category,
        brandId: selectedBrand || undefined,
        useAI,
        structuredBriefJson: structuredBrief,
        referenceLinksJson: referenceLinks.filter(l => l).map(url => ({ url, type: 'unknown' })),
        deliverablesJson: {
          figma: wantsFigmaFile,
          drive: wantsDriveLink,
          video: wantsVideoRef
        }
      });

      // Upload files if any were selected
      if (selectedFiles.length > 0) {
        let uploadedCount = 0;
        const uploadErrors: string[] = [];

        for (const file of selectedFiles) {
          try {
            await uploadAttachment(task.id, file);
            uploadedCount++;
          } catch (uploadErr) {
            const errMsg = uploadErr instanceof Error ? uploadErr.message : 'Unknown error';
            uploadErrors.push(`${file.name}: ${errMsg}`);
          }
        }

        // Show feedback about uploads
        if (uploadErrors.length > 0 && uploadedCount === 0) {
          // All uploads failed
          setError(`Task created but file uploads failed: ${uploadErrors.join('; ')}. You can upload files from the task detail page.`);
          setIsSubmitting(false);
          setTimeout(() => onNavigate(`/tasks/${task.id}`), 3000);
          return;
        } else if (uploadErrors.length > 0) {
          // Some uploads failed
          setError(`Task created. ${uploadedCount} file(s) uploaded successfully, but ${uploadErrors.length} failed: ${uploadErrors.join('; ')}`);
          setIsSubmitting(false);
          setTimeout(() => onNavigate(`/tasks/${task.id}`), 3000);
          return;
        }
      }

      // Track TaskCreateSubmitted analytics event
      if (workspace?.id) {
        analytics.taskCreateSubmitted(workspace.id, task.id, category);
      }

      // Navigate to the newly created task
      setIsSubmitting(false);
      onNavigate(`/tasks/${task.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      if (message.toLowerCase().includes('ai credit')) {
        setError(`${message} Try toggling off "Use AI" for this task or contact Sako to top up credits.`);
      } else {
        setError(message);
      }
      setIsSubmitting(false);
    }
  };

  const handleClearPrefill = () => {
    setPrefillSource(null);
    setTitle('');
    setDescription('');
    setCategory('DESIGN');
    setSelectedBrand('');
    setUseAI(true);
    setEstimate(null);
    setEstimateError(null);
    setLastEstimatePayload(null);
  };

  const handleSaveDraft = async () => {
    if (!title.trim() && !description.trim()) {
      setError('Add a title or description to save as draft');
      return;
    }

    setIsSavingDraft(true);
    setError(null);

    try {
      const draft = await saveTaskDraft({
        id: currentDraftId || undefined,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        category,
        brandId: selectedBrand || undefined,
        useAI,
        structuredBriefJson: structuredBrief,
        referenceLinksJson: referenceLinks.filter(l => l).map(url => ({ url, type: 'unknown' })),
        deliverablesJson: {
          figma: wantsFigmaFile,
          drive: wantsDriveLink,
          video: wantsVideoRef
        }
      });

      setCurrentDraftId(draft.id);
      setLastSavedAt(new Date());
      
      // Show brief success indicator
      const successMsg = currentDraftId ? 'Draft updated' : 'Draft saved';
      // Use a toast or temporary message if available, otherwise just update state
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save draft';
      setError(message);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Compute standard SLA hours for display
  const standardSlaHours = workspace?.effectiveSlaSeconds
    ? Math.round(workspace.effectiveSlaSeconds / 3600)
    : 48;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Tasks</p>
          <h2 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">
            {currentDraftId ? 'Continue draft' : 'Create task'}
          </h2>
          {currentDraftId && lastSavedAt && (
            <p className="text-[11px] text-[color:var(--muted-foreground)] mt-0.5">
              Draft last saved {lastSavedAt.toLocaleString()}
            </p>
          )}
        </div>
        <button
          className="inline-flex items-center px-4 py-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition"
          onClick={() => onNavigate('/tasks')}
        >
          Back to list
        </button>
      </header>

      {prefillSource && (
        <div className="mb-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--accent)]/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-[color:var(--foreground)]">
              Using template from {prefillSource.title}
            </p>
            <p className="text-[12px] text-[color:var(--muted-foreground)]">
              Fields below are prefilled—make edits before submitting.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {prefillSource.taskId && (
              <button
                className="inline-flex items-center px-3 py-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[12px] text-[color:var(--foreground)] hover:bg-[color:var(--card)]/80 transition"
                onClick={() => onNavigate(`/tasks/${prefillSource.taskId}`)}
              >
                View original
              </button>
            )}
            <button
              className="inline-flex items-center px-3 py-1.5 rounded-full border border-[color:var(--border)] text-[12px] text-[color:var(--muted-foreground)] hover:bg-[color:var(--card)] transition"
              onClick={handleClearPrefill}
            >
              Start fresh
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-4 py-3 text-[13px] text-red-900 dark:text-red-200">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-5 md:p-6">
        <div className="grid lg:grid-cols-[2fr_1.4fr] gap-6">
          {/* Main form */}
          <div className="space-y-4 text-[13px]">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Task title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g. Q2 launch visuals for mobile app"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--primary)] placeholder:text-[color:var(--muted-foreground)] transition-all"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--primary)]"
                >
                  <option value="DESIGN">Design</option>
                  <option value="MOTION">Motion</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Brand</label>
                {brandsLoading ? (
                  <div className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--muted-foreground)]">
                    Loading brands...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {brands && brands.length > 0 ? (
                      <>
                        {brands.map(brand => (
                          <button
                            key={brand.id}
                            onClick={() => setSelectedBrand(selectedBrand === brand.id ? '' : brand.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] ${selectedBrand === brand.id
                              ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/10 text-[color:var(--primary)]'
                              : 'border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]'
                              }`}
                          >
                            {brand.colorsJson?.primary && (
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: brand.colorsJson.primary }}></span>
                            )}
                            {brand.name}
                          </button>
                        ))}
                        <button
                          onClick={() => onNavigate('/brands')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-[color:var(--border)] bg-[color:var(--accent)] text-[12px] text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
                        >
                          + New brand
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => onNavigate('/brands')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-[color:var(--border)] bg-[color:var(--accent)] text-[12px] text-[color:var(--foreground)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
                      >
                        + Create your first brand
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Brief / what do you need</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe the outcome, goals, target audience, and deliverables…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--primary)] placeholder:text-[color:var(--muted-foreground)] transition-all"
              ></textarea>
            </div>

            {/* AI Structure & Estimate Section */}
            <div className="flex flex-col gap-3 pt-2 border-t border-dashed border-[color:var(--border)]">
              {/* Structure & Estimate Button (Combined action) */}
              {!estimate && (
                <button
                  onClick={handleStructureAndEstimate}
                  disabled={isIntakeLoading || isEstimating || !title.trim() || !description.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50 shadow-sm"
                >
                  {(isIntakeLoading || isEstimating) ? (
                    <>
                      <Icon name="loader" className="h-4 w-4 animate-spin" />
                      {isIntakeLoading ? 'Structuring brief...' : 'Estimating...'}
                    </>
                  ) : (
                    <>
                      <Icon name="sparkles" className="h-4 w-4" />
                      Structure & Estimate with AI
                    </>
                  )}
                </button>
              )}
              
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Structured Brief</label>
                {estimate && (
                <button
                  onClick={handleIntake}
                  disabled={isIntakeLoading || !description.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/5 text-[11px] font-medium text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10 transition disabled:opacity-50"
                >
                  {isIntakeLoading ? <Icon name="loader" className="h-3 w-3 animate-spin" /> : <Icon name="sparkles" className="h-3 w-3" />}
                    Re-structure
                </button>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/50">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[color:var(--muted-foreground)]">Goal</label>
                  <input
                    type="text"
                    value={structuredBrief.goal}
                    onChange={(e) => setStructuredBrief({ ...structuredBrief, goal: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:border-[color:var(--primary)]"
                    placeholder="e.g. Increase signups"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[color:var(--muted-foreground)]">Audience</label>
                  <input
                    type="text"
                    value={structuredBrief.audience}
                    onChange={(e) => setStructuredBrief({ ...structuredBrief, audience: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:border-[color:var(--primary)]"
                    placeholder="e.g. CTOs of Series A startups"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[color:var(--muted-foreground)]">Funnel Stage</label>
                  <select
                    value={structuredBrief.funnelStage}
                    onChange={(e) => setStructuredBrief({ ...structuredBrief, funnelStage: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:border-[color:var(--primary)]"
                  >
                    <option value="unknown">Not sure</option>
                    <option value="top">Top (Awareness)</option>
                    <option value="middle">Middle (Consideration)</option>
                    <option value="bottom">Bottom (Conversion)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[color:var(--muted-foreground)]">Asset Type</label>
                  <select
                    value={structuredBrief.primaryAssetType}
                    onChange={(e) => setStructuredBrief({ ...structuredBrief, primaryAssetType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:border-[color:var(--primary)]"
                  >
                    <option value="other">Other</option>
                    <option value="landing_page">Landing Page</option>
                    <option value="social">Social Media</option>
                    <option value="email">Email</option>
                    <option value="deck">Pitch Deck</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[11px] text-[color:var(--muted-foreground)]">Key Message</label>
                  <input
                    type="text"
                    value={structuredBrief.keyMessage}
                    onChange={(e) => setStructuredBrief({ ...structuredBrief, keyMessage: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:border-[color:var(--primary)]"
                    placeholder="e.g. We are the fastest way to ship"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[11px] text-[color:var(--muted-foreground)]">Tone</label>
                  <input
                    type="text"
                    value={structuredBrief.tone || ''}
                    onChange={(e) => setStructuredBrief({ ...structuredBrief, tone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] outline-none focus:border-[color:var(--primary)]"
                    placeholder="e.g. Professional but friendly"
                  />
                </div>
              </div>
            </div>

           

            {/* Reference links list */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Reference links</label>
              <div className="space-y-2">
                {referenceLinks.map((link, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => updateReferenceLink(index, e.target.value)}
                      placeholder="https://…"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)] focus:border-[color:var(--primary)] placeholder:text-[color:var(--muted-foreground)] transition-all"
                    />
                    <button
                      onClick={() => removeReferenceLink(index)}
                      className="px-3 py-2 rounded-full border border-[color:var(--border)] bg-[color:var(--accent)] text-[12px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]/80 transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addReferenceLink}
                className="mt-2 inline-flex items-center px-3 py-1.5 rounded-full border border-dashed border-[color:var(--border)] bg-[color:var(--accent)] text-[12px] text-[color:var(--foreground)] hover:border-[color:var(--primary)]/70 hover:text-[color:var(--primary)] transition"
              >
                + Add link
              </button>
            </div>

            {/* Uploads */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Attachments</label>
              <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--accent)] px-4 py-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] text-[color:var(--foreground)]">Upload files with your task</p>
                  <button
                    type="button"
                    onClick={() => document.getElementById('task-create-file-input')?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/5 text-[11px] font-medium text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10 transition"
                  >
                    <Icon name="upload" className="h-3 w-3" />
                    Select files
                  </button>
                  <input
                    id="task-create-file-input"
                    type="file"
                    multiple
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                    className="hidden"
                  />
                </div>
                {selectedFiles.length > 0 ? (
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)]">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Icon name="paperclip" className="h-3 w-3 text-[color:var(--muted-foreground)] flex-shrink-0" />
                          <span className="text-[12px] text-[color:var(--foreground)] truncate">{file.name}</span>
                          <span className="text-[11px] text-[color:var(--muted-foreground)] flex-shrink-0">
                            ({(file.size / 1024 / 1024).toFixed(1)}MB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                          className="ml-2 text-[color:var(--muted-foreground)] hover:text-red-500 text-sm flex-shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[color:var(--muted-foreground)] text-center italic">
                    No files selected
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* AI panel */}
          <div className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">AI assistance</p>
              <p className="text-[13px] text-[color:var(--muted-foreground)]">Every task is structured and estimated with AI.</p>
            </div>

            {/* AI estimator */}
            <div className="bg-[color:var(--accent)] rounded-2xl border border-[color:var(--border)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-medium text-[color:var(--foreground)]">AI estimator</p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">Runs instantly, no credit usage.</p>
                </div>
                {estimate && (
                  <span className={`inline-flex items-center h-7 px-3 rounded-full text-[11px] ${estimate.complexity === 'simple'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : estimate.complexity === 'complex'
                      ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
                    }`}>
                    {estimate.complexity === 'simple' && '✓ Simple'}
                    {estimate.complexity === 'complex' && '⚠ Complex'}
                    {estimate.complexity === 'unsupported' && '✗ Unsupported'}
                  </span>
                )}
              </div>

              {estimateError && (
                <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-3 py-2 text-[11px] text-red-900 dark:text-red-200">
                  {estimateError}
                </div>
              )}

              {/* Re-estimate button only shown when estimate already exists */}
              {estimate && (
                <button
                  onClick={handleEstimate}
                  disabled={isEstimating || !title.trim() || !description.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] text-[12px] hover:bg-[color:var(--accent)] transition disabled:opacity-50"
                >
                  {isEstimating ? (
                    <>
                      <Icon name="loader" className="h-3.5 w-3.5 animate-spin" />
                      Re-estimating...
                    </>
                  ) : (
                    <>
                      <Icon name="refresh-cw" className="h-3.5 w-3.5" />
                      Re-estimate
                    </>
                  )}
                </button>
              )}

              {estimate && (
                <>
                  <div className="space-y-2 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[color:var(--muted-foreground)]">Estimated effort:</span>
                      <span className="font-medium text-[color:var(--foreground)]">~{estimate.estimatedEffortHours} hours</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[color:var(--muted-foreground)]">Delivery expectation:</span>
                      <span className="font-medium text-[color:var(--foreground)]">24–{standardSlaHours}h</span>
                    </div>
                    {!estimate.fits48hWindow && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
                        <strong>⚠ May not fit standard {standardSlaHours}h window.</strong> Consider splitting into {estimate.recommendedSplitCount} subtasks.
                      </div>
                    )}
                    {estimate.flagForAdminReview && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 px-3 py-2 text-[11px] text-blue-900 dark:text-blue-200">
                        <strong>📋 Flagged for review:</strong> {estimate.flagReason}
                      </div>
                    )}
                  </div>

                  {estimate.suggestedSubtasks.length > 0 && (
                    <div className="space-y-1.5 text-[12px]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Suggested subtasks</p>
                      <ul className="list-disc list-inside space-y-0.5 text-[color:var(--muted-foreground)]">
                        {estimate.suggestedSubtasks.map((subtask, idx) => (
                          <li key={idx}>{subtask}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {estimate.missingInfoQuestions.length > 0 && (
                    <div className="space-y-1.5 text-[12px]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Questions to improve brief</p>
                      <ul className="list-disc list-inside space-y-0.5 text-[color:var(--muted-foreground)]">
                        {estimate.missingInfoQuestions.map((question, idx) => (
                          <li key={idx}>{question}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {estimate.aiHelpRecommended && (
                    <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-[11px] text-[color:var(--muted-foreground)]">
                      <p className="flex items-center gap-1.5">
                        <Icon name="sparkles" className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                        <span className="font-medium text-[color:var(--foreground)]">AI can help:</span> {estimate.aiHelpReason}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-dashed border-[color:var(--border)]">
                    <button
                      onClick={() => {
                        setEstimate(null);
                        setEstimateError(null);
                      }}
                      className="inline-flex items-center px-3 py-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[12px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition"
                    >
                      Run again
                    </button>
                    <p className="text-[11px] text-[color:var(--muted-foreground)] flex items-center gap-1">
                      <Icon name="sparkles" className="h-3.5 w-3.5 text-[color:var(--primary)]" />
                      0 AI credits used
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Global AI usage toggle */}
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-[color:var(--foreground)]">Do you want to use AI for this task?</p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">This controls whether AI is used at all for this brief.</p>
                </div>
                <button
                  onClick={() => {
                    const aiCreditsRemaining = workspace?.aiCredit
                      ? workspace.aiCredit.totalCredits - workspace.aiCredit.usedCredits
                      : 0;
                    if (aiCreditsRemaining <= 0) {
                      alert('You have 0 AI credits remaining this period. Add credits or disable AI to continue.');
                      return;
                    }
                    setUseAI(!useAI);
                  }}
                  disabled={(() => {
                    const aiCreditsRemaining = workspace?.aiCredit
                      ? workspace.aiCredit.totalCredits - workspace.aiCredit.usedCredits
                      : 0;
                    return aiCreditsRemaining <= 0;
                  })()}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useAI ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--muted)]'
                    } border border-[color:var(--border)] disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={(() => {
                    const aiCreditsRemaining = workspace?.aiCredit
                      ? workspace.aiCredit.totalCredits - workspace.aiCredit.usedCredits
                      : 0;
                    return aiCreditsRemaining <= 0 ? 'No AI credits remaining' : undefined;
                  })()}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${useAI ? 'translate-x-[22px]' : 'translate-x-1'
                    }`}></span>
                </button>
              </div>
              {workspace?.aiCredit && (
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-dashed border-[color:var(--border)]">
                  <span className="text-[color:var(--muted-foreground)]">AI credits:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {workspace.aiCredit.totalCredits >= 100000 ? 'Unlimited' : `${workspace.aiCredit.totalCredits - workspace.aiCredit.usedCredits} remaining`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <div className="flex items-center gap-2 text-[12px] text-[color:var(--muted-foreground)]">
            {lastSavedAt ? (
              <>
                <Icon name="check" className="h-3.5 w-3.5 text-emerald-500" />
                <span>Draft saved {lastSavedAt.toLocaleTimeString()}</span>
              </>
            ) : (
              <>
                <Icon name="info" className="h-3.5 w-3.5 text-amber-500" />
                <span>Once submitted, this task enters the queue. You can still edit until it's picked up.</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={isSavingDraft || (!title.trim() && !description.trim())}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] font-medium hover:bg-[color:var(--accent)] transition disabled:opacity-50"
            >
              {isSavingDraft ? (
                <>
                  <Icon name="loader" className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon name="save" className="h-4 w-4" />
                  Save draft
                </>
              )}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim() || !description.trim()}
              className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Submit task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
