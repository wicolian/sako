import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminDashboard } from '../components/AdminDashboard';

export const StudioDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  return <AdminDashboard onNavigate={(route) => navigate(route)} />;
};

