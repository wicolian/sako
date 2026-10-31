import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminTasks } from '../components/AdminTasks';

export const StudioTasksListPage: React.FC = () => {
  const navigate = useNavigate();

  return <AdminTasks onNavigate={(route) => navigate(route)} />;
};

