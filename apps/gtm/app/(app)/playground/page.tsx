'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Layout,
  Eye,
  Code,
  Save,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  GripVertical,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Settings2,
  Smartphone,
  Monitor,
  Tablet,
  Download,
  ExternalLink,
  RefreshCw,
  Loader2,
  Wand2,
  Layers,
  Move,
  Send,
  MessageSquare,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Block {
  id: string
  type: 'hero' | 'features' | 'testimonials' | 'pricing' | 'cta' | 'faq' | 'stats' | 'logos'
  html: string
  content: {
    headline?: string
    subheadline?: string
    body?: string
    cta?: string
  }
  claims?: Array<{ text: string; status: 'approved' | 'warning' | 'error' }>
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sectionType?: string
  generatedHtml?: string
}

const BLOCK_TYPES = [
  { id: 'hero', label: 'Hero', icon: '🚀', description: 'Main headline section', color: 'from-primary to-emerald-500' },
  { id: 'features', label: 'Features', icon: '✨', description: 'Feature grid', color: 'from-blue-500 to-cyan-500' },
  { id: 'testimonials', label: 'Testimonials', icon: '💬', description: 'Customer quotes', color: 'from-amber-500 to-orange-500' },
  { id: 'pricing', label: 'Pricing', icon: '💰', description: 'Pricing tables', color: 'from-emerald-500 to-teal-500' },
  { id: 'cta', label: 'CTA', icon: '🎯', description: 'Call to action', color: 'from-rose-500 to-pink-500' },
  { id: 'faq', label: 'FAQ', icon: '❓', description: 'Common questions', color: 'from-indigo-500 to-blue-500' },
  { id: 'stats', label: 'Stats', icon: '📊', description: 'Metrics display', color: 'from-cyan-500 to-blue-500' },
  { id: 'logos', label: 'Logos', icon: '🏢', description: 'Partner logos', color: 'from-gray-500 to-gray-600' },
]

type ViewMode = 'desktop' | 'tablet' | 'mobile'

export default function PlaygroundPage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('desktop')
  const [previewMode, setPreviewMode] = useState<'preview' | 'code'>('preview')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [designName, setDesignName] = useState('Untitled Design')
  
  // Chat state
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  // Full page generation
  const [pageGenerating, setPageGenerating] = useState(false)
  const [briefInput, setBriefInput] = useState('')
  
  // Save dialog
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)

  // Fetch workspace ID on mount
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

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Generate full HTML for iframe preview
  const generatePreviewHtml = useCallback(() => {
    if (blocks.length === 0) return ''
    
    const sectionsHtml = blocks.map(b => b.html).join('\n')
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="bg-card/40 backdrop-blur-sm text-white">
${sectionsHtml}
</body>
</html>`
  }, [blocks])

  // Update iframe when blocks change
  useEffect(() => {
    if (iframeRef.current && previewMode === 'preview') {
      const html = generatePreviewHtml()
      iframeRef.current.srcdoc = html
    }
  }, [blocks, previewMode, generatePreviewHtml])

  const addBlock = async (type: Block['type']) => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/playground/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'section',
          sectionType: type,
          brief: `A modern ${type} section for a B2B SaaS landing page`,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Generation failed')
      }

      const result = await response.json()
      
      const newBlock: Block = {
        id: Date.now().toString(),
        type,
        html: result.html,
        content: {
          headline: result.headline || `New ${type} section`,
          subheadline: result.subheadline || '',
        },
        claims: result.claims?.map((c: string) => ({
          text: c,
          status: 'warning' as const,
        })) || [],
      }
      
      setBlocks([...blocks, newBlock])
      setSelectedBlockId(newBlock.id)
      toast.success(`${type} section generated!`)
    } catch (error) {
      console.error('Failed to add block:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate section')
    } finally {
      setIsGenerating(false)
    }
  }

  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)))
  }

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id))
    if (selectedBlockId === id) {
      setSelectedBlockId(blocks[0]?.id || null)
    }
    toast.success('Section deleted')
  }

  const duplicateBlock = (id: string) => {
    const block = blocks.find((b) => b.id === id)
    if (block) {
      const newBlock = { ...block, id: Date.now().toString() }
      const index = blocks.findIndex((b) => b.id === id)
      const newBlocks = [...blocks]
      newBlocks.splice(index + 1, 0, newBlock)
      setBlocks(newBlocks)
      toast.success('Section duplicated')
    }
  }

  // Regenerate block using AI
  const regenerateBlock = async (id: string) => {
    const block = blocks.find((b) => b.id === id)
    if (!block) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/playground/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'section',
          sectionType: block.type,
          brief: `${block.content.headline || ''} ${block.content.subheadline || ''} - a ${block.type} section for a B2B SaaS landing page`,
        }),
      })

      if (!response.ok) throw new Error('Generation failed')

      const result = await response.json()
      
      updateBlock(id, {
        html: result.html,
        content: {
          ...block.content,
          headline: result.headline || block.content.headline,
          subheadline: result.subheadline || block.content.subheadline,
        },
        claims: result.claims?.map((c: string) => ({
          text: c,
          status: 'warning' as const,
        })) || [],
      })
      
      toast.success('Section regenerated!')
    } catch (error) {
      console.error('Regeneration failed:', error)
      toast.error('Failed to regenerate section')
    } finally {
      setIsGenerating(false)
    }
  }

  // Generate full page
  const generateFullPage = async () => {
    if (!briefInput.trim() || !workspaceId) {
      toast.error('Please enter a description for your landing page')
      return
    }
    
    setPageGenerating(true)
    try {
      const response = await fetch('/api/playground/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'page',
          brief: briefInput,
          workspaceId: workspaceId,
          sections: ['hero', 'features', 'testimonials', 'cta'],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Page generation failed')
      }

      const result = await response.json()
      
      // Create blocks from generated sections
      const newBlocks: Block[] = result.sections.map((section: { type: string; html: string; headline?: string; subheadline?: string }, index: number) => ({
        id: `gen-${Date.now()}-${index}`,
        type: section.type as Block['type'],
        html: section.html,
        content: {
          headline: section.headline || `${section.type} Section`,
          subheadline: section.subheadline || '',
        },
        claims: [],
      }))

      if (newBlocks.length > 0) {
        setBlocks(newBlocks)
        setSelectedBlockId(newBlocks[0].id)
        toast.success('Landing page generated!')
      }
    } catch (error) {
      console.error('Page generation failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate page')
    } finally {
      setPageGenerating(false)
    }
  }

  // Chat-based section generation
  const handleChatSubmit = async () => {
    if (!chatInput.trim() || chatLoading) return
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
    }
    
    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setChatLoading(true)
    
    try {
      // Detect section type from message
      const sectionTypeMatch = chatInput.toLowerCase().match(/(?:create|generate|make|add|build)\s+(?:a\s+)?(\w+)\s+(?:section|block)?/i)
      const sectionType = sectionTypeMatch?.[1] || 'hero'
      const validTypes = ['hero', 'features', 'testimonials', 'pricing', 'cta', 'faq', 'stats', 'logos']
      const finalType = validTypes.includes(sectionType) ? sectionType : 'hero'
      
      const response = await fetch('/api/playground/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'section',
          sectionType: finalType,
          brief: chatInput,
        }),
      })

      if (!response.ok) throw new Error('Generation failed')

      const result = await response.json()
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I've generated a ${finalType} section based on your request. Click "Add to Canvas" to use it.`,
        sectionType: finalType,
        generatedHtml: result.html,
      }
      
      setChatMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I failed to generate that section. Please try again with a different description.',
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }

  const addGeneratedToCanvas = (message: ChatMessage) => {
    if (!message.generatedHtml || !message.sectionType) return
    
    const newBlock: Block = {
      id: Date.now().toString(),
      type: message.sectionType as Block['type'],
      html: message.generatedHtml,
      content: {
        headline: `${message.sectionType} section`,
        subheadline: '',
      },
      claims: [],
    }
    
    setBlocks([...blocks, newBlock])
    setSelectedBlockId(newBlock.id)
    setChatOpen(false)
    toast.success('Section added to canvas!')
  }

  // Save design
  const handleSave = async () => {
    if (!workspaceId) {
      toast.error('No workspace found')
      return
    }
    
    setIsSaving(true)
    try {
      const response = await fetch('/api/playground/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          name: designName,
          html: generatePreviewHtml(),
          sections: blocks.map(b => ({ type: b.type, html: b.html })),
          workspaceId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Save failed')
      }

      setSaveDialogOpen(false)
      toast.success('Design saved!')
    } catch (error) {
      console.error('Save failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save design')
    } finally {
      setIsSaving(false)
    }
  }

  // Export HTML
  const handleExport = () => {
    const html = generatePreviewHtml()
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${designName.toLowerCase().replace(/\s+/g, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('HTML exported!')
  }

  const stats = {
    approved: blocks.reduce((acc, b) => acc + (b.claims?.filter((c) => c.status === 'approved').length || 0), 0),
    warning: blocks.reduce((acc, b) => acc + (b.claims?.filter((c) => c.status === 'warning').length || 0), 0),
    error: blocks.reduce((acc, b) => acc + (b.claims?.filter((c) => c.status === 'error').length || 0), 0),
  }

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-64px)] flex flex-col min-h-screen bg-background text-foreground">
        {/* Toolbar */}
        <div className="h-12 px-4 flex items-center justify-between bg-card border-b">
          <div className="flex items-center gap-2">
            <Layout className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Design Studio</span>
            <Badge variant="secondary" className="text-xs">Draft</Badge>
          </div>

          <div className="flex items-center gap-1">
            {/* Viewport Selector */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              {[
                { id: 'desktop', icon: Monitor, label: 'Desktop' },
                { id: 'tablet', icon: Tablet, label: 'Tablet' },
                { id: 'mobile', icon: Smartphone, label: 'Mobile' },
              ].map(({ id, icon: Icon, label }) => (
                <Tooltip key={id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === id ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setViewMode(id as ViewMode)}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Preview/Code Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5 ml-2">
              <Button
                variant={previewMode === 'preview' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPreviewMode('preview')}
              >
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </Button>
              <Button
                variant={previewMode === 'code' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPreviewMode('code')}
              >
                <Code className="h-3 w-3 mr-1" />
                Code
              </Button>
            </div>

            <div className="w-px h-5 bg-muted mx-2" />

            {/* Actions */}
            <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)} disabled={blocks.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={blocks.length === 0}>
                  Export
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Download HTML
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Push to HubSpot
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Push to Webflow
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Blocks Panel (Left) */}
          <div className="w-64 flex flex-col bg-sidebar border-r">
            <div className="p-3 border-b border-muted">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Components</p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Click to generate & add</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-2 gap-2">
                {BLOCK_TYPES.map((type) => (
                  <motion.button
                    key={type.id}
                    onClick={() => addBlock(type.id as Block['type'])}
                    disabled={isGenerating}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "p-3 rounded-xl bg-card",
                      "hover:ring-2 hover:ring-primary hover:shadow-lg hover:shadow-primary/10",
                      "transition-all duration-200 text-center group relative overflow-hidden",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br",
                      type.color
                    )} />
                    <span className="text-2xl block mb-1.5 relative z-10 group-hover:scale-110 transition-transform">{type.icon}</span>
                    <span className="text-xs font-medium relative z-10">{type.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* AI Assist */}
            <div className="p-3 border-t border-muted space-y-2">
              {/* Chat Button */}
              <Button
                className="w-full justify-start"
                variant="outline"
                onClick={() => setChatOpen(true)}
              >
                <MessageSquare className="h-4 w-4 mr-2 text-primary" />
                Chat to Generate
              </Button>

              {/* AI Page Generator */}
              <div className="pt-2 border-t border-muted">
                <Label className="text-xs text-muted-foreground">Generate Full Page</Label>
                <Textarea
                  placeholder="Describe your landing page..."
                  value={briefInput}
                  onChange={(e) => setBriefInput(e.target.value)}
                  className="mt-1.5 text-xs"
                  rows={3}
                />
                <Button
                  className="w-full mt-2"
                  size="sm"
                  onClick={generateFullPage}
                  disabled={pageGenerating || !briefInput.trim()}
                >
                  {pageGenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4 mr-2" />
                  )}
                  Generate with AI
                </Button>
              </div>
            </div>
          </div>

          {/* Canvas (Center) */}
          <div className="flex-1 overflow-hidden bg-background relative">
            {isGenerating && (
              <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Generating section...</p>
                </div>
              </div>
            )}
            
            {blocks.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <motion.div 
                    className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-xl shadow-primary/20"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Layout className="h-10 w-10 text-white" />
                  </motion.div>
                  <h3 className="text-xl font-semibold mb-2">Start Building Your Page</h3>
                  <p className="text-muted-foreground mb-6">
                    Click a component from the left panel to generate it with AI, or use the chat for custom requests
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Button onClick={() => addBlock('hero')} size="lg" disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                      Add Hero Section
                    </Button>
                    <Button variant="outline" size="lg" onClick={() => setChatOpen(true)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Chat with AI
                    </Button>
                  </div>
                </div>
              </div>
            ) : previewMode === 'preview' ? (
              <div className={cn(
                'h-full mx-auto transition-all duration-300',
                viewMode === 'desktop' && 'w-full',
                viewMode === 'tablet' && 'max-w-[768px]',
                viewMode === 'mobile' && 'max-w-[375px]'
              )}>
                <iframe
                  ref={iframeRef}
                  className="w-full h-full border-0"
                  title="Preview"
                  sandbox="allow-scripts"
                />
              </div>
            ) : (
              <div className="h-full overflow-auto p-4">
                <pre className="text-xs text-muted-foreground bg-muted p-4 rounded-lg overflow-x-auto">
                  <code>{generatePreviewHtml()}</code>
                </pre>
              </div>
            )}
          </div>

          {/* Properties Panel (Right) */}
          <div className="w-72 flex flex-col bg-card border-l">
            <div className="p-4 border-b border-muted">
              <h3 className="font-medium text-sm">Sections ({blocks.length})</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {blocks.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-center p-4">
                  <p className="text-sm text-muted-foreground">
                    No sections yet. Add components from the left panel.
                  </p>
                </div>
              ) : (
                <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} className="space-y-2">
                  {blocks.map((block, index) => (
                    <Reorder.Item key={block.id} value={block}>
                      <motion.div
                        onClick={() => setSelectedBlockId(block.id)}
                        className={cn(
                          'p-3 rounded-lg cursor-pointer transition-all',
                          selectedBlockId === block.id
                            ? 'bg-primary/10 ring-2 ring-primary'
                            : 'bg-muted/50 hover:bg-muted'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          <span className="text-lg">{BLOCK_TYPES.find(t => t.id === block.type)?.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate capitalize">{block.type}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {block.content.headline || 'Section ' + (index + 1)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => { e.stopPropagation(); regenerateBlock(block.id); }}
                                  disabled={isGenerating}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Regenerate</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Duplicate</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 hover:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        
                        {/* Claims indicator */}
                        {block.claims && block.claims.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-muted">
                            {block.claims.some(c => c.status === 'warning') && (
                              <Badge className="text-[10px] bg-amber-500/20 text-amber-500">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {block.claims.filter(c => c.status === 'warning').length} claims
                              </Badge>
                            )}
                          </div>
                        )}
                      </motion.div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>
              )}
            </div>
          </div>
        </div>

        {/* Compliance Bar */}
        <div className="h-10 px-4 flex items-center gap-6 bg-card border-t">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="font-medium">{stats.approved}</span>
            <span className="text-muted-foreground">Approved</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="font-medium">{stats.warning}</span>
            <span className="text-muted-foreground">Warnings</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="font-medium">{stats.error}</span>
            <span className="text-muted-foreground">Errors</span>
          </div>
        </div>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed right-0 top-0 bottom-0 w-96 bg-card border-l shadow-2xl z-50 flex flex-col"
          >
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">AI Design Assistant</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setChatOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    Describe what kind of section you want to create. For example:
                  </p>
                  <div className="mt-4 space-y-2 text-xs">
                    <p className="p-2 bg-muted rounded-lg">"Create a hero section for a fintech app"</p>
                    <p className="p-2 bg-muted rounded-lg">"Generate a pricing section with 3 tiers"</p>
                    <p className="p-2 bg-muted rounded-lg">"Make a testimonials section with customer quotes"</p>
                  </div>
                </div>
              )}
              
              {chatMessages.map((message) => (
                <div key={message.id} className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}>
                  <div className={cn(
                    'max-w-[85%] rounded-lg p-3',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}>
                    <p className="text-sm">{message.content}</p>
                    
                    {message.generatedHtml && (
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => addGeneratedToCanvas(message)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add to Canvas
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Describe a section to generate..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleChatSubmit()}
                  disabled={chatLoading}
                />
                <Button onClick={handleChatSubmit} disabled={!chatInput.trim() || chatLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Design</DialogTitle>
            <DialogDescription>
              Give your design a name to save it to your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="design-name">Design Name</Label>
            <Input
              id="design-name"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="My Landing Page"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !designName.trim()}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Design
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
