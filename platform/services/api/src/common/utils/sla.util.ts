/**
 * SLA Calculation Utilities
 * Provides consistent SLA computations across the app
 * 
 * Supports pause-aware calculations where:
 * - totalPausedSeconds (subscription pause) is subtracted from elapsed time
 * - totalClientWaitSeconds (time in IN_REVIEW) is subtracted from elapsed time
 * 
 * This ensures the SLA timer pauses both when subscription is paused AND when
 * waiting for client feedback (IN_REVIEW status).
 */

export interface SlaComputedFields {
  slaHours: number;
  slaRemainingSeconds: number | null;
  slaIsLate: boolean;
  slaElapsedSeconds: number | null;
  isPaused?: boolean;
  isWaitingOnClient?: boolean;
}

export interface SlaInput {
  slaSeconds: number;
  displaySlaHours?: number | null;
  inProgressAt?: Date | string | null;
  completedAt?: Date | string | null;
  inReviewAt?: Date | string | null;
  totalClientWaitSeconds?: number;
  status?: string;
}

export interface SubscriptionPauseInfo {
  /** Total seconds the subscription has been paused (accumulated) */
  totalPausedSeconds: number;
  /** If currently paused, the timestamp when pause started */
  pausedAt?: Date | string | null;
  /** Current subscription status */
  status?: string;
}

export function computeSlaFields(
  task: SlaInput,
  now: Date = new Date(),
  subscriptionPause?: SubscriptionPauseInfo,
): SlaComputedFields {
  // Derive SLA hours (prefer displaySlaHours if set by estimator, otherwise use slaSeconds)
  const slaHours = task.displaySlaHours ?? Math.round(task.slaSeconds / 3600);
  const slaSeconds = task.slaSeconds;

  // If task never started, no elapsed/remaining computation
  if (!task.inProgressAt) {
    return {
      slaHours,
      slaRemainingSeconds: null,
      slaIsLate: false,
      slaElapsedSeconds: null,
      isPaused: subscriptionPause?.status === 'PAUSED',
      isWaitingOnClient: false,
    };
  }

  const startTime = new Date(task.inProgressAt).getTime();
  
  // Determine effective "now" based on current state
  let effectiveEndTime: number;
  const isPaused = subscriptionPause?.status === 'PAUSED';
  const isWaitingOnClient = task.status === 'IN_REVIEW';
  
  if (task.completedAt) {
    // Task is completed, use completion time
    effectiveEndTime = new Date(task.completedAt).getTime();
  } else if (isPaused && subscriptionPause?.pausedAt) {
    // Task is active but subscription is paused - freeze at pause time
    effectiveEndTime = new Date(subscriptionPause.pausedAt).getTime();
  } else if (isWaitingOnClient && task.inReviewAt) {
    // Task is in review (waiting on client) - freeze at inReviewAt time
    effectiveEndTime = new Date(task.inReviewAt).getTime();
  } else {
    // Task is active and not paused
    effectiveEndTime = now.getTime();
  }

  const rawElapsedMs = effectiveEndTime - startTime;
  
  // Subtract both subscription pause time AND client wait time from elapsed
  const totalPausedMs = (subscriptionPause?.totalPausedSeconds ?? 0) * 1000;
  const totalClientWaitMs = (task.totalClientWaitSeconds ?? 0) * 1000;
  const effectiveElapsedMs = Math.max(0, rawElapsedMs - totalPausedMs - totalClientWaitMs);
  
  const elapsedSeconds = Math.floor(effectiveElapsedMs / 1000);
  const remainingSeconds = slaSeconds - elapsedSeconds;

  // Late if remaining is negative (either now or at completion)
  const isLate = remainingSeconds < 0;

  return {
    slaHours,
    slaRemainingSeconds: remainingSeconds,
    slaIsLate: isLate,
    slaElapsedSeconds: elapsedSeconds,
    isPaused,
    isWaitingOnClient,
  };
}

/**
 * Format SLA status for display
 */
export function formatSlaStatus(computed: SlaComputedFields): string {
  // If paused, indicate that SLA timer is frozen
  if (computed.isPaused) {
    if (computed.slaRemainingSeconds === null) {
      return `SLA ${computed.slaHours}h (PAUSED)`;
    }
    const hoursRemaining = Math.max(0, Math.floor(computed.slaRemainingSeconds / 3600));
    return `SLA ~${hoursRemaining}h remaining (PAUSED)`;
  }

  if (computed.slaRemainingSeconds === null) {
    return `SLA ${computed.slaHours}h`;
  }

  if (computed.slaIsLate) {
    const hoursOver = Math.abs(Math.floor(computed.slaRemainingSeconds / 3600));
    return `SLA exceeded by ${hoursOver}h`;
  }

  const hoursRemaining = Math.max(0, Math.floor(computed.slaRemainingSeconds / 3600));
  return `SLA ~${hoursRemaining}h remaining`;
}

/**
 * Get pause-adjusted effective time for a subscription
 * Useful for calculating how much "real work time" has passed
 */
export function getEffectiveElapsedTime(
  startTime: Date,
  endTime: Date,
  totalPausedSeconds: number,
): number {
  const rawElapsedMs = endTime.getTime() - startTime.getTime();
  const pausedMs = totalPausedSeconds * 1000;
  return Math.max(0, rawElapsedMs - pausedMs);
}

