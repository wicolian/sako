'use client';

/**
 * Campaign Health Dashboard (Jan 2026)
 * 
 * Visual dashboard showing campaign health score with:
 * - Animated score gauge
 * - Component breakdowns (compliance, freshness, performance)
 * - Issues list with actions
 * - Recommendations
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Clock,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  RefreshCw,
  ArrowLeft,
  Loader2,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Link2,
  FileText,
  Activity,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface HealthScore {
  overall: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  components: {
    compliance: ComponentScore;
    freshness: ComponentScore;
    performance: ComponentScore;
  };
  issues: HealthIssue[];
  recommendations: string[];
  lastCalculated: string;
  cached?: boolean;
}

interface ComponentScore {
  score: number;
  weight: number;
  weightedScore: number;
  details: Record<string, number | string>;
}

interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'compliance' | 'freshness' | 'performance';
  message: string;
  action?: string;
}

const GRADE_COLORS = {
  A: { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: 'ring-emerald-500/20' },
  B: { bg: 'bg-blue-500', text: 'text-blue-500', ring: 'ring-blue-500/20' },
  C: { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/20' },
  D: { bg: 'bg-orange-500', text: 'text-orange-500', ring: 'ring-orange-500/20' },
  F: { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/20' },
};

const CATEGORY_ICONS = {
  compliance: Shield,
  freshness: Clock,
  performance: TrendingUp,
};

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/20',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
    icon: AlertCircle,
    iconColor: 'text-amber-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/20',
    icon: Info,
    iconColor: 'text-blue-500',
  },
};

export default function CampaignHealthPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [campaign, setCampaign] = useState<{ name: string } | null>(null);
  const [health, setHealth] = useState<HealthScore | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Fetch health data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch campaign
        const campaignRes = await fetch(`/api/campaigns/${campaignId}`);
        if (campaignRes.ok) {
          const campaignData = await campaignRes.json();
          setCampaign(campaignData);
        }
        
        // Fetch health score
        const healthRes = await fetch(`/api/campaigns/${campaignId}/health`);
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setHealth(healthData);
        }
      } catch (error) {
        console.error('Failed to fetch health data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [campaignId]);
  
  // Refresh health score
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/health`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      }
    } catch (error) {
      console.error('Failed to refresh health:', error);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!health) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium mb-2">Unable to load health data</h2>
          <Button onClick={handleRefresh}>Try Again</Button>
        </div>
      </div>
    );
  }
  
  const gradeColors = GRADE_COLORS[health.grade];
  const criticalIssues = health.issues.filter(i => i.severity === 'critical');
  const warningIssues = health.issues.filter(i => i.severity === 'warning');
  
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
                <Activity className="w-5 h-5 text-primary" />
                Campaign Health
              </h1>
              <p className="text-sm text-muted-foreground">
                {campaign?.name || 'Campaign'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {health.cached && (
              <Badge variant="outline" className="text-xs">
                Cached
              </Badge>
            )}
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Score Overview */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Main Score Gauge */}
            <Card className="md:col-span-1">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center">
                  {/* Animated Gauge */}
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full transform -rotate-90">
                      {/* Background circle */}
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="12"
                        className="text-muted/20"
                      />
                      {/* Score arc */}
                      <motion.circle
                        cx="96"
                        cy="96"
                        r="88"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="12"
                        strokeLinecap="round"
                        className={gradeColors.text}
                        strokeDasharray={`${(health.overall / 100) * 553} 553`}
                        initial={{ strokeDasharray: '0 553' }}
                        animate={{ strokeDasharray: `${(health.overall / 100) * 553} 553` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </svg>
                    
                    {/* Center content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <motion.span
                        className={`text-5xl font-bold ${gradeColors.text}`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        {health.grade}
                      </motion.span>
                      <motion.span
                        className="text-2xl font-semibold text-foreground"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                      >
                        {health.overall}
                      </motion.span>
                      <span className="text-xs text-muted-foreground">out of 100</span>
                    </div>
                  </div>
                  
                  <p className="mt-4 text-sm text-muted-foreground text-center">
                    Last calculated: {new Date(health.lastCalculated).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {/* Component Scores */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Score Breakdown</CardTitle>
                <CardDescription>
                  Health score components and their weights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(health.components).map(([key, component]) => {
                  const Icon = CATEGORY_ICONS[key as keyof typeof CATEGORY_ICONS];
                  const scoreColor = component.score >= 80 ? 'text-emerald-500' :
                    component.score >= 60 ? 'text-amber-500' : 'text-red-500';
                  
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium capitalize">{key}</span>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(component.weight * 100)}% weight
                          </Badge>
                        </div>
                        <span className={`font-semibold ${scoreColor}`}>
                          {component.score}
                        </span>
                      </div>
                      <Progress value={component.score} className="h-2" />
                      
                      {/* Details */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(component.details).slice(0, 4).map(([detailKey, value]) => (
                          <Badge key={detailKey} variant="secondary" className="text-xs">
                            {detailKey.replace(/([A-Z])/g, ' $1').trim()}: {value}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
          
          {/* Issues & Recommendations */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Issues
                  {health.issues.length > 0 && (
                    <Badge variant="destructive" className="ml-auto">
                      {health.issues.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {health.issues.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                    <p className="text-muted-foreground">No issues found!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {health.issues.map((issue, idx) => {
                      const styles = SEVERITY_STYLES[issue.severity];
                      const Icon = styles.icon;
                      const CategoryIcon = CATEGORY_ICONS[issue.category];
                      
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className={`p-3 rounded-lg border ${styles.bg} ${styles.border}`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className={`w-5 h-5 ${styles.iconColor} flex-shrink-0 mt-0.5`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <CategoryIcon className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground capitalize">
                                  {issue.category}
                                </span>
                              </div>
                              <p className="text-sm font-medium">{issue.message}</p>
                              {issue.action && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  💡 {issue.action}
                                </p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {health.recommendations.map((rec, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-sm">{rec}</p>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  className="justify-start h-auto py-3"
                  onClick={() => router.push(`/campaigns/${campaignId}/refresh`)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">One-Click Refresh</div>
                    <div className="text-xs text-muted-foreground">Update all evidence</div>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="justify-start h-auto py-3"
                  onClick={() => router.push(`/compliance`)}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Review Claims</div>
                    <div className="text-xs text-muted-foreground">
                      {criticalIssues.length > 0 ? `${criticalIssues.length} blocked` : 'All clear'}
                    </div>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="justify-start h-auto py-3"
                  onClick={() => router.push(`/evidence`)}
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">Evidence Library</div>
                    <div className="text-xs text-muted-foreground">Manage sources</div>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="justify-start h-auto py-3"
                  onClick={() => router.push(`/campaigns/${campaignId}/analytics`)}
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  <div className="text-left">
                    <div className="font-medium">View Analytics</div>
                    <div className="text-xs text-muted-foreground">Performance data</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Detailed Component Breakdown */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
              <TabsTrigger value="freshness">Freshness</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    {Object.entries(health.components).map(([key, component]) => {
                      const Icon = CATEGORY_ICONS[key as keyof typeof CATEGORY_ICONS];
                      
                      return (
                        <div key={key} className="text-center">
                          <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
                            component.score >= 80 ? 'bg-emerald-100 dark:bg-emerald-500/20' :
                            component.score >= 60 ? 'bg-amber-500/10 dark:bg-amber-500/20' :
                            'bg-destructive/10 dark:bg-red-500/20'
                          }`}>
                            <Icon className={`w-8 h-8 ${
                              component.score >= 80 ? 'text-emerald-600' :
                              component.score >= 60 ? 'text-amber-500' :
                              'text-destructive'
                            }`} />
                          </div>
                          <h3 className="font-medium capitalize mb-1">{key}</h3>
                          <p className="text-3xl font-bold">{component.score}</p>
                          <p className="text-xs text-muted-foreground">
                            Contributes {Math.round(component.weightedScore)} points
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="compliance" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Compliance Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(health.components.compliance.details).map(([key, value]) => (
                      <div key={key} className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-2xl font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="freshness" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Freshness Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(health.components.freshness.details).map(([key, value]) => (
                      <div key={key} className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-2xl font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="performance" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Performance Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(health.components.performance.details).map(([key, value]) => (
                      <div key={key} className="p-4 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                        <p className="text-2xl font-bold">
                          {typeof value === 'number' && key.includes('Rate') || key.includes('ctr')
                            ? `${value}%`
                            : value.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
