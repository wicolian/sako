'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useWallContext } from '@/context/WallContext';
import { SEGMENTS } from '@/config/metrics';

export function Header() {
  const router = useRouter();
  const {
    investorMode,
    toggleInvestorMode,
    lastUpdated,
    refreshData,
    settings,
    updateSettings,
    isFullscreen,
    toggleFullscreen,
  } = useWallContext();

  const [menuOpen, setMenuOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(settings.refreshInterval);

  useEffect(() => {
    setTimeLeft(settings.refreshInterval);
  }, [settings.refreshInterval, lastUpdated]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return settings.refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.refreshInterval]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const segments = SEGMENTS.map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  return (
    <>
      <header className="h-14 border-b border-border bg-background/95 backdrop-blur z-50 flex items-center justify-between px-4 sticky top-0">
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => router.push('/wall')}
          >
            <Image
              src="/sako-white.svg"
              alt="Sako"
              width={28}
              height={28}
              className="group-hover:scale-105 transition-transform"
            />
            <h1 className="font-bold text-base tracking-tight hidden md:block">Wall</h1>
          </div>

          <div className="h-4 w-px bg-border hidden md:block" />

          {/* Segmentation Toggle */}
          <div className="hidden md:flex bg-muted/20 rounded-md p-0.5 border border-border">
            {segments.map((seg) => (
              <button
                key={seg}
                onClick={() => updateSettings({ activeSegment: seg.toLowerCase() })}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-sm transition-all',
                  settings.activeSegment === seg.toLowerCase()
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {seg}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile Menu Toggle */}
          <button className="md:hidden p-2 text-muted-foreground" onClick={() => setMenuOpen(!menuOpen)}>
            <Icons.Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground font-mono mr-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-sonar absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </div>
            <span>{lastUpdated ? lastUpdated.toLocaleTimeString([], { hour12: false }) : '--:--:--'}</span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-accent rounded-md text-muted-foreground transition-colors"
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? <Icons.Minimize className="w-4 h-4" /> : <Icons.Maximize className="w-4 h-4" />}
            </button>

            <button
              onClick={toggleInvestorMode}
              className={cn(
                'p-2 rounded-md transition-colors',
                investorMode ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
              )}
              title="Investor Mode (I)"
            >
              {investorMode ? <Icons.EyeClosed className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
            </button>

            <button
              onClick={() => refreshData()}
              className="p-2 hover:bg-accent rounded-md text-muted-foreground transition-colors group"
              title="Refresh (R)"
            >
              <Icons.Refresh className="w-4 h-4 group-hover:text-primary transition-transform group-hover:rotate-180" />
            </button>
          </div>

          <div className="hidden md:block h-4 w-px bg-border" />

          <button
            onClick={() => router.push('/settings')}
            className="hidden md:block p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icons.Settings className="w-4 h-4" />
          </button>

          <button
            onClick={handleLogout}
            className="hidden md:block p-2 hover:bg-destructive/10 hover:text-destructive rounded-md text-muted-foreground transition-colors"
          >
            <Icons.Logout className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-b border-border bg-background p-4 space-y-4 animate-slide-in">
          <div className="grid grid-cols-2 gap-2">
            {segments.map((seg) => (
              <button
                key={seg}
                onClick={() => {
                  updateSettings({ activeSegment: seg.toLowerCase() });
                  setMenuOpen(false);
                }}
                className={cn(
                  'px-3 py-2 text-xs font-medium rounded-md border',
                  settings.activeSegment === seg.toLowerCase()
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border text-muted-foreground'
                )}
              >
                {seg}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex gap-2">
              <button
                onClick={toggleInvestorMode}
                className={cn('p-2 rounded border', investorMode ? 'bg-primary/10 border-primary' : 'border-border')}
              >
                {investorMode ? <Icons.EyeClosed className="w-4 h-4" /> : <Icons.Eye className="w-4 h-4" />}
              </button>
              <button onClick={() => refreshData()} className="p-2 rounded border border-border">
                <Icons.Refresh className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push('/settings')} className="p-2 rounded border border-border">
                <Icons.Settings className="w-4 h-4" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded border border-destructive/20 text-destructive"
              >
                <Icons.Logout className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
