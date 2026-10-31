import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../Icon';
import { useTasks } from '../../lib/hooks';
import { TaskStatus, TaskCategory } from '../../lib/types';
import { ApiError } from '../../lib/http';
import { getSocket } from '../../lib/socket';
import { LayoutList, LayoutGrid } from 'lucide-react';
import { TaskListSkeleton } from '../skeletons/TaskListSkeleton';
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
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatSlaStatus, getSlaColorClasses } from '../../lib/sla-utils';

interface ClientTasksProps {
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const brandName = task.brand?.name || 'No Brand';
  const brandShort = brandName.substring(0, 3).toUpperCase();
  const slaStatusText = formatSlaStatus(task);
  const slaColors = getSlaColorClasses(task);
  const metaBits: string[] = [];
  
  if (task.revisionNumber > 0) {
    metaBits.push(`Rev #${task.revisionNumber}`);
  }
  metaBits.push(slaStatusText);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onNavigate(`/tasks/${task.id}`)}
      className="bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-[color:var(--primary)] transition group"
    >
      <h4 className="text-[12px] text-[color:var(--foreground)] mb-2 font-medium">{task.title}</h4>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {task.brandId && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[9px] text-[color:var(--foreground)]">
            {brandShort}
          </span>
        )}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[9px] text-[color:var(--foreground)] capitalize">
          {task.category.toLowerCase()}
        </span>
        {/* Show SLA badge for in-progress or late tasks */}
        {(task.status === 'IN_PROGRESS' || task.slaIsLate) && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] ${slaColors.bg} border ${slaColors.border} ${slaColors.text}`}>
            {task.slaIsLate ? '🔥' : '⏱️'} {slaStatusText.replace('SLA ', '')}
          </span>
        )}
      </div>
      {metaBits.length > 0 && (
        <p className="text-[10px] text-[color:var(--muted-foreground)]">{metaBits.join(' · ')}</p>
      )}
    </div>
  );
};

export const ClientTasks: React.FC<ClientTasksProps> = ({ onNavigate }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem('client-tasks-view') as ViewMode) || 'list'
  );
  
  const [statusFilter, setStatusFilter] = useState<TaskStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [optimisticTasks, setOptimisticTasks] = useState<any[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const { data: tasks, loading, error, refetch } = useTasks();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleTaskUpdate = () => {
      refetch();
    };

    socket.on('task:created', handleTaskUpdate);
    socket.on('task:updated', handleTaskUpdate);

    return () => {
      socket.off('task:created', handleTaskUpdate);
      socket.off('task:updated', handleTaskUpdate);
    };
  }, [refetch]);

  // Use optimistic tasks if available, otherwise use real tasks
  const displayTasks = optimisticTasks || tasks;

  // Sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredTasks = useMemo(() => {
    if (!displayTasks) return [];
    return displayTasks.filter(task => {
      if (statusFilter.length > 0 && !statusFilter.includes(task.status)) return false;
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [displayTasks, statusFilter, searchQuery]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over || !displayTasks) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Derive target status: either a column id (status) or the status of the task we dropped onto
    const allowedStatuses: TaskStatus[] = ['QUEUED', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'PAUSED'];
    let newStatus: TaskStatus | null = null;

    if (allowedStatuses.includes(overId as TaskStatus)) {
      newStatus = overId as TaskStatus;
    } else {
      const overTask = displayTasks.find(t => t.id === overId);
      if (overTask) {
        newStatus = overTask.status as TaskStatus;
      }
    }

    if (!newStatus) return;
    
    const task = displayTasks.find(t => t.id === taskId);
    if (!task) return;

    const currentStatus = task.status as TaskStatus;
    if (currentStatus === newStatus) return;

    // Business rules: client-only transition via board = IN_REVIEW → COMPLETED
    if (!(currentStatus === 'IN_REVIEW' && newStatus === 'COMPLETED')) {
      alert('You can only move tasks from In Review to Completed here. Studio moves tasks into progress and review.');
      return;
    }

    // Optimistic update
    const updatedTasks = displayTasks.map(t =>
      t.id === taskId ? { ...t, status: newStatus } : t
    );
    setOptimisticTasks(updatedTasks);

    // API call
    try {
      const { apiFetch } = await import('../../lib/http');
      
      // Use the complete task endpoint
      await apiFetch(`/tasks/${taskId}/complete`, {
        method: 'POST',
      });

      setOptimisticTasks(null);
      refetch();
    } catch (error) {
      console.error('Failed to update task:', error);
      setOptimisticTasks(null);
      if (error instanceof ApiError && (error.body as any)?.error === 'ActiveTaskLimitReached') {
        alert('You have reached your active task limit. Complete or pause another task before moving more work into progress.');
      } else {
        alert(error instanceof ApiError ? error.message : 'Failed to update task status');
      }
    }
  };

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
    localStorage.setItem('client-tasks-view', mode);
  };

  if (loading) {
    return <TaskListSkeleton />;
  }

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="mb-1">
            <span className="text-[12px] text-[color:var(--muted-foreground)] tracking-[1.92px] uppercase">Tasks</span>
          </div>
          <h1 className="text-[20px] font-semibold text-[color:var(--foreground)]">Your tasks</h1>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2 bg-[color:var(--accent)] rounded-lg p-1">
          <button
            onClick={() => handleViewChange('list')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-[12px] font-medium transition ${
              viewMode === 'list'
                ? 'bg-[color:var(--background)] text-[color:var(--foreground)] shadow-sm'
                : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
            }`}
          >
            <LayoutList className="h-4 w-4" />
            List
          </button>
          <button
            onClick={() => handleViewChange('kanban')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-[12px] font-medium transition ${
              viewMode === 'kanban'
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

          {/* Clear filters */}
          {(statusFilter.length > 0 || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter([]);
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
                  <th className="text-left px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">Brand</th>
                  <th className="text-left px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">Category</th>
                  <th className="text-left px-4 py-3 text-[11px] text-[color:var(--muted-foreground)] font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center">
                      <div className="text-[13px] text-[color:var(--muted-foreground)]">
                        {tasks && tasks.length === 0 ? 'No tasks found' : 'No tasks match your filters'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, index) => {
                    const brandName = task.brand?.name || 'No Brand';
                    const brandShort = brandName.substring(0, 3).toUpperCase();
                    const statusStyle = statusConfig[task.status];
                    
                    return (
                      <tr
                        key={task.id}
                        onClick={() => onNavigate(`/tasks/${task.id}`)}
                        className={`cursor-pointer hover:bg-[color:var(--accent)] transition ${
                          index !== filteredTasks.length - 1 ? 'border-b border-[color:var(--border)]' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-[11px] text-[color:var(--foreground)]">{task.title}</div>
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

                  <SortableContext items={columnTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <DroppableColumn id={column.id}>
                      {columnTasks.length === 0 ? (
                        <div className="text-center py-8">
                          <Icon name="inbox" className="h-8 w-8 text-[color:var(--muted)] mx-auto mb-2" />
                          <p className="text-[11px] text-[color:var(--muted-foreground)]">Drop tasks here</p>
                        </div>
                      ) : (
                        columnTasks.map(task => (
                          <DraggableTaskCard key={task.id} task={task} onNavigate={onNavigate} />
                        ))
                      )}
                    </DroppableColumn>
                  </SortableContext>
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
