'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sparkles, Loader2, Layout } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { CampaignBuilderShell } from '@/components/editor/campaign-builder-shell'
import { toast } from 'sonner'
import type { WebsiteDesign } from '@/lib/website/ai-designer'
import type { Campaign } from '@/lib/supabase/types'

interface CampaignDesignTabProps {
  campaign: Campaign
}

export function CampaignDesignTab({ campaign }: CampaignDesignTabProps) {
  const [design, setDesign] = useState<WebsiteDesign | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchDesign = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/design`)
      if (res.ok) {
        const data = (await res.json()) as { design: WebsiteDesign | null }
        setDesign(data.design)
      }
    } catch {
      // silent — empty state handles the no-design case
    } finally {
      setLoading(false)
    }
  }, [campaign.id])

  useEffect(() => {
    void fetchDesign()
  }, [fetchDesign])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designDirection: 'auto' }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? 'Generation failed')
      }

      const data = (await res.json()) as { design: WebsiteDesign }
      setDesign(data.design)
      toast.success('Landing page generated!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate landing page')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!design) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10 p-8">
        <div className="w-full max-w-md">
          <EmptyState
            icon={Layout}
            title="No landing page yet"
            description="Generate a fidelity-first landing page built from brand tokens, design archetypes, and your campaign brief. The canonical HTML is identical to what gets exported and published."
            action={{
              label: generating ? 'Generating…' : 'Generate Landing Page',
              icon: generating ? Loader2 : Sparkles,
              onClick: () => void handleGenerate(),
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <CampaignBuilderShell
      design={design}
      campaignId={campaign.id}
      onDesignUpdate={setDesign}
      className="h-full"
    />
  )
}
