import React from 'react';
import { Icon } from '../Icon';
import { useDashboard } from '../../lib/hooks';
import { useWorkspaceContext } from '../../lib/WorkspaceProvider';
import { getPlanDisplayName } from '../../config/plans';
import { STRATEGY_CALL_URL } from '../../lib/config';
import { analytics } from '../../lib/analytics';
import { deleteTaskDraft, DashboardTask, DashboardDraft } from '../../lib/api';
import { DashboardSkeleton } from '../skeletons/DashboardSkeleton';
import { OpenComposerButton } from './OpenComposerButton';

interface DashboardProps {
  onNavigate: (route: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  // Use aggregate dashboard endpoint for all data in one call
  const { data: dashboardData, loading: dashboardLoading, error: dashboardError, refetch: refetchDashboard } = useDashboard();
  const { permissions, currentRole, workspace } = useWorkspaceContext();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [localDrafts, setLocalDrafts] = React.useState<DashboardDraft[] | null>(null);
  // Optimistic subscription status to fix UI delay after pause/resume
  const [optimisticSubscriptionStatus, setOptimisticSubscriptionStatus] = React.useState<string | null>(null);

  // Sync drafts from dashboard data to local state for optimistic updates
  React.useEffect(() => {
    if (dashboardData?.drafts) {
      setLocalDrafts(dashboardData.drafts);
    }
  }, [dashboardData?.drafts]);

  // Clear optimistic status when dashboard data updates (refetch completed)
  React.useEffect(() => {
    if (dashboardData?.subscription?.status) {
      setOptimisticSubscriptionStatus(null);
    }
  }, [dashboardData?.subscription?.status]);

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm('Delete this draft?')) return;
    try {
      await deleteTaskDraft(draftId);
      setLocalDrafts(prev => prev?.filter(d => d.id !== draftId) || []);
    } catch (error) {
      alert('Failed to delete draft: ' + (error as Error).message);
    }
  };

  // Use local drafts state for optimistic updates, fall back to dashboard data
  const drafts = localDrafts ?? dashboardData?.drafts ?? [];

  const handlePauseAccess = async () => {
    if (!confirm('Pause your subscription? Day credit burn stops. Resume anytime.')) return;

    setIsProcessing(true);
    try {
      const { pauseSubscription } = await import('../../lib/api');
      await pauseSubscription({ reason: 'User requested pause from dashboard' });
      // Set optimistic status immediately so button updates before refetch completes
      setOptimisticSubscriptionStatus('PAUSED');
      refetchDashboard();
    } catch (error) {
      alert('Failed: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const subscriptionStatus = dashboardData?.subscription?.status;
  const isCancelAtPeriodEnd = subscriptionStatus === 'CANCEL_AT_PERIOD_END';

  const handleCancelPlan = async () => {
    if (!confirm('Cancel subscription? Active until billing period ends.')) return;

    setIsProcessing(true);
    try {
      const { cancelSubscription } = await import('../../lib/api');
      await cancelSubscription({ reason: 'User canceled from dashboard' });
      alert('Subscription canceled');
      refetchDashboard();
    } catch (error) {
      alert('Failed: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResumeAccess = async () => {
    if (!confirm('Resume subscription? Day credit burn restarts.')) return;

    setIsProcessing(true);
    try {
      const { resumeSubscription } = await import('../../lib/api');
      await resumeSubscription({ note: 'User resumed from dashboard' });
      // Set optimistic status immediately so button updates before refetch completes
      setOptimisticSubscriptionStatus('ACTIVE');
      refetchDashboard();
    } catch (error) {
      alert('Failed: ' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter tasks by status from aggregate data
  const tasks = dashboardData?.tasks || [];
  const activeTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
  const reviewTasks = tasks.filter(t => t.status === 'IN_REVIEW');

  // Get metrics and credit forecast from aggregate data
  const metrics = dashboardData?.metrics;
  const creditForecast = dashboardData?.creditForecast;

  // Show loading state with skeleton for better perceived performance
  if (dashboardLoading) {
    return <DashboardSkeleton />;
  }

  // Show error state
  if (dashboardError) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <header className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Client</p>
          <h2 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">Dashboard</h2>
        </header>
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
          <p className="text-[13px] text-red-600 dark:text-red-400 mb-2">Failed to load dashboard</p>
          <p className="text-[12px] text-[color:var(--muted-foreground)]">
            {dashboardError?.message}
          </p>
        </div>
      </div>
    );
  }

  if (!dashboardData || !workspace) return null;

  // Get current day credit from aggregate data
  const currentDayCredit = dashboardData.currentDayCredit;
  const subscription = dashboardData.subscription;

  // Transform workspace data for display
  const displayWorkspace = {
    plan: getPlanDisplayName(workspace),
    dayCredits: currentDayCredit ? currentDayCredit.total - currentDayCredit.used : 0,
    dayCreditsTotal: currentDayCredit?.total || 0,
    aiCredits: dashboardData.credits?.aiCredits?.[0] 
      ? dashboardData.credits.aiCredits[0].total - dashboardData.credits.aiCredits[0].used 
      : 0,
    aiCreditsTotal: dashboardData.credits?.aiCredits?.[0]?.total || 0,
    activeSlots: dashboardData.derived?.activeTaskLimit || 0,
    billingPeriodStart: currentDayCredit?.periodStart
      ? new Date(currentDayCredit.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : subscription?.billingPeriodStart
        ? new Date(subscription.billingPeriodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'N/A',
    billingPeriodEnd: currentDayCredit?.periodEnd
      ? new Date(currentDayCredit.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : subscription?.billingPeriodEnd
        ? new Date(subscription.billingPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'N/A',
  };
  const slaHours = Math.round((dashboardData.derived?.effectiveSlaSeconds ?? 172800) / 3600);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Client</p>
          <h2 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">Dashboard</h2>
        </div>
        <OpenComposerButton variant="outline" size="sm" />
      </header>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Subscription + day credits */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 md:p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-1">Subscription</p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] ${subscription?.status === 'ACTIVE'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300'
                    : subscription?.status === 'PAUSED'
                      ? 'bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300'
                      : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
                    }`}>
                    {subscription?.status || 'Unknown'}
                  </span>
                  <span className="text-[12px] text-[color:var(--muted-foreground)]">{displayWorkspace.plan} · Monthly</span>
                </div>
              </div>
              {subscription?.status === 'PAUSED' ? (
                <div className="text-right text-[12px] text-amber-700 dark:text-amber-400">
                  <p className="font-medium">Payment collection paused</p>
                  <p className="text-[11px]">Resume anytime to continue.</p>
                </div>
              ) : (
              <div className="text-right text-[12px] text-[color:var(--muted-foreground)]">
                <p>Billing period:</p>
                <p className="font-medium text-[color:var(--foreground)]">{displayWorkspace.billingPeriodStart} – {displayWorkspace.billingPeriodEnd}</p>
              </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4 items-center">
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] tracking-tight font-semibold text-[color:var(--foreground)]">{displayWorkspace.dayCredits}</span>
                  <span className="text-[13px] text-[color:var(--muted-foreground)]">/ {displayWorkspace.dayCreditsTotal} day credits</span>
                </div>
                <div className="h-2.5 rounded-full bg-[color:var(--accent)] overflow-hidden">
                  <div className="h-full rounded-full bg-[color:var(--primary)]" style={{ width: `${displayWorkspace.dayCreditsTotal > 0 ? (displayWorkspace.dayCredits / displayWorkspace.dayCreditsTotal) * 100 : 0}%` }}></div>
                </div>
                <p className="text-[12px] text-[color:var(--muted-foreground)]">
                  {displayWorkspace.activeSlots} active slot{displayWorkspace.activeSlots === 1 ? '' : 's'} · {slaHours}-hour SLA per slot.
                </p>
              </div>
              <div className="space-y-1 text-[13px] text-[color:var(--muted-foreground)]">
                {creditForecast?.forecast ? (
                  <>
                    <p className="flex items-center gap-1">
                      <Icon name="trending-up" className="h-3.5 w-3.5" />
                      1 credit/day while active
                    </p>
                    <p className="flex items-center gap-1">
                      <Icon name="calendar" className="h-3.5 w-3.5" />
                      {creditForecast.forecast.willLastUntilPeriodEnd ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ✓ {creditForecast.forecast.projectedUnusedAtPeriodEnd} credits may rollover
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          ⚠ May run out in {creditForecast.forecast.daysRemaining} days
                        </span>
                      )}
                    </p>
                    <p>• Pausing stops credit burn.</p>
                  </>
                ) : (
                  <>
                    <p>• 1 credit burns per active day.</p>
                    <p>• Pausing stops burning.</p>
                    <p>• Unused credits may roll over.</p>
                  </>
                )}
              </div>
            </div>

            {/* Subscription controls - Only visible to owners */}
            {permissions.canPauseSubscription ? (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dashed border-[color:var(--border)]">
                {/* Use optimistic status for immediate UI feedback after pause/resume */}
                {(optimisticSubscriptionStatus ?? subscription?.status) === 'PAUSED' ? (
                  <button
                    onClick={handleResumeAccess}
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-emerald-500 text-white text-[13px] font-medium shadow-sm hover:opacity-90 hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Processing...' : 'Resume access'}
                  </button>
                ) : (
                  <button
                    onClick={handlePauseAccess}
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium shadow-sm hover:opacity-90 hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? 'Processing...' : 'Pause access'}
                  </button>
                )}
                {subscription?.status !== 'CANCELED' && (
                  <button
                    onClick={async () => {
                      if (isCancelAtPeriodEnd) {
                        if (!confirm('Keep your subscription and continue automatic renewals?')) return;
                        setIsProcessing(true);
                        try {
                          const { uncancelSubscription } = await import('../../lib/api');
                          await uncancelSubscription({ note: 'User kept subscription from dashboard' });
                          alert('Subscription will continue renewing.');
                          refetchDashboard();
                        } catch (error) {
                          alert('Failed: ' + (error as Error).message);
                        } finally {
                          setIsProcessing(false);
                        }
                      } else {
                        await handleCancelPlan();
                      }
                    }}
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full text-[13px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] border border-transparent hover:border-[color:var(--border)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing
                      ? 'Processing...'
                      : isCancelAtPeriodEnd
                        ? "Don't cancel"
                        : 'Cancel plan'}
                  </button>
                )}
                <span className="text-[12px] text-[color:var(--muted-foreground)] ml-auto">
                  Manage billing from Settings → Billing.
                </span>
              </div>
            ) : (
              <div className="pt-2 border-t border-dashed border-[color:var(--border)]">
                <p className="text-[12px] text-[color:var(--muted-foreground)]">
                  {currentRole === 'VIEWER' ? 'View-only access' : 'Contact workspace owner to manage subscription.'}
                </p>
              </div>
            )}
          </div>

          {/* Composer AI - simplified display */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 md:p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] mb-1">Composer AI</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-[18px] tracking-tight font-semibold text-[color:var(--foreground)]">Included with your plan</span>
                </div>
              </div>
              <div className="text-right text-[12px] text-[color:var(--muted-foreground)]">
                <p>Unlimited access.</p>
                {subscription?.status !== 'PAUSED' && subscription?.billingPeriodEnd && (
                <p>Renews on <span className="font-medium text-[color:var(--foreground)]">
                    {new Date(new Date(subscription.billingPeriodEnd).getTime() + 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span></p>
                )}
              </div>
            </div>
            <p className="text-[12px] text-[color:var(--muted-foreground)]">
              AI drafts and structuring are available through Composer. Use the Composer link in the navigation to open the AI design tool.
            </p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Active tasks */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Work in flight</p>
                <h3 className="text-[16px] tracking-tight font-semibold text-[color:var(--foreground)]">Active tasks</h3>
              </div>
              <span className="text-[12px] text-[color:var(--muted-foreground)]">{activeTasks.length} in progress</span>
            </div>
            <div className="space-y-2">
              {activeTasks.length === 0 ? (
                <p className="text-[12px] text-[color:var(--muted-foreground)] text-center py-4">No active tasks</p>
              ) : (
                activeTasks.map(task => (
                  <TaskCard key={task.id} task={task} onNavigate={onNavigate} statusBadge="In progress" />
                ))
              )}
            </div>
          </div>

          {/* In review */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Review queue</p>
                <h3 className="text-[16px] tracking-tight font-semibold text-[color:var(--foreground)]">Awaiting your review</h3>
              </div>
              <span className="text-[12px] text-[color:var(--muted-foreground)]">{reviewTasks.length} task{reviewTasks.length !== 1 ? 's' : ''}</span>
            </div>
            {reviewTasks.length === 0 ? (
              <p className="text-[12px] text-[color:var(--muted-foreground)] text-center py-4">No tasks in review</p>
            ) : (
              reviewTasks.map(task => (
                <TaskCardReview key={task.id} task={task} onNavigate={onNavigate} />
              ))
            )}
          </div>

          {/* Saved Drafts */}
          {drafts.length > 0 && (
            <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Incomplete</p>
                  <h3 className="text-[16px] tracking-tight font-semibold text-[color:var(--foreground)]">Saved drafts</h3>
                </div>
                <span className="text-[12px] text-[color:var(--muted-foreground)]">{drafts.length} draft{drafts.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-2">
                {drafts.slice(0, 5).map(draft => (
                  <div
                    key={draft.id}
                    className="p-3 rounded-xl bg-[color:var(--accent)] hover:bg-[color:var(--accent)]/80 transition cursor-pointer group"
                    onClick={() => onNavigate(`/tasks/new?draftId=${draft.id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[color:var(--foreground)] truncate">
                          {draft.title || 'Untitled draft'}
                        </p>
                        <p className="text-[11px] text-[color:var(--muted-foreground)] mt-0.5">
                          {draft.category} · Last edited {new Date(draft.lastEditedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDraft(draft.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
                        title="Delete draft"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
                {drafts.length > 5 && (
                  <p className="text-[11px] text-center text-[color:var(--muted-foreground)]">
                    +{drafts.length - 5} more draft{drafts.length - 5 !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Quality & Speed Metrics */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Performance</p>
                <h3 className="text-[16px] tracking-tight font-semibold text-[color:var(--foreground)]">Quality & speed</h3>
              </div>
            </div>
            {!metrics || metrics.tasksCompletedLast30Days === 0 ? (
              <p className="text-[12px] text-[color:var(--muted-foreground)] text-center py-4">
                Not enough data yet. Complete a few tasks to see metrics.
              </p>
            ) : (
              <div className="space-y-3 text-[12px]">
                {metrics.averageTurnaroundHours !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted-foreground)]">Avg turnaround (30d)</span>
                    <span className="font-medium text-[color:var(--foreground)]">{metrics.averageTurnaroundHours}h</span>
                  </div>
                )}
                {metrics.firstPassAcceptanceRate !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--muted-foreground)]">First pass acceptance</span>
                    <span className="font-medium text-[color:var(--foreground)]">{metrics.firstPassAcceptanceRate}%</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[color:var(--muted-foreground)]">Tasks completed (30d)</span>
                  <span className="font-medium text-[color:var(--foreground)]">{metrics.tasksCompletedLast30Days}</span>
                </div>
              </div>
            )}
          </div>

          {/* Strategy Call - Available to all plans */}
          {STRATEGY_CALL_URL && (
            <div className="bg-gradient-to-br from-violet-500/10 to-purple-600/10 dark:from-violet-500/20 dark:to-purple-600/20 rounded-2xl border border-violet-200 dark:border-violet-700/50 shadow-sm p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Icon name="calendar" className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">Available</p>
                  <h3 className="text-[14px] tracking-tight font-semibold text-[color:var(--foreground)]">Strategy Planning</h3>
                </div>
              </div>
              <p className="text-[12px] text-[color:var(--muted-foreground)]">
                Book a call with our design strategy team to plan upcoming campaigns, review brand direction, or discuss long-term design roadmaps.
              </p>
              <a
                href={STRATEGY_CALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => analytics.featureUsed('strategy_call_booked')}
                className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[13px] font-medium shadow-sm hover:opacity-90 hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 transition-all"
              >
                <Icon name="calendar" className="h-4 w-4" />
                Book Strategy Call
              </a>
            </div>
          )}

          {/* Upcoming calls - static for now */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Schedule</p>
                <h3 className="text-[16px] tracking-tight font-semibold text-[color:var(--foreground)]">Upcoming calls</h3>
              </div>
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[12px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition" onClick={() => onNavigate('/calendar')}>
                <Icon name="calendar" className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
                View full calendar
              </button>
            </div>
            <div className="text-[12px] text-[color:var(--muted-foreground)] text-center py-4">
              No upcoming calls scheduled
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper component for active task cards
const TaskCard: React.FC<{ task: DashboardTask; onNavigate: (route: string) => void; statusBadge: string }> = ({ task, onNavigate, statusBadge }) => {
  const metaBits: string[] = [];

  if (task.revisionNumber > 0) {
    metaBits.push(`Rev #${task.revisionNumber}`);
  }

  return (
    <article
      className="rounded-xl border border-border bg-card px-3 py-2.5 flex flex-col gap-1 cursor-pointer transition-colors hover:bg-accent dark:hover:bg-accent/50"
      onClick={() => onNavigate(`/tasks/${task.id}`)}
    >
      <p className="text-[13px] font-medium text-foreground truncate">
        {task.title}
      </p>

      <p className="text-[12px] text-muted-foreground">
        {task.brand?.name || 'No brand'} · {task.category === 'DESIGN' ? 'Design' : 'Motion'}
      </p>

      {metaBits.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {metaBits.join(' · ')}
        </p>
      )}

      <div className="flex items-center justify-between mt-1">
        <p className="text-[11px] text-foreground/80">
          Ready for feedback
        </p>

        <button
          className="inline-flex items-center px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[12px] font-medium hover:opacity-90 transition"
        >
          Review now
        </button>
      </div>
    </article>
  );
};

// Helper component for review task cards
const TaskCardReview: React.FC<{ task: DashboardTask; onNavigate: (route: string) => void }> = ({ task, onNavigate }) => {
  const metaBits: string[] = [];

  if (task.revisionNumber > 0) {
    metaBits.push(`Rev #${task.revisionNumber}`);
  }

  // Show SLA status for review tasks
  if (task.slaIsLate) {
    metaBits.push('Late');
  } else if (task.slaRemainingSeconds !== null && task.slaRemainingSeconds < 3600) {
    metaBits.push('< 1h left');
  }

  return (
    <article
      className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-3 py-2.5 flex flex-col gap-1 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"
      onClick={() => onNavigate(`/tasks/${task.id}`)}
    >
      <p className="text-[13px] font-medium text-amber-900 dark:text-amber-100 truncate">
        {task.title}
      </p>

      <p className="text-[12px] text-amber-900 dark:text-amber-200">
        {task.brand?.name || 'No brand'} · {task.category === 'DESIGN' ? 'Design' : 'Motion'}
      </p>

      {metaBits.length > 0 && (
        <p className="text-[10px] text-amber-900 dark:text-amber-300">
          {metaBits.join(' · ')}
        </p>
      )}

      <div className="flex items-center justify-between mt-1">
        <p className="text-[11px] text-amber-900 dark:text-amber-300">
          Ready for feedback
        </p>
      </div>
    </article>
  );
};
