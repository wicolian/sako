// --- Core Domain Types ---

export type SourceType = 'stripe' | 'posthog' | 'ga4' | 'sako_db' | 'composer_db' | 'manual' | 'neon' | 'ping';
export type MetricFormat = 'currency' | 'percent' | 'number' | 'time' | 'latency';
export type DataTrustState = 'OK' | 'DEGRADED' | 'STALE' | 'DOWN';

export interface MetricDrilldown {
  view: 'trend' | 'bar' | 'table';
  breakdownBy?: string[];
}

// 1. The Metric Contract
export interface MetricDef {
  key: string;
  label: string;
  source: SourceType;
  queryParams?: Record<string, unknown>;
  ttlSeconds: number; // How long to cache (e.g., 180s)
  staleAfterSeconds: number; // When to show "Stale" warning (e.g., 600s)
  investorSafe: boolean; // If false, masked in investor mode
  format: MetricFormat;
  drilldown?: MetricDrilldown;
  target?: string; // Static target for pacing
  goalDirection: 'up' | 'down'; // 'up' means higher is better (Revenue), 'down' means lower is better (Latency)
  supportsSegments?: boolean;
}

// 2. Data Engine Types
export interface MetricValue {
  key: string;
  value: number;
  prevValue: number; // For delta calc
  formattedValue: string;
  delta: string;
  deltaIsPositive: boolean;
  timestamp: number;
  sparkline: { value: number }[];
  pacing?: number;
  warning?: string; // For segment not supported etc
}

export interface SourceStatus {
  key: SourceType;
  label: string;
  status: DataTrustState;
  lastSuccessAt: number | null;
  lastAttemptAt: number | null;
  errorCount: number;
  latencyMs: number;
  lastError?: string;
}

// --- UI Consumption Types ---

export interface ScoreboardData {
  score: number; // 0-100
  status: 'winning' | 'at_risk' | 'losing';
  revenueForecast: string;
  signupForecast: string;
}

export interface PodData {
  open: number;
  notStarted: number;
  inProgress: number;
  inReview: number;
  completed: number;
  avgCycleTime: string;
  blocked: number;
}

export interface ComposerData {
  generations: number;
  successRate: number;
  avgLatency: string;
  costToday: number;
  costPerGen: string;
  tokensTotal: string;
  errorRate: number;
}

export interface AlertItem {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  source?: SourceType;
}

export interface ContextLogItem {
  id: string;
  type: 'deploy' | 'campaign' | 'incident' | 'config';
  title: string;
  time: string;
}

export interface SocialPost {
  platform: 'linkedin' | 'twitter';
  title: string;
  impressions: string;
  reactions: string;
  comments: string;
  postedAt: string;
}

export interface UserSettings {
  refreshInterval: number;
  investorMode: boolean;
  activeSegment: string;
  cacheTTL: number;
  hiddenKPIs: string[];
}

export interface ChartDataPoint {
  date: string;
  value: number;
  value2?: number;
  annotation?: string;
  annotationType?: 'positive' | 'negative' | 'neutral';
}

export interface BreakdownItem {
  id: string;
  source: string;
  value: string;
  share: number;
}

import type { UptimeResult } from '@/providers/uptime';

// Top Movers
export interface TopMover {
  key: string;
  label: string;
  delta: string;
  deltaIsPositive: boolean;
  goalDirection: 'up' | 'down';
}

// API Response Types
export interface WallSummaryResponse {
  tiles: (MetricValue & { label: string; investorSafe: boolean; target?: string; goalDirection: 'up' | 'down' })[];
  charts: {
    dau: ChartDataPoint[];
    revenue: ChartDataPoint[];
  };
  sourceHealth: SourceStatus[];
  uptime: UptimeResult[];
  alerts: AlertItem[];
  contextLogs: ContextLogItem[];
  socialPost: SocialPost | null;
  topMovers: TopMover[];
  scoreboard: ScoreboardData;
  podData: PodData;
  composerData: ComposerData;
  lastUpdated: number;
}

export interface WallMetricResponse {
  metric: MetricValue;
  history: ChartDataPoint[];
  breakdown: BreakdownItem[];
}
