'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { METRIC_CONTRACT, SEGMENTS } from '@/config/metrics';
import type { ChartDataPoint, BreakdownItem } from '@/types';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export default function DetailPage() {
  const router = useRouter();
  const params = useParams();
  const metricKey = params.metricKey as string;

  const [history, setHistory] = useState<ChartDataPoint[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [range, setRange] = useState<'7d' | '14d' | '30d'>('14d');
  const [isLoading, setIsLoading] = useState(true);

  const metric = METRIC_CONTRACT[metricKey];

  useEffect(() => {
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/wall/metric?key=${metricKey}&range=${range}`);
        if (response.ok) {
          const data = await response.json();
          setHistory(data.history || []);
          setBreakdown(data.breakdown || []);
        } else {
          // Empty data if API fails
          setHistory([]);
          setBreakdown([]);
        }
      } catch {
        // Empty data on error
        setHistory([]);
        setBreakdown([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [metricKey, range]);

  if (!metric) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Metric not found</h1>
          <p className="text-muted-foreground mb-4">The metric &quot;{metricKey}&quot; does not exist.</p>
          <Button onClick={() => router.push('/wall')}>Back to Wall</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/wall')} className="gap-2">
            <Icons.ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{metric.label}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {metric.source}
              </Badge>
              <span className="text-xs text-muted-foreground">
                TTL: {metric.ttlSeconds}s • Stale after: {metric.staleAfterSeconds}s
              </span>
            </div>
          </div>
        </div>

        {/* Range selector */}
        <div className="flex bg-muted/20 rounded-md p-0.5 border border-border">
          {(['7d', '14d', '30d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-sm transition-all',
                range === r ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Trend Over Time</h3>
          <div className="h-[400px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Icons.Chart className="w-12 h-12 mb-4 opacity-30" />
                <p className="text-sm">No historical data yet</p>
                <p className="text-xs mt-1">Data will accumulate from snapshots</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border)' }}
                    width={60}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                    }}
                    itemStyle={{ color: 'var(--popover-foreground)', fontFamily: 'var(--font-mono)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--chart-1)', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  {history[0]?.value2 !== undefined && (
                    <Line
                      type="monotone"
                      dataKey="value2"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Breakdown */}
          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Breakdown</h3>
            {breakdown.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No breakdown data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {breakdown.map((item) => (
                  <div key={item.id} className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span>{item.source}</span>
                      <span className="font-mono font-medium">{item.value}</span>
                    </div>
                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${item.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Metadata */}
          <Card className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Metric Info</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Format</span>
                <span className="font-mono">{metric.format}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target</span>
                <span className="font-mono">{metric.target || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Goal Direction</span>
                <span className="font-mono capitalize">{metric.goalDirection}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Investor Safe</span>
                <span>{metric.investorSafe ? '✓ Yes' : '✗ No'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Segments</span>
                <span>{metric.supportsSegments ? '✓ Supported' : '✗ Not supported'}</span>
              </div>
            </div>
          </Card>

          {/* Segment filter (if supported) */}
          {metric.supportsSegments && (
            <Card className="p-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Filter by Segment</h3>
              <div className="flex flex-wrap gap-2">
                {SEGMENTS.map((seg) => (
                  <Badge
                    key={seg}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 capitalize"
                  >
                    {seg}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
