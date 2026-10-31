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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Download, Upload, Copy, Check, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface FigmaImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  onImportComplete: (designId: string) => void
}

export function FigmaImportDialog({
  open,
  onOpenChange,
  workspaceId,
  onImportComplete,
}: FigmaImportDialogProps) {
  const [mode, setMode] = useState<'import' | 'export'>('import')
  const [figmaUrl, setFigmaUrl] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [designName, setDesignName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Export state
  const [exportScript, setExportScript] = useState('')
  const [exportInstructions, setExportInstructions] = useState('')
  const [copied, setCopied] = useState(false)

  const handleImport = async () => {
    if (!figmaUrl) {
      toast.error('Please enter a Figma URL')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/figma/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          figmaUrl,
          accessToken: accessToken || undefined,
          workspaceId,
          name: designName || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Import failed')
      }

      const result = await response.json()
      toast.success(`Imported ${result.sections} sections from Figma!`)
      onImportComplete(result.id)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import from Figma')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async (designId: string) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/figma/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export failed')
      }

      const result = await response.json()
      setExportScript(result.script)
      setExportInstructions(result.instructions)
      setMode('export')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export to Figma')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyScript = async () => {
    await navigator.clipboard.writeText(exportScript)
    setCopied(true)
    toast.success('Script copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.5 12a3.5 3.5 0 0 1 3.5-3.5h7a3.5 3.5 0 1 1 0 7H9a3.5 3.5 0 0 1-3.5-3.5Zm3.5-7a3.5 3.5 0 1 0 0 7h7a3.5 3.5 0 1 0 0-7h-7Z"/>
            </svg>
            Figma Integration
          </DialogTitle>
          <DialogDescription>
            Import designs from Figma or export your design to Figma.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'import' | 'export')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import" className="gap-2">
              <Download className="h-4 w-4" />
              Import
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <Upload className="h-4 w-4" />
              Export
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="figma-url">Figma URL</Label>
              <Input
                id="figma-url"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/file/..."
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Paste a Figma file or frame URL to import its design.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="design-name">Design Name (Optional)</Label>
              <Input
                id="design-name"
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                placeholder="My Imported Design"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-token">Access Token (Optional)</Label>
              <Input
                id="access-token"
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="figd_..."
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                If you haven't connected Figma in settings, provide a{' '}
                <a 
                  href="https://www.figma.com/developers/api#access-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  personal access token
                </a>
                .
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={isLoading || !figmaUrl}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Import
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4 py-4">
            {exportScript ? (
              <>
                <div className="rounded-lg bg-muted p-4 max-h-64 overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                    {exportScript.slice(0, 500)}...
                  </pre>
                </div>

                <div className="space-y-2">
                  <Label>Instructions</Label>
                  <div className="text-sm text-muted-foreground prose prose-sm">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Open your Figma file</li>
                      <li>Press <code>Cmd/Ctrl + Option/Alt + I</code> to open the console</li>
                      <li>Copy the script and paste it into the console</li>
                      <li>Press Enter to run</li>
                    </ol>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCopyScript} className="flex-1">
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Script
                      </>
                    )}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="https://www.figma.com" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Figma
                    </a>
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Export your current design to Figma format.
                </p>
                <p className="text-sm text-muted-foreground">
                  Use the Export to Figma option from the editor menu to generate the script.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
