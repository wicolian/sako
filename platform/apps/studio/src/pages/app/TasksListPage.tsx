import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TasksList } from '../../components/client/TasksList';

export const TasksListPage: React.FC = () => {
  const navigate = useNavigate();

  return <TasksList onNavigate={(route) => navigate(route)} />;
};

