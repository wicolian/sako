import { getISTDateBoundaries } from '@/lib/utils';

interface PostHogConfig {
  host: string;
  apiKey: string;
  projectId?: string;
}

function getConfig(): PostHogConfig {
  const host = process.env.POSTHOG_HOST;
  const apiKey = process.env.POSTHOG_API_KEY;

  if (!host || !apiKey) {
    throw new Error('PostHog configuration missing (POSTHOG_HOST, POSTHOG_API_KEY)');
  }

  return {
    host: host.replace(/\/$/, ''), // Remove trailing slash
    apiKey,
    projectId: process.env.POSTHOG_PROJECT_ID,
  };
}

interface HogQLResponse {
  results: unknown[][];
  columns: string[];
}

/**
 * Execute a HogQL query against PostHog
 */
async function executeHogQL(query: string): Promise<HogQLResponse> {
  const config = getConfig();

  if (!config.projectId) {
    throw new Error('PostHog PROJECT_ID is required for API queries');
  }

  const response = await fetch(`${config.host}/api/projects/${config.projectId}/query/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PostHog query failed: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.results ? data : { results: [], columns: [] };
}

/**
 * Get DAU (Daily Active Users) - unique users with any activity today (IST)
 * Includes both marketing site and app events
 */
export async function getDAU(): Promise<number> {
  const { start, end } = getISTDateBoundaries();
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const query = `
    SELECT count(DISTINCT person_id)
    FROM events
    WHERE timestamp >= '${startStr}'
      AND timestamp <= '${endStr}'
      AND event IN ('$pageview', '$screen', '$autocapture', 'PageViewed', 'DashboardViewed')
  `;

  const result = await executeHogQL(query);

  if (result.results.length > 0 && result.results[0].length > 0) {
    return Number(result.results[0][0]) || 0;
  }

  return 0;
}

/**
 * Get pageview count for today (IST) - fallback for GA4 visits
 */
export async function getPageviews(): Promise<number> {
  const { start, end } = getISTDateBoundaries();
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const query = `
    SELECT count(*)
    FROM events
    WHERE timestamp >= '${startStr}'
      AND timestamp <= '${endStr}'
      AND event IN ('$pageview', 'PageViewed')
  `;

  const result = await executeHogQL(query);

  if (result.results.length > 0 && result.results[0].length > 0) {
    return Number(result.results[0][0]) || 0;
  }

  return 0;
}

/**
 * Get signups today - users who triggered SignupCompleted event (IST)
 * Event names from sako-v1 analytics: SignupCompleted, SignupStarted
 * Also includes funnel_step for COMPLETE_SIGNUP
 * Note: We primarily use sako_db for accurate signup counts
 */
export async function getSignups(): Promise<number> {
  const { start, end } = getISTDateBoundaries();
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const query = `
    SELECT count(DISTINCT person_id)
    FROM events
    WHERE timestamp >= '${startStr}'
      AND timestamp <= '${endStr}'
      AND (
        event IN ('SignupCompleted', 'SignupStarted', '$identify')
        OR (event = 'funnel_step' AND properties.step_name = 'Completed signup')
      )
  `;

  const result = await executeHogQL(query);

  if (result.results.length > 0 && result.results[0].length > 0) {
    return Number(result.results[0][0]) || 0;
  }

  return 0;
}

/**
 * Get activation count - users who created a task today (IST)
 * Event name from sako-v1 analytics: TaskCreateSubmitted
 */
export async function getActivations(): Promise<number> {
  const { start, end } = getISTDateBoundaries();
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const query = `
    SELECT count(DISTINCT person_id)
    FROM events
    WHERE timestamp >= '${startStr}'
      AND timestamp <= '${endStr}'
      AND event IN ('TaskCreateSubmitted', 'TaskViewed', 'TaskCreateOpened')
  `;

  const result = await executeHogQL(query);

  if (result.results.length > 0 && result.results[0].length > 0) {
    return Number(result.results[0][0]) || 0;
  }

  return 0;
}

/**
 * Get D7 retention - users who signed up 7+ days ago and had activity in the last 7 days
 */
export async function getD7Retention(): Promise<{ retained: number; cohort: number; rate: number }> {
  const now = new Date();
  const d7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d14Ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const d7AgoStr = d7Ago.toISOString();
  const d14AgoStr = d14Ago.toISOString();
  const nowStr = now.toISOString();

  // Get users who signed up between D14 and D7
  const cohortQuery = `
    SELECT DISTINCT person_id
    FROM events
    WHERE timestamp >= '${d14AgoStr}'
      AND timestamp < '${d7AgoStr}'
      AND (
        event IN ('SignupCompleted', '$identify')
        OR (event = 'funnel_step' AND properties.step_name = 'Completed signup')
      )
  `;

  const cohortResult = await executeHogQL(cohortQuery);
  const cohortSize = cohortResult.results.length;

  if (cohortSize === 0) {
    return { retained: 0, cohort: 0, rate: 0 };
  }

  // Get which of those users were active in the last 7 days
  const retentionQuery = `
    SELECT count(DISTINCT person_id)
    FROM events
    WHERE timestamp >= '${d7AgoStr}'
      AND timestamp <= '${nowStr}'
      AND event IN ('TaskCreateSubmitted', 'TaskViewed', '$pageview', 'DashboardViewed')
      AND person_id IN (
        SELECT DISTINCT person_id
        FROM events
        WHERE timestamp >= '${d14AgoStr}'
          AND timestamp < '${d7AgoStr}'
          AND (
            event IN ('SignupCompleted', '$identify')
            OR (event = 'funnel_step' AND properties.step_name = 'Completed signup')
          )
      )
  `;

  const retentionResult = await executeHogQL(retentionQuery);
  const retained =
    retentionResult.results.length > 0 && retentionResult.results[0].length > 0
      ? Number(retentionResult.results[0][0]) || 0
      : 0;

  return {
    retained,
    cohort: cohortSize,
    rate: cohortSize > 0 ? (retained / cohortSize) * 100 : 0,
  };
}

/**
 * Get marketing funnel metrics - conversion from landing to signup
 */
export async function getMarketingFunnel(): Promise<{
  landed: number;
  scrolled50: number;
  viewedPricing: number;
  clickedCta: number;
  startedSignup: number;
  completedSignup: number;
}> {
  const { start, end } = getISTDateBoundaries();
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  // Query funnel steps
  const query = `
    SELECT 
      properties.step_name as step,
      count(DISTINCT person_id) as count
    FROM events
    WHERE timestamp >= '${startStr}'
      AND timestamp <= '${endStr}'
      AND event = 'funnel_step'
      AND properties.funnel_name = 'marketing_to_signup'
    GROUP BY properties.step_name
  `;

  const result = await executeHogQL(query);

  const funnel = {
    landed: 0,
    scrolled50: 0,
    viewedPricing: 0,
    clickedCta: 0,
    startedSignup: 0,
    completedSignup: 0,
  };

  for (const row of result.results) {
    const step = row[0] as string;
    const count = Number(row[1]) || 0;

    switch (step) {
      case 'Landed on page':
        funnel.landed = count;
        break;
      case 'Scrolled 50%':
        funnel.scrolled50 = count;
        break;
      case 'Viewed pricing':
        funnel.viewedPricing = count;
        break;
      case 'Clicked CTA':
        funnel.clickedCta = count;
        break;
      case 'Started signup':
        funnel.startedSignup = count;
        break;
      case 'Completed signup':
        funnel.completedSignup = count;
        break;
    }
  }

  return funnel;
}

/**
 * Get product click count (clicks that lead to app)
 */
export async function getProductClicks(): Promise<number> {
  const { start, end } = getISTDateBoundaries();
  const startStr = start.toISOString();
  const endStr = end.toISOString();

  const query = `
    SELECT count(*)
    FROM events
    WHERE timestamp >= '${startStr}'
      AND timestamp <= '${endStr}'
      AND event = 'product_click'
  `;

  const result = await executeHogQL(query);

  if (result.results.length > 0 && result.results[0].length > 0) {
    return Number(result.results[0][0]) || 0;
  }

  return 0;
}

export interface PostHogMetrics {
  dau: number;
  pageviews: number;
  signups: number;
  activations: number;
  d7Retention: {
    retained: number;
    cohort: number;
    rate: number;
  };
  marketingFunnel: {
    landed: number;
    scrolled50: number;
    viewedPricing: number;
    clickedCta: number;
    startedSignup: number;
    completedSignup: number;
  };
  productClicks: number;
}

/**
 * Fetch all PostHog metrics
 */
export async function fetchPostHogMetrics(): Promise<PostHogMetrics> {
  const [dau, pageviews, signups, activations, d7Retention, marketingFunnel, productClicks] =
    await Promise.all([
      getDAU(),
      getPageviews(),
      getSignups(),
      getActivations(),
      getD7Retention(),
      getMarketingFunnel(),
      getProductClicks(),
    ]);

  return {
    dau,
    pageviews,
    signups,
    activations,
    d7Retention,
    marketingFunnel,
    productClicks,
  };
}

/**
 * Check if PostHog is configured
 */
export function isPostHogConfigured(): boolean {
  return !!(process.env.POSTHOG_HOST && process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID);
}
