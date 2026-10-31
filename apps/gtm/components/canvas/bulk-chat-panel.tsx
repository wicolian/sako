'use client'

/**
 * Bulk Chat Panel Component
 * 
 * Apply AI-powered bulk updates to multiple selected assets via chat.
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Wand2,
  Languages,
  Megaphone,
  Minimize2,
  Maximize2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { ProjectAsset } from './infinite-canvas'

interface BulkChatPanelProps {
  projectId: string
  selectedAssets: ProjectAsset[]
  onClose: () => void
  onAssetsUpdated: () => void
}

interface BulkUpdateResult {
  assetId: string
  assetName: string
  success: boolean
  originalValue?: string
  newValue?: string
  error?: string
}

const QUICK_ACTIONS = [
  {
    id: 'rewrite-engaging',
    label: 'Make more engaging',
    icon: Sparkles,
    operation: { type: 'rewrite', prompt: 'Rewrite to be more engaging and action-oriented' },
  },
  {
    id: 'tone-professional',
    label: 'Professional tone',
    icon: Megaphone,
    operation: { type: 'tone_change', prompt: 'Make the tone more professional and formal' },
  },
  {
    id: 'tone-casual',
    label: 'Casual tone',
    icon: Megaphone,
    operation: { type: 'tone_change', prompt: 'Make the tone more casual and friendly' },
  },
  {
    id: 'condense',
    label: 'Shorten content',
    icon: Minimize2,
    operation: { type: 'condense', prompt: 'Shorten by 30% while keeping key points' },
  },
  {
    id: 'expand',
    label: 'Add more detail',
    icon: Maximize2,
    operation: { type: 'expand', prompt: 'Add more detail and supporting examples' },
  },
]

export function BulkChatPanel({
  projectId,
  selectedAssets,
  onClose,
  onAssetsUpdated,
}: BulkChatPanelProps) {
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<BulkUpdateResult[] | null>(null)
  const [showResults, setShowResults] = useState(true)

  const handleSubmit = useCallback(async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt
    if (!finalPrompt.trim() || selectedAssets.length === 0) return

    setIsProcessing(true)
    setResults(null)

    try {
      const response = await fetch('/api/canvas/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          assetIds: selectedAssets.map((a) => a.id),
          operation: {
            type: 'custom',
            prompt: finalPrompt,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to apply bulk update')
      }

      const data = await response.json()
      setResults(data.results)
      setShowResults(true)
      onAssetsUpdated()
    } catch (error) {
      console.error('Bulk update error:', error)
      setResults(
        selectedAssets.map((a) => ({
          assetId: a.id,
          assetName: a.name,
          success: false,
          error: 'Failed to process update',
        }))
      )
    } finally {
      setIsProcessing(false)
    }
  }, [prompt, selectedAssets, projectId, onAssetsUpdated])

  const handleQuickAction = (operation: { type: string; prompt: string }) => {
    setPrompt(operation.prompt)
    handleSubmit(operation.prompt)
  }

  const successCount = results?.filter((r) => r.success).length || 0
  const failCount = results?.filter((r) => !r.success).length || 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[600px] max-w-[calc(100vw-2rem)]"
    >
      <div className="bg-card border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Bulk Edit</span>
            <Badge variant="secondary">{selectedAssets.length} selected</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-3 border-b">
          <p className="text-xs text-muted-foreground mb-2">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleQuickAction(action.operation)}
                disabled={isProcessing}
              >
                <action.icon className="h-3 w-3 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Prompt Input */}
        <div className="p-4">
          <div className="relative">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Apply changes to ${selectedAssets.length} assets... e.g., "Translate to Spanish" or "Add urgency"`}
              className="min-h-[80px] pr-24 resize-none"
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-2">⌘↵</span>
              <Button
                size="sm"
                onClick={() => handleSubmit()}
                disabled={!prompt.trim() || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Apply
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        <AnimatePresence>
          {results && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="border-t overflow-hidden"
            >
              <Collapsible open={showResults} onOpenChange={setShowResults}>
                <CollapsibleTrigger asChild>
                  <button className="w-full px-4 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">Results</span>
                      {successCount > 0 && (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {successCount} updated
                        </Badge>
                      )}
                      {failCount > 0 && (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          {failCount} failed
                        </Badge>
                      )}
                    </div>
                    {showResults ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="max-h-[200px]">
                    <div className="px-4 pb-4 space-y-2">
                      {results.map((result) => (
                        <ResultItem key={result.assetId} result={result} />
                      ))}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Assets Preview */}
        <div className="px-4 py-2 border-t bg-muted/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Editing:</span>
            {selectedAssets.slice(0, 5).map((asset) => (
              <Badge key={asset.id} variant="outline" className="text-xs">
                {asset.name}
              </Badge>
            ))}
            {selectedAssets.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{selectedAssets.length - 5} more
              </Badge>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ResultItem({ result }: { result: BulkUpdateResult }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        result.success ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {result.success ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm font-medium">{result.assetName}</span>
        </div>
        {result.success && result.newValue && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide' : 'Show'} changes
          </Button>
        )}
      </div>
      {result.error && (
        <p className="text-xs text-red-500 mt-1">{result.error}</p>
      )}
      {expanded && result.newValue && (
        <div className="mt-2 text-xs space-y-2">
          {result.originalValue && (
            <div>
              <span className="text-muted-foreground">Before:</span>
              <p className="mt-0.5 p-2 bg-muted rounded text-muted-foreground line-through">
                {result.originalValue.slice(0, 100)}
                {result.originalValue.length > 100 && '...'}
              </p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">After:</span>
            <p className="mt-0.5 p-2 bg-primary/5 rounded">
              {result.newValue.slice(0, 200)}
              {result.newValue.length > 200 && '...'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
