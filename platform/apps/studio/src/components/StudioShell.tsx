import React from 'react';
import {
  LayoutDashboard,
  Users,
  ListChecks,
  Calendar,
  CircleDot,
  CreditCard,
  Settings,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { AnimatedThemeToggler } from './ui/animated-theme-toggler';
import { features } from '../config/features';
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';

interface StudioShellProps {
  children: React.ReactNode;
  currentRoute: string;
  onNavigate: (route: string) => void;
  canManageAdmins?: boolean;
}

export function StudioShell({ children, currentRoute, onNavigate, canManageAdmins }: StudioShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', route: '/studio/dashboard', enabled: true },
    { icon: Users, label: 'Clients', route: '/studio/clients', enabled: true },
    { icon: ListChecks, label: 'Tasks', route: '/studio/tasks', enabled: true },
    { icon: Calendar, label: 'Calendar', route: '/studio/calendar', enabled: true },
    {
      icon: CircleDot,
      label: features.pods ? 'Pods' : 'Pods (coming soon)',
      route: '/studio/pods',
      enabled: features.pods,
    },
    {
      icon: CreditCard,
      label: features.studioBillingInspector ? 'Billing inspector' : 'Billing (coming soon)',
      route: '/studio/billing',
      enabled: features.studioBillingInspector,
    },
    {
      icon: Settings,
      label: features.settings ? 'Settings' : 'Settings (coming soon)',
      route: '/studio/settings',
      enabled: features.settings,
    },
  ];

  // Admin section - visible to admins and super admins
  const adminNavItems = canManageAdmins ? [
    { icon: Users, label: 'Clients', route: '/studio/admin/clients', enabled: true },
    { icon: ShieldCheck, label: 'Users', route: '/studio/admin/users', enabled: true },
  ] : [];

  const getRouteTitle = (route: string) => {
    const item = navItems.find(item => item.route === route);
    return item?.label || 'Dashboard';
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}>
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 border-r border-[color:var(--sidebar-border)] bg-[color:var(--sidebar)]">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[color:var(--sidebar-border)]">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center bg-[color:var(--sidebar-primary)] text-[color:var(--sidebar-primary-foreground)]" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <span className="text-xs font-semibold tracking-tight">SS</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-[color:var(--sidebar-foreground)]">sako studio</span>
            <span className="text-[11px] text-[color:var(--muted-foreground)]">Studio admin</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 text-[13px] space-y-4">
          <div>
            <p className="px-2 mb-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Main</p>
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.enabled && currentRoute === item.route;
                return (
                  <li key={item.route}>
                    {item.enabled ? (
                      <button
                        onClick={() => onNavigate(item.route)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-full text-[13px] transition-colors ${isActive
                            ? 'bg-[color:var(--sidebar-primary)] text-[color:var(--sidebar-primary-foreground)]'
                            : 'hover:bg-[color:var(--sidebar-accent)] text-[color:var(--sidebar-foreground)]'
                          }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    ) : (
                      <div
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-full text-[13px] text-[color:var(--muted-foreground)] opacity-60"
                        aria-disabled="true"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Admin section - only shown to admins and super admins */}
          {adminNavItems.length > 0 && (
            <div>
              <p className="px-2 mb-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Admin</p>
              <ul className="space-y-1">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentRoute === item.route || currentRoute.startsWith(item.route);
                  return (
                    <li key={item.route}>
                      <button
                        onClick={() => onNavigate(item.route)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-full text-[13px] transition-colors ${isActive
                            ? 'bg-[color:var(--sidebar-primary)] text-[color:var(--sidebar-primary-foreground)]'
                            : 'hover:bg-[color:var(--sidebar-accent)] text-[color:var(--sidebar-foreground)]'
                          }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>

        {/* Usage summary */}
        {features.advancedAnalytics && (
          <div className="px-4 pb-4 pt-3 border-t border-[color:var(--sidebar-border)]">
            <div className="rounded-xl border border-[color:var(--sidebar-border)] bg-[color:var(--sidebar-accent)]/40 px-3 py-2.5 text-[11px]" style={{ boxShadow: 'var(--shadow-xs)' }}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)] mb-1">Usage</p>
              <p className="font-medium text-[13px]">Live utilization widgets return once analytics are wired.</p>
            </div>
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b border-[color:var(--border)] bg-[color:var(--background)]/95 backdrop-blur px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="inline-flex md:hidden items-center justify-center h-8 w-8 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                studio / {getRouteTitle(currentRoute).toLowerCase()}
              </span>
              <span className="text-sm font-semibold tracking-tight">Operator overview</span>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 hidden sm:block max-w-xl">
            <GlobalSearch onNavigate={onNavigate} />
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <AnimatedThemeToggler className="h-8 w-8" />

            <NotificationBell onNavigate={onNavigate} />

            {/* User avatar - Clerk UserButton */}
            <UserButton 
              afterSignOutUrl="/login"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                }
              }}
            />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 px-4 md:px-6 py-4 md:py-6 min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile navigation drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden">
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80%] bg-[color:var(--sidebar)] border-r border-[color:var(--sidebar-border)] shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[color:var(--sidebar-border)]">
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-xl flex items-center justify-center bg-[color:var(--sidebar-primary)] text-[color:var(--sidebar-primary-foreground)]"
                  style={{ boxShadow: 'var(--shadow-sm)' }}
                >
                  <span className="text-xs font-semibold tracking-tight">SS</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold tracking-tight text-[color:var(--sidebar-foreground)]">
                    sako studio
                  </span>
                  <span className="text-[11px] text-[color:var(--muted-foreground)]">Studio admin</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[color:var(--sidebar-border)] bg-[color:var(--sidebar)] text-[color:var(--sidebar-foreground)]"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 text-[13px] space-y-4">
              <div>
                <p className="px-2 mb-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                  Main
                </p>
                <ul className="space-y-1">
                  {navItems.map((item) => {
                    const IconComp = item.icon;
                    const isActive = item.enabled && currentRoute === item.route;
                    return (
                      <li key={item.route}>
                        {item.enabled ? (
                          <button
                            onClick={() => {
                              onNavigate(item.route);
                              setIsMobileNavOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-full text-[13px] transition-colors ${
                              isActive
                                ? 'bg-[color:var(--sidebar-primary)] text-[color:var(--sidebar-primary-foreground)]'
                                : 'hover:bg-[color:var(--sidebar-accent)] text-[color:var(--sidebar-foreground)]'
                            }`}
                          >
                            <IconComp className="h-4 w-4" />
                            <span>{item.label}</span>
                          </button>
                        ) : (
                          <div
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-full text-[13px] text-[color:var(--muted-foreground)] opacity-60"
                            aria-disabled="true"
                          >
                            <IconComp className="h-4 w-4" />
                            <span>{item.label}</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {adminNavItems.length > 0 && (
                <div>
                  <p className="px-2 mb-2 text-[11px] uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                    Admin
                  </p>
                  <ul className="space-y-1">
                    {adminNavItems.map((item) => {
                      const IconComp = item.icon;
                      const isActive =
                        currentRoute === item.route || currentRoute.startsWith(item.route);
                      return (
                        <li key={item.route}>
                          <button
                            onClick={() => {
                              onNavigate(item.route);
                              setIsMobileNavOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-full text-[13px] transition-colors ${
                              isActive
                                ? 'bg-[color:var(--sidebar-primary)] text-[color:var(--sidebar-primary-foreground)]'
                                : 'hover:bg-[color:var(--sidebar-accent)] text-[color:var(--sidebar-foreground)]'
                            }`}
                          >
                            <IconComp className="h-4 w-4" />
                            <span>{item.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </nav>

            <div className="px-4 pb-4 border-t border-[color:var(--sidebar-border)] pt-3 flex justify-center">
              <UserButton 
                afterSignOutUrl="/login"
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8",
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
