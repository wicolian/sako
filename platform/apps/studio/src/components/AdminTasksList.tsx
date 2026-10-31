import React, { useState, useMemo } from 'react';
import { Icon } from './Icon';
import { useStudioTasks } from '../lib/hooks';
import { TaskStatus, TaskCategory } from '../lib/types';

interface AdminTasksListProps {
  onNavigate: (route: string) => void;
}

export const AdminTasksList: React.FC<AdminTasksListProps> = ({ onNavigate }) => {
  const [statusFilter, setStatusFilter] = useState<TaskStatus[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real tasks from API
  const { data: tasks, loading, error } = useStudioTasks();

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks.filter(task => {
    if (statusFilter.length > 0 && !statusFilter.includes(task.status)) return false;
    if (categoryFilter.length > 0 && !categoryFilter.includes(task.category)) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });
  }, [tasks, statusFilter, categoryFilter, searchQuery]);

  // Helper to normalize status from API (UPPERCASE) to frontend (lowercase-with-hyphens)
  const normalizeStatus = (status: string): TaskStatus => {
    return status.toLowerCase().replace(/_/g, '-') as TaskStatus;
  };

  const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
    'queued': { color: 'bg-[color:var(--muted)] border-[color:var(--border)] text-[color:var(--foreground)]', label: 'Queued' },
    'in-progress': { color: 'bg-[color:var(--primary)]/10 border-[color:var(--primary)]/60 text-[color:var(--primary)]', label: 'In Progress' },
    'in-review': { color: 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300', label: 'In Review' },
    'completed': { color: 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300', label: 'Completed' },
    'paused': { color: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300', label: 'Paused' },
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-[13px] text-[color:var(--muted-foreground)]">Loading tasks...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-[13px] text-red-500">Failed to load tasks: {error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1">
          <span className="text-[12px] text-[color:var(--muted-foreground)] tracking-[1.92px] uppercase">Tasks</span>
        </div>
        <h1 className="text-[20px] font-semibold text-[color:var(--foreground)]">All studio tasks</h1>
      </div>

      {/* Filters */}
      <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[240px]">
            <div className="relative">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--muted-foreground)]" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-[color:var(--accent)] border border-[color:var(--border)] rounded-lg text-[13px] text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-[color:var(--ring)] placeholder:text-[color:var(--muted-foreground)]"
              />
            </div>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[color:var(--muted-foreground)]">Status:</span>
            <div className="flex gap-1">
              {(['queued', 'in-progress', 'in-review', 'completed'] as TaskStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(prev =>
                      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] transition ${
                    statusFilter.includes(status)
                      ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                      : 'bg-[color:var(--accent)] border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/80'
                  }`}
                >
                  {statusConfig[status].label}
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[color:var(--muted-foreground)]">Category:</span>
            <div className="flex gap-1">
              {(['design', 'motion'] as TaskCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategoryFilter(prev =>
                      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] capitalize transition ${
                    categoryFilter.includes(cat)
                      ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                      : 'bg-[color:var(--accent)] border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Clear filters */}
          {(statusFilter.length > 0 || categoryFilter.length > 0 || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter([]);
                setCategoryFilter([]);
                setSearchQuery('');
              }}
              className="px-3 py-1 rounded-full bg-[color:var(--accent)] border border-[color:var(--border)] text-[11px] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/80 transition"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Tasks table */}
      <div className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[color:var(--border)]">
                <th className="text-left px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">Task</th>
                <th className="text-left px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">Client</th>
                <th className="text-left px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">Brand</th>
                <th className="text-left px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">Category</th>
                <th className="text-left px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">Status</th>
                <th className="text-left px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">Revision</th>
                <th className="text-left px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">Assignee</th>
                <th className="text-right px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">SLA</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="text-[13px] text-[color:var(--muted-foreground)]">
                      {tasks && tasks.length === 0 ? 'No tasks found' : 'No tasks match your filters'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task, index) => {
                  // Get brand from task's brand object if it exists
                  const brandName = task.brand?.name || 'No Brand';
                  const brandShort = brandName.substring(0, 3).toUpperCase();
                  
                  // Get workspace name from task's workspace object if it exists
                  const workspaceName = task.workspace?.name || 'Unknown Client';
                  
                  // Normalize status for display
                  const normalizedStatus = normalizeStatus(task.status);
                  const statusStyle = statusConfig[normalizedStatus];
                
                return (
                  <tr
                    key={task.id}
                    onClick={() => onNavigate(`/studio/tasks/${task.id}`)}
                    className={`cursor-pointer hover:bg-[color:var(--accent)] transition ${
                      index !== filteredTasks.length - 1 ? 'border-b border-[color:var(--border)]' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="text-[11px] text-[color:var(--foreground)]">{task.title}</div>
                    </td>
                    <td className="px-4 py-3">
                        <div className="text-[11px] text-[color:var(--foreground)]">{workspaceName}</div>
                    </td>
                    <td className="px-4 py-3">
                        {task.brandId && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[10px] text-[color:var(--foreground)]">
                            {brandShort}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[10px] text-[color:var(--foreground)] capitalize">
                          {task.category.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] ${statusStyle.color}`}>
                          {statusStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                        {task.revisionNumber !== undefined && task.revisionNumber > 0 && (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400">Rev {task.revisionNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-[#9ae83e] flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-[#1a1a1a]">SK</span>
                        </div>
                        <span className="text-[11px] text-[color:var(--foreground)]">Sako</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                        <span className="text-[10px] text-[color:var(--muted-foreground)]">—</span>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-[color:var(--border)] px-4 py-3 flex items-center justify-between">
          <span className="text-[10px] text-[color:var(--muted-foreground)]">
            Showing {filteredTasks.length} of {tasks?.length || 0} tasks
          </span>
        </div>
      </div>
    </div>
  );
};
