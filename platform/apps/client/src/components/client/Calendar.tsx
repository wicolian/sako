import React, { useState } from 'react';
import { Icon } from '../Icon';
import { useTasks, useWorkspace } from '../../lib/hooks';
import { STRATEGY_CALL_URL } from '../../lib/config';
import { Task } from '../../lib/types';

interface CalendarProps {
  onNavigate: (route: string) => void;
}

type ViewMode = 'calendar' | 'timeline' | 'capacity';

export const Calendar: React.FC<CalendarProps> = ({ onNavigate }) => {
  const { data: tasks, loading } = useTasks();
  const { data: workspace } = useWorkspace();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  // Calendar logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Group tasks by date (created)
  const tasksByDate: Record<string, any[]> = {};
  if (tasks) {
    tasks.forEach(task => {
      const date = new Date(task.createdAt);
      const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      if (!tasksByDate[dateKey]) {
        tasksByDate[dateKey] = [];
      }
      tasksByDate[dateKey].push(task);
    });
  }

  // Calculate SLA deadline for a task
  const getSlaDeadline = (task: Task) => {
    if (!task.inProgressAt) return null;
    const slaSeconds = task.slaSeconds || workspace?.effectiveSlaSeconds || 172800;
    return new Date(new Date(task.inProgressAt).getTime() + slaSeconds * 1000);
  };

  // Get active tasks with SLA deadlines
  const activeTasks = tasks?.filter(t => t.status === 'IN_PROGRESS') || [];
  const tasksWithDeadlines = activeTasks.map(t => ({
    ...t,
    slaDeadline: getSlaDeadline(t),
  })).sort((a, b) => {
    if (!a.slaDeadline) return 1;
    if (!b.slaDeadline) return -1;
    return a.slaDeadline.getTime() - b.slaDeadline.getTime();
  });

  // Build calendar grid
  const calendarDays = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Schedule & Capacity</p>
          <h2 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">Calendar</h2>
          <p className="text-[12px] text-[color:var(--muted-foreground)] mt-1">Track task activity, SLA deadlines, and capacity planning.</p>
        </div>
        <div className="flex items-center gap-3">
          {STRATEGY_CALL_URL && (
            <a
              href={STRATEGY_CALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] text-[13px] font-medium hover:bg-[color:var(--accent)] transition"
            >
              <Icon name="calendar" className="h-4 w-4" />
              Book a call
            </a>
          )}
          <button
            className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition"
            onClick={() => onNavigate('/tasks/new')}
          >
            + New task
          </button>
        </div>
      </header>

      {/* View Mode Switcher */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-3 py-1.5 rounded-full text-[12px] transition ${
            viewMode === 'calendar'
              ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
              : 'bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]'
          }`}
        >
          Calendar
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-3 py-1.5 rounded-full text-[12px] transition ${
            viewMode === 'timeline'
              ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
              : 'bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]'
          }`}
        >
          SLA Timeline
        </button>
        <button
          onClick={() => setViewMode('capacity')}
          className={`px-3 py-1.5 rounded-full text-[12px] transition ${
            viewMode === 'capacity'
              ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
              : 'bg-[color:var(--card)] border border-[color:var(--border)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]'
          }`}
        >
          Capacity
        </button>
      </div>

      {loading ? (
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
          <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading...</p>
        </div>
      ) : viewMode === 'timeline' ? (
        /* SLA Timeline View */
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[color:var(--border)]">
            <h3 className="text-[18px] font-semibold text-[color:var(--foreground)]">SLA Timeline</h3>
            <p className="text-[12px] text-[color:var(--muted-foreground)]">Active tasks sorted by deadline</p>
          </div>
          <div className="p-4 space-y-3">
            {tasksWithDeadlines.length === 0 ? (
              <p className="text-[13px] text-[color:var(--muted-foreground)] text-center py-8">No active tasks with SLA deadlines</p>
            ) : (
              tasksWithDeadlines.map(task => {
                const now = new Date();
                const deadline = task.slaDeadline;
                const hoursRemaining = deadline ? Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)) : null;
                const isOverdue = hoursRemaining !== null && hoursRemaining <= 0;
                const isUrgent = hoursRemaining !== null && hoursRemaining <= 12;
                const progress = deadline && task.inProgressAt
                  ? Math.min(100, ((now.getTime() - new Date(task.inProgressAt).getTime()) / (deadline.getTime() - new Date(task.inProgressAt).getTime())) * 100)
                  : 0;

                return (
                  <div
                    key={task.id}
                    onClick={() => onNavigate(`/tasks/${task.id}`)}
                    className={`p-4 rounded-xl border cursor-pointer transition hover:shadow-sm ${
                      isOverdue
                        ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700'
                        : isUrgent
                        ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700'
                        : 'border-[color:var(--border)] bg-[color:var(--accent)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-medium text-[color:var(--foreground)]">{task.title}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                        isOverdue
                          ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                          : isUrgent
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100'
                      }`}>
                        {isOverdue ? 'Overdue' : isUrgent ? 'Urgent' : 'On track'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-[color:var(--muted-foreground)] mb-2">
                      <span>{task.brand?.name || 'No brand'}</span>
                      <span>•</span>
                      <span>Due: {deadline?.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      {hoursRemaining !== null && (
                        <>
                          <span>•</span>
                          <span className={isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : ''}>
                            {isOverdue ? 'Overdue' : `${Math.floor(hoursRemaining)}h remaining`}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="h-1.5 rounded-full bg-[color:var(--border)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOverdue ? 'bg-red-500' : isUrgent ? 'bg-amber-500' : 'bg-[color:var(--primary)]'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : viewMode === 'capacity' ? (
        /* Capacity View */
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[color:var(--border)]">
            <h3 className="text-[18px] font-semibold text-[color:var(--foreground)]">Capacity Planning</h3>
            <p className="text-[12px] text-[color:var(--muted-foreground)]">Current utilization and slot availability</p>
          </div>
          <div className="p-4">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Active Slots</p>
                <p className="text-[28px] font-semibold text-[color:var(--foreground)]">
                  {activeTasks.length} / {workspace?.effectiveActiveTaskLimit || 1}
                </p>
                <p className="text-[12px] text-[color:var(--muted-foreground)]">Tasks in progress</p>
              </div>
              <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Queued</p>
                <p className="text-[28px] font-semibold text-[color:var(--foreground)]">
                  {tasks?.filter(t => t.status === 'QUEUED').length || 0}
                </p>
                <p className="text-[12px] text-[color:var(--muted-foreground)]">Waiting to start</p>
              </div>
              <div className="p-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">In Review</p>
                <p className="text-[28px] font-semibold text-[color:var(--foreground)]">
                  {tasks?.filter(t => t.status === 'IN_REVIEW').length || 0}
                </p>
                <p className="text-[12px] text-[color:var(--muted-foreground)]">Awaiting your feedback</p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Utilization</p>
              <div className="h-4 rounded-full bg-[color:var(--border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[color:var(--primary)] transition-all"
                  style={{ width: `${Math.min(100, (activeTasks.length / (workspace?.effectiveActiveTaskLimit || 1)) * 100)}%` }}
                />
              </div>
              <p className="text-[12px] text-[color:var(--muted-foreground)]">
                {workspace?.effectiveActiveTaskLimit && activeTasks.length < workspace.effectiveActiveTaskLimit
                  ? `${workspace.effectiveActiveTaskLimit - activeTasks.length} slot${workspace.effectiveActiveTaskLimit - activeTasks.length === 1 ? '' : 's'} available`
                  : 'All slots in use'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm overflow-hidden">
          {/* Calendar header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
            <h3 className="text-[18px] font-semibold text-[color:var(--foreground)]">
              {monthNames[month]} {year}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={previousMonth}
                className="h-8 w-8 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] flex items-center justify-center hover:bg-[color:var(--accent)] transition"
              >
                <Icon name="chevron-right" className="h-4 w-4 rotate-180 text-[color:var(--foreground)]" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[12px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="h-8 w-8 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] flex items-center justify-center hover:bg-[color:var(--accent)] transition"
              >
                <Icon name="chevron-right" className="h-4 w-4 text-[color:var(--foreground)]" />
              </button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="p-4">
            {/* Day names */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-center text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="aspect-square"></div>;
                }

                const dateKey = `${year}-${month + 1}-${day}`;
                const dayTasks = tasksByDate[dateKey] || [];
                const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

                return (
                  <div
                    key={day}
                    className={`aspect-square rounded-xl border p-2 flex flex-col gap-1 ${
                      isToday
                        ? 'border-[color:var(--primary)] bg-[color:var(--primary)]/5'
                        : 'border-[color:var(--border)] bg-[color:var(--accent)]'
                    } hover:border-[color:var(--primary)]/40 transition cursor-pointer`}
                  >
                    <div className={`text-[13px] font-medium ${
                      isToday ? 'text-[color:var(--primary)]' : 'text-[color:var(--foreground)]'
                    }`}>
                      {day}
                    </div>
                    {dayTasks.length > 0 && (
                      <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                        {dayTasks.slice(0, 2).map(task => (
                          <div
                            key={task.id}
                            onClick={() => onNavigate(`/tasks/${task.id}`)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--primary)]/10 text-[color:var(--primary)] truncate hover:bg-[color:var(--primary)]/20"
                          >
                            {task.title}
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <div className="text-[10px] text-[color:var(--muted-foreground)]">
                            +{dayTasks.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent activity */}
      {tasks && tasks.length > 0 && (
        <div className="mt-6 bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-5">
          <h3 className="text-[16px] font-semibold text-[color:var(--foreground)] mb-4">Latest created tasks</h3>
          <div className="space-y-2">
            {tasks.slice(0, 5).map(task => (
              <div
                key={task.id}
                onClick={() => onNavigate(`/tasks/${task.id}`)}
                className="flex items-center justify-between p-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--accent)] hover:bg-[color:var(--accent)]/60 cursor-pointer transition"
              >
                <div>
                  <p className="text-[13px] font-medium text-[color:var(--foreground)]">{task.title}</p>
                  <p className="text-[12px] text-[color:var(--muted-foreground)]">
                    {task.brand?.name || 'No brand'} · {task.category === 'DESIGN' ? 'Design' : 'Motion'}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] ${
                  task.status === 'IN_REVIEW'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300'
                    : task.status === 'IN_PROGRESS'
                    ? 'bg-[color:var(--primary)]/10 text-[color:var(--primary)] border border-[color:var(--primary)]/60'
                    : 'bg-[color:var(--muted)] text-[color:var(--foreground)] border border-[color:var(--border)]'
                }`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
