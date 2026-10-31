import React, { useState, useMemo } from 'react';
import { Icon } from './Icon';
import { useStudioTasks } from '../lib/hooks';
import { TaskStatus, TaskCategory } from '../lib/types';
import { ApiError } from '../lib/http';
import { LayoutList, LayoutGrid } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDroppable,
  useDraggable,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';

interface AdminTasksProps {
  onNavigate: (route: string) => void;
}

type ViewMode = 'list' | 'kanban';

// Droppable Column Component
interface DroppableColumnProps {
  id: TaskStatus;
  children: React.ReactNode;
}

const DroppableColumn: React.FC<DroppableColumnProps> = ({ id, children }) => {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className="flex-1 space-y-3 overflow-y-auto min-h-[200px]">{children}</div>;
};

// Draggable Task Card Component
interface DraggableTaskCardProps {
  task: any;
  onNavigate: (route: string) => void;
}

const DraggableTaskCard: React.FC<DraggableTaskCardProps> = ({ task, onNavigate }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style: React.CSSProperties = transform
    ? {
      transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      opacity: isDragging ? 0.5 : 1,
      zIndex: 10,
    }
    : {
      opacity: isDragging ? 0.5 : 1,
    };

  const brandName = task.brand?.name || 'No Brand';
  const brandShort = brandName.substring(0, 3).toUpperCase();
  const workspaceName = task.workspace?.name || 'Unknown Client';
  const workspaceInitials = workspaceName.slice(0, 2).toUpperCase();
  const slaHours = task.displaySlaHours ?? (task.slaSeconds ? Math.round(task.slaSeconds / 3600) : null);
  const metaBits: string[] = [];
  if (task.revisionNumber > 0) {
    metaBits.push(`Rev #${task.revisionNumber}`);
  }
  if (slaHours != null) {
    metaBits.push(`SLA ${slaHours}h`);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onNavigate(`/studio/tasks/${task.id}`)}
      className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-[color:var(--primary)] transition group"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-5 w-5 rounded-full bg-[color:var(--primary)] flex items-center justify-center">
          <span className="text-[9px] font-semibold text-[color:var(--primary-foreground)]">
            {workspaceInitials}
          </span>
        </div>
        <span className="text-[10px] text-[color:var(--muted-foreground)]">{workspaceName}</span>
      </div>

      <h4 className="text-[12px] text-[color:var(--foreground)] mb-2 font-medium">{task.title}</h4>

      <div className="flex flex-wrap gap-1.5">
        {task.brandId && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[9px] text-[color:var(--foreground)]">
            {brandShort}
          </span>
        )}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[9px] text-[color:var(--foreground)] capitalize">
          {task.category.toLowerCase()}
        </span>
      </div>
      {metaBits.length > 0 && (
        <p className="mt-2 text-[10px] text-[color:var(--muted-foreground)]">{metaBits.join(' · ')}</p>
      )}
    </div>
  );
};

export const AdminTasks: React.FC<AdminTasksProps> = ({ onNavigate }) => {
  // Load view preference from localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('studio-tasks-view') as ViewMode) || 'list'
  );

  const [statusFilter, setStatusFilter] = useState<TaskStatus[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [optimisticTasks, setOptimisticTasks] = useState<any[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: tasks, loading, error, refetch } = useStudioTasks();

  // Use optimistic tasks if available, otherwise use real tasks
  const displayTasks = optimisticTasks || tasks;

  // Sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Drag starts after 8px movement
      },
    })
  );

  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (!displayTasks) return [];
    return displayTasks.filter(task => {
      if (statusFilter.length > 0 && !statusFilter.includes(task.status)) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(task.category)) return false;
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [displayTasks, statusFilter, categoryFilter, searchQuery]);

  const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
    'QUEUED': { color: 'bg-[color:var(--muted)] border-[color:var(--border)] text-[color:var(--foreground)]', label: 'Queued' },
    'IN_PROGRESS': { color: 'bg-[color:var(--primary)]/10 border-[color:var(--primary)]/60 text-[color:var(--primary)]', label: 'In Progress' },
    'IN_REVIEW': { color: 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300', label: 'In Review' },
    'COMPLETED': { color: 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300', label: 'Completed' },
    'PAUSED': { color: 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300', label: 'Paused' },
  };

  const columns: { id: TaskStatus; label: string; color: string }[] = [
    { id: 'QUEUED', label: 'Queued', color: 'border-[color:var(--muted)]' },
    { id: 'IN_PROGRESS', label: 'In Progress', color: 'border-[color:var(--primary)]' },
    { id: 'IN_REVIEW', label: 'In Review', color: 'border-amber-500' },
    { id: 'COMPLETED', label: 'Completed', color: 'border-emerald-500' },
  ];

  const getTasksByStatus = (status: TaskStatus) => {
    return filteredTasks.filter(t => t.status === status);
  };

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.5',
        },
      },
    }),
  };

  const renderActiveTaskCard = (taskId: string) => {
    const task = displayTasks?.find(t => t.id === taskId);
    if (!task) return null;
    return <DraggableTaskCard task={task} onNavigate={onNavigate} />;
  };

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('studio-tasks-view', mode);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
  };

  // Handle drag end - update task status
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over || !displayTasks) {
      return;
    }

    const taskId = active.id as string;
    const overId = over.id as string;

    // Derive target status: either a column id (status) or the status of the task we dropped onto
    const allowedStatuses: TaskStatus[] = ['QUEUED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'PAUSED'];
    let newStatus: TaskStatus | null = null;

    if (allowedStatuses.includes(overId as TaskStatus)) {
      // Dropped into an empty part of a column: over.id is the column's status
      newStatus = overId as TaskStatus;
    } else {
      // Dropped onto another task card: use that task's status (its column)
      const overTask = displayTasks.find(t => t.id === overId);
      if (overTask) {
        newStatus = overTask.status as TaskStatus;
      }
    }

    if (!newStatus) {
      return;
    }

    // Find the dragged task
    const task = displayTasks.find(t => t.id === taskId);
    if (!task) {
      return;
    }

    const currentStatus = task.status as TaskStatus;

    if (currentStatus === newStatus) {
      return; // No change
    }

    // Optimistic update
    const updatedTasks = displayTasks.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    );
    setOptimisticTasks(updatedTasks);

    // API call
    try {
      const { apiFetch } = await import('../lib/http');

      // Business rules: studio-only transitions
      // We prioritize the specific endpoints which enforce business logic (limits, etc.)
      const workspaceId = task.workspace?.id || task.workspaceId;
      if (!workspaceId) {
        alert('Missing workspace context for this task. Please open the client detail to retry.');
        setOptimisticTasks(null);
        return;
      }
      if (currentStatus === 'QUEUED' && newStatus === 'IN_PROGRESS') {
        // QUEUED → IN_PROGRESS
        await apiFetch(`/admin/tasks/${taskId}/start`, {
          method: 'POST',
          workspaceIdOverride: workspaceId,
        });
      } else if (currentStatus === 'IN_PROGRESS' && newStatus === 'IN_REVIEW') {
        // IN_PROGRESS → IN_REVIEW
        await apiFetch(`/admin/tasks/${taskId}/review`, {
          method: 'POST',
          workspaceIdOverride: workspaceId,
        });
      } else {
        // Fallback to generic PATCH for other allowed transitions (e.g. PAUSED <-> IN_PROGRESS, or internal rework)
        // The backend will validate if it's allowed for STUDIO.
        const payload = { status: newStatus };
        await apiFetch(`/admin/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
          workspaceIdOverride: workspaceId,
        });
      }

      setOptimisticTasks(null);
      refetch();
    } catch (error) {
      console.error(`Failed to update task from ${currentStatus} to ${newStatus}:`, error);
      setOptimisticTasks(null);

      // Show specific error messages
      if (error instanceof ApiError) {
        const errorBody = error.body as any;
        if (errorBody?.error === 'ActiveTaskLimitReached') {
          alert('Active task limit reached for this workspace. Complete or pause an active task before starting another.');
        } else if (errorBody?.message?.includes('transition') || errorBody?.message?.includes('Invalid')) {
          alert(`Cannot move task from ${currentStatus} to ${newStatus}. ${errorBody?.message || 'This transition is not allowed.'}`);
        } else {
          alert(`Failed to update task: ${error.message}`);
        }
      } else if (error instanceof Error) {
        alert(`Failed to update task: ${error.message}`);
      } else {
        alert('Failed to update task status. Please try again.');
      }

      // Refetch to ensure UI is in sync with backend
      refetch();
    }
  };

  // Loading/Error states
  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-[13px] text-[color:var(--muted-foreground)]">Loading tasks...</div>
        </div>
      </div>
    );
  }

  if (error) {
    const apiError = error as any;

    if (apiError.status === 403) {
      if (apiError.message === 'Not authorized for SAKO Studio') {
        return (
          <div className="max-w-[1600px] mx-auto px-6 py-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-[13px] text-red-500">Use your internal @trysako.com email.</div>
            </div>
          </div>
        );
      }

      const isPending = apiError?.body?.code === 'PENDING_ADMIN' || apiError.message?.includes('pending approval');
      if (isPending) {
        return (
          <div className="max-w-[1600px] mx-auto px-6 py-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-[13px] text-amber-500">Your studio access is pending approval.</div>
            </div>
          </div>
        );
      }
    }

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="mb-1">
            <span className="text-[12px] text-[color:var(--muted-foreground)] tracking-[1.92px] uppercase">Tasks</span>
          </div>
          <h1 className="text-[20px] font-semibold text-[color:var(--foreground)]">All studio tasks</h1>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2 bg-[color:var(--accent)] rounded-lg p-1">
          <button
            onClick={() => handleViewChange('list')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-[12px] font-medium transition ${viewMode === 'list'
                ? 'bg-[color:var(--background)] text-[color:var(--foreground)] shadow-sm'
                : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
              }`}
          >
            <LayoutList className="h-4 w-4" />
            List
          </button>
          <button
            onClick={() => handleViewChange('kanban')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-[12px] font-medium transition ${viewMode === 'kanban'
                ? 'bg-[color:var(--background)] text-[color:var(--foreground)] shadow-sm'
                : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
              }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </button>
        </div>
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
              {(['QUEUED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'] as TaskStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(prev =>
                      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                    );
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] transition ${statusFilter.includes(status)
                      ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                      : 'bg-[color:var(--accent)] border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)]/80'
                    }`}
                >
                  {statusConfig[status].label}
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

      {/* Content - List or Kanban */}
      {viewMode === 'list' ? (
        /* LIST VIEW */
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
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <div className="text-[13px] text-[color:var(--muted-foreground)]">
                        {tasks && tasks.length === 0 ? 'No tasks found' : 'No tasks match your filters'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, index) => {
                    const brandName = task.brand?.name || 'No Brand';
                    const brandShort = brandName.substring(0, 3).toUpperCase();
                    const workspaceName = task.workspace?.name || 'Unknown Client';
                    const statusStyle = statusConfig[task.status];

                    return (
                      <tr
                        key={task.id}
                        onClick={() => onNavigate(`/studio/tasks/${task.id}`)}
                        className={`cursor-pointer hover:bg-[color:var(--accent)] transition ${index !== filteredTasks.length - 1 ? 'border-b border-[color:var(--border)]' : ''
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[color:var(--border)] px-4 py-3 flex items-center justify-between">
            <span className="text-[10px] text-[color:var(--muted-foreground)]">
              Showing {filteredTasks.length} of {tasks?.length || 0} tasks
            </span>
          </div>
        </div>
      ) : (
        /* KANBAN VIEW WITH DRAG-AND-DROP */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map(column => {
              const columnTasks = getTasksByStatus(column.id);

              return (
                <div key={column.id} className="flex flex-col w-[320px] flex-shrink-0">
                  <div className={`flex items-center justify-between mb-3 pb-3 border-b-2 ${column.color}`}>
                    <h3 className="text-[13px] font-medium text-[color:var(--foreground)]">{column.label}</h3>
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[color:var(--accent)] text-[10px] text-[color:var(--foreground)]">
                      {columnTasks.length}
                    </span>
                  </div>

                  <DroppableColumn id={column.id}>
                    {columnTasks.length === 0 ? (
                      <div className="text-center py-8">
                        <Icon name="layout" className="h-8 w-8 text-[color:var(--muted)] mx-auto mb-2" />
                        <p className="text-[11px] text-[color:var(--muted-foreground)]">Drop tasks here</p>
                      </div>
                    ) : (
                      columnTasks.map(task => (
                        <DraggableTaskCard key={task.id} task={task} onNavigate={onNavigate} />
                      ))
                    )}
                  </DroppableColumn>
                </div>
              );
            })}
          </div>
          <DragOverlay dropAnimation={dropAnimation}>
            {activeId ? renderActiveTaskCard(activeId) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};
