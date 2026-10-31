import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TaskDetail } from '../../components/client/TaskDetail';

export const TaskDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  if (!id) {
    navigate('/app/tasks');
    return null;
  }

  return <TaskDetail taskId={id} onNavigate={(route) => navigate(route)} />;
};

