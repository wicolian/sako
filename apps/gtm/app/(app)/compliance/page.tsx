'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  XCircle,
  Shield,
  FileText,
  ExternalLink,
  Link2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download,
  Eye,
  Edit3,
  MoreHorizontal,
  TrendingUp,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Evidence {
  id: string;
  type: string;
  title: string;
  tier: string;
  confidence: number;
}

interface Claim {
  id: string;
  text: string;
  type: string;
  category: string;
  status: string;
  rawStatus: string;
  riskScore: number;
  source: string;
  evidence: Evidence[];
  suggestedRewrite?: string;
  lastValidated: string;
  campaignId?: string;
  campaignName?: string;
  performance?: {
    impressions: number;
    ctr: number;
  };
}

interface ClaimStats {
  total: number;
  supported: number;
  weak: number;
  blocked: number;
  pending: number;
  avgRisk: number;
}

export default function CompliancePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<ClaimStats>({
    total: 0,
    supported: 0,
    weak: 0,
    blocked: 0,
    pending: 0,
    avgRisk: 0,
  });

  // Fetch claims from API
  useEffect(() => {
    const fetchClaims = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/claims');
        if (response.ok) {
          const data = await response.json();
          setClaims(mapClaimsForDisplay(data.claims || []));
          setStats(mapStatsForDisplay(data.stats));
        }
      } catch (error) {
        console.error('Failed to fetch claims:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClaims();
  }, []);

  const filteredClaims = claims.filter(claim => {
    if (activeTab !== 'all' && claim.status !== activeTab) return false;
    if (searchQuery && !claim.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleValidateAll = async () => {
    setIsValidating(true);
    try {
      const response = await fetch('/api/claims/validate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claims: claims.map((claim) => ({
            id: claim.id,
            text: claim.text,
            claimType: claim.type,
          })),
        }),
      });
      
      if (response.ok) {
        const refreshResponse = await fetch('/api/claims');
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setClaims(mapClaimsForDisplay(data.claims || []));
          setStats(mapStatsForDisplay(data.stats));
        }
      }
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'supported':
        return <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'weak':
        return <AlertCircle className="w-4 h-4 text-amber-500 " />;
      case 'blocked':
        return <XCircle className="w-4 h-4 text-destructive " />;
      case 'pending':
        return <Clock className="w-4 h-4 text-blue-500 " />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      supported: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
      weak: 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 ',
      blocked: 'bg-destructive/10 text-destructive dark:bg-red-500/20 ',
      pending: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 ',
    };
    return colors[status] || '';
  };

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
      B: 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 ',
      C: 'bg-muted/20 text-muted-foreground /20 dark:text-muted-foreground',
    };
    return colors[tier] || '';
  };

  const healthScore = stats.total > 0 
    ? Math.round(((stats.supported / stats.total) * 100))
    : 100;

  const TABS = [
    { id: 'all', label: 'All Claims', count: stats.total },
    { id: 'supported', label: 'Supported', count: stats.supported, color: 'emerald' },
    { id: 'weak', label: 'Needs Review', count: stats.weak, color: 'amber' },
    { id: 'blocked', label: 'Blocked', count: stats.blocked, color: 'red' },
    { id: 'pending', label: 'Pending', count: stats.pending, color: 'blue' },
  ];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Compliance
          </h1>
          <p className="text-muted-foreground mt-1">
            Validate marketing claims and manage evidence
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleValidateAll} disabled={isValidating || claims.length === 0}>
            {isValidating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Re-validate All
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Health Score */}
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Health Score</p>
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-foreground">{healthScore}%</p>
              {healthScore >= 80 && <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mb-1" />}
            </div>
            <Progress value={healthScore} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        
        {/* Stat Cards */}
        {[
          { label: 'Total Claims', value: stats.total, icon: FileText, color: 'text-primary' },
          { label: 'Supported', value: stats.supported, icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Needs Review', value: stats.weak, icon: AlertCircle, color: 'text-amber-500 ' },
          { label: 'Blocked', value: stats.blocked, icon: XCircle, color: 'text-destructive ' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search claims..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                {tab.label}
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${
                    tab.color === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                    tab.color === 'amber' ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 ' :
                    tab.color === 'red' ? 'bg-destructive/10 text-destructive dark:bg-red-500/20 ' :
                    tab.color === 'blue' ? 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 ' :
                    ''
                  }`}
                >
                  {tab.count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>By Risk Score</DropdownMenuItem>
            <DropdownMenuItem>By Category</DropdownMenuItem>
            <DropdownMenuItem>By Source</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Recently Updated</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Claims List */}
      <div className="space-y-3">
        {filteredClaims.map((claim, index) => (
          <motion.div
            key={claim.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-0">
                {/* Main Row */}
                <div
                  className="flex items-center p-4 cursor-pointer"
                  onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {getStatusIcon(claim.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium truncate">{claim.text}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {claim.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {claim.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {claim.source}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Risk Score */}
                    <div className="text-center w-16">
                      <p className={`text-sm font-medium ${
                        claim.riskScore < 30 ? 'text-emerald-600 dark:text-emerald-400' :
                        claim.riskScore < 70 ? 'text-amber-500 ' :
                        'text-destructive '
                      }`}>
                        {claim.riskScore}%
                      </p>
                      <p className="text-xs text-muted-foreground">Risk</p>
                    </div>

                    {/* Evidence Count */}
                    <div className="text-center w-16">
                      <p className="text-sm font-medium text-foreground">
                        {claim.evidence.length}
                      </p>
                      <p className="text-xs text-muted-foreground">Evidence</p>
                    </div>

                    {/* Status Badge */}
                    <Badge className={getStatusBadge(claim.status)}>
                      {claim.status === 'supported' ? 'Supported' :
                       claim.status === 'weak' ? 'Needs Review' : 
                       claim.status === 'blocked' ? 'Blocked' : 'Pending'}
                    </Badge>

                    {/* Expand Icon */}
                    {expandedClaim === claim.id ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedClaim === claim.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t"
                  >
                    <div className="p-4 space-y-4">
                      {/* Evidence Section */}
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                          <Link2 className="w-4 h-4" />
                          Linked Evidence
                        </h4>
                        {claim.evidence.length > 0 ? (
                          <div className="space-y-2">
                            {claim.evidence.map((ev) => (
                              <div
                                key={ev.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                              >
                                <div className="flex items-center gap-3">
                                  <Badge className={getTierBadge(ev.tier)}>
                                    Tier {ev.tier}
                                  </Badge>
                                  <span className="text-sm text-foreground">{ev.title}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {ev.type}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm text-muted-foreground">
                                    {Math.round(ev.confidence * 100)}% confidence
                                  </span>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-500/10 text-center">
                            <AlertTriangle className="w-5 h-5 text-destructive  mx-auto mb-2" />
                            <p className="text-sm text-destructive ">No evidence linked</p>
                            <Button variant="link" className="text-destructive  text-xs mt-1">
                              Find Evidence →
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Suggested Rewrite */}
                      {claim.suggestedRewrite && (
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                          <div className="flex items-start gap-3">
                            <Sparkles className="w-4 h-4 text-primary mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-primary mb-1">
                                Suggested Rewrite
                              </p>
                              <p className="text-sm text-foreground">{claim.suggestedRewrite}</p>
                            </div>
                            <Button size="sm" variant="outline" className="text-xs">
                              Apply
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Performance */}
                      {claim.performance && (
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Eye className="w-4 h-4" />
                            {claim.performance.impressions.toLocaleString()} impressions
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <TrendingUp className="w-4 h-4" />
                            {claim.performance.ctr}% CTR
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            Validated {claim.lastValidated}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button size="sm" variant="outline">
                          <Edit3 className="w-3 h-3 mr-1" /> Edit Claim
                        </Button>
                        <Button size="sm" variant="outline">
                          <Link2 className="w-3 h-3 mr-1" /> Add Evidence
                        </Button>
                        <Button size="sm" variant="outline">
                          <RefreshCw className="w-3 h-3 mr-1" /> Re-validate
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem>View History</DropdownMenuItem>
                            <DropdownMenuItem>Archive Claim</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              Delete Claim
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {filteredClaims.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No claims found</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Import a website to detect claims automatically'}
            </p>
            <Button className="mt-4" variant="outline" asChild>
              <a href="/import">
                <Sparkles className="w-4 h-4 mr-2" /> Import Website
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

type ApiClaim = {
  id: string;
  text: string;
  type?: string;
  category?: string;
  status?: string;
  riskScore?: number;
  evidence?: Array<{
    id: string;
    type: string;
    title: string;
    tier: string;
    confidence?: number;
  }>;
  suggestedRewrites?: string[];
  lastValidated?: string;
};

function mapClaimsForDisplay(apiClaims: ApiClaim[]): Claim[] {
  return apiClaims.map((claim) => {
    const rawStatus = claim.status || 'draft';

    return {
      id: claim.id,
      text: claim.text,
      type: claim.type || 'soft',
      category: claim.category || 'generic',
      status: mapDisplayStatus(rawStatus),
      rawStatus,
      riskScore: claim.riskScore || 0,
      source: 'Workspace',
      evidence: (claim.evidence || []).map((evidence) => ({
        id: evidence.id,
        type: evidence.type,
        title: evidence.title,
        tier: evidence.tier,
        confidence: evidence.confidence ?? 1,
      })),
      suggestedRewrite: claim.suggestedRewrites?.[0],
      lastValidated: claim.lastValidated || 'Never',
    };
  });
}

function mapStatsForDisplay(apiStats?: {
  total?: number;
  approved?: number;
  needsProof?: number;
  blocked?: number;
  draft?: number;
  readyReview?: number;
  avgRisk?: number;
}): ClaimStats {
  return {
    total: apiStats?.total || 0,
    supported: apiStats?.approved || 0,
    weak: (apiStats?.needsProof || 0) + (apiStats?.readyReview || 0),
    blocked: apiStats?.blocked || 0,
    pending: apiStats?.draft || 0,
    avgRisk: apiStats?.avgRisk || 0,
  };
}

function mapDisplayStatus(status: string): string {
  switch (status) {
    case 'approved':
      return 'supported';
    case 'needs_proof':
    case 'ready_review':
      return 'weak';
    case 'blocked':
      return 'blocked';
    default:
      return 'pending';
  }
}
