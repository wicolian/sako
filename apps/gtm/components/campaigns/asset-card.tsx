"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Copy, Download, Code, RefreshCcw, Edit2, Layout, Mail, Share2, Megaphone, Check, Eye, EyeOff } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ClaimData } from "./compliance-sidebar"
import { ClaimHighlight } from "../claims/claim-highlight"
import { parseContentWithClaims } from "@/lib/claims/claim-matcher"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { GuidedReviewRail } from "@/components/planning/guided-review-rail"
import type { ReviewActionId, ReviewSignal } from "@/lib/planning/types"

export interface AssetCardProps {
  assetType: 'landing-page' | 'social' | 'email' | 'ad'
  title: string
  content: string | object
  claims: ClaimData[]
  brandColors?: { primary: string; secondary: string; accent: string }
  onCopy: () => void
  onExportMarkdown: () => void
  onExportHTML: () => void
  onRegenerate: () => void
  onClaimClick?: (claimId: string) => void
  reviewSignals?: ReviewSignal[]
  reviewActions?: ReviewActionId[]
  reviewLoadingAction?: ReviewActionId | null
  onReviewAction?: (action: ReviewActionId) => void
}

const ASSET_ICONS = {
  'landing-page': Layout,
  'social': Share2,
  'email': Mail,
  'ad': Megaphone,
}

export function AssetCard({
  assetType,
  title,
  content,
  claims,
  brandColors,
  onCopy,
  onExportMarkdown,
  onExportHTML,
  onRegenerate,
  onClaimClick,
  reviewSignals = [],
  reviewActions = [],
  reviewLoadingAction = null,
  onReviewAction,
}: AssetCardProps) {
  const [copied, setCopied] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<'preview' | 'claims'>('preview')
  const Icon = ASSET_ICONS[assetType]

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Parses text to add ClaimHighlights
  const renderTextWithClaims = (text: string) => {
    const segments = parseContentWithClaims(text, claims)
    return (
      <>
        {segments.map((seg) => {
          if (seg.isClaim && seg.claim) {
            return (
              <ClaimHighlight
                key={seg.id}
                claimId={seg.claim.id}
                riskLevel={seg.claim.riskLevel}
                category={seg.claim.category}
                isFabricated={!!seg.claim.isFabricated}
                suggestedRewrite={seg.claim.suggestedRewrite}
                evidenceStatus={seg.claim.evidenceStatus || "No evidence linked"}
                onClaimClick={onClaimClick}
              >
                {seg.text}
              </ClaimHighlight>
            )
          }
          return <span key={seg.id}>{seg.text}</span>
        })}
      </>
    )
  }

  // Renders Raw Claims View
  const renderClaimsView = () => {
    if (typeof content === 'string') {
      return (
        <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90 p-4 bg-muted/20 rounded-xl border border-border/50">
          {renderTextWithClaims(content)}
        </div>
      )
    }

    return (
      <pre className="text-sm overflow-x-auto p-4 bg-muted/20 rounded-xl border border-border/50">
        {JSON.stringify(content, null, 2)}
      </pre>
    )
  }

  // Renders Visual Preview
  const renderPreview = () => {
    const textContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2)

    if (assetType === 'social') {
      return (
        <div className="max-w-md mx-auto bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/20 text-primary font-semibold">B</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Brand Account</span>
                <span className="text-xs text-muted-foreground">@brand • Just now</span>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                {textContent}
              </div>
            </div>
          </div>
          <div className="bg-muted/30 px-4 py-3 border-t border-border/50 flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">💬 Reply</span>
            <span className="text-xs font-medium">🔁 Repost</span>
            <span className="text-xs font-medium">❤️ Like</span>
            <span className="text-xs font-medium">↗️ Share</span>
          </div>
        </div>
      )
    }

    if (assetType === 'email') {
      return (
        <div className="max-w-2xl mx-auto bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 p-4 border-b border-border/50 space-y-2 text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground w-12 text-right">From:</span>
              <span className="font-medium">Brand Team &lt;hello@brand.com&gt;</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground w-12 text-right">To:</span>
              <span className="font-medium">Customer &lt;customer@example.com&gt;</span>
            </div>
            <div className="flex items-center gap-4 pt-2 border-t border-border/50">
              <span className="text-muted-foreground w-12 text-right">Subject:</span>
              <span className="font-semibold text-foreground">Your next steps...</span>
            </div>
          </div>
          <div className="p-6 md:p-8 text-base whitespace-pre-wrap leading-relaxed text-foreground/90 bg-background font-serif">
            {textContent}
          </div>
        </div>
      )
    }

    if (assetType === 'landing-page') {
      // Try to parse if it's stringified JSON blocks
      let blocks = []
      if (typeof content === 'string') {
        try {
          const parsed = JSON.parse(`[${content.split('\n\n').join(',')}]`)
          if (Array.isArray(parsed)) blocks = parsed
        } catch(e) {
          // not json, just text
        }
      }

      if (blocks.length > 0) {
         return (
           <div className="w-full bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden flex flex-col gap-4 p-4 md:p-8">
             {blocks.map((block: any, i) => (
               <div key={i} className="w-full bg-muted/20 border border-border/50 rounded-lg p-6 text-center space-y-3">
                 <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Section {i+1}</div>
                 <pre className="text-xs text-left overflow-x-auto whitespace-pre-wrap max-w-full">
                    {JSON.stringify(block, null, 2)}
                 </pre>
               </div>
             ))}
           </div>
         )
      }

      // Fallback standard visual structure for text-based landing page
      return (
        <div className="w-full bg-background border border-border/60 rounded-xl shadow-sm overflow-hidden font-sans">
           <div className="h-12 border-b border-border/50 bg-muted/20 flex items-center px-4 gap-2">
             <div className="w-3 h-3 rounded-full bg-red-500/80" />
             <div className="w-3 h-3 rounded-full bg-amber-500/80" />
             <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
             <div className="flex-1 mx-4 h-6 bg-background rounded-md border border-border/50 flex items-center px-3 text-[10px] text-muted-foreground truncate">
               brand.com/campaign
             </div>
           </div>
           <div className="p-8 md:p-12 lg:p-16 flex flex-col items-center text-center max-w-3xl mx-auto space-y-6">
             <div className="w-16 h-16 bg-primary/20 rounded-2xl mb-4 flex items-center justify-center">
               <Layout className="w-8 h-8 text-primary" />
             </div>
             <div className="text-xl md:text-3xl font-bold tracking-tight text-foreground whitespace-pre-wrap leading-tight">
               {textContent.split('\n')[0] || "Landing Page Hero"}
             </div>
             <div className="text-base text-muted-foreground whitespace-pre-wrap">
               {textContent.split('\n').slice(1).join('\n')}
             </div>
             <Button size="lg" className="mt-4 rounded-full px-8 bg-primary text-primary-foreground hover:bg-primary/90">
               Call to Action
             </Button>
           </div>
        </div>
      )
    }

    // Fallback
    return (
      <div className="p-6 bg-card border border-border/60 rounded-xl whitespace-pre-wrap text-sm">
        {textContent}
      </div>
    )
  }

  return (
    <Card className="border-border/70 shadow-sm overflow-hidden bg-card transition-all hover:border-border">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-5 border-b border-border/50 bg-muted/10">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 text-primary rounded-md">
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        
        <div className="flex items-center gap-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'preview' | 'claims')} className="h-8">
            <TabsList className="h-full bg-muted/50 border border-border/50">
              <TabsTrigger value="preview" className="text-xs h-6 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Eye className="w-3 h-3 mr-1.5" /> Preview
              </TabsTrigger>
              <TabsTrigger value="claims" className="text-xs h-6 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Code className="w-3 h-3 mr-1.5" /> Claims Output
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="w-px h-4 bg-border/80" />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy content</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onExportHTML}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download asset</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRegenerate}>
                  <RefreshCcw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Regenerate</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 bg-muted/5">
        {reviewSignals.length > 0 ? (
          <div className="border-b border-border/50 p-4 md:p-5 bg-background/40">
            <GuidedReviewRail
              signals={reviewSignals}
              actions={reviewActions}
              loadingAction={reviewLoadingAction}
              onAction={onReviewAction}
            />
          </div>
        ) : null}
        <AnimatePresence mode="wait">
          {viewMode === 'preview' ? (
            <div key="preview" className="p-6 md:p-8 min-h-[300px] flex items-center justify-center">
              {renderPreview()}
            </div>
          ) : (
            <div key="claims" className="p-6 md:p-8 min-h-[300px]">
              {renderClaimsView()}
            </div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
