import React, { useState } from 'react';
import { Icon } from '../Icon';
import { useTasks } from '../../lib/hooks';
import { TaskStatus, Task } from '../../lib/types';
import { setNewTaskPrefill } from '../../lib/new-task-prefill';
import { deleteTask } from '../../lib/api';

interface TasksListProps {
  onNavigate: (route: string) => void;
}

export const TasksList: React.FC<TasksListProps> = ({ onNavigate }) => {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Fetch tasks with optional status filter
  const { data: tasks, loading, error, refetch } = useTasks(
    { 
      status: filterStatus !== 'all' ? filterStatus : undefined,
      sort: sortOrder
    }
  );

  const getStatusBadge = (status: TaskStatus) => {
    const badges = {
      'QUEUED': 'bg-[color:var(--muted)] text-[color:var(--foreground)] border-[color:var(--border)]',
      'IN_PROGRESS': 'bg-[color:var(--primary)]/10 text-[color:var(--primary)] border-[color:var(--primary)]/60',
      'IN_REVIEW': 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300',
      'COMPLETED': 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300',
      'PAUSED': 'bg-red-100 text-red-900 border-red-300 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
    };
    const labels = {
      'QUEUED': 'Queued',
      'IN_PROGRESS': 'In progress',
      'IN_REVIEW': 'In review',
      'COMPLETED': 'Completed',
      'PAUSED': 'Paused',
    };
    return { className: badges[status], label: labels[status] };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const calculateHoursLeft = (task: Task): number => {
    if (task.status !== 'IN_PROGRESS' || !task.inProgressAt) return 0;
    const slaHours = task.slaSeconds / 3600;
    const elapsed = (Date.now() - new Date(task.inProgressAt).getTime()) / 1000 / 3600;
    return Math.max(0, Math.round(slaHours - elapsed));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Tasks</p>
          <h2 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">All work</h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="hidden sm:inline-flex items-center px-4 py-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[13px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition" onClick={() => onNavigate('/kanban')}>
            Open kanban
          </button>
          <button className="inline-flex items-center px-4 py-1.5 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition" onClick={() => onNavigate('/tasks/new')}>
            New task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Tabs */}
        <div className="inline-flex items-center rounded-full bg-[color:var(--accent)] border border-[color:var(--border)] p-1 text-[12px]">
          {(['all', 'QUEUED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-full ${
                filterStatus === status
                  ? 'bg-[color:var(--card)] font-medium text-[color:var(--foreground)] shadow-sm'
                  : 'text-[color:var(--muted-foreground)] hover:bg-[color:var(--card)]/60'
              }`}
            >
              {status === 'all' ? 'All' : status === 'IN_PROGRESS' ? 'In progress' : status === 'IN_REVIEW' ? 'In review' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[180px] max-w-xs">
          <div className="flex items-center h-8 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-[13px] text-[color:var(--muted-foreground)]">
            <Icon name="search" className="h-3.5 w-3.5 mr-2 text-[color:var(--muted-foreground)]" />
            <input type="text" placeholder="Search tasks…" className="flex-1 bg-transparent outline-none text-[13px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)]" />
          </div>
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]">
            <Icon name="filter" className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
            Brand: Any
          </button>
          <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]">
            Category: All
          </button>
          <button 
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]"
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
          >
            <Icon name="arrow-up-down" className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
            Sort: {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-8 text-center">
          <p className="text-[13px] text-[color:var(--muted-foreground)]">Loading tasks...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm p-8 text-center">
          <p className="text-[13px] text-red-600 dark:text-red-400 mb-2">Failed to load tasks</p>
          <p className="text-[12px] text-[color:var(--muted-foreground)] mb-4">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-4 py-2 rounded-full bg-[color:var(--primary)] text-[color:var(--primary-foreground)] text-[13px] font-medium hover:opacity-90 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && tasks && (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[minmax(220px,2.2fr)_minmax(120px,1.3fr)_minmax(100px,1fr)_minmax(120px,1.1fr)_minmax(100px,1fr)_minmax(110px,1fr)_minmax(120px,1.1fr)] gap-4 px-4 py-2 border-b border-[color:var(--border)] bg-[color:var(--accent)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
            <span>Title</span>
            <span>Brand</span>
            <span>Category</span>
            <span>Status</span>
            <span>Created</span>
            <span>Due / ETA</span>
            <span className="flex items-center gap-1 justify-end">
              <Icon name="message-circle" className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
              <span>Comments</span>
            </span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[color:var(--border)] text-[13px]">
            {tasks.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-[13px] text-[color:var(--muted-foreground)]">No tasks found</p>
              </div>
            ) : (
              tasks.map(task => {
                const statusBadge = getStatusBadge(task.status);
                const slaHours = task.slaSeconds / 3600;
                const hoursLeft = calculateHoursLeft(task);
                const commentCount = task._count?.comments || task.comments?.length || 0;

                return (
                  <div
                    key={task.id}
                    onClick={() => onNavigate(`/tasks/${task.id}`)}
                    className="w-full px-3 md:px-4 py-3 hover:bg-[color:var(--accent)] transition flex flex-col gap-2 md:grid md:grid-cols-[minmax(220px,2.2fr)_minmax(120px,1.3fr)_minmax(100px,1fr)_minmax(120px,1.1fr)_minmax(100px,1fr)_minmax(110px,1fr)_minmax(120px,1.1fr)] md:items-center md:gap-4 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-[color:var(--foreground)] truncate">{task.title}</p>
                        <p className="md:hidden text-[12px] text-[color:var(--muted-foreground)]">{task.brand?.name || 'No brand'} · {task.category === 'DESIGN' ? 'Design' : 'Motion'}</p>
                      </div>
                      <Icon name="chevron-right" className="h-3 w-3 text-[color:var(--muted-foreground)] md:hidden" />
                    </div>
                    <div className="hidden md:flex items-center">
                      <span className="px-2.5 py-1 rounded-full bg-[color:var(--accent)] border border-[color:var(--border)] text-[color:var(--foreground)] text-[12px]">{task.brand?.name || 'No brand'}</span>
                    </div>
                    <div className="hidden md:flex items-center">
                      <span className="px-2.5 py-1 rounded-full bg-[color:var(--primary)]/10 border border-[color:var(--primary)]/60 text-[color:var(--primary)] text-[12px]">{task.category === 'DESIGN' ? 'Design' : 'Motion'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center h-6 px-3 rounded-full border text-[11px] ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                      {task.aiEligible === false && (
                        <span className="inline-flex items-center h-6 px-3 rounded-full border text-[11px] bg-red-100 text-red-900 border-red-300 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
                          Scope Rejected
                        </span>
                      )}
                      {task.status === 'IN_PROGRESS' && (
                        <span className={`hidden md:inline-flex items-center h-6 px-2 rounded-full border text-[11px] ${
                          hoursLeft < 6 ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300' : 'bg-[color:var(--accent)] border-[color:var(--border)] text-[color:var(--muted-foreground)]'
                        }`}>
                          {Math.round(slaHours)}h · {hoursLeft}h left
                        </span>
                      )}
                    </div>
                    <div className="hidden md:block text-[color:var(--muted-foreground)] text-[12px]">{formatDate(task.createdAt)}</div>
                    <div className="hidden md:block text-[color:var(--muted-foreground)] text-[12px]">
                      {task.completedAt ? formatDate(task.completedAt) : formatDate(task.createdAt)}
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-2">
                      <div className="inline-flex items-center gap-1 text-[12px] text-[color:var(--muted-foreground)]">
                        <Icon name="message-circle" className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
                        <span>{commentCount}</span>
                      </div>
                      <div className="hidden md:flex items-center gap-1 text-[12px]">
                        <button className="text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]" onClick={(e) => { e.stopPropagation(); onNavigate(`/tasks/${task.id}`); }}>View</button>
                        <span className="text-[color:var(--muted-foreground)]">·</span>
                        <button
                          className="text-[color:var(--muted-foreground)] hover:text-[color:var(--primary)]"
                          onClick={(e) => {
                            e.stopPropagation();
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
                          }}
                        >
                          Duplicate
                        </button>
                        {task.status === 'QUEUED' && (
                          <>
                            <span className="text-[color:var(--muted-foreground)]">·</span>
                            <button 
                              className="text-red-700 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300" 
                              onClick={async (e) => { 
                                e.stopPropagation();
                                if (!confirm('Are you sure you want to delete this task?')) return;
                                try {
                                  await deleteTask(task.id);
                                  refetch();
                                } catch(err) {
                                  alert('Failed to delete task');
                                }
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
