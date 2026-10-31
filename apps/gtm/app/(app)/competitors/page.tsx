'use client';

/**
 * Competitor Intelligence Dashboard (Jan 2026)
 *
 * Track competitor public metrics and get AI-powered
 * positioning suggestions. No content scraping.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Star,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Swords,
  Target,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Competitor {
  id: string;
  name: string;
  domain: string;
  metrics: {
    g2Rating?: number;
    g2Reviews?: number;
    g2Url?: string;
    capterraRating?: number;
    capterraReviews?: number;
    linkedinFollowers?: number;
    linkedinUrl?: string;
  };
  lastUpdated: string;
}

interface BattleCard {
  id: string;
  competitorName: string;
  strengths: string[];
  weaknesses: string[];
  counterMessages: Array<{
    competitorClaim: string;
    yourResponse: string;
    evidenceNeeded: string[];
  }>;
  winningAngles: string[];
  keyDifferentiators: string[];
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [battleCard, setBattleCard] = useState<BattleCard | null>(null);
  const [isGeneratingBattleCard, setIsGeneratingBattleCard] = useState(false);

  // Fetch competitors
  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    try {
      const response = await fetch('/api/competitors');
      if (response.ok) {
        const data = await response.json();
        setCompetitors(data.competitors || []);
      }
    } catch (error) {
      console.error('Failed to fetch competitors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCompetitor = async () => {
    if (!newDomain) return;

    setIsAdding(true);
    try {
      const response = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });

      if (response.ok) {
        const data = await response.json();
        setCompetitors(prev => [...prev, data.competitor]);
        setNewDomain('');
        setAddDialogOpen(false);
      }
    } catch (error) {
      console.error('Failed to add competitor:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRefresh = async (competitorId: string) => {
    try {
      const response = await fetch(`/api/competitors/${competitorId}/refresh`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setCompetitors(prev =>
          prev.map(c => c.id === competitorId ? data.competitor : c)
        );
      }
    } catch (error) {
      console.error('Failed to refresh competitor:', error);
    }
  };

  const handleDelete = async (competitorId: string) => {
    try {
      await fetch(`/api/competitors/${competitorId}`, {
        method: 'DELETE',
      });
      setCompetitors(prev => prev.filter(c => c.id !== competitorId));
    } catch (error) {
      console.error('Failed to delete competitor:', error);
    }
  };

  const generateBattleCard = async (competitor: Competitor) => {
    setSelectedCompetitor(competitor);
    setIsGeneratingBattleCard(true);
    setBattleCard(null);

    try {
      const response = await fetch(`/api/competitors/${competitor.id}/battle-card`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setBattleCard(data.battleCard);
      }
    } catch (error) {
      console.error('Failed to generate battle card:', error);
    } finally {
      setIsGeneratingBattleCard(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              Competitor Intelligence
              <Badge variant="secondary">Beta</Badge>
            </h1>
            <p className="text-muted-foreground">
              Track public metrics and get AI-powered positioning suggestions
            </p>
          </div>

          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Competitor
          </Button>
        </div>

        {/* Notice */}
        <Card className="mb-6 border-blue-500/20 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <div className="font-medium text-blue-500 ">Ethical Intelligence</div>
                <div className="text-sm text-muted-foreground">
                  We only track publicly available metrics like G2 ratings, Capterra reviews,
                  and LinkedIn data. We never scrape or copy competitor content.
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  This area is still in beta and some provider results may be incomplete.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {competitors.length === 0 ? (
          <EmptyState onAdd={() => setAddDialogOpen(true)} />
        ) : (
          <div className="space-y-8">
            {/* Competitor Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {competitors.map(competitor => (
                <CompetitorCard
                  key={competitor.id}
                  competitor={competitor}
                  onRefresh={() => handleRefresh(competitor.id)}
                  onDelete={() => handleDelete(competitor.id)}
                  onGenerateBattleCard={() => generateBattleCard(competitor)}
                />
              ))}
            </div>

            {/* Battle Card Section */}
            {(selectedCompetitor || battleCard) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Swords className="w-5 h-5 text-primary" />
                    Battle Card: {selectedCompetitor?.name || battleCard?.competitorName}
                  </CardTitle>
                  <CardDescription>
                    AI-generated competitive intelligence for sales and marketing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isGeneratingBattleCard ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      <span className="ml-3 text-muted-foreground">Generating battle card...</span>
                    </div>
                  ) : battleCard ? (
                    <BattleCardView battleCard={battleCard} />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      Select a competitor and click "Generate Battle Card"
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Add Competitor Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Competitor</DialogTitle>
            <DialogDescription>
              Enter a competitor's domain to start tracking their public metrics.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <label className="text-sm text-muted-foreground mb-2 block">
              Competitor Domain
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="competitor.com"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCompetitor}
              disabled={!newDomain || isAdding}
            >
              {isAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Competitor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompetitorCard({
  competitor,
  onRefresh,
  onDelete,
  onGenerateBattleCard,
}: {
  competitor: Competitor;
  onRefresh: () => void;
  onDelete: () => void;
  onGenerateBattleCard: () => void;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{competitor.name}</h3>
            <p className="text-sm text-muted-foreground">{competitor.domain}</p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              className="h-8 w-8"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {competitor.metrics.g2Rating && (
            <MetricRow
              icon={Star}
              label="G2 Rating"
              value={`${competitor.metrics.g2Rating}/5`}
              subValue={`${competitor.metrics.g2Reviews || 0} reviews`}
              url={competitor.metrics.g2Url}
            />
          )}

          {competitor.metrics.capterraRating && (
            <MetricRow
              icon={Star}
              label="Capterra"
              value={`${competitor.metrics.capterraRating}/5`}
              subValue={`${competitor.metrics.capterraReviews || 0} reviews`}
            />
          )}

          {competitor.metrics.linkedinFollowers && (
            <MetricRow
              icon={Users}
              label="LinkedIn"
              value={formatNumber(competitor.metrics.linkedinFollowers)}
              subValue="followers"
              url={competitor.metrics.linkedinUrl}
            />
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onGenerateBattleCard}
          className="w-full"
        >
          <Swords className="w-4 h-4 mr-2" />
          Generate Battle Card
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-2">
          Updated {new Date(competitor.lastUpdated).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}

function MetricRow({
  icon: Icon,
  label,
  value,
  subValue,
  url,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subValue?: string;
  url?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-medium">{value}</span>
        {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function BattleCardView({ battleCard }: { battleCard: BattleCard }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          Their Strengths
        </h4>
        <ul className="space-y-2">
          {battleCard.strengths.map((strength, i) => (
            <li key={i} className="text-sm text-muted-foreground pl-4 border-l-2 border-green-500/30">
              {strength}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          Their Weaknesses
        </h4>
        <ul className="space-y-2">
          {battleCard.weaknesses.map((weakness, i) => (
            <li key={i} className="text-sm text-muted-foreground pl-4 border-l-2 border-amber-500/30">
              {weakness}
            </li>
          ))}
        </ul>
      </div>

      <div className="md:col-span-2">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          Your Key Differentiators
        </h4>
        <div className="flex flex-wrap gap-2">
          {battleCard.keyDifferentiators.map((diff, i) => (
            <Badge key={i} variant="outline" className="border-primary/30 text-primary">
              {diff}
            </Badge>
          ))}
        </div>
      </div>

      <div className="md:col-span-2">
        <h4 className="font-medium mb-3">Counter-Messages</h4>
        <div className="space-y-4">
          {battleCard.counterMessages.slice(0, 3).map((counter, i) => (
            <div key={i} className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-2">
                They say: "{counter.competitorClaim}"
              </p>
              <p className="text-sm mb-2">
                You say: "{counter.yourResponse}"
              </p>
              <div className="flex flex-wrap gap-1">
                {counter.evidenceNeeded.map((evidence, j) => (
                  <Badge key={j} variant="secondary" className="text-xs">
                    Needs: {evidence}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-full bg-muted mb-4 text-primary">
        <Swords className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-medium mb-2">
        No competitors tracked yet
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Add competitors to track their public metrics and get
        AI-powered battle cards and positioning suggestions.
      </p>
      <Button onClick={onAdd}>
        <Plus className="w-4 h-4 mr-2" />
        Add First Competitor
      </Button>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
