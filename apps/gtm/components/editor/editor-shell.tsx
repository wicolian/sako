'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye,
  Pencil,
  Code,
  Save,
  ChevronDown,
  Undo2,
  Redo2,
  Monitor,
  Tablet,
  Smartphone,
  Download,
  Globe,
  Settings,
  Layers,
  Palette,
  Type,
  Box,
  Plus,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  FileCode,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { PreviewMode } from './preview-mode'
import { DesignMode } from './design-mode'
import { CodeMode } from './code-mode'
import { LayersPanel } from './layers-panel'
import { PropertiesPanel } from './properties-panel'
import { PublishDialog } from './publish-dialog'
import type { WebsiteDesign, WebsiteSection, SectionType } from '@/lib/website/ai-designer'

export type EditorMode = 'preview' | 'design' | 'code'
export type ViewportSize = 'desktop' | 'tablet' | 'mobile'

interface EditorShellProps {
  initialDesign: WebsiteDesign
  /** Override the root element height class. Defaults to "h-screen" for standalone use. Pass "h-full" when embedding inside a tab. */
  className?: string
}

interface HistoryEntry {
  sections: WebsiteSection[]
  timestamp: number
}

export function EditorShell({ initialDesign, className }: EditorShellProps) {
  // Core state
  const [design, setDesign] = useState<WebsiteDesign>(initialDesign)
  const [mode, setMode] = useState<EditorMode>('design')
  const [viewport, setViewport] = useState<ViewportSize>('desktop')
  const [previewEngine, setPreviewEngine] = useState<'html' | 'openui'>('html')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [leftPanelTab, setLeftPanelTab] = useState<'layers' | 'components'>('layers')

  // History for undo/redo
  const [history, setHistory] = useState<HistoryEntry[]>([{ sections: design.sections, timestamp: Date.now() }])
  const [historyIndex, setHistoryIndex] = useState(0)

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    setDesign(initialDesign)
    setHistory([{ sections: initialDesign.sections, timestamp: Date.now() }])
    setHistoryIndex(0)
    setSelectedSectionId(null)
    setHasUnsavedChanges(false)
  }, [initialDesign])

  // Fetch workspace ID
  useEffect(() => {
    const fetchWorkspaceId = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .single()
        const workspaceData = data as { workspace_id: string } | null
        if (workspaceData?.workspace_id) {
          setWorkspaceId(workspaceData.workspace_id)
        }
      }
    }
    fetchWorkspaceId()
  }, [])

  // Track unsaved changes
  useEffect(() => {
    if (historyIndex > 0) {
      setHasUnsavedChanges(true)
    }
  }, [historyIndex])

  // Update sections with history
  const updateSections = useCallback((newSections: WebsiteSection[]) => {
    const newEntry: HistoryEntry = { sections: newSections, timestamp: Date.now() }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newEntry)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    setDesign(prev => ({ ...prev, sections: newSections }))
  }, [history, historyIndex])

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setDesign(prev => ({ ...prev, sections: history[newIndex].sections }))
    }
  }, [historyIndex, history])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setDesign(prev => ({ ...prev, sections: history[newIndex].sections }))
    }
  }, [historyIndex, history])

  // Save design
  const handleSave = useCallback(async () => {
    if (!workspaceId) {
      toast.error('No workspace found')
      return
    }

    setIsSaving(true)
    try {
      const supabase = createClient()
      
      if (design.id === 'new') {
        // Create new design - cast to bypass generated types
        type InsertResult = { data: { id: string } | null; error: Error | null }
        const { data, error } = await (supabase as unknown as { from: (t: string) => { insert: (v: Record<string, unknown>) => { select: () => { single: () => Promise<InsertResult> } } } })
          .from('website_designs')
          .insert({
            workspace_id: workspaceId,
            name: design.name,
            description: design.description,
            brand_id: design.brand_id,
            sections: design.sections,
            global_styles: design.globalStyles,
            seo_meta: design.seoMeta,
            status: 'draft',
          })
          .select()
          .single()

        if (error) throw error
        setDesign(prev => ({ ...prev, id: data!.id, workspace_id: workspaceId }))
        toast.success('Design created!')
      } else {
        // Update existing design - cast to bypass generated types
        type UpdateResult = { error: Error | null }
        const { error } = await (supabase as unknown as { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<UpdateResult> } } })
          .from('website_designs')
          .update({
            name: design.name,
            description: design.description,
            sections: design.sections,
            global_styles: design.globalStyles,
            seo_meta: design.seoMeta,
            updated_at: new Date().toISOString(),
          })
          .eq('id', design.id)

        if (error) throw error
        toast.success('Design saved!')
      }
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Save failed:', error)
      toast.error('Failed to save design')
    } finally {
      setIsSaving(false)
    }
  }, [design, workspaceId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void handleSave()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleRedo, handleSave, handleUndo])

  // Add section
  const handleAddSection = async (type: SectionType) => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/website/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          designId: design.id,
          brandId: design.brand_id,
        }),
      })

      if (!response.ok) throw new Error('Failed to generate section')

      const newSection = await response.json()
      const sections = [...design.sections, { ...newSection, order: design.sections.length }]
      updateSections(sections)
      setSelectedSectionId(newSection.id)
      toast.success(`${type} section added!`)
    } catch (error) {
      console.error('Failed to add section:', error)
      toast.error('Failed to generate section')
    } finally {
      setIsGenerating(false)
    }
  }

  // Delete section
  const handleDeleteSection = (sectionId: string) => {
    const sections = design.sections.filter(s => s.id !== sectionId)
    updateSections(sections)
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null)
    }
    toast.success('Section deleted')
  }

  // Duplicate section
  const handleDuplicateSection = (sectionId: string) => {
    const section = design.sections.find(s => s.id === sectionId)
    if (section) {
      const newSection = {
        ...section,
        id: crypto.randomUUID(),
        order: design.sections.length,
      }
      updateSections([...design.sections, newSection])
      setSelectedSectionId(newSection.id)
      toast.success('Section duplicated')
    }
  }

  // Reorder sections
  const handleReorderSections = (newOrder: WebsiteSection[]) => {
    const reordered = newOrder.map((s, i) => ({ ...s, order: i }))
    updateSections(reordered)
  }

  // Update section content
  const handleUpdateSection = (sectionId: string, updates: Partial<WebsiteSection>) => {
    const sections = design.sections.map(s =>
      s.id === sectionId ? { ...s, ...updates } : s
    )
    updateSections(sections)
  }

  // Update global styles
  const handleUpdateGlobalStyles = (updates: Partial<WebsiteDesign['globalStyles']>) => {
    setDesign(prev => ({
      ...prev,
      globalStyles: { ...prev.globalStyles, ...updates },
    }))
    setHasUnsavedChanges(true)
  }

  const selectedSection = design.sections.find(s => s.id === selectedSectionId)

  return (
    <TooltipProvider>
      <div className={cn("h-screen flex flex-col bg-background", className)}>
        {/* Top Toolbar */}
        <div className="h-12 px-4 flex items-center justify-between bg-card border-b shrink-0">
          {/* Left: Design name */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-primary" />
              <Input
                value={design.name}
                onChange={e => setDesign(prev => ({ ...prev, name: e.target.value }))}
                className="h-7 w-48 text-sm font-medium border-transparent hover:border-input focus:border-input"
              />
            </div>
            {hasUnsavedChanges && (
              <Badge variant="secondary" className="text-xs">Unsaved</Badge>
            )}
          </div>

          {/* Center: Mode toggle */}
          <Tabs value={mode} onValueChange={v => setMode(v as EditorMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="preview" className="text-xs gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="design" className="text-xs gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Design
              </TabsTrigger>
              <TabsTrigger value="code" className="text-xs gap-1.5">
                <Code className="h-3.5 w-3.5" />
                Code
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Viewport selector */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              {[
                { id: 'desktop', icon: Monitor, label: 'Desktop' },
                { id: 'tablet', icon: Tablet, label: 'Tablet' },
                { id: 'mobile', icon: Smartphone, label: 'Mobile' },
              ].map(({ id, icon: Icon, label }) => (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewport === id ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setViewport(id as ViewportSize)}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* OpenUI POC toggle — visible only in explicit dev/experimental mode.
                Campaign-linked pages use CampaignBuilderShell which does not include this toggle. */}
            {mode === 'preview' && process.env.NEXT_PUBLIC_OPENUI_DEV === 'true' && (
              <div className="flex items-center bg-muted rounded-lg p-0.5">
                <Button
                  variant={previewEngine === 'html' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPreviewEngine('html')}
                >
                  HTML
                </Button>
                <Button
                  variant={previewEngine === 'openui' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPreviewEngine('openui')}
                >
                  OpenUI POC
                </Button>
              </div>
            )}

            <div className="w-px h-5 bg-border" />

            {/* Undo/Redo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleUndo}
                  disabled={historyIndex === 0}
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (⌘Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (⌘⇧Z)</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-border" />

            {/* Save */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>

            {/* Publish */}
            <Button size="sm" onClick={() => setPublishDialogOpen(true)}>
              <Globe className="h-4 w-4 mr-2" />
              Publish
            </Button>

            {/* More options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Download className="h-4 w-4 mr-2" />
                  Export HTML
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Export to Figma
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel (Layers/Components) */}
          {mode === 'design' && (
            <div className="w-64 bg-card border-r flex flex-col shrink-0">
              <Tabs value={leftPanelTab} onValueChange={v => setLeftPanelTab(v as 'layers' | 'components')}>
                <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-10 px-2">
                  <TabsTrigger value="layers" className="text-xs gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Layers
                  </TabsTrigger>
                  <TabsTrigger value="components" className="text-xs gap-1.5">
                    <Box className="h-3.5 w-3.5" />
                    Add
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex-1 overflow-hidden">
                {leftPanelTab === 'layers' ? (
                  <LayersPanel
                    sections={design.sections}
                    selectedId={selectedSectionId}
                    onSelect={setSelectedSectionId}
                    onReorder={handleReorderSections}
                    onDelete={handleDeleteSection}
                    onDuplicate={handleDuplicateSection}
                  />
                ) : (
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-muted-foreground mb-3">Click to add a section</p>
                    {(['hero', 'features', 'testimonials', 'pricing', 'faq', 'cta', 'stats', 'logos', 'about', 'contact'] as SectionType[]).map(type => (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start capitalize"
                        onClick={() => handleAddSection(type)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        {type}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Canvas Area */}
          <div className="flex-1 overflow-hidden bg-muted/30">
            {mode === 'preview' && (
              <PreviewMode
                design={design}
                viewport={viewport}
                previewEngine={previewEngine}
              />
            )}
            {mode === 'design' && (
              <DesignMode
                design={design}
                viewport={viewport}
                selectedSectionId={selectedSectionId}
                onSelectSection={setSelectedSectionId}
                onUpdateSection={handleUpdateSection}
                onReorderSections={handleReorderSections}
                onDeleteSection={handleDeleteSection}
                onDuplicateSection={handleDuplicateSection}
              />
            )}
            {mode === 'code' && (
              <CodeMode
                design={design}
                onUpdateDesign={(updates) => {
                  setDesign(prev => ({ ...prev, ...updates }))
                  setHasUnsavedChanges(true)
                }}
              />
            )}
          </div>

          {/* Right Panel (Properties) */}
          {mode === 'design' && (
            <PropertiesPanel
              section={selectedSection}
              globalStyles={design.globalStyles}
              onUpdateSection={(updates) => {
                if (selectedSectionId) {
                  handleUpdateSection(selectedSectionId, updates)
                }
              }}
              onUpdateGlobalStyles={handleUpdateGlobalStyles}
            />
          )}
        </div>
      </div>

      {/* Publish Dialog */}
      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        design={design}
        onPublished={(url) => {
          setDesign(prev => ({ ...prev, published_url: url, status: 'published' }))
        }}
      />
    </TooltipProvider>
  )
}
