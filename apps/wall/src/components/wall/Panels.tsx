'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useWallContext } from '@/context/WallContext';
import type { PodData, ComposerData, SourceStatus, TopMover } from '@/types';

// ==================== WorldClock ====================
export function WorldClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // Only set time on client side to avoid hydration mismatch
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const getTime = (zone: string) => {
    if (!now) return '--:--';
    return now.toLocaleTimeString('en-US', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Icons.Globe className="w-3.5 h-3.5" />
        World Time
      </div>
      <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
        <div className="flex flex-col lg:flex-row justify-between items-center lg:border-b border-border/50 pb-0 lg:pb-2">
          <span className="text-xs font-bold text-chart-2">IST</span>
          <span className="font-mono text-sm lg:text-lg font-medium tracking-tight">{getTime('Asia/Kolkata')}</span>
        </div>
        <div className="flex flex-col lg:flex-row justify-between items-center lg:border-b border-border/50 pb-0 lg:pb-2">
          <span className="text-xs text-muted-foreground">UTC</span>
          <span className="font-mono text-xs lg:text-sm">{getTime('UTC')}</span>
        </div>
        <div className="flex flex-col lg:flex-row justify-between items-center">
          <span className="text-xs text-muted-foreground">PST</span>
          <span className="font-mono text-xs lg:text-sm">{getTime('America/Los_Angeles')}</span>
        </div>
      </div>
    </Card>
  );
}

// ==================== SystemStatusPanel ====================
export function SystemStatusPanel() {
  const { uptime } = useWallContext();

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Icons.Server className="w-3.5 h-3.5" />
        Product Status
      </div>
      <div className="space-y-3">
        {uptime.length > 0 ? (
          uptime.map((monitor) => (
            <div key={monitor.url} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate mr-2" title={monitor.url}>
                {monitor.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{monitor.latencyMs}ms</span>
                <Badge
                  variant={monitor.status === 'UP' ? 'success' : 'destructive'}
                  className="h-5 px-1.5 text-[10px] uppercase"
                >
                  {monitor.status}
                </Badge>
              </div>
            </div>
          ))
        ) : (
          <div className="text-[10px] text-muted-foreground italic">No monitors configured</div>
        )}

        <div className="text-[10px] text-center text-muted-foreground pt-1">
          Source: External Uptime
        </div>
      </div>
    </Card>
  );
}

// ==================== PodOpsPanel ====================
interface PodOpsPanelProps {
  data?: PodData;
}

export function PodOpsPanel({ data }: PodOpsPanelProps) {
  const podData: PodData = data || {
    open: 0,
    notStarted: 0,
    inProgress: 0,
    inReview: 0,
    completed: 0,
    avgCycleTime: '—',
    blocked: 0,
  };

  const totalActive = podData.open > 0 ? podData.open : 1; // Prevent divide by zero

  const bottleneck =
    podData.inReview > podData.inProgress
      ? 'Bottleneck: Review'
      : podData.notStarted > podData.open * 0.5
      ? 'Bottleneck: Capacity'
      : null;

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Icons.Box className="w-3.5 h-3.5" /> Pod Ops
        </div>
        {podData.blocked > 0 && (
          <Badge variant="destructive" className="h-4 px-1 text-[9px]">
            {podData.blocked} Blocked
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Pipeline Health</span>
            <span>{podData.open} Tasks</span>
          </div>
          <div className="flex h-2 w-full rounded-sm overflow-hidden gap-0.5">
            <div
              className="bg-muted h-full"
              style={{ width: `${(podData.notStarted / totalActive) * 100}%` }}
              title="Not Started"
            />
            <div
              className="bg-primary h-full"
              style={{ width: `${(podData.inProgress / totalActive) * 100}%` }}
              title="In Progress"
            />
            <div
              className="bg-orange-500 h-full"
              style={{ width: `${(podData.inReview / totalActive) * 100}%` }}
              title="Review"
            />
            <div
              className="bg-chart-2 h-full"
              style={{ width: `${(podData.completed / totalActive) * 100}%` }}
              title="Done"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/10 p-2 rounded border border-border">
            <div className="text-muted-foreground text-[10px]">WIP</div>
            <div className="font-mono font-medium text-foreground">{podData.inProgress + podData.inReview}</div>
          </div>
          <div className="bg-muted/10 p-2 rounded border border-border">
            <div className="text-muted-foreground text-[10px]">Avg Cycle</div>
            <div className="font-mono font-medium text-foreground">{podData.avgCycleTime}</div>
          </div>
        </div>

        {bottleneck && (
          <div className="flex items-center gap-1.5 text-[10px] text-orange-400 bg-orange-500/10 p-1.5 rounded border border-orange-500/20">
            <Icons.Alert className="w-3 h-3" />
            {bottleneck}
          </div>
        )}
      </div>
    </Card>
  );
}

// ==================== DataTrustIndicator ====================
export function DataTrustIndicator() {
  const [open, setOpen] = useState(false);
  const { sources } = useWallContext();
  
  const overallStatus = sources.length > 0 && sources.every((d) => d.status === 'OK') ? 'healthy' : 'degraded';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between p-2 rounded-md border text-xs transition-colors',
          overallStatus === 'healthy'
            ? 'border-green-500/20 bg-green-500/5 text-green-500 hover:bg-green-500/10'
            : 'border-orange-500/20 bg-orange-500/5 text-orange-500 hover:bg-orange-500/10'
        )}
      >
        <div className="flex items-center gap-2">
          <Icons.Shield className="w-3.5 h-3.5" />
          <span className="font-medium">Data Trust</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="capitalize">{overallStatus}</span>
          <div
            className={cn('w-1.5 h-1.5 rounded-full', overallStatus === 'healthy' ? 'bg-green-500' : 'bg-orange-500')}
          />
        </div>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-popover border border-border rounded-lg shadow-xl z-20 space-y-2 w-[220px]">
          <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Source Health</h4>
          {sources.map((source) => (
            <div key={source.key} className="flex items-center justify-between text-xs">
              <span className="text-foreground">{source.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{source.latencyMs}ms</span>
                {source.status === 'OK' ? (
                  <Icons.Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Icons.Alert className="w-3 h-3 text-orange-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== ComposerOpsPanel ====================
interface ComposerOpsPanelProps {
  data?: ComposerData;
}

export function ComposerOpsPanel({ data }: ComposerOpsPanelProps) {
  const { investorMode } = useWallContext();

  const composerData: ComposerData = data || {
    generations: 0,
    successRate: 0,
    avgLatency: '—',
    costToday: 0,
    costPerGen: '$0.000',
    tokensTotal: '0',
    errorRate: 0,
  };

  return (
    <Card className="p-3 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Icons.Cpu className="w-3.5 h-3.5" /> Composer
        </div>
        <div className={cn('text-[10px] font-mono', composerData.errorRate > 1 ? 'text-destructive' : 'text-chart-2')}>
          {composerData.errorRate.toFixed(1)}% Err
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-muted/10 p-2 rounded border border-border">
          <div className="text-[10px] text-muted-foreground">Gen Count</div>
          <div className="text-sm font-mono font-medium">{composerData.generations.toLocaleString()}</div>
        </div>
        <div className="bg-muted/10 p-2 rounded border border-border">
          <div className="text-[10px] text-muted-foreground">Success %</div>
          <div
            className={cn('text-sm font-mono font-medium', composerData.successRate < 99 ? 'text-orange-500' : 'text-chart-2')}
          >
            {composerData.successRate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-muted/10 p-2 rounded border border-border">
          <div className="text-[10px] text-muted-foreground">Latency</div>
          <div className="text-sm font-mono font-medium">{composerData.avgLatency}</div>
        </div>
        <div className="bg-muted/10 p-2 rounded border border-border">
          <div className="text-[10px] text-muted-foreground">Cost/Gen</div>
          {investorMode ? (
            <span className="text-xs font-mono text-muted-foreground">•••</span>
          ) : (
            <div className="text-sm font-mono font-medium">{composerData.costPerGen}</div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Daily Burn</span>
          {investorMode ? <span>$•••</span> : <span>${composerData.costToday.toFixed(2)}</span>}
        </div>
        <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
          <div className="h-full bg-chart-1 w-[65%]" />
        </div>
        <div className="text-[9px] text-right text-muted-foreground">{composerData.tokensTotal} tokens</div>
      </div>
    </Card>
  );
}

// ==================== TopMoversPanel ====================
export function TopMoversPanel() {
  const { topMovers } = useWallContext();

  return (
    <Card className="p-3 mb-4">
      <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Icons.Trending className="w-3.5 h-3.5" /> Top Movers
      </div>
      <div className="space-y-2">
        {topMovers.map((m, idx) => (
          <div key={m.key || idx} className="flex items-center justify-between text-xs border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
            <span className="truncate max-w-[100px]">{m.label.split('(')[0]}</span>
            <div
              className={cn(
                'flex items-center font-mono font-bold',
                m.delta === '—' ? 'text-muted-foreground' :
                (m.deltaIsPositive && m.goalDirection === 'up') || (!m.deltaIsPositive && m.goalDirection === 'down')
                  ? 'text-chart-2'
                  : 'text-destructive'
              )}
            >
              {m.delta}
              {m.delta !== '—' && (
                m.deltaIsPositive ? (
                  <Icons.ArrowUp className="w-3 h-3 ml-0.5" />
                ) : (
                  <Icons.ArrowDown className="w-3 h-3 ml-0.5" />
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ==================== SocialBlock ====================
export function SocialBlock() {
  const { socialPost } = useWallContext();

  if (!socialPost) {
    return (
      <Card className="p-3 mb-4">
        <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Icons.Linkedin className="w-3.5 h-3.5 text-[#0077b5]" />
          Latest Post
        </div>
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground italic">No social post configured</p>
          <p className="text-[10px] text-muted-foreground mt-1">Add via /admin/manual</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-3 mb-4">
      <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Icons.Linkedin className="w-3.5 h-3.5 text-[#0077b5]" />
        Latest Post
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium line-clamp-2 leading-relaxed">&ldquo;{socialPost.title}&rdquo;</p>
        <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-2">
          <div>
            <div className="text-lg font-mono font-medium text-foreground">{socialPost.impressions}</div>
            <div className="text-[10px] text-muted-foreground">Views</div>
          </div>
          <div>
            <div className="text-lg font-mono font-medium text-foreground">{socialPost.reactions}</div>
            <div className="text-[10px] text-muted-foreground">Likes</div>
          </div>
          <div>
            <div className="text-lg font-mono font-medium text-foreground">{socialPost.comments}</div>
            <div className="text-[10px] text-muted-foreground">Cmts</div>
          </div>
        </div>
        <div className="text-[10px] text-right text-muted-foreground">{socialPost.postedAt}</div>
      </div>
    </Card>
  );
}

// ==================== ContextLog ====================
export function ContextLog() {
  const { contextLogs } = useWallContext();

  return (
    <Card className="flex flex-col h-full bg-muted/10">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Icons.Terminal className="w-3.5 h-3.5" /> Context Log
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[200px]">
        {contextLogs.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground italic">No context logs</p>
          </div>
        ) : (
          contextLogs.map((log) => (
            <div key={log.id} className="relative pl-3 border-l-2 border-border pb-1">
              <div
                className={cn(
                  'absolute -left-[5px] top-1 w-2 h-2 rounded-full ring-2 ring-background',
                  log.type === 'deploy'
                    ? 'bg-chart-2'
                    : log.type === 'incident'
                    ? 'bg-destructive'
                    : log.type === 'campaign'
                    ? 'bg-primary'
                    : 'bg-muted-foreground'
                )}
              />
              <p className="text-xs font-medium leading-none mb-1">{log.title}</p>
              <p className="text-[10px] text-muted-foreground font-mono uppercase">
                {log.type} • {log.time}
              </p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
