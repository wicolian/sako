import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '../../components/client/Calendar';

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();

  return <Calendar onNavigate={(route) => navigate(route)} />;
};

