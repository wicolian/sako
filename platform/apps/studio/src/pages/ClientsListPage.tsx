import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminClientsList } from '../components/AdminClientsList';

export const ClientsListPage: React.FC = () => {
  const navigate = useNavigate();

  return <AdminClientsList onNavigate={(route) => navigate(route)} />;
};

