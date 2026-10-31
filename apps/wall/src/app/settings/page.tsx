'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { METRIC_CONTRACT } from '@/config/metrics';

export default function SettingsPage() {
  const router = useRouter();
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [hiddenKPIs, setHiddenKPIs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    // Save to localStorage
    localStorage.setItem(
      'sako_wall_settings',
      JSON.stringify({
        refreshInterval,
        hiddenKPIs,
      })
    );
    setTimeout(() => {
      setIsSaving(false);
      router.push('/wall');
    }, 500);
  };

  const toggleKPI = (key: string) => {
    setHiddenKPIs((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

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
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Customize your wall experience</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Refresh Interval */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icons.Refresh className="w-5 h-5" />
            Refresh Interval
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            How often the wall should poll for new data
          </p>
          <div className="flex gap-2">
            {[30, 60, 120, 300].map((interval) => (
              <button
                key={interval}
                onClick={() => setRefreshInterval(interval)}
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
                  refreshInterval === interval
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card border-border hover:bg-accent'
                )}
              >
                {interval < 60 ? `${interval}s` : `${interval / 60}m`}
              </button>
            ))}
          </div>
        </Card>

        {/* KPI Visibility */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icons.Eye className="w-5 h-5" />
            KPI Visibility
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Toggle which KPIs are shown on the wall
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(METRIC_CONTRACT).map((key) => {
              const metric = METRIC_CONTRACT[key];
              const isHidden = hiddenKPIs.includes(key);
              return (
                <Badge
                  key={key}
                  variant={isHidden ? 'outline' : 'default'}
                  className={cn(
                    'cursor-pointer transition-all',
                    isHidden ? 'opacity-50' : 'opacity-100'
                  )}
                  onClick={() => toggleKPI(key)}
                >
                  {isHidden ? <Icons.EyeClosed className="w-3 h-3 mr-1" /> : <Icons.Eye className="w-3 h-3 mr-1" />}
                  {metric.label}
                </Badge>
              );
            })}
          </div>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icons.Zap className="w-5 h-5" />
            Keyboard Shortcuts
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Refresh data</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">R</kbd>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Toggle investor mode</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">I</kbd>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Toggle fullscreen</span>
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F</kbd>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => router.push('/wall')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
