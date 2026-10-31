import { MetricDef, SourceType } from '@/types';

/**
 * WALL METRIC CONTRACT
 * Single source of truth for all KPIs.
 * Defines source, caching rules, and investor sensitivity.
 * 
 * Sources:
 * - stripe: Revenue data from Stripe API
 * - sako_db: User/Task/Subscription data from sako-v1 Postgres (Neon)
 * - composer_db: AI generation data from sako-gtm Supabase
 * - posthog: Event analytics from PostHog
 * - ga4: Web analytics from Google Analytics
 */

export const METRIC_CONTRACT: Record<string, MetricDef> = {
  // ===========================================
  // REVENUE & GROWTH
  // ===========================================
  'revenue-today': {
    key: 'revenue-today',
    label: 'Revenue (Today)',
    source: 'stripe',
    ttlSeconds: 180,
    staleAfterSeconds: 600,
    investorSafe: false,
    format: 'currency',
    target: '50000',
    goalDirection: 'up',
    supportsSegments: true,
  },
  'revenue-mtd': {
    key: 'revenue-mtd',
    label: 'Revenue (MTD)',
    source: 'stripe',
    ttlSeconds: 300,
    staleAfterSeconds: 600,
    investorSafe: false,
    format: 'currency',
    target: '1100000',
    goalDirection: 'up',
    supportsSegments: true,
  },
  signups: {
    key: 'signups',
    label: 'Signups (Today)',
    source: 'sako_db',
    ttlSeconds: 60,
    staleAfterSeconds: 300,
    investorSafe: true,
    format: 'number',
    target: '30',
    goalDirection: 'up',
    supportsSegments: false,
  },
  'total-users': {
    key: 'total-users',
    label: 'Total Users',
    source: 'sako_db',
    ttlSeconds: 300,
    staleAfterSeconds: 600,
    investorSafe: true,
    format: 'number',
    goalDirection: 'up',
    supportsSegments: false,
  },

  // ===========================================
  // SUBSCRIPTIONS & WORKSPACES
  // ===========================================
  'active-subscriptions': {
    key: 'active-subscriptions',
    label: 'Active Subscriptions',
    source: 'sako_db',
    ttlSeconds: 300,
    staleAfterSeconds: 600,
    investorSafe: true,
    format: 'number',
    goalDirection: 'up',
    supportsSegments: false,
  },
  'active-workspaces': {
    key: 'active-workspaces',
    label: 'Active Workspaces',
    source: 'sako_db',
    ttlSeconds: 300,
    staleAfterSeconds: 600,
    investorSafe: true,
    format: 'number',
    goalDirection: 'up',
    supportsSegments: false,
  },

  // ===========================================
  // ENGAGEMENT & RETENTION
  // ===========================================
  dau: {
    key: 'dau',
    label: 'Active Users (DAU)',
    source: 'posthog',
    ttlSeconds: 180,
    staleAfterSeconds: 600,
    investorSafe: true,
    format: 'number',
    target: '500',
    goalDirection: 'up',
    supportsSegments: false,
  },
  activation: {
    key: 'activation',
    label: 'Activation Rate',
    source: 'sako_db',
    ttlSeconds: 300,
    staleAfterSeconds: 600,
    investorSafe: true,
    format: 'percent',
    target: '30',
    goalDirection: 'up',
    supportsSegments: false,
  },
  'd7-retention': {
    key: 'd7-retention',
    label: 'D7 Retention',
    source: 'sako_db',
    ttlSeconds: 3600, // Slow moving
    staleAfterSeconds: 7200,
    investorSafe: true,
    format: 'percent',
    target: '40',
    goalDirection: 'up',
    supportsSegments: false,
  },

  // ===========================================
  // OPERATIONAL - WEB TRAFFIC
  // ===========================================
  visits: {
    key: 'visits',
    label: 'Visits (Today)',
    source: 'ga4',
    ttlSeconds: 900,
    staleAfterSeconds: 3600,
    investorSafe: true,
    format: 'number',
    target: '1000',
    goalDirection: 'up',
    supportsSegments: true,
  },
  conversion: {
    key: 'conversion',
    label: 'Conversion Rate',
    source: 'sako_db',
    ttlSeconds: 300,
    staleAfterSeconds: 600,
    investorSafe: true,
    format: 'percent',
    target: '3.5',
    goalDirection: 'up',
    supportsSegments: false,
  },
  'churn-risk': {
    key: 'churn-risk',
    label: 'Churn Risk Accounts',
    source: 'sako_db',
    ttlSeconds: 60,
    staleAfterSeconds: 300,
    investorSafe: false,
    format: 'number',
    target: '10',
    goalDirection: 'down', // Lower is better
    supportsSegments: false,
  },

  // ===========================================
  // COMPOSER - AI GENERATION METRICS
  // ===========================================
  'gen-count': {
    key: 'gen-count',
    label: 'AI Generations (Today)',
    source: 'composer_db',
    ttlSeconds: 60,
    staleAfterSeconds: 300,
    investorSafe: true,
    format: 'number',
    goalDirection: 'up',
    supportsSegments: false,
  },
  'gen-success-rate': {
    key: 'gen-success-rate',
    label: 'Gen Success Rate',
    source: 'composer_db',
    ttlSeconds: 60,
    staleAfterSeconds: 300,
    investorSafe: true,
    format: 'percent',
    target: '95',
    goalDirection: 'up',
    supportsSegments: false,
  },
  'daily-burn': {
    key: 'daily-burn',
    label: 'Daily AI Burn',
    source: 'composer_db',
    ttlSeconds: 60,
    staleAfterSeconds: 300,
    investorSafe: false,
    format: 'currency',
    goalDirection: 'down', // Lower is better (cost control)
    supportsSegments: false,
  },
  'ai-tokens-today': {
    key: 'ai-tokens-today',
    label: 'AI Tokens (Today)',
    source: 'composer_db',
    ttlSeconds: 60,
    staleAfterSeconds: 300,
    investorSafe: true,
    format: 'number',
    goalDirection: 'up', // Usage indicator
    supportsSegments: false,
  },

  // ===========================================
  // COMPOSER - CAMPAIGN METRICS
  // ===========================================
  'campaigns-today': {
    key: 'campaigns-today',
    label: 'Campaigns (Today)',
    source: 'composer_db',
    ttlSeconds: 60,
    staleAfterSeconds: 300,
    investorSafe: true,
    format: 'number',
    goalDirection: 'up',
    supportsSegments: false,
  },
  'total-campaigns': {
    key: 'total-campaigns',
    label: 'Total Campaigns',
    source: 'composer_db',
    ttlSeconds: 300,
    staleAfterSeconds: 600,
    investorSafe: true,
    format: 'number',
    goalDirection: 'up',
    supportsSegments: false,
  },
  'deployments-today': {
    key: 'deployments-today',
    label: 'Deployments (Today)',
    source: 'composer_db',
    ttlSeconds: 60,
    staleAfterSeconds: 300,
    investorSafe: true,
    format: 'number',
    goalDirection: 'up',
    supportsSegments: false,
  },
  'composer-workspaces': {
    key: 'composer-workspaces',
    label: 'Active Composer Workspaces',
    source: 'composer_db',
    ttlSeconds: 300,
    staleAfterSeconds: 600,
    investorSafe: true,
    format: 'number',
    goalDirection: 'up',
    supportsSegments: false,
  },
};

export const SOURCE_DEFINITIONS: Record<SourceType, { label: string; reliability: number }> = {
  stripe: { label: 'Stripe Payments', reliability: 0.99 },
  posthog: { label: 'PostHog Events', reliability: 0.95 },
  ga4: { label: 'Google Analytics', reliability: 0.98 },
  sako_db: { label: 'Sako DB (Neon)', reliability: 0.999 },
  composer_db: { label: 'Composer DB (Supabase)', reliability: 0.99 },
  neon: { label: 'Neon Infra', reliability: 0.999 },
  manual: { label: 'Manual Entry', reliability: 1.0 },
  ping: { label: 'Uptime Monitors', reliability: 0.999 },
};

export const UPTIME_MONITORS = [
  { label: 'Landing Page', url: 'https://trysako.com' },
  { label: 'Studio', url: 'https://studio.trysako.com' },
  { label: 'App', url: 'https://app.trysako.com' },
  { label: 'API Health', url: 'https://api.trysako.com/api/v1/health' },
];

export const SEGMENTS = ['all', 'paid', 'organic', 'enterprise', 'self_serve'] as const;
export type Segment = (typeof SEGMENTS)[number];

/**
 * Group metrics by category for UI display
 */
export const METRIC_GROUPS = {
  revenue: ['revenue-today', 'revenue-mtd', 'signups', 'total-users'],
  subscriptions: ['active-subscriptions', 'active-workspaces'],
  engagement: ['dau', 'activation', 'd7-retention'],
  operations: ['visits', 'conversion', 'churn-risk'],
  composer: ['gen-count', 'gen-success-rate', 'daily-burn', 'ai-tokens-today'],
  campaigns: ['campaigns-today', 'total-campaigns', 'deployments-today', 'composer-workspaces'],
} as const;

/**
 * Primary KPIs shown in the main tile grid
 */
export const PRIMARY_KPIS = [
  'revenue-today',
  'revenue-mtd',
  'signups',
  'dau',
  'activation',
  'd7-retention',
  'visits',
  'conversion',
  'churn-risk',
  'gen-count',
  'gen-success-rate',
  'daily-burn',
] as const;
