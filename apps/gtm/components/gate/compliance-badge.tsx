'use client'

/**
 * Compliance Badge - Embeddable badge for passed validations
 * 
 * Shows a "Verified by Sako" badge that can be embedded on websites.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Copy, Check, Code2, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ComplianceBadgeProps {
  score: number
  reportToken?: string
  className?: string
}

/**
 * Display component for the compliance badge
 */
export function ComplianceBadge({ score, reportToken, className }: ComplianceBadgeProps) {
  const complianceScore = Math.max(0, Math.min(100, 100 - score))
  
  const getColor = () => {
    if (complianceScore >= 80) return '#10b981' // emerald-500
    if (complianceScore >= 50) return '#f59e0b' // amber-500
    return '#ef4444' // red-500
  }
  
  const color = getColor()
  
  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background', className)}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="9" stroke={color} strokeWidth="2" fill={`${color}20`} />
        <path 
          d="M6 10L9 13L14 7" 
          stroke={color} 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-sm font-medium">
        Verified by Sako
      </span>
      <span 
        className="text-xs font-semibold px-1.5 py-0.5 rounded" 
        style={{ backgroundColor: `${color}20`, color }}
      >
        {complianceScore}
      </span>
    </div>
  )
}

/**
 * Generate embeddable HTML for the badge
 */
export function generateBadgeEmbed(reportToken: string, score: number): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://composer.trysako.com'
  const complianceScore = Math.max(0, Math.min(100, 100 - score))
  
  return `<a href="${baseUrl}/gate/report/${reportToken}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;">
  <img src="${baseUrl}/api/badge/${reportToken}" alt="Verified by Sako - Compliance Score: ${complianceScore}" style="height:28px;border:0;" />
</a>`
}

/**
 * Generate markdown embed for the badge
 */
export function generateBadgeMarkdown(reportToken: string, score: number): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://composer.trysako.com'
  const complianceScore = Math.max(0, Math.min(100, 100 - score))
  
  return `[![Verified by Sako - Score: ${complianceScore}](${baseUrl}/api/badge/${reportToken})](${baseUrl}/gate/report/${reportToken})`
}

interface BadgeEmbedDialogProps {
  score: number
  reportToken: string
  children: React.ReactNode
}

/**
 * Dialog for copying badge embed code
 */
export function BadgeEmbedDialog({ score, reportToken, children }: BadgeEmbedDialogProps) {
  const [copiedHtml, setCopiedHtml] = useState(false)
  const [copiedMarkdown, setCopiedMarkdown] = useState(false)
  
  const htmlEmbed = generateBadgeEmbed(reportToken, score)
  const markdownEmbed = generateBadgeMarkdown(reportToken, score)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://composer.trysako.com'
  
  const copyToClipboard = async (text: string, type: 'html' | 'markdown') => {
    await navigator.clipboard.writeText(text)
    if (type === 'html') {
      setCopiedHtml(true)
      setTimeout(() => setCopiedHtml(false), 2000)
    } else {
      setCopiedMarkdown(true)
      setTimeout(() => setCopiedMarkdown(false), 2000)
    }
  }
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Embed Compliance Badge</DialogTitle>
          <DialogDescription>
            Add this badge to your website to show your content is verified compliant.
          </DialogDescription>
        </DialogHeader>
        
        {/* Badge Preview */}
        <div className="flex justify-center py-4 bg-muted/50 rounded-lg">
          <ComplianceBadge score={score} reportToken={reportToken} />
        </div>
        
        <Tabs defaultValue="html" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
          </TabsList>
          
          <TabsContent value="html" className="space-y-3">
            <div className="relative">
              <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                <code>{htmlEmbed}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 w-7 p-0"
                onClick={() => copyToClipboard(htmlEmbed, 'html')}
              >
                {copiedHtml ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="markdown" className="space-y-3">
            <div className="relative">
              <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                <code>{markdownEmbed}</code>
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 w-7 p-0"
                onClick={() => copyToClipboard(markdownEmbed, 'markdown')}
              >
                {copiedMarkdown ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          <span>Badge links to your verification report at {baseUrl}/gate/report/{reportToken}</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
