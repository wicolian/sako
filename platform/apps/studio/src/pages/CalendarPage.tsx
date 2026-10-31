import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminCalendar } from '../components/AdminCalendar';

export const StudioCalendarPage: React.FC = () => {
  const navigate = useNavigate();

  return <AdminCalendar onNavigate={(route) => navigate(route)} />;
};

