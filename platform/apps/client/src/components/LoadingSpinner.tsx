import React from 'react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--background)]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--muted-foreground)] border-t-[color:var(--primary)]" />
        <p className="text-[13px] text-[color:var(--muted-foreground)]">{message}</p>
      </div>
    </div>
  );
};
