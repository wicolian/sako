/**
 * Frontend SLA utilities for Studio
 * Consistent SLA display across all components
 */

import { Task } from './types';

export function formatSlaStatus(task: Task): string {
  const slaHours = task.computedSlaHours ?? (task.displaySlaHours ?? Math.round(task.slaSeconds / 3600));

  // If no inProgressAt, just show the SLA window
  if (!task.inProgressAt || !task.slaRemainingSeconds) {
    return `SLA ${slaHours}h`;
  }

  // If task is late
  if (task.slaIsLate && task.slaRemainingSeconds !== null) {
    const hoursOver = Math.abs(Math.floor(task.slaRemainingSeconds / 3600));
    return `SLA exceeded by ${hoursOver}h`;
  }

  // Show remaining time with paused indicator if waiting on client
  const hoursRemaining = Math.max(0, Math.floor(task.slaRemainingSeconds / 3600));
  if (task.isWaitingOnClient) {
    return `SLA ~${hoursRemaining}h remaining (paused)`;
  }
  return `SLA ~${hoursRemaining}h remaining`;
}

export function getSlaColorClasses(task: Task): { bg: string; border: string; text: string } {
  if (task.slaStatus === 'LATE' || task.slaIsLate) {
    return {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-300 dark:border-red-700',
      text: 'text-red-900 dark:text-red-300',
    };
  }

  if (task.slaStatus === 'AT_RISK') {
    return {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-300 dark:border-amber-700',
      text: 'text-amber-900 dark:text-amber-300',
    };
  }

  return {
    bg: 'bg-[color:var(--card)]',
    border: 'border-[color:var(--border)]',
    text: 'text-[color:var(--foreground)]',
  };
}

export function getSlaStatusChip(task: Task): { label: string; className: string } {
  if (task.slaStatus === 'LATE' || task.slaIsLate) {
    return {
      label: 'Late',
      className: 'bg-red-100 border-red-300 text-red-900 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
    };
  }

  if (task.slaStatus === 'AT_RISK') {
    return {
      label: 'At Risk',
      className: 'bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300',
    };
  }

  return {
    label: 'On Track',
    className: 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300',
  };
}

