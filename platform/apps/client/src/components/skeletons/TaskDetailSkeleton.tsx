import React from 'react';
import { Skeleton } from '../ui/skeleton';

export const TaskDetailSkeleton: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 animate-pulse">
      {/* Back button */}
      <div className="mb-4">
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Main card */}
      <div className="bg-[color:var(--card)] rounded-2xl border border-[color:var(--border)] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[color:var(--border)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-7 w-3/4" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-32 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Content grid */}
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[color:var(--border)]">
          {/* Left - Description */}
          <div className="p-6 space-y-4">
            <Skeleton className="h-5 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>

          {/* Right - Details */}
          <div className="p-6 space-y-4">
            <Skeleton className="h-5 w-20" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comments section */}
        <div className="p-6 border-t border-[color:var(--border)]">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
          {/* Comment input */}
          <div className="mt-4 pt-4 border-t border-[color:var(--border)]">
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailSkeleton;
