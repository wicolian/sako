'use client';

/**
 * Analytics Page (Jan 2026)
 * 
 * Real performance analytics with:
 * - Campaign metrics (impressions, clicks, conversions)
 * - Claim-level analytics
 * - Asset performance
 * - Time series charts
 * - ROI calculations
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Zap,
  Users,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Target,
  Layers,
  Eye,
  MousePointer,
  CheckCircle,
  Shield,
  Loader2,
  RefreshCw,
  Download,
  Calendar,
} from 'lucide-react';

interface AnalyticsData {
  period: string;
  startDate: string;
  endDate: string;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    claimViews: number;
    ctr: number;
    conversionRate: number;
    revenue: number;
    totalEvents: number;
  };
  claimAnalytics: Array<{
    claimId: string;
    text: string;
    status: string;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
  }>;
  assetAnalytics: Array<{
    assetId: string;
    type: string;
    format: string;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
  }>;
  timeSeries: Array<{
    date: string;
    impressions: number;
    clicks: number;
    conversions: number;
  }>;
}

interface UsageData {
  limits: {
    aiGenerations: number | 'unlimited';
    campaigns: number | 'unlimited';
    brands: number | 'unlimited';
    teamSeats: number | 'unlimited';
    apiCalls: number | 'unlimited';
  };
  current: {
    aiGenerations: number;
    campaigns: number;
    brands: number;
    teamSeats: number;
    apiCalls: number;
    periodStart: string;
    periodEnd: string;
  };
  breakdown: { date: string; aiGenerations: number; deployments: number }[];
  costEstimate: number;
  alerts: { type: string; percentUsed: number; message: string }[];
}

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState('30d');

  const fetchData = async () => {
    try {
      // Fetch analytics
      const analyticsRes = await fetch(`/api/analytics?period=${period}`);
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalyticsData(data);
      }

      // Fetch usage
      const usageRes = await fetch('/api/usage');
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsageData(data);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] min-h-screen bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const calculatePercent = (used: number, limit: number | 'unlimited') => {
    if (limit === 'unlimited') return 0;
    return Math.min(100, (used / limit) * 100);
  };

  const metrics = analyticsData?.metrics || {
    impressions: 0,
    clicks: 0,
    conversions: 0,
    claimViews: 0,
    ctr: 0,
    conversionRate: 0,
    revenue: 0,
    totalEvents: 0,
  };

  // Calculate max for chart scaling
  const maxImpressions = Math.max(
    ...((analyticsData?.timeSeries || []).map(d => d.impressions) || [1])
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your performance, usage, and ROI
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {usageData?.alerts && usageData.alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {usageData.alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border flex items-center gap-3 ${
                alert.percentUsed >= 100
                  ? 'bg-destructive/10 border-destructive/30'
                  : 'bg-yellow-500/10 border-yellow-500/30'
              }`}
            >
              <AlertTriangle
                className={`w-5 h-5 ${
                  alert.percentUsed >= 100 ? 'text-destructive' : 'text-yellow-500'
                }`}
              />
              <span className="flex-1">{alert.message}</span>
              <Button variant="outline" size="sm">
                Upgrade
              </Button>
            </motion.div>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="roi">ROI (Coming Soon)</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Impressions</p>
                    <p className="text-2xl font-bold">
                      {metrics.impressions.toLocaleString()}
                    </p>
                    <p className="text-xs text-emerald-500 flex items-center mt-1">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      +12% vs last period
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Eye className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Clicks</p>
                    <p className="text-2xl font-bold">
                      {metrics.clicks.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {metrics.ctr}% CTR
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <MousePointer className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Conversions</p>
                    <p className="text-2xl font-bold">
                      {metrics.conversions.toLocaleString()}
                    </p>
                    <p className="text-xs text-emerald-500 flex items-center mt-1">
                      <ArrowUpRight className="h-3 w-3 mr-1" />
                      {metrics.conversionRate}% rate
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-emerald-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Claim Views</p>
                    <p className="text-2xl font-bold">
                      {metrics.claimViews.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Evidence interactions
                    </p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-violet-500/10 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-violet-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Chart */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Over Time
              </CardTitle>
              <CardDescription>
                Daily impressions, clicks, and conversions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end gap-1">
                {(analyticsData?.timeSeries || []).map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col gap-0.5 items-center group">
                    <div className="w-full flex flex-col gap-0.5">
                      <div
                        className="w-full bg-primary/20 rounded-t transition-all group-hover:bg-primary/40"
                        style={{
                          height: `${Math.max(4, (day.impressions / maxImpressions) * 180)}px`,
                        }}
                        title={`${day.impressions} impressions`}
                      />
                      <div
                        className="w-full bg-blue-500 rounded transition-all group-hover:bg-blue-400"
                        style={{
                          height: `${Math.max(2, (day.clicks / maxImpressions) * 180)}px`,
                        }}
                        title={`${day.clicks} clicks`}
                      />
                      <div
                        className="w-full bg-emerald-500 rounded-b transition-all group-hover:bg-emerald-400"
                        style={{
                          height: `${Math.max(2, (day.conversions / maxImpressions) * 180)}px`,
                        }}
                        title={`${day.conversions} conversions`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {new Date(day.date).getDate()}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-6 mt-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary/40 rounded" />
                  <span className="text-sm text-muted-foreground">Impressions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded" />
                  <span className="text-sm text-muted-foreground">Clicks</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded" />
                  <span className="text-sm text-muted-foreground">Conversions</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Top Performing Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData?.assetAnalytics && analyticsData.assetAnalytics.length > 0 ? (
                  <div className="space-y-4">
                    {analyticsData.assetAnalytics.slice(0, 5).map((asset, i) => (
                      <div
                        key={asset.assetId}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium capitalize">{asset.type}</p>
                          <p className="text-sm text-muted-foreground">
                            {asset.impressions.toLocaleString()} impressions • {asset.ctr}% CTR
                          </p>
                        </div>
                        <Badge variant={i === 0 ? 'default' : 'secondary'}>
                          {i === 0 ? 'Top' : `#${i + 1}`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No asset data yet. Deploy campaigns to see performance.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Top Performing Claims
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analyticsData?.claimAnalytics && analyticsData.claimAnalytics.length > 0 ? (
                  <div className="space-y-4">
                    {analyticsData.claimAnalytics.slice(0, 5).map((claim, i) => (
                      <div
                        key={claim.claimId}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="font-medium truncate">{claim.text}</p>
                          <p className="text-sm text-muted-foreground">
                            {claim.impressions.toLocaleString()} views • {claim.ctr}% CTR
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            claim.status === 'supported'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                              : claim.status === 'weak'
                              ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 '
                              : ''
                          }
                        >
                          {claim.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No claim data yet. Add claims to see performance.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>
                Detailed metrics for each campaign
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData?.assetAnalytics && analyticsData.assetAnalytics.length > 0 ? (
                <div className="space-y-4">
                  {analyticsData.assetAnalytics.map((asset) => (
                    <div
                      key={asset.assetId}
                      className="p-4 rounded-lg border"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-medium capitalize">{asset.type}</p>
                          <p className="text-sm text-muted-foreground">{asset.format}</p>
                        </div>
                        <Badge>{asset.ctr}% CTR</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">{asset.impressions.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Impressions</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{asset.clicks.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Clicks</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{asset.conversions.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Conversions</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No campaign data available. Deploy campaigns to see metrics.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claims">
          <Card>
            <CardHeader>
              <CardTitle>Claim-Level Analytics</CardTitle>
              <CardDescription>
                See which claims drive the most engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsData?.claimAnalytics && analyticsData.claimAnalytics.length > 0 ? (
                <div className="space-y-4">
                  {analyticsData.claimAnalytics.map((claim) => (
                    <div
                      key={claim.claimId}
                      className="p-4 rounded-lg border"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <p className="font-medium flex-1">{claim.text}</p>
                        <Badge
                          variant="outline"
                          className={
                            claim.status === 'supported'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                              : claim.status === 'weak'
                              ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 '
                              : 'bg-destructive/10 text-destructive dark:bg-red-500/20 '
                          }
                        >
                          {claim.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-xl font-bold">{claim.impressions.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Views</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold">{claim.clicks.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Clicks</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold">{claim.conversions.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Conversions</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold">{claim.ctr}%</p>
                          <p className="text-xs text-muted-foreground">CTR</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No claim analytics yet. Add the tracking snippet to your pages.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
                <CardDescription>
                  Current billing period:{' '}
                  {usageData?.current.periodStart &&
                    new Date(usageData.current.periodStart).toLocaleDateString()}{' '}
                  -{' '}
                  {usageData?.current.periodEnd &&
                    new Date(usageData.current.periodEnd).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  {
                    name: 'AI Generations',
                    used: usageData?.current.aiGenerations || 0,
                    limit: usageData?.limits.aiGenerations,
                    icon: Zap,
                    color: 'text-primary',
                  },
                  {
                    name: 'Campaigns',
                    used: usageData?.current.campaigns || 0,
                    limit: usageData?.limits.campaigns,
                    icon: Target,
                    color: 'text-blue-500',
                  },
                  {
                    name: 'Brands',
                    used: usageData?.current.brands || 0,
                    limit: usageData?.limits.brands,
                    icon: Layers,
                    color: 'text-violet-500',
                  },
                  {
                    name: 'API Calls',
                    used: usageData?.current.apiCalls || 0,
                    limit: usageData?.limits.apiCalls,
                    icon: Activity,
                    color: 'text-emerald-500',
                  },
                ].map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <item.icon className={`w-4 h-4 ${item.color}`} />
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {item.used.toLocaleString()} / {item.limit === 'unlimited' ? '∞' : item.limit?.toLocaleString()}
                      </span>
                    </div>
                    <Progress
                      value={calculatePercent(item.used, item.limit || 'unlimited')}
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
                <CardDescription>
                  Estimated AI costs for this billing period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'Landing Pages', cost: 12.50, percent: 45 },
                    { name: 'Email Sequences', cost: 8.20, percent: 30 },
                    { name: 'Claims Validation', cost: 4.80, percent: 17 },
                    { name: 'Other', cost: 2.20, percent: 8 },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded"
                          style={{
                            backgroundColor: `hsl(${item.percent * 2.5}, 70%, 50%)`,
                          }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">${item.cost.toFixed(2)}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          ({item.percent}%)
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between font-medium">
                      <span>Total Estimated Cost</span>
                      <span>${(usageData?.costEstimate || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roi">
          <Card>
            <CardHeader>
              <CardTitle>ROI Calculator</CardTitle>
              <CardDescription>
                This view is not ready for launch because the ROI model is not grounded in live financial inputs yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Badge variant="secondary" className="mb-3">Coming Soon</Badge>
                <p className="text-sm text-muted-foreground">
                  ROI reporting will return once cost inputs and attributed revenue are connected to live campaign analytics.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
