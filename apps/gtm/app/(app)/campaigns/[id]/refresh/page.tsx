'use client';

/**
 * Campaign Refresh Page (Jan 2026)
 * 
 * One-click refresh with:
 * - Progress tracking
 * - Diff preview for each change
 * - Approve/reject individual changes
 * - Apply selected changes
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Link2,
  Shield,
  Sparkles,
  Check,
  X,
  Eye,
  Clock,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface RefreshChange {
  id: string;
  type: 'evidence' | 'claim' | 'copy' | 'asset';
  action: 'added' | 'updated' | 'removed' | 'unchanged';
  entityId: string;
  entityType: string;
  before?: any;
  after?: any;
  reason?: string;
  approved?: boolean;
}

interface RefreshResult {
  id: string;
  campaignId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  changes: RefreshChange[];
  summary: {
    evidenceUpdated: number;
    evidenceAdded: number;
    evidenceRemoved: number;
    claimsRevalidated: number;
    claimsStatusChanged: number;
    copyUpdated: number;
    assetsRegenerated: number;
    totalChanges: number;
  };
  error?: string;
}

const ACTION_COLORS = {
  added: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  updated: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 ',
  removed: 'bg-destructive/10 text-destructive dark:bg-red-500/20 ',
  unchanged: 'bg-muted/20 text-muted-foreground /20 dark:text-muted-foreground',
};

const TYPE_ICONS = {
  evidence: Link2,
  claim: Shield,
  copy: FileText,
  asset: Sparkles,
};

export default function CampaignRefreshPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
  const router = useRouter();
  
  const [campaign, setCampaign] = useState<{ name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [refreshHistory, setRefreshHistory] = useState<RefreshResult[]>([]);
  
  // Options
  const [options, setOptions] = useState({
    refreshEvidence: true,
    refreshClaims: true,
    refreshCopy: false,
    refreshAssets: false,
  });
  
  // Fetch campaign and history
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch campaign
        const campaignRes = await fetch(`/api/campaigns/${campaignId}`);
        if (campaignRes.ok) {
          const data = await campaignRes.json();
          setCampaign(data);
        }
        
        // Fetch refresh history
        const historyRes = await fetch(`/api/campaigns/${campaignId}/refresh`);
        if (historyRes.ok) {
          const data = await historyRes.json();
          setRefreshHistory(data.history || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [campaignId]);
  
  // Start refresh
  const handleStartRefresh = async () => {
    setIsRefreshing(true);
    setRefreshResult(null);
    setSelectedChanges(new Set());
    
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      
      if (response.ok) {
        const result: RefreshResult = await response.json();
        setRefreshResult(result);
        
        // Auto-select all non-unchanged changes
        const autoSelected = new Set<string>();
        for (const change of result.changes) {
          if (change.action !== 'unchanged') {
            autoSelected.add(change.id);
          }
        }
        setSelectedChanges(autoSelected);
      }
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Apply selected changes
  const handleApplyChanges = async () => {
    if (!refreshResult) return;
    
    setIsApplying(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/refresh`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshId: refreshResult.id,
          approvedChanges: Array.from(selectedChanges),
        }),
      });
      
      if (response.ok) {
        // Redirect to health page
        router.push(`/campaigns/${campaignId}/health`);
      }
    } catch (error) {
      console.error('Failed to apply changes:', error);
    } finally {
      setIsApplying(false);
    }
  };
  
  // Toggle change selection
  const toggleChange = (changeId: string) => {
    const newSelected = new Set(selectedChanges);
    if (newSelected.has(changeId)) {
      newSelected.delete(changeId);
    } else {
      newSelected.add(changeId);
    }
    setSelectedChanges(newSelected);
  };
  
  // Toggle change expansion
  const toggleExpanded = (changeId: string) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(changeId)) {
      newExpanded.delete(changeId);
    } else {
      newExpanded.add(changeId);
    }
    setExpandedChanges(newExpanded);
  };
  
  // Select all/none
  const selectAll = () => {
    if (!refreshResult) return;
    const all = new Set<string>();
    for (const change of refreshResult.changes) {
      if (change.action !== 'unchanged') {
        all.add(change.id);
      }
    }
    setSelectedChanges(all);
  };
  
  const selectNone = () => {
    setSelectedChanges(new Set());
  };
  
  // Group changes by type
  const groupedChanges = refreshResult?.changes.reduce((acc, change) => {
    if (!acc[change.type]) {
      acc[change.type] = [];
    }
    acc[change.type].push(change);
    return acc;
  }, {} as Record<string, RefreshChange[]>) || {};
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" />
                Campaign Refresh
              </h1>
              <p className="text-sm text-muted-foreground">
                {campaign?.name || 'Campaign'}
              </p>
            </div>
          </div>
          
          {refreshResult && refreshResult.changes.length > 0 && (
            <Button
              onClick={handleApplyChanges}
              disabled={isApplying || selectedChanges.size === 0}
            >
              {isApplying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Apply {selectedChanges.size} Changes
            </Button>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Refresh Options */}
          {!refreshResult && (
            <Card>
              <CardHeader>
                <CardTitle>Refresh Options</CardTitle>
                <CardDescription>
                  Choose what to refresh in this campaign
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Link2 className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Evidence</p>
                        <p className="text-sm text-muted-foreground">
                          Re-research and update evidence
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={options.refreshEvidence}
                      onCheckedChange={(checked) =>
                        setOptions({ ...options, refreshEvidence: checked })
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Claims</p>
                        <p className="text-sm text-muted-foreground">
                          Re-validate all claims
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={options.refreshClaims}
                      onCheckedChange={(checked) =>
                        setOptions({ ...options, refreshClaims: checked })
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Copy</p>
                        <p className="text-sm text-muted-foreground">
                          Update outdated statistics
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={options.refreshCopy}
                      onCheckedChange={(checked) =>
                        setOptions({ ...options, refreshCopy: checked })
                      }
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Assets</p>
                        <p className="text-sm text-muted-foreground">
                          Regenerate campaign assets
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={options.refreshAssets}
                      onCheckedChange={(checked) =>
                        setOptions({ ...options, refreshAssets: checked })
                      }
                    />
                  </div>
                </div>
                
                <Button
                  onClick={handleStartRefresh}
                  disabled={isRefreshing}
                  className="w-full"
                  size="lg"
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Refreshing Campaign...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Start One-Click Refresh
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
          
          {/* Refresh Progress */}
          {isRefreshing && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                  <h3 className="text-lg font-medium mb-2">Refreshing Campaign</h3>
                  <p className="text-muted-foreground mb-4">
                    This may take a few moments...
                  </p>
                  <Progress value={33} className="w-full max-w-xs mx-auto" />
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Refresh Results */}
          {refreshResult && (
            <>
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {refreshResult.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    )}
                    Refresh Complete
                  </CardTitle>
                  <CardDescription>
                    Found {refreshResult.summary.totalChanges} changes to review
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-emerald-600">
                        {refreshResult.summary.evidenceAdded}
                      </p>
                      <p className="text-xs text-muted-foreground">Evidence Added</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-blue-500">
                        {refreshResult.summary.evidenceUpdated}
                      </p>
                      <p className="text-xs text-muted-foreground">Evidence Updated</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-amber-500">
                        {refreshResult.summary.claimsStatusChanged}
                      </p>
                      <p className="text-xs text-muted-foreground">Claims Changed</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-2xl font-bold text-violet-600">
                        {refreshResult.summary.copyUpdated}
                      </p>
                      <p className="text-xs text-muted-foreground">Copy Updated</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Changes List */}
              {refreshResult.changes.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Review Changes</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAll}>
                          Select All
                        </Button>
                        <Button variant="outline" size="sm" onClick={selectNone}>
                          Select None
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(groupedChanges).map(([type, changes]) => {
                      const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS];
                      const actionableChanges = changes.filter(c => c.action !== 'unchanged');
                      
                      if (actionableChanges.length === 0) return null;
                      
                      return (
                        <div key={type} className="space-y-2">
                          <h4 className="font-medium capitalize flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {type} ({actionableChanges.length})
                          </h4>
                          
                          {actionableChanges.map((change) => (
                            <Collapsible
                              key={change.id}
                              open={expandedChanges.has(change.id)}
                              onOpenChange={() => toggleExpanded(change.id)}
                            >
                              <div className="border rounded-lg overflow-hidden">
                                <div className="flex items-center gap-3 p-3 bg-muted/30">
                                  <Checkbox
                                    checked={selectedChanges.has(change.id)}
                                    onCheckedChange={() => toggleChange(change.id)}
                                  />
                                  
                                  <Badge className={ACTION_COLORS[change.action]}>
                                    {change.action}
                                  </Badge>
                                  
                                  <span className="flex-1 text-sm truncate">
                                    {change.reason || `${change.entityType} ${change.action}`}
                                  </span>
                                  
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      {expandedChanges.has(change.id) ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                </div>
                                
                                <CollapsibleContent>
                                  <div className="p-4 border-t bg-background">
                                    <div className="grid md:grid-cols-2 gap-4">
                                      {change.before && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-2">
                                            Before
                                          </p>
                                          <pre className="p-3 rounded bg-red-50 dark:bg-red-500/10 text-xs overflow-auto max-h-40">
                                            {JSON.stringify(change.before, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                      
                                      {change.after && (
                                        <div>
                                          <p className="text-xs font-medium text-muted-foreground mb-2">
                                            After
                                          </p>
                                          <pre className="p-3 rounded bg-emerald-50 dark:bg-emerald-500/10 text-xs overflow-auto max-h-40">
                                            {JSON.stringify(change.after, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          ))}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
              
              {/* No Changes */}
              {refreshResult.changes.filter(c => c.action !== 'unchanged').length === 0 && (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
                    <h3 className="text-lg font-medium mb-2">Everything is up to date!</h3>
                    <p className="text-muted-foreground">
                      No changes needed for this campaign.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
          
          {/* Refresh History */}
          {!refreshResult && refreshHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Refresh History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {refreshHistory.slice(0, 5).map((refresh) => (
                    <div
                      key={refresh.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {refresh.status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : refresh.status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        <div>
                          <p className="text-sm font-medium">
                            {refresh.summary.totalChanges} changes
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(refresh.startedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{refresh.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
