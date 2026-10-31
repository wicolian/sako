'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Globe, Loader2, Check, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import type { WebsiteDesign } from '@/lib/website/ai-designer'

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  design: WebsiteDesign
  onPublished: (url: string) => void
}

export function PublishDialog({ open, onOpenChange, design, onPublished }: PublishDialogProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const [subdomain, setSubdomain] = useState(
    design.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  )
  const [publishedUrl, setPublishedUrl] = useState(design.published_url || '')
  const [copied, setCopied] = useState(false)

  const handlePublish = async () => {
    if (!subdomain.trim()) {
      toast.error('Please enter a subdomain')
      return
    }

    setIsPublishing(true)
    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId: design.id,
          subdomain: subdomain.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Failed to publish')
      }

      const result = await response.json()
      setPublishedUrl(result.url)
      onPublished(result.url)
      toast.success(result.message || 'Publish artifact created')
    } catch (error) {
      console.error('Publish failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to publish')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(publishedUrl)
    setCopied(true)
    toast.success('URL copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const isPublished = !!publishedUrl

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Publish Website
          </DialogTitle>
          <DialogDescription>
            Upload an HTML artifact to your workspace hosting bucket. Public hosting depends on your `PUBLISH_DOMAIN` DNS setup.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Subdomain input */}
          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain</Label>
            <div className="flex items-center">
              <Input
                id="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="my-website"
                className="rounded-r-none"
                disabled={isPublishing}
              />
              <div className="px-3 py-2 bg-muted border border-l-0 rounded-r-md text-sm text-muted-foreground">
                .sako.pub
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The artifact URL will be {subdomain || 'your-subdomain'}.sako.pub once DNS routing is configured.
            </p>
          </div>

          {/* Published URL */}
          {isPublished && (
            <div className="space-y-2 p-4 bg-green-50  rounded-lg border border-emerald-500/20 ">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-emerald-500 ">
                  Publish artifact ready
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={publishedUrl}
                  readOnly
                  className="bg-card dark:bg-card/40 backdrop-blur-sm text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyUrl}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  asChild
                >
                  <a href={publishedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={isPublished ? 'default' : 'secondary'}>
              {isPublished ? 'Beta Hosting' : 'Draft'}
            </Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePublish} disabled={isPublishing || !subdomain.trim()}>
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : isPublished ? (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Update
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Publish
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
