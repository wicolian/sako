'use client';

import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useWallContext } from '@/context/WallContext';

export function AlertStrip() {
  const { alerts } = useWallContext();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="w-full bg-background border-b border-border py-1.5 px-4 flex items-center gap-4 overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-r border-border pr-3">
        <Icons.Alert className="w-3.5 h-3.5" />
        Ops Alerts
      </div>
      <div className="flex gap-6 overflow-x-auto scrollbar-hide">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-center gap-2 text-xs whitespace-nowrap">
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                alert.severity === 'critical'
                  ? 'bg-destructive animate-pulse'
                  : alert.severity === 'warning'
                  ? 'bg-orange-500'
                  : 'bg-green-500'
              )}
            />
            <span className={cn(
              'font-medium',
              alert.severity === 'critical' ? 'text-destructive' : 
              alert.severity === 'warning' ? 'text-orange-500' : 
              'text-foreground'
            )}>
              {alert.message}
            </span>
            <span className="text-muted-foreground font-mono text-[10px]">({alert.timestamp})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
