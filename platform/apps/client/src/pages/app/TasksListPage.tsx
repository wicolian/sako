import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClientTasks } from '../../components/client/ClientTasks';

export const TasksListPage: React.FC = () => {
  const navigate = useNavigate();

  return <ClientTasks onNavigate={(route) => navigate(route)} />;
};

