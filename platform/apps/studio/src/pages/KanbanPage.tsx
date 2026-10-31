import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminTasks } from '../components/AdminTasks';

export const StudioKanbanPage: React.FC = () => {
  const navigate = useNavigate();

  // Set kanban view in localStorage so component opens in kanban mode
  React.useEffect(() => {
    localStorage.setItem('studio-tasks-view', 'kanban');
  }, []);

  return <AdminTasks onNavigate={(route) => navigate(route)} />;
};

