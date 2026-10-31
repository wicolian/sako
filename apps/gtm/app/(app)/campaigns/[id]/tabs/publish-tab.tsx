'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, AlertCircle, ExternalLink, Loader2, Send, Download, Link2, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import type { Campaign, Message, Angle, PageBlock } from '@/lib/supabase/types'

interface PublishTabProps {
  campaign: Campaign
  messages: Message[]
  angles: Angle[]
  blocks: PageBlock[]
}

interface ChecklistItem {
  id: string
  label: string
  description: string
  complete: boolean
}

interface HubSpotStatus {
  connected: boolean
  portal_id?: string
}

interface WebflowStatus {
  connected: boolean
}

export function PublishTab({ campaign, messages, angles, blocks }: PublishTabProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [publishing, setPublishing] = useState(false)
  const [exportingFigma, setExportingFigma] = useState(false)
  const [publishingWebflow, setPublishingWebflow] = useState(false)
  const [exportingFramer, setExportingFramer] = useState(false)
  const [creatingPackage, setCreatingPackage] = useState(false)
  const [hubspotStatus, setHubspotStatus] = useState<HubSpotStatus>({ connected: false })
  const [webflowStatus, setWebflowStatus] = useState<WebflowStatus>({ connected: false })
  const [deployResult, setDeployResult] = useState<{
    success: boolean
    partial?: boolean
    errors?: string[]
    result?: Record<string, unknown>
    error?: string
  } | null>(null)

  useEffect(() => {
    checkHubSpotStatus()
    checkWebflowStatus()
  }, [])

  const checkHubSpotStatus = async () => {
    try {
      const res = await fetch('/api/hubspot/status')
      if (res.ok) {
        const data = await res.json()
        setHubspotStatus(data)
      }
    } catch (error) {
      console.error('Failed to check HubSpot status:', error)
    }
  }

  const checkWebflowStatus = async () => {
    try {
      const res = await fetch('/api/webflow/status')
      if (res.ok) {
        const data = await res.json()
        setWebflowStatus({ connected: Boolean(data.connected) })
      }
    } catch (error) {
      console.error('Failed to check Webflow status:', error)
    }
  }

  const checklist: ChecklistItem[] = [
    {
      id: 'messages',
      label: 'Campaign copy generated',
      description: 'Messaging assets are ready to review',
      complete: messages.length > 0,
    },
    {
      id: 'angle',
      label: 'Campaign direction chosen',
      description: 'The brief has a selected angle',
      complete: !!campaign.selected_angle_id,
    },
    {
      id: 'page',
      label: 'Landing page ready',
      description: 'The landing page has editable blocks',
      complete: blocks.length > 0,
    },
  ]

  const publishToDestination = async (
    destination: 'hubspot' | 'webflow',
    setPending: (pending: boolean) => void
  ) => {
    setPending(true)
    setDeployResult(null)
    try {
      const res = await fetch(`/api/deploy/${campaign.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinations: [destination] }),
      })
      const data = await res.json()
      setDeployResult(data)
      if (data.success) {
        toast({
          title: destination === 'hubspot' ? 'Published to HubSpot' : 'Published to Webflow',
          description: destination === 'hubspot'
            ? 'Campaign assets were sent to HubSpot.'
            : 'Landing page was sent to Webflow.',
        })
        router.refresh()
      } else {
        toast({ title: 'Publish failed', description: data.error || 'Unknown error', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Failed to publish:', error)
      toast({ title: 'Error', description: 'Failed to publish campaign.', variant: 'destructive' })
    } finally {
      setPending(false)
    }
  }

  const exportToFigma = async () => {
    setExportingFigma(true)
    try {
      const res = await fetch(`/api/export/figma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Exported!', description: 'Design exported to Figma clipboard.' })
      } else {
        toast({ title: 'Export failed', description: data.error || 'Unknown error', variant: 'destructive' })
      }
    } catch (error) {
      console.error('Failed to export to Figma:', error)
      toast({ title: 'Error', description: 'Failed to export to Figma.', variant: 'destructive' })
    } finally {
      setExportingFigma(false)
    }
  }

  const exportToFramer = async () => {
    setExportingFramer(true)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          platform: 'framer',
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to export to Framer')
      }

      if (typeof data.clipboardData === 'string') {
        await navigator.clipboard.writeText(data.clipboardData)
      }

      toast({
        title: 'Copied for Framer',
        description: typeof data.instructions === 'string'
          ? data.instructions
          : 'Framer-compatible markup was copied to your clipboard.',
      })
    } catch (error) {
      console.error('Failed to export to Framer:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to export to Framer.',
        variant: 'destructive',
      })
    } finally {
      setExportingFramer(false)
    }
  }

  const createHandoffPackage = async () => {
    setCreatingPackage(true)
    try {
      const res = await fetch(`/api/export/package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: campaign.id }),
      })
      
      // Check if it's a direct file download (ZIP blob response)
      const contentType = res.headers.get('content-type')
      if (contentType?.includes('application/zip')) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${campaign.name.replace(/\s+/g, '-').toLowerCase()}-package.zip`
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: 'Downloaded!', description: 'Campaign package downloaded.' })
        return
      }
      
      // Otherwise it's a JSON response with download URL
      const data = await res.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      if (data.downloadUrl) {
        // Open the download URL in a new tab or trigger download
        const a = document.createElement('a')
        a.href = data.downloadUrl
        a.download = data.fileName || `${campaign.name.replace(/\s+/g, '-').toLowerCase()}-package.zip`
        a.target = '_blank'
        a.click()
        toast({ title: 'Downloaded!', description: 'Campaign package downloaded.' })
      } else if (data.package) {
        // Fallback for old JSON package format
        const blob = new Blob([JSON.stringify(data.package, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${campaign.name.replace(/\s+/g, '-').toLowerCase()}-package.json`
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: 'Downloaded!', description: 'Campaign package downloaded.' })
      } else {
        throw new Error('No download available')
      }
    } catch (error) {
      console.error('Failed to create package:', error)
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create package.', variant: 'destructive' })
    } finally {
      setCreatingPackage(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-lg font-semibold">Choose how to ship this campaign</h2>
        <p className="text-sm text-muted-foreground">
          Direct deploy, export-only handoff, and manual package download are separated below so you can see what actually works.
        </p>
      </div>

      {/* Checklist */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Before you ship</CardTitle>
          <CardDescription>
            These checks apply before any deploy or export path
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checklist.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  item.complete ? 'bg-primary/5' : 'bg-muted/30'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    item.complete
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {item.complete ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
                {item.complete ? (
                  <Badge variant="default" className="text-xs">
                    Complete
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Pending
                  </Badge>
                )}
              </div>
            ))}
            </div>
          </CardContent>
        </Card>

      <Card className="mb-6 border-border/50 bg-muted/20">
        <CardContent className="grid gap-3 p-4 md:grid-cols-4">
          <div className="rounded-xl border border-border/50 bg-background/70 p-3">
            <Badge variant="secondary">Direct deploy</Badge>
            <p className="mt-2 text-sm text-muted-foreground">HubSpot and Webflow beta can push directly when connected.</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/70 p-3">
            <Badge variant="secondary">Export-only</Badge>
            <p className="mt-2 text-sm text-muted-foreground">Figma and Framer are handoff paths, not live hosting.</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/70 p-3">
            <Badge variant="secondary">Manual handoff</Badge>
            <p className="mt-2 text-sm text-muted-foreground">Download a ZIP package if you want to move the campaign elsewhere.</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/70 p-3">
            <Badge variant="secondary">Connections</Badge>
            <p className="mt-2 text-sm text-muted-foreground">Manage provider auth in Settings before attempting direct deploy.</p>
          </div>
        </CardContent>
      </Card>

      {/* Deploy result — only shown after a publish attempt */}
      {deployResult && (
        <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
          deployResult.success
            ? 'border-emerald-500/20 bg-green-50'
            : deployResult.partial
            ? 'border-yellow-200 bg-yellow-50'
            : 'border-red-200 bg-red-50'
        }`}>
          {deployResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          ) : deployResult.partial ? (
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium">
              {deployResult.success
                ? 'Published successfully to all destinations'
                : deployResult.partial
                ? 'Partially published — some destinations failed'
                : `Publish failed: ${deployResult.error ?? 'Unknown error'}`}
            </p>
            {deployResult.partial && Array.isArray((deployResult as { errors?: unknown[] }).errors) && (
              <ul className="mt-1 text-xs text-amber-500 list-disc list-inside">
                {((deployResult as { errors: string[] }).errors).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Publish Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* HubSpot Publish */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 bg-[#ff7a59] rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  HS
                </div>
                Deploy to HubSpot
              </CardTitle>
              <Badge variant="secondary">Direct deploy</Badge>
            </div>
            <CardDescription>
              Push campaign assets directly to a connected HubSpot workspace on Team plans and above
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-xs text-muted-foreground">
              {hubspotStatus.connected ? `Connected portal ${hubspotStatus.portal_id ?? ""}` : "Connect HubSpot in Settings to enable direct deploy."}
            </div>
            <Button
              onClick={() => publishToDestination('hubspot', setPublishing)}
              disabled={publishing || !hubspotStatus.connected}
              className="w-full shadow-md shadow-[#ff7a59]/10"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Deploy to HubSpot
            </Button>
          </CardContent>
        </Card>

        {/* Figma Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 bg-muted rounded-xl flex items-center justify-center shadow-sm">
                  <Link2 className="w-4 h-4" />
                </div>
                Export to Figma
              </CardTitle>
              <Badge variant="secondary">Export-only</Badge>
            </div>
            <CardDescription>
              Copy the landing page into Figma for design handoff
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={exportToFigma}
              disabled={exportingFigma}
              className="w-full"
            >
              {exportingFigma ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Export to Figma
            </Button>
          </CardContent>
        </Card>

        {/* Webflow Publish */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 bg-[#4353FF] rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  WF
                </div>
                Deploy to Webflow
              </CardTitle>
              <Badge variant="secondary">Beta deploy</Badge>
            </div>
            <CardDescription>
              Push the landing page to a connected Webflow site on Team plans and above
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 text-xs text-muted-foreground">
              {webflowStatus.connected ? "Webflow is connected and ready for beta deploy." : "Connect Webflow in Settings to enable beta deploy."}
            </div>
            <Button
              onClick={() => publishToDestination('webflow', setPublishingWebflow)}
              disabled={publishingWebflow || !webflowStatus.connected}
              className="w-full bg-[#4353FF] hover:bg-[#4353FF]/90 text-white shadow-md shadow-[#4353FF]/20"
            >
              {publishingWebflow ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Deploy to Webflow
            </Button>
          </CardContent>
        </Card>

        {/* Framer Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 bg-black border border-white/10 rounded-xl flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 38 57" fill="currentColor">
                    <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z"/>
                    <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z"/>
                    <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z"/>
                    <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z"/>
                    <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z"/>
                  </svg>
                </div>
                Export to Framer
              </CardTitle>
              <Badge variant="secondary">Export-only</Badge>
            </div>
            <CardDescription>
              Copy a Framer-compatible payload to your clipboard for paste-import
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={exportToFramer}
              disabled={exportingFramer}
              className="w-full bg-card text-foreground hover:bg-gray-200 shadow-md shadow-white/10"
            >
              {exportingFramer ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="w-4 h-4 mr-2" />
              )}
              Copy for Framer
            </Button>
          </CardContent>
        </Card>

        {/* Download Package */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-8 h-8 bg-muted rounded-xl flex items-center justify-center shadow-sm">
                  <Download className="w-4 h-4" />
                </div>
                Download Package
              </CardTitle>
              <Badge variant="secondary">Manual handoff</Badge>
            </div>
            <CardDescription>
              Download a manual handoff ZIP on paid plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={createHandoffPackage}
              disabled={creatingPackage}
              className="w-full"
            >
              {creatingPackage ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download Package
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
