import React, { useState } from 'react';
import { 
  DndContext, 
  DragEndEvent, 
  useDraggable, 
  useDroppable, 
  DragOverlay, 
  closestCorners, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { Icon } from './Icon';
import { useStudioTasks } from '../lib/hooks';
import { TaskStatus, Task } from '../lib/types';
import { adminMoveToReview, adminStartTask } from '../lib/api';

interface AdminKanbanProps {
  onNavigate: (route: string) => void;
}

// Draggable Task Component
const DraggableTask = ({ task, onClick, isOverlay = false }: { task: Task, onClick?: () => void, isOverlay?: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isOverlay // Disable dragging if this is the overlay
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 999,
  } : undefined;

  const brandName = task.brand?.name || 'No Brand';
  const brandShort = brandName.substring(0, 3).toUpperCase();
  const workspaceName = task.workspace?.name || 'Unknown Client';
  const workspaceInitials = workspaceName.slice(0, 2).toUpperCase();

  const content = (
    <div
      className={`bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl p-3 hover:border-[color:var(--primary)] transition group ${isDragging ? 'opacity-30' : ''} ${isOverlay ? 'shadow-xl cursor-grabbing' : 'cursor-grab'}`}
      onClick={onClick}
    >
      {/* Client name */}
      <div className="flex items-center gap-2 mb-2">
        <div className="h-5 w-5 rounded-full bg-[color:var(--primary)] flex items-center justify-center">
          <span className="text-[9px] font-semibold text-[color:var(--primary-foreground)]">
        <div className="flex items-center gap-2 mb-2">
        <div className="h-5 w-5 rounded-full bg-[color:var(--primary)] flex items-center justify-center">
          <span className="text-[9px] font-semibold text-[color:var(--primary-foreground)]">
            {workspaceInitials}
          </span>
        </div>
        <span className="text-[10px] text-[color:var(--muted-foreground)]">{workspaceName}</span>
      </div>

      {/* Task title */}
      <h4 className="text-[12px] text-[color:var(--foreground)] mb-2 font-medium">{task.title}</h4>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {task.brandId && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[9px] text-[color:var(--foreground)]">
            {brandShort}
          </span>
        )}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[9px] text-[color:var(--foreground)] capitalize">
          {task.category.toLowerCase()}
        </span>
        {task.priority === 'high' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-[9px] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            High
          </span>
        )}
        {task.priority === 'rush' && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-[9px] text-red-700 dark:bg-red-900/30 dark:text-red-300">
            Rush
          </span>
        )}
        {task.revisionNumber !== undefined && task.revisionNumber > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-[9px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            Rev {task.revisionNumber}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[color:var(--border)]">
        {/* Assignee */}
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-full bg-[color:var(--primary)] flex items-center justify-center">
            <span className="text-[9px] font-semibold text-[color:var(--primary-foreground)]">SK</span>
          </div>
          <span className="text-[10px] text-[color:var(--muted-foreground)]">Sako</span>
        </div>

        {/* SLA indicator - simplified since we don't have hoursLeft from API */}
        {task.status === 'in-progress' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--accent)] text-[9px] text-[color:var(--foreground)]">
            <Icon name="clock" className="h-3 w-3" />
            Active
          </span>
        )}

        {task.status === 'in-review' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-[9px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Icon name="eye" className="h-3 w-3" />
            Review
          </span>
        )}
      </div>
    </div>
  );

  if (isOverlay) {
    return content;
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {content}
    </div>
  );
};

// Droppable Column Component
const DroppableColumn = ({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div 
      ref={setNodeRef} 
      className={`${className} ${isOver ? 'bg-[color:var(--accent)]/30 ring-2 ring-[color:var(--primary)] ring-inset rounded-lg' : ''} transition-colors duration-200`}
    >
      {children}
    </div>
  );
};

export const AdminKanban: React.FC<AdminKanbanProps> = ({ onNavigate }) => {
  const { data: tasks, loading, error, refetch } = useStudioTasks();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Sensors for Drag and Drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Helper to normalize status from API (UPPERCASE) to frontend (lowercase-with-hyphens)
  const normalizeStatus = (status: string): TaskStatus => {
    return status.toLowerCase().replace(/_/g, '-') as TaskStatus;
  };

  // We use lowercase IDs for columns and normalize task.status from API to match.
  const columns: { id: string; label: string; color: string }[] = [
    { id: 'queued', label: 'Queued', color: 'border-[color:var(--muted)]' },
    { id: 'in-progress', label: 'In Progress', color: 'border-[color:var(--primary)]' },
    { id: 'in-review', label: 'In Review', color: 'border-amber-500' },
    { id: 'completed', label: 'Completed', color: 'border-emerald-500' },
  ];

  const getTasksByStatus = (status: string) => {
    return tasks?.filter(t => normalizeStatus(t.status) === status) || [];
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks?.find(t => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const task = tasks?.find(t => t.id === taskId);
    const newStatus = over.id as string;

    if (!task) return;
    
    const currentStatus = normalizeStatus(task.status);

    if (currentStatus === newStatus) {
      // Dropped back in same column – no-op
      return;
    }

    // Admin can drag QUEUED -> IN_PROGRESS
    if (currentStatus === 'queued' && newStatus === 'in-progress') {
      try {
        await adminStartTask(taskId, task.workspace?.id || task.workspaceId);
        toast.success('Task started');
        refetch();
      } catch (err: any) {
        console.error('Failed to start task', err);
        toast.error(err?.message || 'Failed to start task');
      }
      return;
    }

    // Admin can drag IN_PROGRESS -> IN_REVIEW
    if (currentStatus === 'in-progress' && newStatus === 'in-review') {
      try {
        await adminMoveToReview(taskId, task.workspace?.id || task.workspaceId);
        toast.success('Task moved to review');
        refetch(); // Refresh list
      } catch (err: any) {
        console.error('Failed to move task', err);
        toast.error(err?.message || 'Failed to move task');
      }
      return;
    }

    // For now, other transitions are not supported via drag & drop
    toast.info(`Drag from ${currentStatus.replace('-', ' ')} to ${newStatus.replace('-', ' ')} isn’t supported here. Use the task detail actions instead.`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[13px] text-[color:var(--muted-foreground)]">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[13px] text-red-500">Failed to load tasks: {error.message}</div>
      </div>
    );
  }

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-6 border-b border-[color:var(--border)]">
          <div className="mb-1">
            <span className="text-[12px] text-[color:var(--muted-foreground)] tracking-[1.92px] uppercase">Operations</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-[20px] font-semibold text-[color:var(--foreground)]">Studio Kanban</h1>
            <div className="flex items-center gap-2">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[color:var(--accent)] border border-[color:var(--border)] text-[11px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)]/80 transition">
                <Icon name="filter" className="h-3 w-3" />
                Filter
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[color:var(--primary)] text-[11px] text-[color:var(--primary-foreground)] font-medium hover:bg-[color:var(--primary)]/90 transition">
                <Icon name="plus" className="h-3 w-3" />
                New task
              </button>
            </div>
          </div>
        </div>

        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto px-6 py-6">
          <div className="flex gap-4 h-full min-w-max">
            {columns.map(column => {
              const columnTasks = getTasksByStatus(column.id);
              
              return (
                <div key={column.id} className="flex flex-col w-[320px]">
                  {/* Column header */}
                  <div className={`flex items-center justify-between mb-3 pb-3 border-b-2 ${column.color}`}>
                    <h3 className="text-[13px] font-medium text-[color:var(--foreground)]">{column.label}</h3>
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-[color:var(--accent)] text-[10px] text-[color:var(--foreground)]">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Cards container */}
                  <DroppableColumn 
                    id={column.id} 
                    className="flex-1 space-y-3 overflow-y-auto pr-2 min-h-[100px]"
                  >
                    {columnTasks.length === 0 ? (
                      <div className="text-center py-8">
                        <Icon name="inbox" className="h-8 w-8 text-[color:var(--muted)] mx-auto mb-2" />
                        <p className="text-[11px] text-[color:var(--muted-foreground)]">No tasks</p>
                      </div>
                    ) : (
                      columnTasks.map(task => (
                        <DraggableTask
                          key={task.id}
                          task={task}
                          onClick={() => onNavigate(`/studio/tasks/${task.id}`)}
                        />
                      ))
                    )}
                  </DroppableColumn>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeTask ? <DraggableTask task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
};
