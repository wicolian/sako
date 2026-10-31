import { querySako, isSakoDbConfigured } from '@/lib/sakoDb';
import { getISTDateBoundaries, getISTMonthBoundaries } from '@/lib/utils';

// Task status mapping per plan:
// QUEUED = backlog/ready
// IN_PROGRESS = active (SLA clock starts here)
// IN_REVIEW = waiting on client
// COMPLETED = done
// PAUSED = blocked

interface TaskRow {
  status: string;
  count: bigint;
}

interface UserRow {
  count: bigint;
}

interface ChurnRiskRow {
  count: bigint;
}

interface SubscriptionRow {
  count: bigint;
}

interface WorkspaceRow {
  count: bigint;
}

/**
 * Get signups today from sako_db (users created today in IST)
 * Note: Table is 'users' (lowercase, mapped via Prisma @@map)
 */
export async function getSignups(): Promise<number> {
  if (!isSakoDbConfigured()) return 0;

  const { start, end } = getISTDateBoundaries();

  const result = await querySako<UserRow>(`
    SELECT COUNT(*) as count
    FROM users
    WHERE "createdAt" >= '${start.toISOString()}'
      AND "createdAt" <= '${end.toISOString()}'
  `);

  return result[0]?.count ? Number(result[0].count) : 0;
}

/**
 * Get activation rate - users who created at least one task / total users
 * Activation = TaskCreated per plan
 * Note: User-Workspace relationship is through workspace_members table
 */
export async function getActivationRate(): Promise<number> {
  if (!isSakoDbConfigured()) return 0;

  // Total users (excluding very recent to give them time to activate)
  const d7Ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const totalResult = await querySako<UserRow>(`
    SELECT COUNT(*) as count
    FROM users
    WHERE "createdAt" <= '${d7Ago.toISOString()}'
  `);

  const total = totalResult[0]?.count ? Number(totalResult[0].count) : 0;
  if (total === 0) return 0;

  // Users who created at least one task (via workspace_members)
  const activatedResult = await querySako<UserRow>(`
    SELECT COUNT(DISTINCT u.id) as count
    FROM users u
    INNER JOIN workspace_members wm ON wm."userId" = u.id
    INNER JOIN tasks t ON t."workspaceId" = wm."workspaceId"
    WHERE u."createdAt" <= '${d7Ago.toISOString()}'
  `);

  const activated = activatedResult[0]?.count ? Number(activatedResult[0].count) : 0;

  return (activated / total) * 100;
}

/**
 * Get D7 retention from database
 */
export async function getD7Retention(): Promise<{ rate: number; retained: number; cohort: number }> {
  if (!isSakoDbConfigured()) return { rate: 0, retained: 0, cohort: 0 };

  const now = new Date();
  const d7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d14Ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Cohort: users who signed up between D14 and D7
  const cohortResult = await querySako<UserRow>(`
    SELECT COUNT(*) as count
    FROM users
    WHERE "createdAt" >= '${d14Ago.toISOString()}'
      AND "createdAt" < '${d7Ago.toISOString()}'
  `);

  const cohort = cohortResult[0]?.count ? Number(cohortResult[0].count) : 0;
  if (cohort === 0) return { rate: 0, retained: 0, cohort: 0 };

  // Retained: users from cohort who created a task in last 7 days (via workspace_members)
  const retainedResult = await querySako<UserRow>(`
    SELECT COUNT(DISTINCT u.id) as count
    FROM users u
    INNER JOIN workspace_members wm ON wm."userId" = u.id
    INNER JOIN tasks t ON t."workspaceId" = wm."workspaceId"
    WHERE u."createdAt" >= '${d14Ago.toISOString()}'
      AND u."createdAt" < '${d7Ago.toISOString()}'
      AND t."createdAt" >= '${d7Ago.toISOString()}'
  `);

  const retained = retainedResult[0]?.count ? Number(retainedResult[0].count) : 0;

  return {
    rate: (retained / cohort) * 100,
    retained,
    cohort,
  };
}

/**
 * Get task counts by status (for Pod Ops panel)
 */
export async function getTasksByStatus(): Promise<{
  total: number;
  queued: number;
  inProgress: number;
  inReview: number;
  completed: number;
  paused: number;
}> {
  if (!isSakoDbConfigured()) {
    return { total: 0, queued: 0, inProgress: 0, inReview: 0, completed: 0, paused: 0 };
  }

  // Get tasks from last 30 days
  const d30Ago = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await querySako<TaskRow>(`
    SELECT status, COUNT(*) as count
    FROM tasks
    WHERE "createdAt" >= '${d30Ago.toISOString()}'
    GROUP BY status
  `);

  const counts = {
    total: 0,
    queued: 0,
    inProgress: 0,
    inReview: 0,
    completed: 0,
    paused: 0,
  };

  for (const row of result) {
    const count = Number(row.count);
    counts.total += count;

    switch (row.status) {
      case 'QUEUED':
        counts.queued = count;
        break;
      case 'IN_PROGRESS':
        counts.inProgress = count;
        break;
      case 'IN_REVIEW':
        counts.inReview = count;
        break;
      case 'COMPLETED':
        counts.completed = count;
        break;
      case 'PAUSED':
        counts.paused = count;
        break;
    }
  }

  return counts;
}

/**
 * Get churn risk accounts - workspaces with PAST_DUE or CANCEL_AT_PERIOD_END subscriptions
 */
export async function getChurnRiskAccounts(): Promise<number> {
  if (!isSakoDbConfigured()) return 0;

  const result = await querySako<ChurnRiskRow>(`
    SELECT COUNT(DISTINCT w.id) as count
    FROM workspaces w
    INNER JOIN subscriptions s ON s."workspaceId" = w.id
    WHERE s.status IN ('PAST_DUE', 'CANCEL_AT_PERIOD_END')
      OR s."cancelAtPeriodEnd" = true
  `);

  return result[0]?.count ? Number(result[0].count) : 0;
}

/**
 * Get conversion rate (signups to paid)
 */
export async function getConversionRate(): Promise<number> {
  if (!isSakoDbConfigured()) return 0;

  // Total signups (excluding last 7 days to give time to convert)
  const d7Ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const totalResult = await querySako<UserRow>(`
    SELECT COUNT(*) as count
    FROM users
    WHERE "createdAt" <= '${d7Ago.toISOString()}'
  `);

  const total = totalResult[0]?.count ? Number(totalResult[0].count) : 0;
  if (total === 0) return 0;

  // Users with active/trialing subscription (via workspace_members)
  const convertedResult = await querySako<UserRow>(`
    SELECT COUNT(DISTINCT wm."userId") as count
    FROM workspace_members wm
    INNER JOIN subscriptions s ON s."workspaceId" = wm."workspaceId"
    INNER JOIN users u ON u.id = wm."userId"
    WHERE u."createdAt" <= '${d7Ago.toISOString()}'
      AND s.status IN ('ACTIVE', 'TRIALING')
  `);

  const converted = convertedResult[0]?.count ? Number(convertedResult[0].count) : 0;

  return (converted / total) * 100;
}

/**
 * Get active subscriptions count
 */
export async function getActiveSubscriptions(): Promise<number> {
  if (!isSakoDbConfigured()) return 0;

  const result = await querySako<SubscriptionRow>(`
    SELECT COUNT(*) as count
    FROM subscriptions
    WHERE status = 'ACTIVE'
  `);

  return result[0]?.count ? Number(result[0].count) : 0;
}

/**
 * Get active workspaces count (workspaces with active subscriptions)
 */
export async function getActiveWorkspaces(): Promise<number> {
  if (!isSakoDbConfigured()) return 0;

  const result = await querySako<WorkspaceRow>(`
    SELECT COUNT(DISTINCT w.id) as count
    FROM workspaces w
    INNER JOIN subscriptions s ON s."workspaceId" = w.id
    WHERE s.status = 'ACTIVE'
  `);

  return result[0]?.count ? Number(result[0].count) : 0;
}

/**
 * Get total users count
 */
export async function getTotalUsers(): Promise<number> {
  if (!isSakoDbConfigured()) return 0;

  const result = await querySako<UserRow>(`
    SELECT COUNT(*) as count
    FROM users
  `);

  return result[0]?.count ? Number(result[0].count) : 0;
}

export interface SakoDbMetrics {
  signups: number;
  activationRate: number;
  d7Retention: { rate: number; retained: number; cohort: number };
  taskCounts: {
    total: number;
    queued: number;
    inProgress: number;
    inReview: number;
    completed: number;
    paused: number;
  };
  churnRiskAccounts: number;
  conversionRate: number;
  activeSubscriptions: number;
  activeWorkspaces: number;
  totalUsers: number;
}

/**
 * Fetch all Sako DB metrics
 */
export async function fetchSakoDbMetrics(): Promise<SakoDbMetrics> {
  if (!isSakoDbConfigured()) {
    return {
      signups: 0,
      activationRate: 0,
      d7Retention: { rate: 0, retained: 0, cohort: 0 },
      taskCounts: { total: 0, queued: 0, inProgress: 0, inReview: 0, completed: 0, paused: 0 },
      churnRiskAccounts: 0,
      conversionRate: 0,
      activeSubscriptions: 0,
      activeWorkspaces: 0,
      totalUsers: 0,
    };
  }

  const [
    signups,
    activationRate,
    d7Retention,
    taskCounts,
    churnRiskAccounts,
    conversionRate,
    activeSubscriptions,
    activeWorkspaces,
    totalUsers,
  ] = await Promise.all([
    getSignups(),
    getActivationRate(),
    getD7Retention(),
    getTasksByStatus(),
    getChurnRiskAccounts(),
    getConversionRate(),
    getActiveSubscriptions(),
    getActiveWorkspaces(),
    getTotalUsers(),
  ]);

  return {
    signups,
    activationRate,
    d7Retention,
    taskCounts,
    churnRiskAccounts,
    conversionRate,
    activeSubscriptions,
    activeWorkspaces,
    totalUsers,
  };
}
