import React from 'react';
import { Skeleton } from '../ui/skeleton';

export const StudioDashboardSkeleton: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <header className="mb-6">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-7 w-40" />
      </header>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tasks section */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] p-5">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[color:var(--accent)]">
                  <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Activity section */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] p-5">
            <Skeleton className="h-5 w-28 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick actions */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] p-5">
            <Skeleton className="h-5 w-28 mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          </div>

          {/* Team */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] p-5">
            <Skeleton className="h-5 w-20 mb-4" />
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-8 rounded-full border-2 border-[color:var(--card)]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudioDashboardSkeleton;
