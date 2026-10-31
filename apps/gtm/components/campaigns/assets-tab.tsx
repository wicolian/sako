'use client'

import { useState } from 'react'
import { Mail, Megaphone, FileText, MessageSquare, Loader2, Sparkles, Download, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

interface AssetsTabProps {
  campaignId: string
}

type AssetType = 'email_sequence' | 'ad_variants' | 'sales_one_pager' | 'talk_track'

const assetTypes = [
  {
    id: 'email_sequence' as const,
    name: 'Email Sequence',
    description: 'Generate a 5-email nurture sequence',
    icon: Mail,
  },
  {
    id: 'ad_variants' as const,
    name: 'Ad Variants',
    description: 'Create ads for LinkedIn, Meta, Google',
    icon: Megaphone,
  },
  {
    id: 'sales_one_pager' as const,
    name: 'Sales One-Pager',
    description: 'Generate a leave-behind PDF',
    icon: FileText,
  },
  {
    id: 'talk_track' as const,
    name: 'SDR Talk Track',
    description: 'Create a call script for sales reps',
    icon: MessageSquare,
  },
]

export function AssetsTab({ campaignId }: AssetsTabProps) {
  const { toast } = useToast()
  const [generatingType, setGeneratingType] = useState<AssetType | null>(null)
  const [generatedAssets, setGeneratedAssets] = useState<Record<AssetType, unknown>>({} as Record<AssetType, unknown>)

  const generateAsset = async (assetType: AssetType) => {
    setGeneratingType(assetType)
    try {
      const response = await fetch('/api/ai/generate-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          assetType,
          options: { save: true },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate asset')
      }

      const data = await response.json()
      setGeneratedAssets((prev) => ({ ...prev, [assetType]: data.asset }))
      toast({
        title: 'Asset Generated',
        description: `Your ${assetType.replace(/_/g, ' ')} has been created.`,
      })
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate asset. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setGeneratingType(null)
    }
  }

  const copyToClipboard = (content: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(content, null, 2))
    toast({ title: 'Copied!', description: 'Content copied to clipboard' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Multi-Asset Generation</h2>
          <p className="text-sm text-muted-foreground">
            Generate marketing assets from your campaign brief
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {assetTypes.map((asset) => {
          const Icon = asset.icon
          const isGenerating = generatingType === asset.id
          const hasAsset = !!generatedAssets[asset.id]

          return (
            <Card key={asset.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{asset.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {asset.description}
                      </CardDescription>
                    </div>
                  </div>
                  {hasAsset && (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-green-800">
                      Generated
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {hasAsset ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(generatedAssets[asset.id])}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateAsset(asset.id)}
                      disabled={isGenerating}
                    >
                      Regenerate
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => generateAsset(asset.id)}
                    disabled={isGenerating}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        Generate
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Preview Section */}
      {Object.keys(generatedAssets).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Assets Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={Object.keys(generatedAssets)[0]}>
              <TabsList>
                {Object.keys(generatedAssets).map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(generatedAssets).map(([key, content]) => (
                <TabsContent key={key} value={key} className="mt-4">
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-[400px]">
                    {JSON.stringify(content, null, 2)}
                  </pre>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
