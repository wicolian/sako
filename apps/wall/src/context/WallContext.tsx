'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { MetricValue, SourceStatus, UserSettings, WallSummaryResponse, AlertItem, ContextLogItem, SocialPost, TopMover, ChartDataPoint, ScoreboardData, PodData, ComposerData } from '@/types';
import type { UptimeResult } from '@/providers/uptime';

interface WallContextType {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Investor mode
  investorMode: boolean;
  toggleInvestorMode: () => void;

  // Settings
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;

  // Data state
  metrics: Record<string, MetricValue>;
  sources: SourceStatus[];
  uptime: UptimeResult[];
  alerts: AlertItem[];
  contextLogs: ContextLogItem[];
  socialPost: SocialPost | null;
  topMovers: TopMover[];
  charts: { dau: ChartDataPoint[]; revenue: ChartDataPoint[] };
  scoreboard: ScoreboardData | null;
  podData: PodData | null;
  composerData: ComposerData | null;
  lastUpdated: Date | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  refreshData: () => Promise<void>;

  // Fullscreen
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

const WallContext = createContext<WallContextType | null>(null);

export const useWallContext = () => {
  const context = useContext(WallContext);
  if (!context) {
    throw new Error('useWallContext must be used within WallProvider');
  }
  return context;
};

const defaultSettings: UserSettings = {
  refreshInterval: 60,
  cacheTTL: 120,
  investorMode: false,
  hiddenKPIs: [],
  activeSegment: 'all',
};

export function WallProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [investorMode, setInvestorMode] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [metrics, setMetrics] = useState<Record<string, MetricValue>>({});
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [uptime, setUptime] = useState<UptimeResult[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [contextLogs, setContextLogs] = useState<ContextLogItem[]>([]);
  const [socialPost, setSocialPost] = useState<SocialPost | null>(null);
  const [topMovers, setTopMovers] = useState<TopMover[]>([]);
  const [charts, setCharts] = useState<{ dau: ChartDataPoint[]; revenue: ChartDataPoint[] }>({ dau: [], revenue: [] });
  const [scoreboard, setScoreboard] = useState<ScoreboardData | null>(null);
  const [podData, setPodData] = useState<PodData | null>(null);
  const [composerData, setComposerData] = useState<ComposerData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedInvestorMode = localStorage.getItem('sako_investor_mode');
      if (savedInvestorMode === 'true') {
        setInvestorMode(true);
      }

      const savedSettings = localStorage.getItem('sako_wall_settings');
      if (savedSettings) {
        try {
          setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
        } catch {
          // Ignore parse errors
        }
      }
    }
  }, []);

  // Apply theme class
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const toggleInvestorMode = useCallback(() => {
    setInvestorMode((prev) => {
      const newValue = !prev;
      localStorage.setItem('sako_investor_mode', String(newValue));
      return newValue;
    });
  }, []);

  const updateSettings = useCallback((newSettings: Partial<UserSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('sako_wall_settings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        segment: settings.activeSegment,
        mode: investorMode ? 'investor' : 'internal',
      });

      const response = await fetch(`/api/wall/summary?${params}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }

      const data: WallSummaryResponse = await response.json();

      // Convert tiles array to metrics record
      const metricsRecord: Record<string, MetricValue> = {};
      for (const tile of data.tiles) {
        metricsRecord[tile.key] = tile;
      }

      setMetrics(metricsRecord);
      setSources(data.sourceHealth);
      setUptime(data.uptime);
      setAlerts(data.alerts || []);
      setContextLogs(data.contextLogs || []);
      setSocialPost(data.socialPost || null);
      setTopMovers(data.topMovers || []);
      setCharts(data.charts || { dau: [], revenue: [] });
      setScoreboard(data.scoreboard || null);
      setPodData(data.podData || null);
      setComposerData(data.composerData || null);
      setLastUpdated(new Date(data.lastUpdated));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to refresh wall data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [settings.activeSegment, investorMode]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        refreshData();
      }
      if (e.key.toLowerCase() === 'i') {
        e.preventDefault();
        toggleInvestorMode();
      }
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [refreshData, toggleInvestorMode, toggleFullscreen]);

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, settings.refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [refreshData, settings.refreshInterval]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, []);

  const value: WallContextType = {
    theme,
    toggleTheme,
    investorMode,
    toggleInvestorMode,
    settings,
    updateSettings,
    metrics,
    sources,
    uptime,
    alerts,
    contextLogs,
    socialPost,
    topMovers,
    charts,
    scoreboard,
    podData,
    composerData,
    lastUpdated,
    isLoading,
    error,
    refreshData,
    isFullscreen,
    toggleFullscreen,
  };

  return <WallContext.Provider value={value}>{children}</WallContext.Provider>;
}
