import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskCreate } from '../../components/client/TaskCreate';

export const TaskCreatePage: React.FC = () => {
  const navigate = useNavigate();

  return <TaskCreate onNavigate={(route) => navigate(route)} />;
};
