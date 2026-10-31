import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StudioPlaceholder } from '../components/StudioPlaceholder';
import { features } from '../config/features';

export const StudioPodsPage: React.FC = () => {
  const navigate = useNavigate();

  if (!features.pods) {
    return (
      <StudioPlaceholder
        title="Pods & Teams"
        subtitle="Studio"
        onNavigate={(route) => navigate(route)}
        message="pods management isn’t part of the beta. we’re keeping it internal until the workflows settle."
      />
    );
  }

  return <StudioPlaceholder title="Pods & Teams" subtitle="Studio" onNavigate={(route) => navigate(route)} />;
};
