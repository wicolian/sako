import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminTaskDetail } from '../components/AdminTaskDetail';

export const StudioTaskDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  if (!id) {
    navigate('/studio/tasks');
    return null;
  }

  return <AdminTaskDetail taskId={id} onNavigate={(route) => navigate(route)} />;
};

