'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useWallContext } from '@/context/WallContext';
import { METRIC_CONTRACT } from '@/config/metrics';
import {
  WorldClock,
  SystemStatusPanel,
  PodOpsPanel,
  DataTrustIndicator,
  TopMoversPanel,
  ComposerOpsPanel,
  SocialBlock,
  ContextLog,
} from '@/components/wall/Panels';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  Tooltip,
  BarChart,
  Bar,
  ReferenceLine,
  Label,
} from 'recharts';

// ==================== DailyScoreboard ====================
function DailyScoreboard() {
  const { investorMode, scoreboard, metrics } = useWallContext();

  const score = scoreboard?.score ?? 50;
  const status = scoreboard?.status ?? 'at_risk';
  const revenueForecast = scoreboard?.revenueForecast ?? '$0';
  const signupForecast = scoreboard?.signupForecast ?? '0';

  const statusColor = status === 'winning' ? 'text-chart-2' : status === 'at_risk' ? 'text-orange-500' : 'text-destructive';
  const statusBg = status === 'winning' ? 'bg-chart-2/10' : status === 'at_risk' ? 'bg-orange-500/10' : 'bg-destructive/10';

  // Calculate pacing based on actual values vs targets
  const revenueToday = metrics['revenue-today']?.value || 0;
  const signupsToday = metrics['signups']?.value || 0;
  const hour = new Date().getHours();
  const expectedProgress = hour / 24;
  const pacingPercent = revenueToday > 0 ? Math.min((revenueToday / 5000) / expectedProgress, 1) : 0.5;
  const pacingStatus = pacingPercent >= 0.9 ? 'Ahead' : pacingPercent >= 0.7 ? 'On Track' : 'Behind';

  return (
    <Card className="p-3 flex flex-col sm:flex-row items-center justify-between bg-card/50 backdrop-blur-sm border-primary/20 mb-4 gap-4 sm:gap-0">
      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Today Score</span>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-3xl font-black font-mono leading-none', statusColor)}>{score}</span>
            <Badge variant="outline" className={cn('text-[10px] h-4 uppercase', statusBg, statusColor, 'border-none')}>
              {status.replace('_', ' ')}
            </Badge>
          </div>
        </div>
        <div className="h-8 w-px bg-border hidden sm:block" />
        <div className="flex flex-col justify-center gap-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">EOD Rev:</span>
            <span className="font-mono font-medium">{investorMode ? '••••' : revenueForecast}</span>
            <Icons.ArrowUp className="w-3 h-3 text-chart-2" />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">EOD Signups:</span>
            <span className="font-mono font-medium">{signupForecast}</span>
            <Icons.ArrowUp className="w-3 h-3 text-chart-2" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground w-full sm:w-auto justify-end">
        <span>Pacing:</span>
        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn('h-full', pacingPercent >= 0.9 ? 'bg-chart-2' : pacingPercent >= 0.7 ? 'bg-orange-500' : 'bg-destructive')} 
            style={{ width: `${pacingPercent * 100}%` }}
          />
        </div>
        <span className="font-medium text-foreground">{pacingStatus}</span>
      </div>
    </Card>
  );
}

// ==================== SmartFunnelRow ====================
function SmartFunnelRow() {
  const { metrics } = useWallContext();

  const visits = metrics['visits']?.value || 0;
  const signups = metrics['signups']?.value || 0;
  const activationRate = metrics['activation']?.value || 0;
  const retentionRate = metrics['d7-retention']?.value || 0;

  const activated = Math.round(signups * (activationRate / 100));
  const retained = Math.round(activated * (retentionRate / 100));

  const signupRate = visits > 0 ? ((signups / visits) * 100).toFixed(1) : '0';
  const activatedDrop = signups > 0 ? (100 - (activated / signups) * 100).toFixed(0) : '0';
  const retainedDrop = activated > 0 ? (100 - (retained / activated) * 100).toFixed(0) : '0';

  const steps = [
    { label: 'Visits', value: formatCompact(visits) },
    { label: 'Signups', value: formatCompact(signups), rate: `${signupRate}%`, drop: `${100 - parseFloat(signupRate)}%` },
    { label: 'Activated', value: formatCompact(activated), rate: `${activationRate}%`, drop: `${activatedDrop}%` },
    { label: 'Retained', value: formatCompact(retained), rate: `${retentionRate}%`, drop: `${retainedDrop}%` },
  ];

  const activationIsLow = activationRate < 50;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      {steps.map((step, i) => (
        <div
          key={i}
          className={cn(
            'relative flex flex-col p-3 border rounded-lg shadow-sm overflow-hidden',
            step.label === 'Activated' && activationIsLow ? 'bg-orange-500/5 border-orange-500/30' : 'bg-card border-border'
          )}
        >
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">{step.label}</span>
            {i > 0 && <span className="text-[9px] text-muted-foreground">-{step.drop}</span>}
          </div>
          <div className="flex items-end gap-2 mt-1">
            <span className="text-xl font-mono font-medium text-foreground">{step.value}</span>
            {step.rate && (
              <span className={cn('text-xs mb-1', step.label === 'Activated' && activationIsLow ? 'text-orange-500 font-bold' : 'text-muted-foreground')}>
                ({step.rate})
              </span>
            )}
          </div>
          {step.label === 'Activated' && activationIsLow && (
            <div className="absolute bottom-1 right-1">
              <Icons.Alert className="w-3 h-3 text-orange-500 opacity-50" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatCompact(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

// ==================== AnnotatedChart ====================
function AnnotatedChart() {
  const { charts, contextLogs } = useWallContext();
  const dauData = charts.dau;

  // Map context logs to chart annotations
  const annotatedData = dauData.map((point, index) => {
    // Find matching context log by approximate date (simplified)
    const log = contextLogs.find(l => {
      // Match if log time contains the date part
      return l.time.toLowerCase().includes('now') && index === dauData.length - 1;
    });

    return {
      ...point,
      annotation: log?.title?.slice(0, 15),
      annotationType: log?.type === 'incident' ? 'negative' : log?.type === 'deploy' ? 'neutral' : undefined,
    };
  });

  return (
    <Card className="p-4 h-full relative min-h-[220px]">
      <h4 className="text-xs font-medium text-muted-foreground mb-2 absolute top-4 left-4">DAU Trend (14D) + Context</h4>
      <div className="h-full pt-6">
        {dauData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={annotatedData}>
              <XAxis dataKey="date" hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--popover)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
                itemStyle={{ color: 'var(--popover-foreground)', fontFamily: 'var(--font-mono)' }}
                labelStyle={{ display: 'none' }}
              />
              <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              {annotatedData.map((entry, index) => {
                if (entry.annotation) {
                  return (
                    <ReferenceLine
                      key={index}
                      x={entry.date}
                      stroke={entry.annotationType === 'negative' ? 'var(--destructive)' : 'var(--muted-foreground)'}
                      strokeDasharray="3 3"
                    >
                      <Label
                        value={entry.annotation}
                        position="top"
                        style={{ fill: 'var(--muted-foreground)', fontSize: '10px', textTransform: 'uppercase' }}
                      />
                    </ReferenceLine>
                  );
                }
                return null;
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Collecting data...
          </div>
        )}
      </div>
    </Card>
  );
}

// ==================== Main Wall Page ====================
export default function WallPage() {
  const router = useRouter();
  const { investorMode, settings, metrics, charts, podData, composerData } = useWallContext();

  // Get visible KPIs
  const metricKeys = Object.keys(METRIC_CONTRACT);
  const visibleKPIs = metricKeys
    .filter((key) => !settings.hiddenKPIs.includes(key))
    .map((key) => ({
      ...METRIC_CONTRACT[key],
      ...(metrics[key] || {
        key,
        value: 0,
        prevValue: 0,
        formattedValue: '--',
        delta: '0%',
        deltaIsPositive: true,
        timestamp: typeof window !== 'undefined' ? Date.now() : 0,
        sparkline: [],
      }),
    }));

  const revenueData = charts.revenue;

  return (
    <div className="p-4 h-[calc(100vh-80px)] overflow-y-auto lg:overflow-hidden animate-slide-in flex flex-col lg:grid lg:grid-cols-[220px_1fr_260px] gap-4">
      {/* LEFT RAIL: Delivery & Status */}
      <div className="flex flex-col gap-4 lg:overflow-y-auto pr-1 scrollbar-hide order-2 lg:order-1">
        <WorldClock />
        <SystemStatusPanel />
        <PodOpsPanel data={podData || undefined} />
        <div className="mt-auto space-y-4">
          <DataTrustIndicator />
        </div>
      </div>

      {/* CENTER RAIL: Main metrics */}
      <div className="flex flex-col gap-4 lg:overflow-y-auto scrollbar-hide order-1 lg:order-2">
        <DailyScoreboard />
        <SmartFunnelRow />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleKPIs.slice(0, 8).map((kpi, index) => (
            <Card
              key={kpi.key}
              className="p-4 flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group h-[160px] relative overflow-hidden"
              onClick={() => router.push(`/detail/${kpi.key}`)}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="absolute inset-0 border-2 border-primary opacity-0 group-hover:opacity-100 rounded-lg transition-opacity pointer-events-none" />

              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-medium text-muted-foreground truncate pr-2">{kpi.label}</span>
                <div
                  className={cn(
                    'flex items-center text-[10px] font-bold px-1 py-0.5 rounded',
                    kpi.deltaIsPositive ? 'text-chart-2 bg-chart-2/10' : 'text-destructive bg-destructive/10'
                  )}
                >
                  {kpi.deltaIsPositive ? (
                    <Icons.ArrowUp className="w-2.5 h-2.5 mr-0.5" />
                  ) : (
                    <Icons.ArrowDown className="w-2.5 h-2.5 mr-0.5" />
                  )}
                  {kpi.delta}
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                {investorMode && !kpi.investorSafe ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-2xl font-mono tracking-tighter text-muted-foreground/50 select-none">••••</span>
                    <div className="inline-flex items-center gap-1 text-[10px] text-primary/70">
                      <Icons.EyeClosed className="w-3 h-3" /> Hidden
                    </div>
                  </div>
                ) : (
                  <span className="text-3xl font-mono font-medium tracking-tight text-foreground">{kpi.formattedValue}</span>
                )}
              </div>

              <div className="space-y-1.5">
                {kpi.target && (
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Target: {kpi.target}</span>
                  </div>
                )}
                {kpi.pacing !== undefined && (
                  <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full', kpi.pacing >= 1 ? 'bg-chart-2' : 'bg-orange-500')}
                      style={{ width: `${Math.min(kpi.pacing * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-auto lg:h-[220px] flex-shrink-0">
          <AnnotatedChart />
          <Card className="p-4 min-h-[220px]">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">Revenue Mix</h4>
            <div className="h-[160px]">
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData.slice(0, 7)}>
                    <Bar dataKey="value" fill="var(--chart-2)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Collecting data...
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* RIGHT RAIL: Context & Infra */}
      <div className="flex flex-col gap-4 lg:overflow-y-auto pl-1 scrollbar-hide order-3">
        <TopMoversPanel />
        <ComposerOpsPanel data={composerData || undefined} />
        <SocialBlock />
        <div className="flex-1 min-h-[200px]">
          <ContextLog />
        </div>
      </div>
    </div>
  );
}
