import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Brands } from '../../components/client/Brands';

export const BrandsPage: React.FC = () => {
  const navigate = useNavigate();

  return <Brands onNavigate={(route) => navigate(route)} />;
};

