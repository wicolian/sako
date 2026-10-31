'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CopyCheck,
  Globe,
  Loader2,
  Palette,
  Search,
  Shield,
  Sparkles,
  Zap,
  Check,
  Info,
  ShieldX,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getBrandProfileHref, getImportedCampaignHref } from '@/lib/import/import-routing';

interface ImportProgress {
  stage: string;
  progress: number;
  message?: string;
  partialData?: PartialImportResult;
}

interface ClaimResult {
  id: string;
  text: string;
  type: string;
  category: string;
  riskScore: number;
  flags: string[];
}

interface LinkedEvidenceResult {
  claimId: string;
  status: string;
  confidence: number;
  suggestedRewrite?: string;
}

interface ImportResult {
  brandId: string;
  sourceUrl: string;
  brand: {
    name: string;
    tagline: string;
    voice: {
      formality: string;
      personality: string[];
      tone: string;
    };
    audience: {
      type: string;
      personas: string[];
      painPoints: string[];
    };
    industry: string;
    valuePropositions: string[];
    logoUrl?: string;
  };
  designTokens: {
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
      extractedFromPage?: boolean;
    };
    typography: {
      fontFamily: string;
      fontHeading: string;
      extractedFromPage?: boolean;
    };
    corners: string;
    shadows: string;
  };
  claims: ClaimResult[];
  linkedEvidence: LinkedEvidenceResult[];
  summary: {
    claimsTotal: number;
    claimsSupported: number;
    claimsNeedReview: number;
    claimsBlocked: number;
    evidenceFound: number;
    complianceScore: number;
    complianceGrade: string;
  };
}

interface PartialImportResult {
  brandId?: string | null;
  sourceUrl?: string;
  brand?: Partial<ImportResult['brand']>;
  designTokens?: Partial<ImportResult['designTokens']>;
  claims?: ClaimResult[];
  linkedEvidence?: LinkedEvidenceResult[];
  summary?: Partial<ImportResult['summary']>;
}

interface ActivityEntry {
  id: string;
  stage: string;
  message: string;
  progress: number;
}

const stages = [
  { key: 'fetching', label: 'Fetch site', icon: Globe, description: 'Downloading page content' },
  { key: 'parsing', label: 'Parse content', icon: CopyCheck, description: 'Extracting text and structure' },
  { key: 'extracting_brand', label: 'Brand profile', icon: Sparkles, description: 'Analyzing brand voice and positioning' },
  { key: 'extracting_design', label: 'Design tokens', icon: Palette, description: 'Detecting colors and typography' },
  { key: 'detecting_claims', label: 'Claims scan', icon: Shield, description: 'Finding marketing claims' },
  { key: 'researching_evidence', label: 'Evidence check', icon: Search, description: 'Researching supporting evidence' },
  { key: 'linking_evidence', label: 'Risk review', icon: AlertTriangle, description: 'Assessing compliance risk' },
  { key: 'finalizing', label: 'Ready', icon: Zap, description: 'Building your campaign' },
];

const exampleUrls = [
  { name: 'Linear', url: 'https://linear.app', icon: 'L' },
  { name: 'Stripe', url: 'https://stripe.com', icon: 'S' },
  { name: 'Notion', url: 'https://notion.so', icon: 'N' },
];

function LogoImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div className={cn("flex items-center justify-center border border-dashed border-border bg-muted/50 text-[10px] text-muted-foreground", className)}>
        {alt.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function getGradeColor(grade: string) {
  if (['A', 'B'].includes(grade)) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  if (grade === 'C') return "text-amber-500 bg-amber-500/10 border-amber-500/20";
  return "text-red-500 bg-red-500/10 border-red-500/20";
}

function getClaimStatusTone(claim: ClaimResult, linkedEvidence: LinkedEvidenceResult[]) {
  const link = linkedEvidence.find((item) => item.claimId === claim.id);
  if (claim.riskScore >= 75) return 'blocked';
  if (link?.status === 'supported') return 'safe';
  if (claim.riskScore >= 55) return 'risky';
  return 'needs_evidence';
}

function getClaimStatusIconAndColor(status: string) {
  switch (status) {
    case 'safe': return { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500' };
    case 'needs_evidence': return { icon: Info, color: 'text-amber-500', bg: 'bg-amber-500' };
    case 'risky': return { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500' };
    case 'blocked': return { icon: ShieldX, color: 'text-red-500', bg: 'bg-red-500' };
    default: return { icon: Info, color: 'text-muted-foreground', bg: 'bg-muted' };
  }
}

export default function ImportPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [confirmOwnership, setConfirmOwnership] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [partialData, setPartialData] = useState<PartialImportResult>({});
  const [error, setError] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [claimFilter, setClaimFilter] = useState<string>('all');
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing, startTime]);

  const currentStageIndex = progress
    ? stages.findIndex((stage) => stage.key === progress.stage)
    : -1;

  const handleAnalyze = useCallback(async () => {
    if (!url || !confirmOwnership) return;

    setIsAnalyzing(true);
    setError(null);
    setProgress(null);
    setResult(null);
    setPartialData({});
    setActivityLog([]);
    setStartTime(Date.now());
    setElapsedTime(0);

    try {
      const response = await fetch('/api/import/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, confirmOwnership }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Failed to analyze URL');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const event = JSON.parse(line.slice(6));

          if (event.event === 'progress') {
            setProgress(event);
            if (event.partialData) {
              setPartialData(prev => ({ ...prev, ...event.partialData }));
            }
            if (event.message) {
              const entryId = `${event.stage}:${event.progress}:${event.message}`;
              setActivityLog((prev) => {
                if (prev.some((entry) => entry.id === entryId)) {
                  return prev;
                }
                return [
                  ...prev,
                  {
                    id: entryId,
                    stage: event.stage,
                    message: event.message,
                    progress: event.progress,
                  },
                ].slice(-8);
              });
            }
          } else if (event.event === 'complete') {
            setResult(event.data);
            setIsAnalyzing(false);
          } else if (event.event === 'error') {
            throw new Error(event.error);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      if (message.toLowerCase().includes('credits')) {
        setError('Import ran out of model credits before analysis finished. Add OpenRouter credits or switch to a lower-cost model key, then retry.');
      } else {
        setError(message);
      }
      setIsAnalyzing(false);
    }
  }, [url, confirmOwnership]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')} elapsed`;
  };

  const filteredClaims = useMemo(() => {
    if (!result?.claims) return [];
    if (claimFilter === 'all') return result.claims;
    return result.claims.filter(c => getClaimStatusTone(c, result.linkedEvidence) === claimFilter);
  }, [result, claimFilter]);
  const brandProfileHref = getBrandProfileHref(result?.brandId);
  const importedCampaignHref = getImportedCampaignHref(result?.brandId, result?.sourceUrl);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <AnimatePresence mode="wait">
        
        {/* State 1: Input */}
        {!isAnalyzing && !result && !error && (
          <motion.div
            key="input-state"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-3xl space-y-12 relative z-10"
          >
            {/* Ambient Background Glow */}
            <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-20 pointer-events-none">
              <div className="w-96 h-96 bg-primary/30 rounded-full blur-[100px] animate-pulse" />
            </div>

            <div className="text-center space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                Import your brand
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Paste your website. Composer extracts brand voice, pulls out claims, and gives you a campaign-ready starting point with compliance review built in.
              </p>
            </div>

            <Card className="border-border/50 shadow-2xl bg-card/60 backdrop-blur-xl overflow-hidden rounded-2xl">
              <CardContent className="p-8 md:p-10 space-y-8">
                <div className="relative group">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/5 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-xl" />
                  <div className="relative flex items-center">
                    <Globe className="absolute left-4 h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      type="url"
                      placeholder="https://your-company.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="h-16 pl-14 pr-6 text-lg bg-background/50 border-border/50 rounded-2xl focus-visible:ring-primary/30 focus-visible:ring-offset-0 focus-visible:border-primary/50 transition-all placeholder:text-muted-foreground/50"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center space-x-3">
                    <Switch
                      id="ownership"
                      checked={confirmOwnership}
                      onCheckedChange={setConfirmOwnership}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Label htmlFor="ownership" className="text-sm font-medium cursor-pointer text-muted-foreground">
                      I have permission to analyze this URL
                    </Label>
                  </div>
                  
                  <Button
                    onClick={handleAnalyze}
                    disabled={!url || !confirmOwnership}
                    className="h-12 px-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all group overflow-hidden relative"
                    size="lg"
                  >
                    <span className="relative z-10 flex items-center font-semibold">
                      Analyze Brand
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  </Button>
                </div>

                <div className="pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center gap-4 text-sm">
                  <span className="text-muted-foreground font-medium">Try with:</span>
                  <div className="flex gap-3">
                    {exampleUrls.map((example) => (
                      <button
                        key={example.name}
                        onClick={() => setUrl(example.url)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/50 transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <div className="w-4 h-4 rounded bg-background flex items-center justify-center text-[10px] font-bold border border-border/50">
                          {example.icon}
                        </div>
                        {example.name}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* State 2: Analyzing */}
        {isAnalyzing && (
          <motion.div
            key="analyzing-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8 h-[80vh]"
          >
            {/* Left: Progress Timeline */}
            <div className="flex flex-col h-full bg-card/40 border border-border/50 rounded-2xl p-6 shadow-lg">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-8 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Live Analysis
              </h3>

              <div className="mb-6 space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{progress?.stage ? stages.find((stage) => stage.key === progress.stage)?.label || 'Working' : 'Starting'}</span>
                  <span>{progress?.progress || 0}%</span>
                </div>
                <Progress value={progress?.progress || 0} className="h-2" />
                <p className="text-sm text-foreground">
                  {progress?.message || 'Preparing import...'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Large pages can take a few minutes. Composer keeps the latest extracted brand and claims context visible as it works.
                </p>
              </div>
              
              <div className="relative flex-1">
                {/* Progress Line */}
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-muted rounded-full">
                  <div 
                    className="w-full bg-primary rounded-full transition-all duration-500 ease-out" 
                    style={{ height: `${progress?.progress || 0}%` }}
                  />
                </div>

                <div className="space-y-6 relative z-10">
                  {stages.map((stage, idx) => {
                    const isCompleted = currentStageIndex > idx;
                    const isActive = currentStageIndex === idx;
                    const Icon = stage.icon;

                    return (
                      <motion.div 
                        key={stage.key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        className={cn(
                          "flex items-start gap-4 transition-opacity",
                          isCompleted ? "opacity-100" : isActive ? "opacity-100" : "opacity-40"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors",
                          isCompleted ? "bg-primary border-primary text-primary-foreground" : 
                          isActive ? "bg-background border-primary text-primary" : 
                          "bg-background border-muted text-muted-foreground"
                        )}>
                          {isCompleted ? (
                            <motion.div
                              initial={{ scale: 0, rotate: -45 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                              <Check className="w-4 h-4" />
                            </motion.div>
                          ) : isActive ? (
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            >
                              <Icon className="w-4 h-4" />
                            </motion.div>
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="pt-1.5 space-y-0.5">
                          <h4 className={cn("text-sm font-medium", isActive ? "text-primary" : "text-foreground")}>
                            {stage.label}
                          </h4>
                          <p className="text-xs text-muted-foreground">{stage.description}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 space-y-3 border-t border-border/50 pt-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent updates
                </div>
                <div className="space-y-2">
                  {activityLog.length > 0 ? activityLog.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-border/50 bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-foreground">{entry.message}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{entry.progress}%</span>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-border/50 bg-background/70 p-3 text-xs text-muted-foreground">
                      Waiting for the first import update...
                    </div>
                  )}
                </div>
                <div className="text-center text-xs font-mono text-muted-foreground">
                  {formatTime(elapsedTime)}
                </div>
              </div>
            </div>

            {/* Right: Live Preview Panel */}
            <div className="bg-card/40 border border-border/50 rounded-2xl shadow-lg overflow-hidden flex flex-col relative">
              <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                <div className="text-sm font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  {url}
                </div>
                <Badge variant="outline" className="text-[10px] font-mono animate-pulse">EXTRACTING...</Badge>
              </div>

              <ScrollArea className="flex-1 p-8">
                <div className="max-w-2xl mx-auto space-y-12">
                  
                  {/* Brand Preview */}
                  <AnimatePresence>
                    {(currentStageIndex >= 2 || partialData.brand) && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        <div className="space-y-2">
                          <h2 className="text-3xl font-bold">
                            {partialData.brand?.name || <span className="block h-8 w-48 rounded bg-muted animate-pulse" />}
                          </h2>
                          {partialData.brand?.tagline ? (
                            <p className="text-lg text-muted-foreground">{partialData.brand.tagline}</p>
                          ) : (
                            <span className="block h-6 w-96 rounded bg-muted animate-pulse mt-2" />
                          )}
                        </div>
                        
                        {(currentStageIndex >= 3 || partialData.designTokens) && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-4 items-center"
                          >
                            <div className="text-xs font-medium uppercase text-muted-foreground">Colors</div>
                            <div className="flex gap-2">
                              {partialData.designTokens?.colors ? (
                                Object.entries(partialData.designTokens.colors)
                                  .filter(([k]) => !k.includes('extracted'))
                                  .map(([key, value]) => (
                                  <motion.div 
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    key={key} 
                                    className="w-8 h-8 rounded-full border border-border/50 shadow-sm"
                                    style={{ backgroundColor: value as string }}
                                    title={`${key}: ${value}`}
                                  />
                                ))
                              ) : (
                                [1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full bg-muted animate-pulse" />)
                              )}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Claims Preview */}
                  <AnimatePresence>
                    {(currentStageIndex >= 4 || partialData.claims) && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                            Discovered Claims
                          </h3>
                          <span className="text-xs font-mono text-muted-foreground">
                            {partialData.claims?.length || 0} found...
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {partialData.claims ? (
                            partialData.claims.slice(0, 5).map((claim, idx) => (
                              <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                key={claim.id || idx}
                                className="p-3 rounded-lg border border-border/50 bg-background/50 text-sm flex gap-3 items-start"
                              >
                                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", 
                                  claim.riskScore >= 75 ? "bg-red-500" :
                                  claim.riskScore >= 55 ? "bg-orange-500" : "bg-emerald-500"
                                )} />
                                <span className="flex-1">{claim.text}</span>
                              </motion.div>
                            ))
                          ) : (
                            [1,2,3].map(i => (
                              <div key={i} className="h-12 w-full bg-muted rounded-lg animate-pulse" />
                            ))
                          )}
                          {partialData.claims && partialData.claims.length > 5 && (
                            <div className="text-center text-xs text-muted-foreground pt-2">
                              + {partialData.claims.length - 5} more claims
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>
              </ScrollArea>
              
              {/* Bottom gradient fade */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-card/80 to-transparent pointer-events-none" />
            </div>
          </motion.div>
        )}

        {/* State 3: Error */}
        {error && (
          <motion.div
            key="error-state"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">
                {error.toLowerCase().includes('save')
                  ? 'Import could not be saved'
                  : 'Analysis failed'}
              </h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => { setError(null); setUrl(''); }}>Start Over</Button>
              <Button onClick={handleAnalyze}>Retry</Button>
            </div>
          </motion.div>
        )}

        {/* State 4: Results */}
        {result && (
          <motion.div
            key="result-state"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-5xl space-y-8 pb-12"
          >
            {/* Section 1: Brand Hero */}
            <Card className="border-border/70 overflow-hidden relative">
              <div 
                className="absolute top-0 left-0 right-0 h-2 opacity-50" 
                style={{ background: `linear-gradient(to right, ${result.designTokens.colors.primary}, ${result.designTokens.colors.secondary || 'transparent'})` }}
              />
              <CardContent className="p-8 md:p-10 flex flex-col md:flex-row gap-8 items-start">
                <LogoImage 
                  src={result.brand.logoUrl || ''} 
                  alt={result.brand.name} 
                  className="w-24 h-24 rounded-2xl bg-card p-2 border border-border/50 object-contain shrink-0"
                />
                <div className="space-y-6 flex-1">
                  <div>
                    <h1 className="text-3xl font-bold">{result.brand.name}</h1>
                    <p className="text-lg text-muted-foreground mt-1">{result.brand.tagline}</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-8 gap-y-4">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Colors</span>
                      <div className="flex gap-2">
                        {Object.entries(result.designTokens.colors)
                          .filter(([k]) => !k.includes('extracted'))
                          .map(([key, val]) => (
                            <div 
                              key={key} 
                              className="w-6 h-6 rounded-full border border-border shadow-sm relative group cursor-pointer"
                              style={{ backgroundColor: val as string }}
                            >
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                {val as string}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Voice & Tone</span>
                      <div className="flex gap-2">
                        <Badge variant="secondary" className="font-mono text-xs">{result.brand.voice.tone}</Badge>
                        <Badge variant="secondary" className="font-mono text-xs">{result.brand.voice.formality}</Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Audience</span>
                      <div className="text-sm font-medium">{result.brand.audience.type}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Compliance Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
              {/* Left: Stats */}
              <div className="space-y-6">
                <Card className="border-border/70 h-full">
                  <CardContent className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-bold", getGradeColor(result.summary.complianceGrade))}>
                        {result.summary.complianceGrade}
                      </div>
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Compliance</div>
                        <div className="text-2xl font-bold">{result.summary.complianceScore}%</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/30 rounded-xl p-3 text-center border border-border/50">
                        <div className="text-2xl font-bold text-foreground">{result.summary.claimsTotal}</div>
                        <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1">Total Claims</div>
                      </div>
                      <div className="bg-emerald-500/10 rounded-xl p-3 text-center border border-emerald-500/20">
                        <div className="text-2xl font-bold text-emerald-600">{result.summary.evidenceFound}</div>
                        <div className="text-[10px] uppercase font-bold text-emerald-600/80 mt-1">Evidence Links</div>
                      </div>
                    </div>
                    
                    {(result.summary.claimsNeedReview > 0 || result.summary.claimsBlocked > 0) && (
                      <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-sm font-semibold text-orange-600">Action Required</div>
                            <div className="text-xs text-orange-600/80 mt-1">
                              {result.summary.claimsNeedReview} risky and {result.summary.claimsBlocked} blocked claims detected.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right: Claims List */}
              <Card className="border-border/70 flex flex-col overflow-hidden h-[500px]">
                <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                  <div className="flex gap-2">
                    {['all', 'safe', 'needs_evidence', 'risky', 'blocked'].map(filter => (
                      <Badge 
                        key={filter}
                        variant={claimFilter === filter ? "default" : "secondary"}
                        className="cursor-pointer text-[10px] uppercase tracking-wider font-mono hover:bg-primary/80"
                        onClick={() => setClaimFilter(filter)}
                      >
                        {filter.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {filteredClaims.map((claim) => {
                      const status = getClaimStatusTone(claim, result.linkedEvidence);
                      const { icon: StatusIcon, color, bg } = getClaimStatusIconAndColor(status);
                      const linkedEvidence = result.linkedEvidence.find(e => e.claimId === claim.id);
                      
                      return (
                        <div key={claim.id} className="p-4 rounded-xl border border-border/50 bg-card hover:border-primary/30 transition-colors flex gap-4">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-opacity-10", color, bg.replace('bg-', 'bg-').replace('500', '500/10'))}>
                            <StatusIcon className="w-4 h-4" />
                          </div>
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider bg-background">
                                {claim.category}
                              </Badge>
                              {linkedEvidence?.status === 'supported' && (
                                <span className="text-[10px] font-medium text-emerald-500 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Evidence Linked
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium leading-relaxed">{claim.text}</p>
                          </div>
                        </div>
                      );
                    })}
                    {filteredClaims.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        No claims found for this filter.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </div>

            {/* Section 3: Action Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-end pt-4">
              <Button
                variant="ghost"
                className="text-muted-foreground"
                disabled={!brandProfileHref}
                onClick={() => {
                  if (brandProfileHref) {
                    router.push(brandProfileHref);
                  }
                }}
              >
                Open brand profile
              </Button>
              <Button variant="outline" onClick={() => { setResult(null); setUrl(''); }}>
                Import another site
              </Button>
              <Button 
                size="lg" 
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto text-base h-12 px-8 shadow-xl shadow-primary/20"
                disabled={!importedCampaignHref}
                onClick={() => {
                  if (importedCampaignHref) {
                    router.push(importedCampaignHref);
                  }
                }}
              >
                Create campaign
                <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
