import React from 'react';
import { useNavigate } from 'react-router-dom';
import { KanbanBoard } from '../../components/client/KanbanBoard';

export const KanbanPage: React.FC = () => {
  const navigate = useNavigate();

  return <KanbanBoard onNavigate={(route) => navigate(route)} />;
};

