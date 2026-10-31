import React from 'react';
import { 
  Users, 
  ListChecks, 
  Phone, 
  CreditCard, 
  ArrowUpRight, 
  Filter, 
  Plus, 
  ChevronRight,
  Calendar,
  LayoutDashboard,
  CircleDot,
  FileText,
  MessageCircle,
  Timer
} from 'lucide-react';
import { useStudioTasks, useStudioClients, useStudioMetrics } from '../lib/hooks';
import { features } from '../config/features';
import { adminBurnCredits } from '../lib/api';
import { toast } from 'sonner';

interface AdminDashboardProps {
  onNavigate: (route: string) => void;
}

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { data: tasks, loading: tasksLoading } = useStudioTasks();
  const { data: clients, loading: clientsLoading } = useStudioClients();
  const { data: metrics, loading: metricsLoading } = useStudioMetrics();
  const showAdvanced = features.advancedAnalytics;
  const showPods = features.pods;

  const handleBurnCredits = async () => {
    if (!confirm('Run manual day credit burn for ALL active workspaces?')) return;
    try {
      const result = await adminBurnCredits();
      toast.success(`Burned: ${result.burned}, Skipped: ${result.skipped}`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to burn credits');
    }
  };

  // Helper to normalize status
  const normalizeStatus = (status: string) => {
    return status.toLowerCase().replace(/_/g, '-');
  };

  // Calculate real metrics
  const activeTasksCount = tasks?.filter(t => normalizeStatus(t.status) === 'in-progress').length || 0;
  const reviewTasksCount = tasks?.filter(t => normalizeStatus(t.status) === 'in-review').length || 0;
  const queuedTasksCount = tasks?.filter(t => normalizeStatus(t.status) === 'queued').length || 0;
  const completedTasksCount = tasks?.filter(t => normalizeStatus(t.status) === 'completed').length || 0;
  const totalClientsCount = clients?.length || 0;
  
  // Get recent tasks (last 4)
  const recentTasks = tasks?.slice(0, 4) || [];
  
  // Get clients list (last 3)
  const recentClients = clients?.slice(0, 3) || [];

  const pods = [
    {
      name: 'Discovery',
      active: 4,
      statusDot: 'bg-emerald-500',
      progress: 55,
      progressColor: 'bg-[color:var(--chart-1)]',
      tasks: [
        { title: 'Website strategy', time: 'due today' },
        { title: 'Content audit', time: 'Thu · 10:00' }
      ]
    },
    {
      name: 'Build',
      active: 6,
      statusDot: 'bg-amber-500',
      progress: 72,
      progressColor: 'bg-[color:var(--chart-2)]',
      tasks: [
        { title: 'Component library', time: 'in review' },
        { title: 'Landing page v2', time: '+3 comments' }
      ]
    },
    {
      name: 'Care',
      active: 3,
      statusDot: 'bg-sky-500',
      progress: 44,
      progressColor: 'bg-[color:var(--chart-3)]',
      tasks: [
        { title: 'Performance review', time: 'Fri' },
        { title: 'Monthly report', time: 'next week' }
      ]
    }
  ];

  // Simple placeholder calls data for the \"Today's schedule\" card.
  // This is purely informational and does NOT affect any core flows.
  const calls = [
    {
      id: '1',
      time: '09',
      title: 'Kickoff – Atlas Systems',
      description: 'Discovery · Zoom · 60 min',
      badge: 'In 30 min',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      timeClass: 'bg-emerald-50 text-emerald-700',
    },
    {
      id: '2',
      time: '14',
      title: 'Roadmap review – Nova Labs',
      description: 'Build · Meet · 45 min',
      badge: 'Today',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
      timeClass: 'bg-[color:var(--muted)]/40',
    },
    {
      id: '3',
      time: '17',
      title: 'Retention check-in – Umbra',
      description: 'Care · Google Meet · 30 min',
      badge: 'Late afternoon',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-100',
      timeClass: 'bg-[color:var(--muted)]/40',
    },
  ];

  const podDetails = [
    {
      name: 'Discovery',
      status: 'Healthy',
      statusClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      statusDot: 'bg-emerald-500',
      description: 'Frontloaded with new calls this week.',
      load: '72%'
    },
    {
      name: 'Build',
      status: 'At risk',
      statusClass: 'bg-amber-50 text-amber-700 border-amber-100',
      statusDot: 'bg-amber-500',
      description: 'Two launches in the same window.',
      load: '88%'
    },
    {
      name: 'Care',
      status: 'Stable',
      statusClass: 'bg-sky-50 text-sky-700 border-sky-100',
      statusDot: 'bg-sky-500',
      description: 'Room for 1–2 new retainers.',
      load: '56%'
    }
  ];

  const upcomingInvoices = [
    { client: 'Nova Labs', due: 'Due in 2 days', amount: '$3.2k' },
    { client: 'Atlas Systems', due: 'Due this week', amount: '$2.1k' },
    { client: 'Umbra Media', due: 'Due next week', amount: '$3.1k' }
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPI row */}
      <section aria-label="Key metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {/* Active clients */}
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 md:p-4 flex flex-col gap-3" style={{ boxShadow: 'var(--shadow-xs)' }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Active clients</p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {clientsLoading ? '...' : totalClientsCount}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-[color:var(--accent)] flex items-center justify-center text-[color:var(--accent-foreground)]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[color:var(--muted-foreground)]">
            <span>Workspace(s)</span>
            <span>{queuedTasksCount} queued</span>
          </div>
        </div>

        {/* Active tasks */}
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 md:p-4 flex flex-col gap-3" style={{ boxShadow: 'var(--shadow-xs)' }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Active tasks</p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {tasksLoading ? '...' : activeTasksCount}
              </p>
            </div>
            <div className="h-8 w-8 rounded-full bg-[color:var(--accent)] flex items-center justify-center text-[color:var(--accent-foreground)]">
              <ListChecks className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[color:var(--muted-foreground)]">
            <span>{reviewTasksCount} in review</span>
            <span>{completedTasksCount} completed</span>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 md:p-4 flex flex-col gap-3" style={{ boxShadow: 'var(--shadow-xs)' }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Performance</p>
              <p className="mt-1 text-sm font-semibold tracking-tight">Quality & speed</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-[color:var(--accent)] flex items-center justify-center text-[color:var(--accent-foreground)]">
              <Timer className="h-4 w-4" />
            </div>
          </div>
          {metricsLoading ? (
            <div className="text-[11px] text-[color:var(--muted-foreground)]">Loading...</div>
          ) : (
            <div className="flex flex-col gap-1.5 text-[11px] text-[color:var(--muted-foreground)]">
              <div className="flex justify-between">
                <span>Avg Turnaround</span>
                <span className="text-[color:var(--foreground)] font-medium">{metrics?.averageTurnaroundHours ?? '-'}h</span>
              </div>
              <div className="flex justify-between">
                <span>First Pass Rate</span>
                <span className="text-[color:var(--foreground)] font-medium">{metrics?.firstPassAcceptanceRate ?? '-'}%</span>
              </div>
              <div className="flex justify-between">
                <span>Completed (30d)</span>
                <span className="text-[color:var(--foreground)] font-medium">{metrics?.tasksCompletedLast30Days ?? 0}</span>
              </div>
            </div>
          )}
        </div>

        {showAdvanced && (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 md:p-4 flex flex-col gap-3" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Calls this week</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">16</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-[color:var(--accent)] flex items-center justify-center text-[color:var(--accent-foreground)]">
                <Phone className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[color:var(--muted-foreground)]">
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+4 vs. avg</span>
              </span>
              <span>Next call in 2h</span>
            </div>
          </div>
        )}

        {showAdvanced && (
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 md:p-4 flex flex-col gap-3" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">MRR</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">$42.3k</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-[color:var(--accent)] flex items-center justify-center text-[color:var(--accent-foreground)]">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[color:var(--muted-foreground)]">
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>+6.3% MoM</span>
              </span>
              <span>1 invoice due</span>
            </div>
          </div>
        )}
      </section>

      {/* Main layout: left detail panel + right side panels */}
      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)] gap-4 md:gap-5">
        {/* Left: client / task overview */}
        <div className="space-y-4 md:space-y-5">
          {/* Client pipeline snapshot */}
          {showPods ? (
            <section aria-label="Client pipeline" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3.5 md:p-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
              <header className="flex items-center justify-between gap-2 mb-3 md:mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Pods & stages</p>
                  <h2 className="text-sm font-semibold tracking-tight">Studio pipeline</h2>
                </div>
                <button className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/60 px-2.5 py-1 text-[11px] hover:bg-[color:var(--accent)]/60 transition-colors">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filter</span>
                </button>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 text-[11px]">
                {pods.map((pod) => (
                  <div key={pod.name} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/70 px-3 py-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Pod</p>
                        <p className="text-xs font-semibold tracking-tight">{pod.name}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-[10px] text-[color:var(--accent-foreground)]">
                        <span className={`h-1.5 w-1.5 rounded-full ${pod.statusDot}`}></span>
                        {pod.active} active
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {pod.tasks.map((task, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2">
                          <span className="truncate">{task.title}</span>
                          <span className="text-[10px] text-[color:var(--muted-foreground)]">{task.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section aria-label="Client pipeline placeholder" className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-3.5 md:p-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
              <h2 className="text-sm font-semibold tracking-tight mb-2">studio pipeline</h2>
              <p className="text-[13px] text-[color:var(--muted-foreground)]">
                pods tracking lives in our internal ops tools and will reappear here once it’s wired to live data.
              </p>
            </section>
          )}

          {/* Tasks list */}
          <section aria-label="Task list" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border)] px-3.5 md:px-4 py-2.5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Tasks</p>
                <h2 className="text-sm font-semibold tracking-tight">Today & this week</h2>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/70 px-2.5 py-1 text-[11px] hover:bg-[color:var(--accent)]/60 transition-colors">
                  <Filter className="h-3.5 w-3.5" />
                  <span>View</span>
                </button>
                <button
                  onClick={() => onNavigate('/studio/tasks/new')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-3.5 py-1.5 text-[11px] font-medium hover:bg-[color:var(--chart-2)] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New task</span>
                </button>
              </div>
            </header>

            <div className="divide-y divide-[color:var(--border)] text-[12px]">
              {tasksLoading ? (
                <div className="px-3.5 md:px-4 py-8 text-center text-[11px] text-[color:var(--muted-foreground)]">
                  Loading tasks...
                </div>
              ) : recentTasks.length === 0 ? (
                <div className="px-3.5 md:px-4 py-8 text-center text-[11px] text-[color:var(--muted-foreground)]">
                  No tasks found
                </div>
              ) : (
                recentTasks.map((task) => {
                  const statusMap: Record<string, { color: string; label: string }> = {
                    'queued': { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Queued' },
                    'in-progress': { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'In Progress' },
                    'in-review': { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'In Review' },
                    'completed': { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Completed' },
                  };
                  const status = normalizeStatus(task.status);
                  const statusStyle = statusMap[status] || statusMap['queued'];
                  
                return (
                    <article 
                      key={task.id} 
                      onClick={() => onNavigate(`/studio/tasks/${task.id}`)}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 px-3.5 md:px-4 py-2.5 hover:bg-[color:var(--background)]/70 transition-colors cursor-pointer"
                    >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                        <label className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate">{task.title}</p>
                          <p className="text-[11px] text-[color:var(--muted-foreground)] truncate">{task.description || 'No description'}</p>
                      </label>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 text-[11px]">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[color:var(--muted-foreground)] capitalize">
                          {task.category.toLowerCase()}
                      </span>
                    </div>
                  </article>
                );
                })
              )}

              <div className="px-3.5 md:px-4 py-2 text-[11px] text-[color:var(--muted-foreground)] flex items-center justify-between">
                <span>Showing {recentTasks.length} of {tasks?.length || 0} tasks</span>
                <button 
                  onClick={() => onNavigate('/studio/tasks')}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--accent-foreground)] hover:underline"
                >
                  View all
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right: side panels */}
        <aside className="space-y-4 md:space-y-5">
          {/* Upcoming calls / calendar */}
          {showAdvanced && (
            <section aria-label="Upcoming calls" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3.5 md:p-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
              <header className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Calls</p>
                  <h2 className="text-sm font-semibold tracking-tight">Today's schedule</h2>
                </div>
                <button 
                  onClick={() => onNavigate('/studio/calendar')}
                  className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/70 px-2.5 py-1 text-[11px] hover:bg-[color:var(--accent)]/60 transition-colors"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Open calendar</span>
                </button>
              </header>

              <ol className="space-y-1.5 text-[11px]">
                {calls.map((call, idx) => (
                  <li
                    key={call.id}
                    className={`flex items-start gap-2 rounded-xl px-2.5 py-2 ${
                      idx === 0 ? 'border border-[color:var(--border)] bg-[color:var(--background)]/60' : 'hover:bg-[color:var(--background)]/60 transition-colors'
                    }`}
                  >
                    <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-medium ${call.timeClass}`}>
                      {call.time}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium truncate">{call.title}</p>
                      <p className="text-[11px] text-[color:var(--muted-foreground)] truncate">{call.description}</p>
                    </div>
                    <span className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 ${call.badgeClass}`}>{call.badge}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Clients list summary */}
          <section aria-label="Clients list" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3.5 md:p-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <header className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Clients</p>
                <h2 className="text-sm font-semibold tracking-tight">Active retainers</h2>
              </div>
              <button className="inline-flex items-center gap-1 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] px-2.5 py-1 text-[11px] hover:bg-[color:var(--chart-2)] transition-colors">
                <Plus className="h-3.5 w-3.5" />
                <span>New client</span>
              </button>
            </header>

            <div className="space-y-1.5 text-[11px]">
              {clientsLoading ? (
                <div className="text-center py-4 text-[color:var(--muted-foreground)]">Loading clients...</div>
              ) : recentClients.length === 0 ? (
                <div className="text-center py-4 text-[color:var(--muted-foreground)]">No clients found</div>
              ) : (
                recentClients.map((client, idx) => {
                  const statusColors = {
                    'ACTIVE': 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300',
                    'PAUSED': 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300',
                    'CANCELED': 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
                  };
                  const statusColor = statusColors[client.subscriptionStatus as keyof typeof statusColors] || statusColors['ACTIVE'];
                  const initials = client.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  
                  return (
                    <div
                      key={client.id}
                      onClick={() => onNavigate(`/studio/clients/${client.id}`)}
                      className={`flex items-center gap-2 rounded-xl px-2.5 py-2 cursor-pointer ${
                        idx === 0 ? 'border border-[color:var(--border)] bg-[color:var(--background)]/60' : 'hover:bg-[color:var(--background)]/60 transition-colors'
                      }`}
                    >
                      <div className="h-6 w-6 rounded-full bg-[color:var(--primary)]/10 text-[color:var(--primary)] flex items-center justify-center text-[10px] font-medium">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium truncate">{client.name}</p>
                        <p className="text-[11px] text-[color:var(--muted-foreground)] truncate">{client.planName} · {client.activeTasksCount} active</p>
                      </div>
                      <span className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 ${statusColor}`}>
                        {client.subscriptionStatus === 'ACTIVE' ? 'Active' : client.subscriptionStatus === 'PAUSED' ? 'Paused' : 'Canceled'}
                      </span>
                    </div>
                  );
                })
              )}

              <button 
                onClick={() => onNavigate('/studio/clients')}
                className="w-full mt-1.5 inline-flex items-center justify-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/70 px-2.5 py-1.5 text-[11px] hover:bg-[color:var(--accent)]/60 transition-colors"
              >
                <span>Open full CRM</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </section>

          {/* Kanban / pods quick view */}
          {showPods && (
            <section aria-label="Kanban overview" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3.5 md:p-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
              <header className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Kanban</p>
                  <h2 className="text-sm font-semibold tracking-tight">Flow by pod</h2>
                </div>
                <button 
                  onClick={() => onNavigate('/studio/kanban')}
                  className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/70 px-2.5 py-1 text-[11px] hover:bg-[color:var(--accent)]/60 transition-colors"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  <span>Open board</span>
                </button>
              </header>

              <div className="grid grid-cols-3 gap-2 text-[10px]">
                {pods.map((pod) => (
                  <div key={pod.name} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/70 px-2 py-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[11px]">{pod.name}</span>
                      <span className="text-[color:var(--muted-foreground)]">{pod.active}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[color:var(--muted)]/60 overflow-hidden">
                      <div className={`h-full ${pod.progressColor} rounded-full`} style={{ width: `${pod.progress}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>

      {/* Pods & billing strip */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-4 md:gap-5">
        {/* Pods detail */}
        {showPods ? (
          <section aria-label="Pods detail" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3.5 md:p-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <header className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Pods</p>
                <h2 className="text-sm font-semibold tracking-tight">Operator pods</h2>
              </div>
              <button 
                onClick={() => onNavigate('/studio/pods')}
                className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/70 px-2.5 py-1 text-[11px] hover:bg-[color:var(--accent)]/60 transition-colors"
              >
                <CircleDot className="h-3.5 w-3.5" />
                <span>Manage pods</span>
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
              {podDetails.map((pod) => (
                <div key={pod.name} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/70 px-3 py-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[12px]">{pod.name}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${pod.statusClass}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${pod.statusDot}`}></span>
                      {pod.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">{pod.description}</p>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">
                    Load: <span className="font-medium text-[color:var(--foreground)]">{pod.load}</span>
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section aria-label="Pods detail placeholder" className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-3.5 md:p-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <h2 className="text-sm font-semibold tracking-tight mb-2">operator pods</h2>
            <p className="text-[13px] text-[color:var(--muted-foreground)]">
              pods management is an internal-only tool right now. once it’s stable, we’ll surface it here.
            </p>
          </section>
        )}

        {/* Billing summary */}
        {showAdvanced ? (
          <section aria-label="Billing summary" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3.5 md:p-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <header className="flex items-center justify-between gap-2 mb-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Billing</p>
                <h2 className="text-sm font-semibold tracking-tight">Revenue & invoices</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleBurnCredits}
                  className="inline-flex items-center px-2 py-1 rounded-full bg-red-100 text-red-700 text-[10px] hover:bg-red-200 transition-colors"
                  title="Dev: Trigger daily credit burn"
                >
                  🔥 Burn
                </button>
                <button className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/70 px-2.5 py-1 text-[11px] hover:bg-[color:var(--accent)]/60 transition-colors">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Open billing</span>
                </button>
              </div>
            </header>

            <div className="space-y-3 text-[11px]">
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/70 px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[color:var(--muted-foreground)]">Monthly recurring</p>
                  <p className="text-[13px] font-semibold tracking-tight">$42.3k</p>
                </div>
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>+6.3% MoM</span>
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] text-[color:var(--muted-foreground)]">Open invoices</span>
                  <span className="text-[12px] font-medium">3 · $8.4k</span>
                </div>
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <ArrowUpRight className="h-3.5 w-3.5 rotate-90" />
                  <span>2 due this week</span>
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] text-[color:var(--muted-foreground)]">Upcoming invoices</p>
                <div className="space-y-1">
                  {upcomingInvoices.map((invoice) => (
                    <div key={invoice.client} className="flex items-center justify-between rounded-lg border border-[color:var(--border)] bg-[color:var(--background)]/70 px-2.5 py-1.5">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-medium">{invoice.client}</span>
                        <span className="text-[10px] text-[color:var(--muted-foreground)]">{invoice.due}</span>
                      </div>
                      <span className="text-[11px] font-semibold">{invoice.amount}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button className="w-full mt-1.5 inline-flex items-center justify-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/70 px-2.5 py-1.5 text-[11px] hover:bg-[color:var(--accent)]/60 transition-colors">
                <span>View full billing</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </section>
        ) : (
          <section aria-label="Billing summary placeholder" className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-3.5 md:p-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold tracking-tight">billing inspector</h2>
              <button 
                onClick={handleBurnCredits}
                className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] hover:bg-red-200 transition-colors"
                title="Dev: Trigger daily credit burn"
              >
                🔥 Burn
              </button>
            </div>
            <p className="text-[13px] text-[color:var(--muted-foreground)] mb-3">
              realtime billing, credits, and Stripe status are now available in the billing inspector page.
            </p>
            <button
              onClick={() => onNavigate('/studio/billing')}
              className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/70 px-3 py-1.5 text-[12px] hover:bg-[color:var(--accent)]/60 transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Open billing inspector</span>
            </button>
          </section>
        )}
      </section>
    </div>
  );
}
