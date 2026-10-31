import React from 'react';
import { Skeleton } from '../ui/skeleton';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <header className="mb-6">
        <Skeleton className="h-3 w-16 mb-2" />
        <Skeleton className="h-7 w-32" />
      </header>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Subscription card */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 md:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-3 w-24 ml-auto" />
                <Skeleton className="h-4 w-28 ml-auto" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-2.5 w-full rounded-full" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-dashed border-[color:var(--border)]">
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-24 rounded-full" />
            </div>
          </div>

          {/* Composer AI card */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 md:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-48" />
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-3 w-24 ml-auto" />
                <Skeleton className="h-3 w-20 ml-auto" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Active tasks */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="p-3 rounded-xl bg-[color:var(--accent)]">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          </div>

          {/* Review queue */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>

          {/* Metrics */}
          <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm p-4 space-y-3">
            <div className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSkeleton;
