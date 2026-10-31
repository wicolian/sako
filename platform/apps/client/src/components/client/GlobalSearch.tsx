import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../Icon';
import { apiFetch } from '../../lib/http';
import { analytics } from '../../lib/analytics';

interface SearchResult {
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    category: string;
    workspaceId: string;
    workspaceName?: string;
  }>;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

interface GlobalSearchProps {
  onNavigate: (route: string) => void;
  onSwitchWorkspace?: (workspaceId: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onNavigate, onSwitchWorkspace }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<SearchResult>(`/search?q=${encodeURIComponent(query)}&scope=client&limit=5`);
        setResults(data);
        setOpen(true);
        setSelectedIndex(-1);
        
        // Track search analytics
        const totalResults = (data.tasks?.length || 0) + (data.workspaces?.length || 0);
        analytics.searchUsed(query, totalResults);
      } catch (err) {
        console.error('Search failed:', err);
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get all selectable items
  const getAllItems = useCallback(() => {
    if (!results) return [];
    const items: Array<{ type: 'task' | 'workspace'; data: any }> = [];
    results.tasks.forEach(task => items.push({ type: 'task', data: task }));
    results.workspaces.forEach(workspace => items.push({ type: 'workspace', data: workspace }));
    return items;
  }, [results]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = getAllItems();
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item) {
        handleSelect(item.type, item.data);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (type: 'task' | 'workspace', data: any) => {
    setOpen(false);
    setQuery('');
    
    if (type === 'task') {
      onNavigate(`/tasks/${data.id}`);
    } else if (type === 'workspace' && onSwitchWorkspace) {
      onSwitchWorkspace(data.id);
    }
  };

  const statusColors: Record<string, string> = {
    QUEUED: 'bg-[color:var(--muted)] text-[color:var(--foreground)]',
    IN_PROGRESS: 'bg-[color:var(--primary)]/10 text-[color:var(--primary)]',
    IN_REVIEW: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300',
    COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    PAUSED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const allItems = getAllItems();
  const hasResults = results && (results.tasks.length > 0 || results.workspaces.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center w-full h-8 rounded-full border border-[color:var(--border)] bg-[color:var(--input)] px-3 text-[13px] text-[color:var(--muted-foreground)]">
        <Icon name="search" className="h-3.5 w-3.5 mr-2 text-[color:var(--muted-foreground)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search tasks, brands, calls…"
          className="flex-1 bg-transparent outline-none text-[13px] text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)]"
        />
        {loading && <Icon name="loader" className="h-3.5 w-3.5 animate-spin text-[color:var(--muted-foreground)]" />}
        <span className="text-[11px] text-[color:var(--muted-foreground)] hidden sm:inline ml-2">⌘K</span>
      </div>

      {/* Search Results Dropdown */}
      {open && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[color:var(--card)] border border-[color:var(--border)] rounded-xl shadow-lg overflow-hidden z-50 max-h-[400px] overflow-y-auto">
          {!hasResults && !loading && (
            <div className="px-4 py-6 text-center text-[13px] text-[color:var(--muted-foreground)]">
              No results found for "{query}"
            </div>
          )}

          {/* Tasks Section */}
          {results && results.tasks.length > 0 && (
            <div>
              <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-[color:var(--muted-foreground)] border-b border-[color:var(--border)] bg-[color:var(--accent)]">
                Tasks
              </div>
              {results.tasks.map((task, index) => {
                const itemIndex = index;
                const isSelected = selectedIndex === itemIndex;
                return (
                  <button
                    key={task.id}
                    onClick={() => handleSelect('task', task)}
                    className={`w-full px-3 py-2.5 text-left flex items-center gap-3 hover:bg-[color:var(--accent)] transition ${
                      isSelected ? 'bg-[color:var(--accent)]' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[color:var(--foreground)] truncate">{task.title}</p>
                      <p className="text-[11px] text-[color:var(--muted-foreground)] truncate">
                        {task.workspaceName || 'Workspace'} · {task.category}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusColors[task.status] || statusColors.QUEUED}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Workspaces Section */}
          {results && results.workspaces.length > 0 && (
            <div>
              <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-[color:var(--muted-foreground)] border-b border-t border-[color:var(--border)] bg-[color:var(--accent)]">
                Workspaces
              </div>
              {results.workspaces.map((workspace, index) => {
                const itemIndex = (results.tasks?.length || 0) + index;
                const isSelected = selectedIndex === itemIndex;
                return (
                  <button
                    key={workspace.id}
                    onClick={() => handleSelect('workspace', workspace)}
                    className={`w-full px-3 py-2.5 text-left flex items-center gap-3 hover:bg-[color:var(--accent)] transition ${
                      isSelected ? 'bg-[color:var(--accent)]' : ''
                    }`}
                  >
                    <div className="h-7 w-7 rounded-full bg-[color:var(--secondary)] text-[color:var(--secondary-foreground)] flex items-center justify-center text-[10px] font-semibold">
                      {workspace.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[color:var(--foreground)] truncate">{workspace.name}</p>
                      <p className="text-[11px] text-[color:var(--muted-foreground)]">{workspace.slug}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

