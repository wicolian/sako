import React from 'react';
import { Icon } from '../Icon';
import { useTasks } from '../../lib/hooks';
import { TaskStatus, Task } from '../../lib/types';
import { formatSlaStatus, getSlaColorClasses } from '../../lib/sla-utils';

interface KanbanBoardProps {
  onNavigate: (route: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ onNavigate }) => {
  const { data: tasks, loading, error } = useTasks();

  const columns: { status: TaskStatus; label: string; dotColor: string }[] = [
    { status: 'QUEUED', label: 'Queued', dotColor: 'bg-[color:var(--muted)]' },
    { status: 'IN_PROGRESS', label: 'In progress', dotColor: 'bg-[color:var(--primary)]' },
    { status: 'IN_REVIEW', label: 'In review', dotColor: 'bg-amber-400' },
    { status: 'COMPLETED', label: 'Completed', dotColor: 'bg-emerald-400' },
  ];

  const getCardBorder = (status: TaskStatus) => {
    const borders = {
      'QUEUED': 'border-[color:var(--border)]',
      'IN_PROGRESS': 'border-[color:var(--border)]',
      'IN_REVIEW': 'border-amber-300 dark:border-amber-700',
      'COMPLETED': 'border-emerald-200 dark:border-emerald-700',
      'PAUSED': 'border-red-200 dark:border-red-700',
    };
    return borders[status];
  };

  const getCardBg = (status: TaskStatus) => {
    const backgrounds = {
      'QUEUED': 'bg-[color:var(--card)]',
      'IN_PROGRESS': 'bg-[color:var(--card)]',
      'IN_REVIEW': 'bg-amber-50 dark:bg-amber-900/20',
      'COMPLETED': 'bg-emerald-50 dark:bg-emerald-900/20',
      'PAUSED': 'bg-red-50 dark:bg-red-900/20',
    };
    return backgrounds[status];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Tasks</p>
          <h2 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">Kanban</h2>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-[color:var(--muted-foreground)] hidden sm:inline">Read-only view. Click a task to manage status.</span>
          <button className="inline-flex items-center px-4 py-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition" onClick={() => onNavigate('/tasks')}>
            Back to list
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
          <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading kanban...</p>
        </div>
      )}

      {error && (
        <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-8 text-center">
          <p className="text-[13px] text-red-600 dark:text-red-400">Failed to load tasks: {error.message}</p>
        </div>
      )}

      {!loading && !error && tasks && (
        <div className="grid md:grid-cols-4 gap-4 text-[13px]">
          {columns.map(column => {
            const columnTasks = tasks.filter(t => t.status === column.status);

            return (
              <div key={column.status} className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${column.dotColor}`}></span>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">{column.label}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[color:var(--accent)] border border-[color:var(--border)] text-[color:var(--muted-foreground)]">{columnTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {columnTasks.length === 0 ? (
                    <p className="text-[12px] text-[color:var(--muted-foreground)] text-center py-4">No tasks</p>
                  ) : (
                    columnTasks.map(task => (
                      <TaskCard key={task.id} task={task} status={column.status} onNavigate={onNavigate} getCardBorder={getCardBorder} getCardBg={getCardBg} formatDate={formatDate} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TaskCard: React.FC<{
  task: Task;
  status: TaskStatus;
  onNavigate: (route: string) => void;
  getCardBorder: (status: TaskStatus) => string;
  getCardBg: (status: TaskStatus) => string;
  formatDate: (dateStr: string) => string;
}> = ({ task, status, onNavigate, getCardBorder, getCardBg, formatDate }) => {
  const commentCount = task._count?.comments || task.comments?.length || 0;
  const slaStatusText = formatSlaStatus(task);
  const slaColors = getSlaColorClasses(task);
  const metaBits: string[] = [];
  
  if (task.revisionNumber > 0) {
    metaBits.push(`Rev #${task.revisionNumber}`);
  }

  return (
    <article
      onClick={() => onNavigate(`/tasks/${task.id}`)}
      className={`group rounded-xl border px-2.5 py-2 flex flex-col gap-1 cursor-pointer hover:shadow-md transition ${getCardBorder(status)} ${getCardBg(status)}`}
    >
      <div className="flex items-start gap-1.5">
        <Icon name="more-vertical" className={`h-4 w-4 mt-0.5 ${status === 'IN_REVIEW' ? 'text-amber-500' : status === 'COMPLETED' ? 'text-emerald-500' : 'text-[color:var(--muted-foreground)]'}`} />
        <div className="flex-1">
          <p className="font-medium text-[13px] text-[color:var(--foreground)] truncate">{task.title}</p>
          <div className="flex flex-wrap gap-1 text-[11px] mt-0.5">
            <span className="px-2 py-0.5 rounded-full bg-[color:var(--accent)] border border-[color:var(--border)] text-[color:var(--foreground)]">{task.brand?.name || 'No brand'}</span>
            <span className="px-2 py-0.5 rounded-full bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/60 text-[color:var(--primary)]">{task.category === 'DESIGN' ? 'Design' : 'Motion'}</span>
            {status === 'IN_REVIEW' && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300">Awaiting client</span>
            )}
            {status === 'COMPLETED' && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300">Completed</span>
            )}
          </div>
          {metaBits.length > 0 && (
            <p className="text-[10px] text-[color:var(--muted-foreground)] mt-1">
              {metaBits.join(' · ')}
            </p>
          )}
          {/* Show SLA status for in-progress tasks */}
          {(status === 'IN_PROGRESS' || task.slaIsLate) && (
            <div className={`mt-1 px-2 py-0.5 rounded-full text-[10px] inline-flex items-center gap-1 ${slaColors.bg} border ${slaColors.border} ${slaColors.text}`}>
              <span>{slaStatusText}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className={`text-[11px] ${status === 'IN_REVIEW' ? 'text-amber-900 dark:text-amber-200' : status === 'COMPLETED' ? 'text-emerald-900 dark:text-emerald-200' : 'text-[color:var(--muted-foreground)]'}`}>
          {formatDate(task.createdAt)}
        </span>
        <div className={`inline-flex items-center gap-1 text-[11px] ${status === 'IN_REVIEW' || status === 'COMPLETED' ? 'text-[color:var(--foreground)]' : 'text-[color:var(--muted-foreground)]'}`}>
          <Icon name="message-circle" className="h-3 w-3" />
          <span>{commentCount}</span>
        </div>
      </div>
    </article>
  );
};
