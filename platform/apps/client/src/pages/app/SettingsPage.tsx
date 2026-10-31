import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from '../../components/client/Settings';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();

  return <Settings onNavigate={(route) => navigate(route)} />;
};

