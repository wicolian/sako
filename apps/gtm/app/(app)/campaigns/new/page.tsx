'use client'

import { Suspense } from 'react'

;

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { StreamingAssetReveal } from '@/components/campaigns/streaming-asset-reveal';
import { GenerationPlanStep } from '@/components/planning/generation-plan-step';
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Globe,
  Video,
  MessageSquare,
  Mail,
  Presentation,
  Check,
  Loader2,
  Target,
  Zap,
  Shield,
  Layout,
  Share2,
} from 'lucide-react';
import type { GenerationPlan } from '@/lib/planning/types';

type DesignDirection = 'auto' | 'trust' | 'product' | 'editorial' | 'technical' | 'conversion'

const DESIGN_DIRECTIONS: Array<{ value: DesignDirection; label: string; description: string }> = [
  { value: 'auto', label: 'Auto', description: 'Use imported brand and industry context' },
  { value: 'trust', label: 'Trust & Proof', description: 'Measured, proof-forward, compliance-friendly' },
  { value: 'product', label: 'Product Demo', description: 'Show the product clearly with restraint' },
  { value: 'editorial', label: 'Editorial', description: 'Narrative, typographic, less UI chrome' },
  { value: 'technical', label: 'Technical', description: 'Sharp, minimal, infrastructure-style' },
  { value: 'conversion', label: 'Conversion', description: 'Direct, focused, action-oriented' },
]

const ASSET_TYPES = [
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'High-converting landing pages with compliant copy',
    icon: Globe,
    formats: ['Desktop', 'Mobile'],
    estimatedTime: '2-3 min',
  },
  {
    id: 'social',
    name: 'Social Posts',
    description: 'Platform-optimized posts for LinkedIn, X, FB, IG',
    icon: MessageSquare,
    formats: ['LinkedIn', 'Twitter/X', 'Facebook', 'Instagram'],
    estimatedTime: '1 min',
  },
  {
    id: 'email',
    name: 'Email Sequence',
    description: 'Nurture sequences with personalization',
    icon: Mail,
    formats: ['Welcome', 'Nurture', 'Promo', 'Re-engagement'],
    estimatedTime: '2 min',
  },
  {
    id: 'deck',
    name: 'Sales Deck',
    description: 'Presentation slides with speaker notes',
    icon: Presentation,
    formats: ['PPTX', 'Google Slides', 'PDF'],
    estimatedTime: '3-4 min',
  },
  {
    id: 'video',
    name: 'Video Ad',
    description: 'Script + voiceover + assembled video',
    icon: Video,
    formats: ['16:9 (YouTube)', '9:16 (TikTok/Reels)', '1:1 (Feed)'],
    estimatedTime: '4-5 min',
  },
];

interface CampaignFormState {
  name: string;
  goal: string;
  audience: string;
  offer: string;
  cta: string;
  selectedAssets: string[];
  selectedFormats: Record<string, string[]>;
  validateClaims: boolean;
  useTemplates: boolean;
  designDirection: DesignDirection;
}

const STEPS = [
  { id: 'basics', title: 'Campaign Basics' },
  { id: 'assets', title: 'Select Assets' },
  { id: 'formats', title: 'Choose Formats' },
  { id: 'plan', title: 'Review Plan' },
  { id: 'review', title: 'Review & Generate' },
];

const IMPORT_FLOW_ASSETS = ['landing-page', 'social', 'email'];

interface ImportedBrand {
  id: string;
  name: string;
  tagline?: string | null;
  website_url?: string | null;
  voice?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  value_propositions?: string[] | null;
}

function NewCampaignContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedAsset = searchParams.get('asset');
  const imported = searchParams.get('imported') === '1';
  const importedBrandId = searchParams.get('brand');
  const sourceUrl = searchParams.get('sourceUrl') || '';
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [importedBrand, setImportedBrand] = useState<ImportedBrand | null>(null);
  const [importedError, setImportedError] = useState<string | null>(null);
  const [generationPlan, setGenerationPlan] = useState<GenerationPlan | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);
  
  // Streaming Reveal State
  const [generatedCampaignId, setGeneratedCampaignId] = useState<string>('');
  const [streamingAssets, setStreamingAssets] = useState<any[]>(
    IMPORT_FLOW_ASSETS.map(type => ({ type, status: 'pending' }))
  );
  const [complianceResult, setComplianceResult] = useState<any>(null);
  const [isGenerationComplete, setIsGenerationComplete] = useState(false);

  const [form, setForm] = useState<CampaignFormState>({
    name: '',
    goal: '',
    audience: '',
    offer: '',
    cta: '',
    selectedAssets: preselectedAsset ? [preselectedAsset] : [],
    selectedFormats: {},
    validateClaims: true,
    useTemplates: true,
    designDirection: 'auto',
  });

  useEffect(() => {
    if (preselectedAsset && ASSET_TYPES.find(a => a.id === preselectedAsset)) {
      setForm(prev => ({
        ...prev,
        selectedAssets: [preselectedAsset],
        selectedFormats: {
          [preselectedAsset]: ASSET_TYPES.find(a => a.id === preselectedAsset)?.formats.slice(0, 1) || []
        }
      }));
    }
  }, [preselectedAsset]);

  useEffect(() => {
    if (!imported) {
      return;
    }

    if (!importedBrandId || importedBrandId === 'null' || importedBrandId === 'undefined') {
      setImportedError('This imported flow is missing a saved brand. Re-run the brand import and try again.')
      return;
    }

    let active = true;

    const loadBrand = async () => {
      try {
        const response = await fetch(`/api/brands/${importedBrandId}`);
        if (!response.ok) {
          throw new Error('Failed to load imported brand');
        }

        const data = (await response.json()) as { brand?: ImportedBrand };
        if (!active) {
          return;
        }

        const brand = data.brand ?? null;
        setImportedBrand(brand);
        setForm((prev) => ({
          ...prev,
          name: prev.name || `${brand?.name || 'Imported'} campaign`,
          goal:
            prev.goal ||
            `Turn visitors from ${sourceUrl.replace(/^https?:\/\//, '') || 'the imported page'} into qualified pipeline.`,
          audience: prev.audience || brand?.tagline || 'Prospects already evaluating this product',
          offer:
            prev.offer ||
            brand?.value_propositions?.[0] ||
            brand?.tagline ||
            brand?.name ||
            '',
          cta: prev.cta || 'Book a demo',
          selectedAssets: IMPORT_FLOW_ASSETS,
          selectedFormats: {
            social: ['LinkedIn', 'Twitter/X'],
            email: ['Nurture'],
            'landing-page': ['Desktop'],
          },
          validateClaims: true,
          useTemplates: true,
          designDirection: 'auto',
        }));
      } catch (error) {
        if (active) {
          setImportedError(error instanceof Error ? error.message : 'Failed to load brand');
        }
      }
    };

    loadBrand();

    return () => {
      active = false;
    };
  }, [imported, importedBrandId, sourceUrl]);

  const startGeneration = async (payload: {
    name: string;
    goal: string;
    audience: string;
    offer: string;
    cta: string;
    brandId?: string;
    constraints?: Record<string, unknown>;
    plan?: GenerationPlan | null;
    assetTypes: string[];
    formats: Record<string, string[]>;
    validateClaims: boolean;
    useTemplates: boolean;
    designDirection: DesignDirection;
  }) => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus('Creating campaign...');
    setStreamingAssets(payload.assetTypes.map(type => ({ type, status: 'generating' })));
    setIsGenerationComplete(false);

    try {
      const createResponse = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          goal: payload.goal,
          audience: payload.audience,
          offer: payload.offer,
          cta: payload.cta,
          brandId: payload.brandId,
          constraints: {
            ...(payload.constraints || {}),
            generation_plan: payload.plan ?? generationPlan,
          },
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json().catch(() => ({}));
        throw new Error((error as { error?: string }).error || 'Failed to create campaign');
      }

      const campaign = (await createResponse.json()) as { id: string };
      const campaignId = campaign.id;
      setGeneratedCampaignId(campaignId);

      setGenerationProgress(10);
      setGenerationStatus('Campaign created, starting generation...');

      const generateResponse = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetTypes: payload.assetTypes,
          formats: payload.formats,
          validateClaims: payload.validateClaims,
          useTemplates: payload.useTemplates,
          designDirection: payload.designDirection,
          plan: payload.plan ?? generationPlan,
        }),
      });

      if (!generateResponse.ok) {
        const errBody = await generateResponse.json().catch(() => ({}));
        const message = (errBody as { error?: string })?.error ?? `Generation failed (${generateResponse.status})`;
        throw new Error(message);
      }

      const reader = generateResponse.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) {
              continue;
            }

            const event = JSON.parse(line.slice(6));
            
            if (event.step === 'asset_complete') {
               setStreamingAssets(prev => prev.map(a => 
                 a.type === event.assetType ? { ...a, status: 'completed', data: event.data } : a
               ));
            } else if (event.step === 'compliance_complete') {
               setComplianceResult(event.compliance);
            } else if (event.step === 'complete') {
              setIsGenerationComplete(true);
              return;
            } else if (event.step === 'error') {
              throw new Error(event.error || 'Generation failed');
            } else {
              setGenerationProgress(event.progress ?? 0);
              setGenerationStatus(event.status ?? 'Generating...');
            }
          }
        }
      }

      setIsGenerationComplete(true);
    } catch (error) {
      console.error('Campaign generation failed:', error);
      setGenerationStatus(error instanceof Error ? error.message : 'Generation failed');
      setIsGenerating(false);
    }
  };

  const requestGenerationPlan = useCallback(async (overrides?: {
    assetTypes?: string[];
    brandId?: string;
  }): Promise<GenerationPlan | null> => {
    setIsPlanning(true);
    setPlanningError(null);

    try {
      const response = await fetch('/api/campaigns/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          audience: form.audience,
          goal: form.goal,
          offer: form.offer,
          cta: form.cta,
          brandId: overrides?.brandId ?? importedBrandId ?? undefined,
          assetTypes: overrides?.assetTypes ?? form.selectedAssets,
          designDirection: form.designDirection,
          constraints: form.validateClaims
            ? { mustInclude: ['Keep claims supportable and proof-backed'] }
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error((error as { error?: string }).error || 'Failed to build plan');
      }

      const data = (await response.json()) as { plan?: GenerationPlan };
      const plan = data.plan ?? null;
      setGenerationPlan(plan);
      return plan;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to build plan';
      setPlanningError(message);
      return null;
    } finally {
      setIsPlanning(false);
    }
  }, [
    form.name,
    form.audience,
    form.goal,
    form.offer,
    form.cta,
    form.selectedAssets,
    form.designDirection,
    form.validateClaims,
    importedBrandId,
  ]);

  const goNext = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const goBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const toggleAsset = (assetId: string) => {
    setForm(prev => {
      const isSelected = prev.selectedAssets.includes(assetId);
      if (isSelected) {
        const newFormats = { ...prev.selectedFormats };
        delete newFormats[assetId];
        return {
          ...prev,
          selectedAssets: prev.selectedAssets.filter(id => id !== assetId),
          selectedFormats: newFormats,
        };
      } else {
        const asset = ASSET_TYPES.find(a => a.id === assetId);
        return {
          ...prev,
          selectedAssets: [...prev.selectedAssets, assetId],
          selectedFormats: {
            ...prev.selectedFormats,
            [assetId]: asset?.formats.slice(0, 1) || [],
          },
        };
      }
    });
  };

  const toggleFormat = (assetId: string, format: string) => {
    setForm(prev => {
      const currentFormats = prev.selectedFormats[assetId] || [];
      const isSelected = currentFormats.includes(format);
      return {
        ...prev,
        selectedFormats: {
          ...prev.selectedFormats,
          [assetId]: isSelected
            ? currentFormats.filter(f => f !== format)
            : [...currentFormats, format],
        },
      };
    });
  };

  const handleGenerate = async () => {
    const plan = generationPlan ?? (await requestGenerationPlan());
    if (!plan) {
      return;
    }
    await startGeneration({
      name: form.name,
      goal: form.goal,
      audience: form.audience,
      offer: form.offer,
      cta: form.cta,
      plan,
      assetTypes: form.selectedAssets,
      formats: form.selectedFormats,
      validateClaims: form.validateClaims,
      useTemplates: form.useTemplates,
      designDirection: form.designDirection,
    });
  };

  const handleImportedGenerate = async () => {
    if (!importedBrandId || importedBrandId === 'null' || importedBrandId === 'undefined' || !importedBrand) {
      setImportedError('Composer could not load the imported brand. Re-run the brand import before generating a campaign.')
      return
    }

    const plan =
      generationPlan ??
      (await requestGenerationPlan({
        assetTypes: IMPORT_FLOW_ASSETS,
        brandId: importedBrandId || undefined,
      }));
    if (!plan) {
      return;
    }

    await startGeneration({
      name: form.name,
      goal: form.goal,
      audience: form.audience,
      offer: form.offer,
      cta: form.cta,
      brandId: importedBrandId || undefined,
      constraints: {
        source_url: sourceUrl || importedBrand?.website_url || null,
        flow: 'url_import',
        flow_version: 'mvp',
      },
      plan,
      assetTypes: IMPORT_FLOW_ASSETS,
      formats: {
        'landing-page': ['Desktop'],
        social: ['LinkedIn', 'Twitter/X'],
        email: ['Nurture'],
      },
      validateClaims: true,
      useTemplates: true,
      designDirection: form.designDirection,
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return form.name && form.goal && form.audience;
      case 1:
        return form.selectedAssets.length > 0;
      case 2:
        return Object.values(form.selectedFormats).some(formats => formats.length > 0);
      case 3:
        return Boolean(generationPlan);
      default:
        return true;
    }
  };

  useEffect(() => {
    if (!imported || !importedBrand || !form.name || !form.goal || !form.audience) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void requestGenerationPlan({
        assetTypes: IMPORT_FLOW_ASSETS,
        brandId: importedBrandId || undefined,
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    imported,
    importedBrand,
    importedBrandId,
    form.name,
    form.goal,
    form.audience,
    form.offer,
    form.cta,
    form.designDirection,
    requestGenerationPlan,
  ]);

  // If we are generating, show the full-page takeover
  if (isGenerating) {
    return (
      <StreamingAssetReveal 
        campaignId={generatedCampaignId}
        assets={streamingAssets}
        compliance={complianceResult}
        isComplete={isGenerationComplete}
      />
    );
  }

  if (imported) {
    const canGenerateImportedCampaign =
      Boolean(importedBrandId && importedBrandId !== 'null' && importedBrandId !== 'undefined') &&
      Boolean(importedBrand) &&
      !importedError &&
      Boolean(form.name && form.goal && form.audience) &&
      Boolean(generationPlan) &&
      !isPlanning

    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="space-y-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              Imported flow
            </Badge>
            <h1 className="text-3xl font-bold text-foreground">Generate from imported brand</h1>
            <p className="text-muted-foreground">
              Review your campaign brief. The brand, voice, and claim grounding came from the URL you just analyzed.
            </p>
          </div>

          <Card className="border-border/70 overflow-hidden">
            <CardContent className="grid gap-8 p-8 md:grid-cols-[1fr_1.5fr]">
              <div className="space-y-6">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-2">Brand Identity</div>
                  <div className="text-xl font-semibold text-foreground">
                    {importedBrand?.name || 'Loading brand...'}
                  </div>
                </div>

                <div className="flex gap-2">
                  {(['primary_color', 'secondary_color', 'accent_color'] as const).map((key) => {
                    const value = importedBrand?.[key];
                    if (!value) return null;
                    return (
                      <div 
                        key={key} 
                        className="h-8 w-8 rounded-full border border-border shadow-sm" 
                        style={{ backgroundColor: value }} 
                        title={key.replace('_color', '')}
                      />
                    );
                  })}
                </div>

                <div className="space-y-3 pt-6 border-t border-border/50">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    What you'll get
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-sm">
                      <Layout className="w-4 h-4 text-primary" /> Landing Page
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Share2 className="w-4 h-4 text-primary" /> Social Posts
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-primary" /> Email Sequence
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="imported-name" className="text-muted-foreground">Campaign Name</Label>
                  <Input
                    id="imported-name"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="bg-muted/30 border-transparent hover:border-border focus:border-primary transition-colors text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imported-goal" className="text-muted-foreground">Primary Goal</Label>
                  <Textarea
                    id="imported-goal"
                    value={form.goal}
                    onChange={(event) => setForm((prev) => ({ ...prev, goal: event.target.value }))}
                    className="min-h-[80px] bg-muted/30 border-transparent hover:border-border focus:border-primary transition-colors text-base resize-none"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="imported-audience" className="text-muted-foreground">Audience</Label>
                    <Input
                      id="imported-audience"
                      value={form.audience}
                      onChange={(event) => setForm((prev) => ({ ...prev, audience: event.target.value }))}
                      className="bg-muted/30 border-transparent hover:border-border focus:border-primary transition-colors text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="imported-cta" className="text-muted-foreground">Primary CTA</Label>
                    <Input
                      id="imported-cta"
                      value={form.cta}
                      onChange={(event) => setForm((prev) => ({ ...prev, cta: event.target.value }))}
                      className="bg-muted/30 border-transparent hover:border-border focus:border-primary transition-colors text-base"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imported-offer" className="text-muted-foreground">Offer / value prop</Label>
                  <Input
                    id="imported-offer"
                    value={form.offer}
                    onChange={(event) => setForm((prev) => ({ ...prev, offer: event.target.value }))}
                    className="bg-muted/30 border-transparent hover:border-border focus:border-primary transition-colors text-base"
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <div>
                    <Label className="text-muted-foreground">Design Direction</Label>
                    <p className="text-xs text-muted-foreground mt-1">Auto uses the imported brand as the source of truth.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {DESIGN_DIRECTIONS.map((direction) => {
                      const active = form.designDirection === direction.value
                      return (
                        <button
                          key={direction.value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, designDirection: direction.value }))}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            active
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border/50 bg-background hover:border-primary/40'
                          }`}
                        >
                          <div className="text-sm font-medium">{direction.label}</div>
                          <div className="text-[11px] text-muted-foreground mt-1">{direction.description}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <GenerationPlanStep
                  plan={generationPlan}
                  loading={isPlanning}
                  error={planningError}
                  compact
                  title="Route plan"
                  description="Composer proposes a route before rendering the imported campaign."
                  onRefresh={() => void requestGenerationPlan({
                    assetTypes: IMPORT_FLOW_ASSETS,
                    brandId: importedBrandId || undefined,
                  })}
                  onPlanChange={setGenerationPlan}
                />
              </div>
            </CardContent>
          </Card>

          {importedError && !isGenerating && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {importedError}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row justify-end pt-4">
            <Button variant="outline" onClick={() => router.push('/import')} className="h-14 px-8">
              Back to import
            </Button>
            <Button
              size="lg"
              onClick={handleImportedGenerate}
              disabled={!canGenerateImportedCampaign}
              className="h-14 px-8 text-base shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Generate campaign
              <Sparkles className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                placeholder="Q1 Product Launch"
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="bg-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="goal">Campaign Goal</Label>
              <Textarea
                id="goal"
                placeholder="Generate qualified leads for our new product..."
                value={form.goal}
                onChange={(e) => setForm(prev => ({ ...prev, goal: e.target.value }))}
                className="bg-input min-h-[80px]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="audience">Target Audience</Label>
              <Input
                id="audience"
                placeholder="CTOs and Engineering Leaders at mid-market SaaS companies"
                value={form.audience}
                onChange={(e) => setForm(prev => ({ ...prev, audience: e.target.value }))}
                className="bg-input"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="offer">Offer / Value Prop</Label>
                <Input
                  id="offer"
                  placeholder="Free trial, demo, whitepaper..."
                  value={form.offer}
                  onChange={(e) => setForm(prev => ({ ...prev, offer: e.target.value }))}
                  className="bg-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cta">Primary CTA</Label>
                <Input
                  id="cta"
                  placeholder="Start Free Trial"
                  value={form.cta}
                  onChange={(e) => setForm(prev => ({ ...prev, cta: e.target.value }))}
                  className="bg-input"
                />
              </div>
            </div>
          </div>
        );
        
      case 1:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select the types of assets you want to generate for this campaign.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ASSET_TYPES.map((asset) => {
                const isSelected = form.selectedAssets.includes(asset.id);
                return (
                  <motion.div
                    key={asset.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className={`cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-primary/10 ring-2 ring-primary'
                          : 'bg-card hover:bg-muted'
                      }`}
                      onClick={() => toggleAsset(asset.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-primary/20' : 'bg-muted'
                          }`}>
                            <asset.icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-foreground">{asset.name}</h4>
                              {isSelected && <Check className="w-4 h-4 text-primary" />}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{asset.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                ~{asset.estimatedTime}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {asset.formats.length} formats
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Choose specific formats for each asset type.
            </p>
            {form.selectedAssets.map((assetId) => {
              const asset = ASSET_TYPES.find(a => a.id === assetId);
              if (!asset) return null;
              
              return (
                <Card key={assetId} className="bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <asset.icon className="w-5 h-5 text-primary" />
                      <CardTitle className="text-base">{asset.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {asset.formats.map((format) => {
                        const isSelected = form.selectedFormats[assetId]?.includes(format);
                        return (
                          <Button
                            key={format}
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => toggleFormat(assetId, format)}
                            className={isSelected ? 'bg-primary hover:bg-primary/90' : ''}
                          >
                            {isSelected && <Check className="w-3 h-3 mr-1" />}
                            {format}
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {/* Options */}
            <Card className="bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Generation Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-500" />
                    <div>
                      <Label>Validate Claims</Label>
                      <p className="text-xs text-muted-foreground">Auto-check compliance before generation</p>
                    </div>
                  </div>
                  <Checkbox
                    checked={form.validateClaims}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, validateClaims: !!checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <div>
                      <Label>Use Brand Templates</Label>
                      <p className="text-xs text-muted-foreground">Apply your design system</p>
                    </div>
                  </div>
                  <Checkbox
                    checked={form.useTemplates}
                    onCheckedChange={(checked) => setForm(prev => ({ ...prev, useTemplates: !!checked }))}
                  />
                </div>
                <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="flex items-center gap-2">
                    <Layout className="w-4 h-4 text-primary" />
                    <div>
                      <Label>Design Direction</Label>
                      <p className="text-xs text-muted-foreground">Keep this opinionated. Auto is recommended.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {DESIGN_DIRECTIONS.map((direction) => {
                      const active = form.designDirection === direction.value
                      return (
                        <button
                          key={direction.value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, designDirection: direction.value }))}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            active
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border/50 bg-background hover:border-primary/40'
                          }`}
                        >
                          <div className="text-sm font-medium">{direction.label}</div>
                          <div className="text-[11px] text-muted-foreground mt-1">{direction.description}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-6">
            <GenerationPlanStep
              plan={generationPlan}
              loading={isPlanning}
              error={planningError}
              onRefresh={() => void requestGenerationPlan()}
              onPlanChange={setGenerationPlan}
            />
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Campaign Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="text-foreground font-medium">{form.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Audience</p>
                    <p className="text-foreground font-medium">{form.audience}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Goal</p>
                    <p className="text-foreground">{form.goal}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Assets to Generate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {form.selectedAssets.map((assetId) => {
                    const asset = ASSET_TYPES.find(a => a.id === assetId);
                    const formats = form.selectedFormats[assetId] || [];
                    if (!asset) return null;
                    
                    return (
                      <div key={assetId} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                        <div className="flex items-center gap-3">
                          <asset.icon className="w-4 h-4 text-primary" />
                          <span className="text-foreground">{asset.name}</span>
                        </div>
                        <div className="flex gap-1">
                          {formats.map((format) => (
                            <Badge key={format} variant="secondary" className="text-xs">
                              {format}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-4 p-3 rounded-lg bg-green-500/10">
                  <div className="flex items-center gap-2 text-green-500">
                    <Shield className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Claims will be validated automatically
                    </span>
                  </div>
                </div>
                <div className="mt-3 p-3 rounded-lg bg-muted/40 text-sm text-muted-foreground">
                  Design direction: <span className="font-medium text-foreground">{DESIGN_DIRECTIONS.find(direction => direction.value === form.designDirection)?.label ?? 'Auto'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create Campaign</h1>
          <p className="text-muted-foreground">
            Generate compliant, multi-channel marketing assets with AI.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center mb-8">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all
                ${idx < currentStep ? 'bg-green-500/20 text-green-500' : ''}
                ${idx === currentStep ? 'bg-primary/30 text-primary ring-2 ring-primary/50' : ''}
                ${idx > currentStep ? 'bg-muted text-muted-foreground' : ''}
              `}>
                {idx < currentStep ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-16 h-0.5 mx-2 ${
                  idx < currentStep ? 'bg-green-500/50' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-xl">{STEPS[currentStep].title}</CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-muted">
              {currentStep > 0 && (
                <Button variant="ghost" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              )}
              <div className="flex-1" />
              {currentStep < STEPS.length - 1 ? (
                <Button 
                  onClick={async () => {
                    if (currentStep === 2) {
                      const plan = await requestGenerationPlan();
                      if (plan) {
                        goNext();
                      }
                      return;
                    }

                    goNext();
                  }}
                  disabled={!canProceed()}
                  className="bg-primary hover:bg-primary/90"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleGenerate}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Sparkles className="w-4 h-4 mr-2" /> Generate Campaign
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function NewCampaignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <NewCampaignContent />
    </Suspense>
  );
}

export default function SuspenseWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewCampaignPage />
    </Suspense>
  )
}
