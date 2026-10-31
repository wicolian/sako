import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminClientDetail } from '../components/AdminClientDetail';

export const ClientDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  if (!id) {
    navigate('/studio/clients');
    return null;
  }

  return <AdminClientDetail workspaceId={id} onNavigate={(route) => navigate(route)} />;
};

