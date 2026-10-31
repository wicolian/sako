'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { ContextLogItem } from '@/types';

interface ManualInput {
  key: string;
  label: string;
  type: 'text' | 'number' | 'url';
  placeholder: string;
}

const LINKEDIN_INPUTS: ManualInput[] = [
  { key: 'linkedin_post_url', label: 'LinkedIn Post URL', type: 'url', placeholder: 'https://linkedin.com/feed/update/...' },
  { key: 'linkedin_views', label: 'Views', type: 'number', placeholder: '0' },
  { key: 'linkedin_reactions', label: 'Reactions', type: 'number', placeholder: '0' },
  { key: 'linkedin_comments', label: 'Comments', type: 'number', placeholder: '0' },
  { key: 'linkedin_post_title', label: 'Post Title (snippet)', type: 'text', placeholder: 'Excited to announce...' },
];

const LOG_TYPES = ['deploy', 'campaign', 'incident', 'config'] as const;

export default function ManualInputPage() {
  const router = useRouter();
  
  // LinkedIn state
  const [linkedinData, setLinkedinData] = useState<Record<string, string>>({});
  const [linkedinSaving, setLinkedinSaving] = useState(false);
  const [linkedinLastSaved, setLinkedinLastSaved] = useState<string | null>(null);
  
  // Context logs state
  const [contextLogs, setContextLogs] = useState<ContextLogItem[]>([]);
  const [newLog, setNewLog] = useState({ title: '', type: 'deploy' as (typeof LOG_TYPES)[number] });
  const [logsSaving, setLogsSaving] = useState(false);
  const [logsLastSaved, setLogsLastSaved] = useState<string | null>(null);

  // Load existing data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch LinkedIn data
        const linkedinResponse = await fetch('/api/wall/manual?key=linkedin_latest');
        if (linkedinResponse.ok) {
          const data = await linkedinResponse.json();
          if (data.value) {
            setLinkedinData(data.value);
            setLinkedinLastSaved(data.updatedAt);
          }
        }
        
        // Fetch context logs
        const logsResponse = await fetch('/api/wall/manual?key=context_logs');
        if (logsResponse.ok) {
          const data = await logsResponse.json();
          if (data.value && Array.isArray(data.value)) {
            setContextLogs(data.value);
            setLogsLastSaved(data.updatedAt);
          }
        }
      } catch {
        // Ignore errors on initial load
      }
    };
    fetchData();
  }, []);

  const handleSaveLinkedin = async () => {
    setLinkedinSaving(true);
    try {
      const response = await fetch('/api/wall/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'linkedin_latest',
          value: linkedinData,
        }),
      });

      if (response.ok) {
        setLinkedinLastSaved(new Date().toISOString());
      }
    } catch (err) {
      console.error('Failed to save LinkedIn:', err);
    } finally {
      setLinkedinSaving(false);
    }
  };

  const handleAddLog = async () => {
    if (!newLog.title.trim()) return;
    
    const log: ContextLogItem = {
      id: crypto.randomUUID(),
      title: newLog.title.trim(),
      type: newLog.type,
      time: 'Just now',
    };
    
    const updatedLogs = [log, ...contextLogs].slice(0, 10); // Keep max 10
    setContextLogs(updatedLogs);
    setNewLog({ title: '', type: 'deploy' });
    
    // Save to DB
    setLogsSaving(true);
    try {
      const response = await fetch('/api/wall/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'context_logs',
          value: updatedLogs,
        }),
      });

      if (response.ok) {
        setLogsLastSaved(new Date().toISOString());
      }
    } catch (err) {
      console.error('Failed to save logs:', err);
    } finally {
      setLogsSaving(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    const updatedLogs = contextLogs.filter(l => l.id !== id);
    setContextLogs(updatedLogs);
    
    // Save to DB
    try {
      await fetch('/api/wall/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'context_logs',
          value: updatedLogs,
        }),
      });
      setLogsLastSaved(new Date().toISOString());
    } catch (err) {
      console.error('Failed to delete log:', err);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/wall')} className="gap-2">
            <Icons.ArrowLeft className="w-4 h-4" />
            Back to Wall
          </Button>
          <div className="h-6 w-px bg-border" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Manual Inputs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage social metrics, context logs, and other manual data
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        {/* LinkedIn Section */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#0077b5]/10 flex items-center justify-center">
              <Icons.Linkedin className="w-5 h-5 text-[#0077b5]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">LinkedIn Latest Post</h2>
              <p className="text-sm text-muted-foreground">Track your latest LinkedIn post performance</p>
            </div>
          </div>

          <div className="space-y-4">
            {LINKEDIN_INPUTS.map((input) => (
              <div key={input.key} className="space-y-2">
                <label htmlFor={input.key} className="text-sm font-medium text-foreground">
                  {input.label}
                </label>
                <input
                  id={input.key}
                  type={input.type}
                  value={linkedinData[input.key] || ''}
                  onChange={(e) =>
                    setLinkedinData((prev) => ({
                      ...prev,
                      [input.key]: e.target.value,
                    }))
                  }
                  placeholder={input.placeholder}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            ))}

            <div className="pt-4 flex items-center justify-between border-t border-border">
              <div className="text-xs text-muted-foreground">
                {linkedinLastSaved ? `Last saved: ${new Date(linkedinLastSaved).toLocaleString()}` : 'Not saved yet'}
              </div>
              <Button onClick={handleSaveLinkedin} disabled={linkedinSaving}>
                {linkedinSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Context Log Section */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icons.Terminal className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Context Log</h2>
              <p className="text-sm text-muted-foreground">Track deploys, campaigns, and incidents</p>
            </div>
          </div>

          {/* Add new log */}
          <div className="space-y-3 mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newLog.title}
                onChange={(e) => setNewLog(prev => ({ ...prev, title: e.target.value }))}
                placeholder="What happened?"
                className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onKeyDown={(e) => e.key === 'Enter' && handleAddLog()}
              />
              <Button onClick={handleAddLog} disabled={!newLog.title.trim() || logsSaving}>
                Add
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {LOG_TYPES.map((type) => (
                <Badge
                  key={type}
                  variant={newLog.type === type ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer capitalize transition-colors',
                    newLog.type === type && 'bg-primary text-primary-foreground'
                  )}
                  onClick={() => setNewLog(prev => ({ ...prev, type }))}
                >
                  {type}
                </Badge>
              ))}
            </div>
          </div>

          {/* Existing logs */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {contextLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No context logs yet</p>
            ) : (
              contextLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-muted/20 rounded-lg group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        log.type === 'deploy' ? 'bg-chart-2' :
                        log.type === 'incident' ? 'bg-destructive' :
                        log.type === 'campaign' ? 'bg-primary' :
                        'bg-muted-foreground'
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium">{log.title}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {log.type} • {log.time}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteLog(log.id)}
                  >
                    <Icons.X className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-border">
            <div className="text-xs text-muted-foreground">
              {logsLastSaved ? `Last saved: ${new Date(logsLastSaved).toLocaleString()}` : 'Not saved yet'}
            </div>
          </div>
        </Card>

        {/* Info */}
        <Card className="p-6 bg-muted/20 lg:col-span-2">
          <div className="flex items-start gap-3">
            <Icons.Info className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <h3 className="text-sm font-medium mb-1">About Manual Inputs</h3>
              <p className="text-sm text-muted-foreground">
                Manual inputs are stored in the database and displayed on the wall. LinkedIn metrics are marked as
                &quot;stale&quot; if not updated within 7 days. Context logs help provide context for metric changes.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
