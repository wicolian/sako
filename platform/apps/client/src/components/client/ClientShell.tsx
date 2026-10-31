import React from 'react';
import { Icon } from '../Icon';
import { useWorkspace } from '../../lib/hooks';
import { UserButton, useUser } from '@clerk/clerk-react';
import { AnimatedThemeToggler } from '../ui/animated-theme-toggler';
import { LayoutDashboard, ListChecks, FolderClosed, CalendarDays, PlusCircle, ChevronDown, Check, Menu, X, Sparkles, HelpCircle } from 'lucide-react';
import { getPlanDisplayName } from '../../config/plans';
import { COMPOSER_URL } from '../../lib/config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useWorkspaceContext } from "../../lib/WorkspaceProvider";
import { GlobalSearch } from './GlobalSearch';
import { NotificationBell } from './NotificationBell';
import { useProductTour } from '../../contexts/ProductTourContext';

interface ClientShellProps {
  children: React.ReactNode;
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export const ClientShell: React.FC<ClientShellProps> = ({ children, currentRoute, onNavigate }) => {
  const { data: workspace } = useWorkspace();
  const { workspaces, switchWorkspace, permissions, currentRole } = useWorkspaceContext();
  const { user } = useUser();
  const [isMobileNavOpen, setIsMobileNavOpen] = React.useState(false);
  const { resetTour, startTour } = useProductTour();

  // Handle help button click - replay the product tour
  const handleHelpClick = () => {
    resetTour();
    startTour();
  };

  // Get user's first name for welcome message
  const userFirstName = user?.firstName || user?.fullName?.split(' ')[0] || '';

  const navItems = [
    { route: '/', label: 'Dashboard', icon: LayoutDashboard, external: false, isComposer: false, dataTour: undefined },
    { route: '/tasks', label: 'Tasks', icon: ListChecks, external: false, isComposer: false, dataTour: undefined },
    { route: '/calendar', label: 'Calendar', icon: CalendarDays, external: false, isComposer: false, dataTour: undefined },
    { route: '/brands', label: 'Brands', icon: FolderClosed, external: false, isComposer: false, dataTour: 'nav-brands' },
    { route: '#', label: 'Composer (coming soon)', icon: Sparkles, external: false, isComposer: false, isComingSoon: true, dataTour: undefined },
  ];

  // Handle Composer launch with workspace context
  const handleComposerLaunch = async () => {
    try {
      // Import API helper to fetch capabilities
      const { fetchComposerCapabilities } = await import('../../lib/api');
      const capabilities = await fetchComposerCapabilities();
      
      // Build URL with context params
      const composerUrl = new URL(COMPOSER_URL);
      composerUrl.searchParams.set('workspace_id', capabilities.workspace_id || '');
      composerUrl.searchParams.set('plan', capabilities.plan_code || 'COMPOSER_FREE');
      composerUrl.searchParams.set('has_studio', capabilities.has_studio_access ? 'true' : 'false');
      
      window.open(composerUrl.toString(), '_blank', 'noopener,noreferrer');
    } catch (error) {
      // Fallback: open Composer without context
      console.error('Failed to fetch Composer capabilities:', error);
      window.open(COMPOSER_URL, '_blank', 'noopener,noreferrer');
    }
  };

  // Handle navigation - check for external links
  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.isComingSoon) {
      // Do nothing for coming soon items
      return;
    }
    if (item.isComposer) {
      handleComposerLaunch();
    } else if (item.external) {
      window.open(item.route, '_blank', 'noopener,noreferrer');
    } else {
    onNavigate(item.route);
    }
  };

  // Transform workspace data for display
  const displayWorkspace = workspace ? {
    name: workspace.name || 'Workspace',
    plan: getPlanDisplayName(workspace),
    activeSlots: workspace.effectiveActiveTaskLimit || 0,
    dayCredits: workspace.dayCredit ? workspace.dayCredit.totalCredits - workspace.dayCredit.usedCredits : 0,
  } : {
    name: 'Sako',
    plan: 'Loading...',
    activeSlots: 0,
    dayCredits: 0,
  };

  // Safely get initials
  const getInitials = (name: string) => {
    if (!name || name.length < 2) return 'SK';
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex min-h-screen bg-[color:var(--background)]">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-[color:var(--border)] bg-[color:var(--card)] backdrop-blur-sm">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full outline-none">
            <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-[color:var(--border)] hover:bg-[color:var(--accent)] transition cursor-pointer text-left">
              <div className="h-7 w-7 rounded-full bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] flex items-center justify-center text-[11px] font-semibold tracking-tight shrink-0">
                {getInitials(displayWorkspace.name)}
              </div>
              <div className="flex flex-col leading-tight overflow-hidden">
                <span className="text-[15px] font-semibold tracking-tight text-[color:var(--foreground)] flex items-center gap-2 truncate">
                  <span className="truncate">{displayWorkspace.name}</span>
                  <ChevronDown className="h-3 w-3 text-[color:var(--muted-foreground)] shrink-0" />
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] truncate">Client workspace</span>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">Switch Workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => switchWorkspace(ws.id)}
                className="flex items-center justify-between cursor-pointer"
              >
                <span className="truncate">{ws.name}</span>
                {ws.id === workspace?.id && <Check className="h-3.5 w-3.5 text-[color:var(--primary)]" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="opacity-50 cursor-not-allowed">
              <PlusCircle className="mr-2 h-3.5 w-3.5" />
              <span>Create Workspace</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <nav className="flex-1 px-3 py-4 text-[13px]">
          {permissions.canCreateTasks && (
            <div className="px-2 mb-3">
              <button
                data-tour="new-task-btn"
                onClick={() => onNavigate('/tasks/new')}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] text-[13px] font-medium hover:opacity-90 transition"
              >
                <PlusCircle className="h-4 w-4" />
                New task
              </button>
            </div>
          )}
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] px-2 mb-2 mt-4">Navigation</p>
          <ul className="space-y-1.5">
            {navItems.map(item => (
              <li key={item.route}>
                <button
                  data-tour={item.dataTour}
                  onClick={() => handleNavClick(item)}
                  disabled={item.isComingSoon}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[13px] transition ${
                    item.isComingSoon
                      ? 'text-[color:var(--muted-foreground)] cursor-not-allowed opacity-50'
                      : !item.external && currentRoute === item.route
                      ? 'bg-[color:var(--primary)]/10 text-[color:var(--sidebar-primary-foreground)] font-medium'
                      : 'text-[color:var(--foreground)] hover:bg-[color:var(--accent)]'
                  }`}
                >
                  <item.icon
                    className={`h-4 w-4 ${
                      !item.external && currentRoute === item.route
                        ? 'text-[color:var(--accent)]'
                        : item.external
                        ? 'text-violet-500'
                        : 'text-[color:var(--muted-foreground)]'
                    }`}
                  />
                  {item.label}
                  {item.external && (
                    <svg className="h-3 w-3 ml-auto text-[color:var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
            {permissions.canManageSettings && (
              <li className="mt-4 border-t border-dashed border-[color:var(--border)] pt-3">
                <button
                  data-tour="nav-settings"
                  onClick={() => onNavigate('/settings')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[13px] transition ${currentRoute === '/settings'
                    ? 'bg-[color:var(--primary)]/10 text-[color:var(--sidebar-primary-foreground)] font-medium'
                    : 'text-[color:var(--foreground)] hover:bg-[color:var(--accent)]'
                    }`}
                >
                  <Icon name="user" className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
                  Settings
                </button>
              </li>
            )}
            {/* Role indicator for non-owners */}
            {!permissions.isOwner && (
              <li className="mt-4 border-t border-dashed border-[color:var(--border)] pt-3">
                <div className="px-2.5 py-1.5 text-[11px] text-[color:var(--muted-foreground)]">
                  Role: <span className="font-medium capitalize">{currentRole?.toLowerCase()}</span>
                </div>
              </li>
            )}
          </ul>
        </nav>
        <div className="px-4 pb-4 border-t border-[color:var(--border)] pt-3 text-[11px] text-[color:var(--muted-foreground)] space-y-1">
          <p>Plan: <span className="font-medium text-[color:var(--foreground)]">{displayWorkspace.plan}</span></p>
          <p>Active slots: <span className="font-medium text-[color:var(--foreground)]">{displayWorkspace.activeSlots}</span></p>
          <p>Day credits left: <span className="font-medium text-[color:var(--foreground)]">{displayWorkspace.dayCredits}</span></p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-14 border-b border-[color:var(--border)] bg-[color:var(--background)]/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 gap-2">
          <div className="md:hidden flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="h-7 w-7 rounded-full bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] flex items-center justify-center text-[11px] font-semibold tracking-tight">
              {getInitials(displayWorkspace.name)}
            </div>
            <span className="text-[14px] font-semibold tracking-tight text-[color:var(--foreground)]">{displayWorkspace.name}</span>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[13px] text-[color:var(--foreground)]">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
              Welcome{userFirstName ? ` ${userFirstName}` : ''},
            </span>
            <span>here is what's on your plate.</span>
          </div>
          <div className="hidden sm:flex flex-1 justify-center px-3 max-w-md">
            <GlobalSearch
              onNavigate={onNavigate}
              onSwitchWorkspace={switchWorkspace}
            />
          </div>
          <div className="flex items-center gap-2">
            <AnimatedThemeToggler className="h-8 w-8" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-tour="help-btn"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:bg-[color:var(--accent)] hover:text-[color:var(--foreground)] transition"
                  title="Help & support"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Help & Support</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleHelpClick} className="cursor-pointer">
                  <Sparkles className="h-4 w-4 mr-2 text-[color:var(--muted-foreground)]" />
                  <span>Restart product tour</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href="mailto:support@trysako.com"
                    className="flex items-center cursor-pointer"
                  >
                    <svg className="h-4 w-4 mr-2 text-[color:var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    <span>Contact support</span>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NotificationBell onNavigate={onNavigate} />
            <button className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[12px] text-[color:var(--foreground)] hover:bg-[color:var(--accent)] transition">
              <Icon name="sun" className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-[color:var(--foreground)]">{displayWorkspace.dayCredits}</span>
              <span className="text-[color:var(--muted-foreground)]">day credits</span>
            </button>
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                }
              }}
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>

      {/* Mobile navigation drawer */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden">
          <div className="absolute inset-y-0 left-0 w-64 max-w-[80%] bg-[color:var(--sidebar)] border-r border-[color:var(--border)] shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[color:var(--border)]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-full bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] flex items-center justify-center text-[11px] font-semibold tracking-tight shrink-0">
                  {getInitials(displayWorkspace.name)}
                </div>
                <div className="flex flex-col leading-tight overflow-hidden">
                  <span className="text-[15px] font-semibold tracking-tight text-[color:var(--foreground)] truncate">
                    {displayWorkspace.name}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted-foreground)] truncate">
                    Client workspace
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 text-[13px] overflow-y-auto">
              {permissions.canCreateTasks && (
                <div className="px-2 mb-3">
                  <button
                    onClick={() => {
                      onNavigate('/tasks/new');
                      setIsMobileNavOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] text-[13px] font-medium hover:opacity-90 transition"
                  >
                    <PlusCircle className="h-4 w-4" />
                    New task
                  </button>
                </div>
              )}

              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)] px-2 mb-2 mt-4">
                Navigation
              </p>
              <ul className="space-y-1.5">
                {navItems.map(item => (
                  <li key={item.route}>
                    <button
                      onClick={() => {
                        handleNavClick(item);
                        if (!item.external && !item.isComingSoon) setIsMobileNavOpen(false);
                      }}
                      disabled={item.isComingSoon}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[13px] transition ${
                        item.isComingSoon
                          ? 'text-[color:var(--muted-foreground)] cursor-not-allowed opacity-50'
                          : !item.external && currentRoute === item.route
                          ? 'bg-[color:var(--primary)]/10 text-[color:var(--primary)] font-medium'
                          : 'text-[color:var(--foreground)] hover:bg-[color:var(--accent)]'
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${
                          !item.external && currentRoute === item.route
                            ? 'text-[color:var(--primary)]'
                            : item.external
                            ? 'text-violet-500'
                            : 'text-[color:var(--muted-foreground)]'
                        }`}
                      />
                      {item.label}
                      {item.external && (
                        <svg className="h-3 w-3 ml-auto text-[color:var(--muted-foreground)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </li>
                ))}
                {permissions.canManageSettings && (
                  <li className="mt-4 border-t border-dashed border-[color:var(--border)] pt-3">
                    <button
                      onClick={() => {
                        onNavigate('/settings');
                        setIsMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[13px] transition ${currentRoute === '/settings'
                        ? 'bg-[color:var(--primary)]/10 text-[color:var(--primary)] font-medium'
                        : 'text-[color:var(--foreground)] hover:bg-[color:var(--accent)]'
                        }`}
                    >
                      <Icon name="user" className="h-3.5 w-3.5 text-[color:var(--muted-foreground)]" />
                      Settings
                    </button>
                  </li>
                )}
                {/* Role indicator for non-owners */}
                {!permissions.isOwner && (
                  <li className="mt-4 border-t border-dashed border-[color:var(--border)] pt-3">
                    <div className="px-2.5 py-1.5 text-[11px] text-[color:var(--muted-foreground)]">
                      Role: <span className="font-medium capitalize">{currentRole?.toLowerCase()}</span>
                    </div>
                  </li>
                )}
              </ul>
            </nav>

            <div className="px-4 pb-4 border-t border-[color:var(--border)] pt-3 text-[11px] text-[color:var(--muted-foreground)] space-y-1">
              <p>
                Plan:{' '}
                <span className="font-medium text-[color:var(--foreground)]">
                  {displayWorkspace.plan}
                </span>
              </p>
              <p>
                Active slots:{' '}
                <span className="font-medium text-[color:var(--foreground)]">
                  {displayWorkspace.activeSlots}
                </span>
              </p>
              <p>
                Day credits left:{' '}
                <span className="font-medium text-[color:var(--foreground)]">
                  {displayWorkspace.dayCredits}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
