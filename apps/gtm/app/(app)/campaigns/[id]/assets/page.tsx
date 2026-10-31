'use client';

/**
 * Campaign Assets Page (Jan 2026)
 *
 * Manage all campaign assets: landing pages, social posts,
 * sales decks, email sequences, and videos.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Share2,
  Presentation,
  Mail,
  Plus,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  MoreHorizontal,
  Sparkles,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Asset {
  id: string;
  type: string;
  format?: string;
  status: 'draft' | 'review' | 'approved' | 'published';
  content: Record<string, unknown>;
  claimsValidated: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Campaign {
  id: string;
  name: string;
  audience?: string;
  goal?: string;
}

const assetTypes = [
  { id: 'landing', label: 'Landing Page', icon: FileText, color: 'text-blue-500' },
  { id: 'social', label: 'Social Posts', icon: Share2, color: 'text-pink-500' },
  { id: 'deck', label: 'Sales Deck', icon: Presentation, color: 'text-orange-500' },
  { id: 'email', label: 'Email Sequence', icon: Mail, color: 'text-green-500' },
];

export default function CampaignAssetsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<string | null>(null);

  // Fetch campaign and assets
  useEffect(() => {
    async function fetchData() {
      try {
        const [campaignRes, assetsRes] = await Promise.all([
          fetch(`/api/campaigns/${campaignId}`),
          fetch(`/api/campaigns/${campaignId}/assets`),
        ]);

        if (campaignRes.ok) {
          const data = await campaignRes.json();
          setCampaign((data.campaign || data) as Campaign);
        }

        if (assetsRes.ok) {
          const data = await assetsRes.json();
          const rawAssets = (data.assetDocuments || data.assets || []) as Array<Record<string, unknown>>;
          setAssets(rawAssets.map(normalizeAsset));
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [campaignId]);

  // Generate asset
  const handleGenerate = async (type: string) => {
    setIsGenerating(true);
    setSelectedAssetType(type);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/assets/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetType: mapUiTypeToApiType(type) }),
      });

      if (response.ok) {
        const data = await response.json();
        const generated = (data.assetDocuments || (data.asset ? [data.asset] : [])) as Array<Record<string, unknown>>;
        setAssets(prev => [...prev, ...generated.map(normalizeAsset)]);
      }
    } catch (error) {
      console.error('Failed to generate asset:', error);
    } finally {
      setIsGenerating(false);
      setSelectedAssetType(null);
      setGenerateDialogOpen(false);
    }
  };

  // Delete asset
  const handleDelete = async (assetId: string) => {
    try {
      await fetch(`/api/campaigns/${campaignId}/assets/${assetId}`, {
        method: 'DELETE',
      });
      setAssets(prev => prev.filter(a => a.id !== assetId));
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  // Filter assets by type
  const filteredAssets = activeTab === 'all'
    ? assets
    : assets.filter(a => a.type === activeTab);

  // Get asset counts
  const assetCounts = assetTypes.reduce((acc, type) => {
    acc[type.id] = assets.filter(a => a.type === type.id).length;
    return acc;
  }, {} as Record<string, number>);

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
            <h1 className="text-3xl font-bold mb-2">
              Campaign Assets
            </h1>
            <p className="text-muted-foreground">
              {campaign?.name} • {assets.length} assets
            </p>
          </div>

          <Button onClick={() => setGenerateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Generate Asset
          </Button>
        </div>

        {/* Asset Type Summary */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          {assetTypes.map(type => {
            const Icon = type.icon;
            const count = assetCounts[type.id] || 0;

            return (
              <Card
                key={type.id}
                className={`cursor-pointer transition-all hover:border-ring ${
                  activeTab === type.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setActiveTab(type.id)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${type.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs text-muted-foreground">{type.label}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="all">
              All ({assets.length})
            </TabsTrigger>
            {assetTypes.map(type => (
              <TabsTrigger key={type.id} value={type.id}>
                {type.label} ({assetCounts[type.id] || 0})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab}>
            {filteredAssets.length === 0 ? (
              <EmptyState
                type={activeTab}
                onGenerate={() => {
                  setSelectedAssetType(activeTab === 'all' ? null : activeTab);
                  setGenerateDialogOpen(true);
                }}
              />
            ) : (
              <div className="grid gap-4">
                <AnimatePresence mode="popLayout">
                  {filteredAssets.map(asset => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onDelete={() => handleDelete(asset.id)}
                      onView={() => router.push(`/campaigns/${campaignId}/assets/${asset.id}`)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Generate Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate New Asset</DialogTitle>
            <DialogDescription>
              Choose an asset type to generate for this campaign.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            {assetTypes.map(type => {
              const Icon = type.icon;
              const isSelected = selectedAssetType === type.id;
              const isGeneratingThis = isGenerating && selectedAssetType === type.id;

              return (
                <button
                  key={type.id}
                  onClick={() => !isGenerating && handleGenerate(type.id)}
                  disabled={isGenerating}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-ring bg-card'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${type.color}`}>
                      {isGeneratingThis ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {type.id === 'landing' && 'Full page with sections'}
                        {type.id === 'social' && 'Multi-platform posts'}
                        {type.id === 'deck' && 'Presentation slides'}
                        {type.id === 'email' && 'Nurture sequence'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">
                AI will generate compliant content using your brand guidelines and validated claims.
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssetCard({
  asset,
  onDelete,
  onView,
}: {
  asset: Asset;
  onDelete: () => void;
  onView: () => void;
}) {
  const typeConfig = assetTypes.find(t => t.id === asset.type);
  const Icon = typeConfig?.icon || FileText;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="hover:border-ring transition-all">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-muted ${typeConfig?.color}`}>
              <Icon className="w-6 h-6" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">
                  {typeConfig?.label || asset.type}
                </span>
                {asset.format && (
                  <Badge variant="outline" className="text-xs">
                    {asset.format}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(asset.createdAt).toLocaleDateString()}
                </span>
                <StatusBadge status={asset.status} />
                {asset.claimsValidated && (
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle2 className="w-3 h-3" />
                    Validated
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onView}
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onView}>
                    <Eye className="w-4 h-4 mr-2" />
                    View & Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: Asset['status'] }) {
  const config = {
    draft: { label: 'Draft', class: 'bg-muted text-muted-foreground' },
    review: { label: 'Review', class: 'bg-yellow-500/20 text-amber-500 ' },
    approved: { label: 'Approved', class: 'bg-green-500/20 text-emerald-500 ' },
    published: { label: 'Published', class: 'bg-blue-500/20 text-blue-500 ' },
  };

  const c = config[status] || config.draft;

  return (
    <span className={`px-2 py-0.5 rounded text-xs ${c.class}`}>
      {c.label}
    </span>
  );
}

function mapUiTypeToApiType(type: string): string {
  switch (type) {
    case 'landing':
      return 'landing_page';
    case 'social':
      return 'social_post';
    default:
      return type;
  }
}

function normalizeAsset(asset: Record<string, unknown>): Asset {
  const rawType = typeof asset.type === 'string'
    ? asset.type
    : typeof asset.asset_type === 'string'
      ? asset.asset_type
      : 'landing';
  const rawStatus = typeof asset.status === 'string' ? asset.status : 'draft';
  const claims = Array.isArray(asset.claims) ? asset.claims : [];

  return {
    id: typeof asset.id === 'string' ? asset.id : crypto.randomUUID(),
    type: normalizeAssetType(rawType),
    format: typeof asset.format === 'string'
      ? asset.format
      : typeof asset.channel === 'string'
        ? asset.channel
        : undefined,
    status: normalizeAssetStatus(rawStatus),
    content: typeof asset.content === 'object' && asset.content !== null
      ? (asset.content as Record<string, unknown>)
      : {},
    claimsValidated: claims.length === 0 || claims.every((claim) => {
      if (typeof claim !== 'object' || claim === null) return false;
      const status = (claim as Record<string, unknown>).status;
      return status === 'verified' || status === 'overridden';
    }),
    createdAt: typeof asset.createdAt === 'string'
      ? asset.createdAt
      : typeof asset.created_at === 'string'
        ? asset.created_at
        : new Date().toISOString(),
    updatedAt: typeof asset.updatedAt === 'string'
      ? asset.updatedAt
      : typeof asset.updated_at === 'string'
        ? asset.updated_at
        : new Date().toISOString(),
  };
}

function normalizeAssetType(type: string): string {
  switch (type) {
    case 'landing_page':
    case 'landing-page':
      return 'landing';
    case 'social_post':
      return 'social';
    case 'email_sequence':
      return 'email';
    case 'sales_deck':
      return 'deck';
    default:
      return type;
  }
}

function normalizeAssetStatus(status: string): Asset['status'] {
  switch (status) {
    case 'reviewing':
      return 'review';
    case 'draft':
    case 'review':
    case 'approved':
    case 'published':
      return status;
    default:
      return 'draft';
  }
}

function EmptyState({
  type,
  onGenerate,
}: {
  type: string;
  onGenerate: () => void;
}) {
  const typeConfig = assetTypes.find(t => t.id === type);
  const Icon = typeConfig?.icon || Sparkles;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={`p-4 rounded-full bg-muted mb-4 ${typeConfig?.color || 'text-muted-foreground'}`}>
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-medium mb-2">
        {type === 'all' ? 'No assets yet' : `No ${typeConfig?.label?.toLowerCase() || type} assets`}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Generate AI-powered {type === 'all' ? 'campaign assets' : typeConfig?.label?.toLowerCase()}
        with compliance validation built in.
      </p>
      <Button onClick={onGenerate}>
        <Sparkles className="w-4 h-4 mr-2" />
        Generate {type === 'all' ? 'Asset' : typeConfig?.label}
      </Button>
    </div>
  );
}
