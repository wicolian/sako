import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number with commas
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.floor(value));
}

/**
 * Format a number as a percentage
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format milliseconds as latency string
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.floor(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Get IST date boundaries for today
 */
export function getISTDateBoundaries(): { start: Date; end: Date } {
  const now = new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istTime = new Date(utcTime + istOffset);

  // Get start of day in IST
  const startOfDayIST = new Date(istTime);
  startOfDayIST.setHours(0, 0, 0, 0);

  // Get end of day in IST
  const endOfDayIST = new Date(istTime);
  endOfDayIST.setHours(23, 59, 59, 999);

  // Convert back to UTC
  const startUTC = new Date(startOfDayIST.getTime() - istOffset);
  const endUTC = new Date(endOfDayIST.getTime() - istOffset);

  return { start: startUTC, end: endUTC };
}

/**
 * Get IST month boundaries for MTD
 */
export function getISTMonthBoundaries(): { start: Date; end: Date } {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istTime = new Date(utcTime + istOffset);

  // Get start of month in IST
  const startOfMonthIST = new Date(istTime.getFullYear(), istTime.getMonth(), 1, 0, 0, 0, 0);

  // Get current time in IST (end)
  const endOfDayIST = new Date(istTime);
  endOfDayIST.setHours(23, 59, 59, 999);

  // Convert back to UTC
  const startUTC = new Date(startOfMonthIST.getTime() - istOffset);
  const endUTC = new Date(endOfDayIST.getTime() - istOffset);

  return { start: startUTC, end: endUTC };
}

/**
 * Calculate time ago string
 */
export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
