import React from 'react';
import { Subscription } from '../../lib/types';

interface PauseStatusProps {
  subscription: Subscription;
  isPaused: boolean;
}

/**
 * Component that shows pause duration and rollover eligibility
 * Helps users understand when they can resume and until when it's valid
 */
export const PauseStatus: React.FC<PauseStatusProps> = ({ subscription, isPaused }) => {
  if (!isPaused && !subscription.pausedAt) {
    return null; // Not paused, don't show anything
  }

  // Determine billing interval from plan code
  // Plan codes: CORE, OPS, ENTERPRISE, COMPOSER_FREE, COMPOSER_PRO
  // We check billing period to determine if it's monthly or yearly
  const planCode = subscription.planCode || '';
  let isYearly = false;
  
  if (subscription.billingPeriodStart && subscription.billingPeriodEnd) {
    const start = new Date(subscription.billingPeriodStart);
    const end = new Date(subscription.billingPeriodEnd);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    isYearly = daysDiff >= 300; // If billing period is 300+ days, consider it yearly
  } else {
    // Fallback: assume monthly for most plans, yearly for OPS/ENTERPRISE
    isYearly = planCode === 'OPS' || planCode === 'ENTERPRISE';
  }
  
  const maxPauseMonths = isYearly ? 6 : 3; // 6 months for annual, 3 months for monthly

  // Calculate current pause duration
  let currentPauseSeconds = subscription.totalPausedSeconds || 0;
  if (subscription.pausedAt) {
    // If currently paused, add time since pausedAt
    const pausedAt = new Date(subscription.pausedAt);
    const now = new Date();
    const currentPauseDuration = Math.floor((now.getTime() - pausedAt.getTime()) / 1000);
    currentPauseSeconds += currentPauseDuration;
  }

  // Convert to days and months
  const pauseDurationDays = currentPauseSeconds / (24 * 60 * 60);
  const pauseDurationMonths = pauseDurationDays / 30.44; // Average month length
  const maxPauseDays = maxPauseMonths * 30.44;
  const remainingDays = Math.max(0, maxPauseDays - pauseDurationDays);
  const remainingMonths = remainingDays / 30.44;

  // Determine status color
  const isNearLimit = remainingMonths < 1; // Less than 1 month remaining
  const isOverLimit = pauseDurationMonths > maxPauseMonths;

  const formatDuration = (months: number): string => {
    if (months < 1) {
      const days = Math.floor(months * 30.44);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    const wholeMonths = Math.floor(months);
    const days = Math.floor((months - wholeMonths) * 30.44);
    if (days === 0) {
      return `${wholeMonths} month${wholeMonths !== 1 ? 's' : ''}`;
    }
    return `${wholeMonths} month${wholeMonths !== 1 ? 's' : ''}, ${days} day${days !== 1 ? 's' : ''}`;
  };

  return (
    <div className={`p-4 rounded-xl border ${
      isOverLimit
        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
        : isNearLimit
        ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
        : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
    }`}>
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-[13px] font-medium ${
              isOverLimit
                ? 'text-red-800 dark:text-red-300'
                : isNearLimit
                ? 'text-amber-800 dark:text-amber-300'
                : 'text-blue-800 dark:text-blue-300'
            }`}>
              {isOverLimit ? '⚠️ Rollover Eligibility Lost' : '⏸️ Subscription Paused'}
            </p>
            <p className="text-[12px] text-neutral-600 dark:text-neutral-400 mt-1">
              Paused for {formatDuration(pauseDurationMonths)}
            </p>
          </div>
        </div>

        {isOverLimit ? (
          <div className="text-[12px] text-red-700 dark:text-red-400">
            <p className="font-medium">Rollover limit exceeded</p>
            <p className="mt-1">
              You've paused for more than {maxPauseMonths} months. Unused day credits from previous periods will not roll over to the next billing period.
            </p>
          </div>
        ) : (
          <div className="text-[12px] text-neutral-700 dark:text-neutral-300">
            <p className="font-medium mb-1">Rollover eligibility</p>
            <p className="mb-2">
              Resume within <strong>{formatDuration(remainingMonths)}</strong> to maintain rollover benefits.
              {isNearLimit && (
                <span className="block mt-1 text-amber-700 dark:text-amber-400 font-medium">
                  ⚠️ Less than 1 month remaining!
                </span>
              )}
            </p>
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
              Rollover limit: {maxPauseMonths} months for {isYearly ? 'annual' : 'monthly'} plans
            </p>
          </div>
        )}

        {subscription.pausedAt && (
          <p className="text-[11px] text-neutral-500 dark:text-neutral-500 mt-2">
            Paused since {new Date(subscription.pausedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
    </div>
  );
};


