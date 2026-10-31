'use client';

/**
 * A/B Testing Page (Jan 2026)
 * 
 * Create and manage A/B tests for campaign assets:
 * - Create test variants
 * - Set traffic split
 * - Monitor performance
 * - Declare winners
 */

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FlaskConical,
  ArrowLeft,
  Loader2,
  Plus,
  Play,
  Pause,
  Trophy,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Percent,
  Users,
  Target,
  CheckCircle,
  XCircle,
  Copy,
  Trash2,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Variant {
  id: string;
  name: string;
  assetId: string;
  trafficPercent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversionRate: number;
  isControl: boolean;
  isWinner?: boolean;
}

interface ABTest {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  assetType: string;
  variants: Variant[];
  startDate?: string;
  endDate?: string;
  winnerVariantId?: string;
  confidenceLevel: number;
  minimumSampleSize: number;
  currentSampleSize: number;
}

export default function ABTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: campaignId } = use(params);
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [campaign, setCampaign] = useState<{ name: string } | null>(null);
  const [tests, setTests] = useState<ABTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  
  // New test form
  const [newTestName, setNewTestName] = useState('');
  const [newTestAssetType, setNewTestAssetType] = useState('landing-page');
  
  // Fetch data
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
        
        // Fetch A/B tests
        const testsRes = await fetch(`/api/campaigns/${campaignId}/ab-tests`);
        if (testsRes.ok) {
          const data = await testsRes.json();
          setTests(data.tests || []);
          if (data.tests?.length > 0) {
            setSelectedTest(data.tests[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [campaignId]);
  
  // Create new test
  const handleCreateTest = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/ab-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTestName,
          assetType: newTestAssetType,
        }),
      });
      
      if (response.ok) {
        const newTest = await response.json();
        setTests([...tests, newTest]);
        setSelectedTest(newTest);
        setIsCreateDialogOpen(false);
        setNewTestName('');
      }
    } catch (error) {
      console.error('Failed to create test:', error);
    }
  };
  
  // Start/pause test
  const handleToggleTest = async (test: ABTest) => {
    const newStatus = test.status === 'running' ? 'paused' : 'running';
    
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/ab-tests/${test.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        setTests(tests.map(t => 
          t.id === test.id ? { ...t, status: newStatus } : t
        ));
        if (selectedTest?.id === test.id) {
          setSelectedTest({ ...selectedTest, status: newStatus });
        }
      }
    } catch (error) {
      console.error('Failed to toggle test:', error);
    }
  };
  
  // Declare winner
  const handleDeclareWinner = async (variantId: string) => {
    if (!selectedTest) return;
    
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/ab-tests/${selectedTest.id}/winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      });
      
      if (response.ok) {
        const updatedTest = {
          ...selectedTest,
          status: 'completed' as const,
          winnerVariantId: variantId,
          variants: selectedTest.variants.map(v => ({
            ...v,
            isWinner: v.id === variantId,
          })),
        };
        setSelectedTest(updatedTest);
        setTests(tests.map(t => t.id === selectedTest.id ? updatedTest : t));
      }
    } catch (error) {
      console.error('Failed to declare winner:', error);
    }
  };
  
  // Update traffic split
  const handleUpdateTraffic = async (variantId: string, percent: number) => {
    if (!selectedTest) return;
    
    // Adjust other variants proportionally
    const otherVariants = selectedTest.variants.filter(v => v.id !== variantId);
    const remainingPercent = 100 - percent;
    const totalOtherPercent = otherVariants.reduce((sum, v) => sum + v.trafficPercent, 0);
    
    const updatedVariants = selectedTest.variants.map(v => {
      if (v.id === variantId) {
        return { ...v, trafficPercent: percent };
      }
      const ratio = totalOtherPercent > 0 ? v.trafficPercent / totalOtherPercent : 1 / otherVariants.length;
      return { ...v, trafficPercent: Math.round(remainingPercent * ratio) };
    });
    
    setSelectedTest({ ...selectedTest, variants: updatedVariants });
  };
  
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
                <FlaskConical className="w-5 h-5 text-primary" />
                A/B Testing
                <Badge variant="secondary">Beta</Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                {campaign?.name || 'Campaign'}
              </p>
            </div>
          </div>
          
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Test
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Test List */}
        <div className="w-72 border-r bg-muted/30 p-4 overflow-y-auto">
          <div className="mb-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Variant tracking is still being wired to live metrics. Treat results here as beta.
          </div>
          <h2 className="font-medium mb-4">Tests</h2>
          
          {tests.length === 0 ? (
            <div className="text-center py-8">
              <FlaskConical className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No A/B tests yet
              </p>
              <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                Create Test
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTest?.id === test.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-background hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedTest(test)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{test.name}</span>
                    <Badge
                      variant="outline"
                      className={
                        test.status === 'running'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                          : test.status === 'completed'
                          ? 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 '
                          : ''
                      }
                    >
                      {test.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {test.variants.length} variants • {test.assetType}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Test Details */}
        <div className="flex-1 p-6 overflow-y-auto">
          {selectedTest ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Test Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">{selectedTest.name}</h2>
                  <p className="text-muted-foreground">
                    {selectedTest.assetType} • {selectedTest.variants.length} variants
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsSettingsDialogOpen(true)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Button>
                  <Button
                    variant={selectedTest.status === 'running' ? 'outline' : 'default'}
                    onClick={() => handleToggleTest(selectedTest)}
                    disabled={selectedTest.status === 'completed'}
                  >
                    {selectedTest.status === 'running' ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Progress */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Sample Size Progress</p>
                      <p className="text-2xl font-bold">
                        {selectedTest.currentSampleSize.toLocaleString()} / {selectedTest.minimumSampleSize.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Confidence Level</p>
                      <p className="text-2xl font-bold">{selectedTest.confidenceLevel}%</p>
                    </div>
                  </div>
                  <Progress
                    value={(selectedTest.currentSampleSize / selectedTest.minimumSampleSize) * 100}
                    className="h-2"
                  />
                </CardContent>
              </Card>
              
              {/* Variants */}
              <div className="space-y-4">
                <h3 className="font-medium">Variants</h3>
                
                {selectedTest.variants.map((variant, idx) => {
                  const isLeading = variant.conversionRate === Math.max(
                    ...selectedTest.variants.map(v => v.conversionRate)
                  );
                  
                  return (
                    <Card
                      key={variant.id}
                      className={variant.isWinner ? 'ring-2 ring-emerald-500' : ''}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                              variant.isControl
                                ? 'bg-muted'
                                : idx === 1
                                ? 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 '
                                : 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400'
                            }`}>
                              {variant.name}
                            </div>
                            <div>
                              <p className="font-medium">
                                Variant {variant.name}
                                {variant.isControl && (
                                  <Badge variant="outline" className="ml-2">Control</Badge>
                                )}
                                {variant.isWinner && (
                                  <Badge className="ml-2 bg-emerald-500">
                                    <Trophy className="w-3 h-3 mr-1" />
                                    Winner
                                  </Badge>
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {variant.trafficPercent}% traffic
                              </p>
                            </div>
                          </div>
                          
                          {!selectedTest.winnerVariantId && selectedTest.status !== 'draft' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeclareWinner(variant.id)}
                            >
                              <Trophy className="w-4 h-4 mr-1" />
                              Declare Winner
                            </Button>
                          )}
                        </div>
                        
                        {/* Metrics */}
                        <div className="grid grid-cols-5 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold">{variant.impressions.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Impressions</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{variant.clicks.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Clicks</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{variant.conversions.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Conversions</p>
                          </div>
                          <div>
                            <p className={`text-2xl font-bold ${isLeading ? 'text-emerald-600' : ''}`}>
                              {variant.ctr}%
                            </p>
                            <p className="text-xs text-muted-foreground">CTR</p>
                          </div>
                          <div>
                            <p className={`text-2xl font-bold ${isLeading ? 'text-emerald-600' : ''}`}>
                              {variant.conversionRate}%
                              {isLeading && selectedTest.variants.length > 1 && (
                                <TrendingUp className="w-4 h-4 inline ml-1 text-emerald-500" />
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">Conv. Rate</p>
                          </div>
                        </div>
                        
                        {/* Traffic Slider */}
                        {selectedTest.status === 'draft' && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm">Traffic Split</span>
                              <span className="text-sm font-medium">{variant.trafficPercent}%</span>
                            </div>
                            <Slider
                              value={[variant.trafficPercent]}
                              onValueChange={([value]) => handleUpdateTraffic(variant.id, value)}
                              max={100}
                              step={5}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              
              {/* Add Variant */}
              {selectedTest.status === 'draft' && selectedTest.variants.length < 4 && (
                <Button variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Variant
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <FlaskConical className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a test</h3>
                <p className="text-muted-foreground">
                  Choose a test from the sidebar or create a new one
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Create Test Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create A/B Test</DialogTitle>
            <DialogDescription>
              Set up a new experiment to optimize your campaign performance
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Test Name</label>
              <Input
                value={newTestName}
                onChange={(e) => setNewTestName(e.target.value)}
                placeholder="e.g., Headline Test"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Asset Type</label>
              <Select value={newTestAssetType} onValueChange={setNewTestAssetType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landing-page">Landing Page</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="social-post">Social Post</SelectItem>
                  <SelectItem value="ad-creative">Ad Creative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTest} disabled={!newTestName}>
              Create Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Settings Dialog */}
      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Settings</DialogTitle>
          </DialogHeader>
          
          {selectedTest && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Minimum Sample Size</label>
                <Input
                  type="number"
                  value={selectedTest.minimumSampleSize}
                  onChange={(e) => setSelectedTest({
                    ...selectedTest,
                    minimumSampleSize: parseInt(e.target.value) || 1000,
                  })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum visitors before declaring a winner
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Confidence Level</label>
                <Select
                  value={selectedTest.confidenceLevel.toString()}
                  onValueChange={(value) => setSelectedTest({
                    ...selectedTest,
                    confidenceLevel: parseInt(value),
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90">90%</SelectItem>
                    <SelectItem value="95">95%</SelectItem>
                    <SelectItem value="99">99%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setIsSettingsDialogOpen(false)}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
