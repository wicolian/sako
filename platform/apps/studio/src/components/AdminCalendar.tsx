import React, { useState } from 'react';
import { Icon } from './Icon';
import { useStudioTasks } from '../lib/hooks';

interface AdminCalendarProps {
  onNavigate: (route: string) => void;
}

export const AdminCalendar: React.FC<AdminCalendarProps> = ({ onNavigate }) => {
  const { data: tasks, loading } = useStudioTasks();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper to normalize status
  const normalizeStatus = (status: string) => {
    return status.toLowerCase().replace(/_/g, '-');
  };

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

  // Group tasks by date (using createdAt)
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
          <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">Schedule</p>
          <h2 className="text-[22px] tracking-tight font-semibold text-[color:var(--foreground)]">Studio Calendar</h2>
        </div>
      </header>

      {/* Calendar navigation */}
      <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[18px] font-semibold text-[color:var(--foreground)]">
            {monthNames[month]} {year}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={previousMonth}
              className="h-8 w-8 rounded-full border border-[color:var(--border)] bg-[color:var(--background)] hover:bg-[color:var(--accent)] flex items-center justify-center transition"
            >
              <Icon name="chevron-right" className="h-4 w-4 rotate-180" />
            </button>
            <button
              onClick={nextMonth}
              className="h-8 w-8 rounded-full border border-[color:var(--border)] bg-[color:var(--background)] hover:bg-[color:var(--accent)] flex items-center justify-center transition"
            >
              <Icon name="chevron-right" className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-[color:var(--border)] rounded-lg overflow-hidden">
          {/* Day names */}
          {dayNames.map(day => (
            <div key={day} className="bg-[color:var(--card)] p-2 text-center">
              <span className="text-[11px] font-medium text-[color:var(--muted-foreground)] uppercase">
                {day}
              </span>
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="bg-[color:var(--background)]/40 min-h-[100px]" />;
            }

            const dateKey = `${year}-${month + 1}-${day}`;
            const dayTasks = tasksByDate[dateKey] || [];
            const today = new Date();
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

            return (
              <div
                key={day}
                className={`bg-[color:var(--card)] min-h-[100px] p-2 hover:bg-[color:var(--accent)]/50 transition ${
                  isToday ? 'ring-2 ring-[color:var(--primary)] ring-inset' : ''
                }`}
              >
                <div className="text-[13px] font-medium text-[color:var(--foreground)] mb-2">
                  {day}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map(task => {
                    const status = normalizeStatus(task.status);
                    const statusColors = {
                      'queued': 'bg-gray-100 text-gray-700',
                      'in-progress': 'bg-blue-100 text-blue-700',
                      'in-review': 'bg-amber-100 text-amber-700',
                      'completed': 'bg-emerald-100 text-emerald-700',
                    };
                    const color = statusColors[status as keyof typeof statusColors] || statusColors['queued'];

                    return (
                      <div
                        key={task.id}
                        onClick={() => onNavigate(`/studio/tasks/${task.id}`)}
                        className={`text-[10px] px-2 py-1 rounded cursor-pointer hover:opacity-80 transition truncate ${color}`}
                      >
                        {task.title}
                      </div>
                    );
                  })}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] text-[color:var(--muted-foreground)] px-2">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="text-center py-4 text-[13px] text-[color:var(--muted-foreground)]">
            Loading tasks...
          </div>
        )}
      </div>

      {/* Task summary */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {['queued', 'in-progress', 'in-review', 'completed'].map(status => {
          const count = tasks?.filter(t => normalizeStatus(t.status) === status).length || 0;
          const labels = {
            'queued': 'Queued',
            'in-progress': 'In Progress',
            'in-review': 'In Review',
            'completed': 'Completed',
          };

          return (
            <div key={status} className="bg-[color:var(--card)] rounded-lg border border-[color:var(--border)] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)] mb-1">
                {labels[status as keyof typeof labels]}
              </div>
              <div className="text-2xl font-semibold text-[color:var(--foreground)]">
                {count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

