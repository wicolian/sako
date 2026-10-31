'use client'

import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { WebsiteDesign } from '@/lib/website/ai-designer'
import { Renderer, type OpenUiParseResult } from '@/lib/openui/runtime'
import {
  buildOpenUiPromptFromDesign,
  sakoOpenUiLibrary,
  websiteDesignToOpenUiSource,
} from '@/lib/openui/sako-library'
import type { ViewportSize } from './editor-shell'

interface OpenUiPreviewModeProps {
  design: WebsiteDesign
  viewport: ViewportSize
}

const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
  desktop: 'w-full',
  tablet: 'max-w-[768px]',
  mobile: 'max-w-[375px]',
}

type PreviewTab = 'render' | 'html' | 'source'

export function OpenUiPreviewMode({ design, viewport }: OpenUiPreviewModeProps) {
  const [prompt, setPrompt] = useState(() => buildOpenUiPromptFromDesign(design))
  const [response, setResponse] = useState(() => websiteDesignToOpenUiSource(design))
  const [isStreaming, setIsStreaming] = useState(false)
  const [parseResult, setParseResult] = useState<OpenUiParseResult | null>(null)
  const [activeTab, setActiveTab] = useState<PreviewTab>('render')
  const [compiledHtml, setCompiledHtml] = useState<string>('')
  const [compilePending, setCompilePending] = useState(false)

  useEffect(() => {
    setPrompt(buildOpenUiPromptFromDesign(design))
    setResponse(websiteDesignToOpenUiSource(design))
  }, [design])

  const compileHtml = useCallback(async (source: string) => {
    if (!source.trim()) {
      setCompiledHtml('')
      return
    }

    setCompilePending(true)
    try {
      const renderResponse = await fetch('/api/openui/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })

      if (!renderResponse.ok) {
        throw new Error('Failed to render OpenUI HTML')
      }

      const payload = (await renderResponse.json()) as { html?: string }
      setCompiledHtml(payload.html || '')
    } catch (error) {
      console.error('Failed to compile OpenUI HTML:', error)
      setCompiledHtml('')
    } finally {
      setCompilePending(false)
    }
  }, [])

  useEffect(() => {
    if (!isStreaming) {
      void compileHtml(response)
    }
  }, [compileHtml, isStreaming, response])

  const handleGenerate = useCallback(async () => {
    setIsStreaming(true)
    setResponse('')
    setParseResult(null)

    try {
      const result = await fetch('/api/openui/poc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          workspaceId: design.workspace_id,
          brandId: design.brand_id,
        }),
      })

      if (!result.ok || !result.body) {
        throw new Error('Failed to stream OpenUI preview')
      }

      const reader = result.body.getReader()
      const decoder = new TextDecoder()
      let streamed = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        streamed += decoder.decode(value, { stream: true })
        setResponse(streamed)
      }
    } catch (error) {
      console.error('Failed to generate OpenUI preview:', error)
      setResponse(websiteDesignToOpenUiSource(design))
    } finally {
      setIsStreaming(false)
    }
  }, [design, prompt])

  const stats = useMemo(() => {
    if (!parseResult) {
      return {
        statements: 0,
        unresolved: 0,
        validationErrors: 0,
        incomplete: false,
      }
    }

    return {
      statements: parseResult.meta.statementCount,
      unresolved: parseResult.meta.unresolved.length,
      validationErrors: parseResult.meta.validationErrors.length,
      incomplete: parseResult.meta.incomplete,
    }
  }, [parseResult])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b bg-card px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">OpenUI POC prompt</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Streams OpenUI Lang directly from the model, then renders it with the OpenUI runtime.
            </p>
            <Textarea
              className="mt-3 min-h-24"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Button onClick={() => void handleGenerate()} disabled={isStreaming}>
              {isStreaming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Stream OpenUI
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const next = websiteDesignToOpenUiSource(design)
                setResponse(next)
                setParseResult(null)
              }}
              disabled={isStreaming}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset to current design
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Statements: {stats.statements}</Badge>
          <Badge variant="secondary">Unresolved: {stats.unresolved}</Badge>
          <Badge variant={stats.validationErrors > 0 ? 'destructive' : 'secondary'}>
            Validation: {stats.validationErrors}
          </Badge>
          <Badge variant={stats.incomplete ? 'outline' : 'secondary'}>
            {stats.incomplete || isStreaming ? 'Streaming' : 'Complete'}
          </Badge>
          {compilePending ? <Badge variant="outline">Compiling HTML…</Badge> : null}
        </div>
      </div>

      <div className="border-b bg-muted/40 px-4 py-2">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PreviewTab)}>
          <TabsList className="h-8">
            <TabsTrigger value="render" className="text-xs">Live Renderer</TabsTrigger>
            <TabsTrigger value="html" className="text-xs">Static HTML</TabsTrigger>
            <TabsTrigger value="source" className="text-xs">Source</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto bg-muted/30 p-4">
        {activeTab === 'render' ? (
          <div className={cn('mx-auto overflow-hidden rounded-lg bg-white shadow-2xl', VIEWPORT_WIDTHS[viewport])}>
            <Renderer
              response={response}
              library={sakoOpenUiLibrary}
              isStreaming={isStreaming}
              onParseResult={setParseResult}
            />
          </div>
        ) : null}

        {activeTab === 'html' ? (
          <div className={cn('mx-auto overflow-hidden rounded-lg bg-white shadow-2xl', VIEWPORT_WIDTHS[viewport])}>
            <iframe
              className="h-[75vh] w-full border-0"
              sandbox="allow-scripts allow-same-origin"
              srcDoc={compiledHtml}
              title="OpenUI static HTML preview"
            />
          </div>
        ) : null}

        {activeTab === 'source' ? (
          <pre className="mx-auto max-w-5xl overflow-x-auto rounded-lg border bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {response}
          </pre>
        ) : null}
      </div>
    </div>
  )
}
