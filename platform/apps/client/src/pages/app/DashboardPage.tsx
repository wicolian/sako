import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dashboard } from '../../components/client/Dashboard';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return <Dashboard onNavigate={(route) => navigate(route)} />;
};

