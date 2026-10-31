'use client'

import { useState, useCallback } from 'react'
import {
  Palette,
  Layout,
  Type,
  Image,
  Layers,
  Grid,
  Smartphone,
  Monitor,
  Tablet,
  Eye,
  Code,
  Download,
  Save,
  Undo,
  Redo,
  Settings,
  Wand2,
  PanelLeft,
  PanelLeftClose,
  Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator as UiSeparator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
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
import { useToast } from '@/components/ui/use-toast'

// ============================================================================
// Types
// ============================================================================

export interface DesignElement {
  id: string
  type: 'text' | 'image' | 'button' | 'section' | 'spacer' | 'divider'
  content?: string
  props: Record<string, unknown>
  position: { x: number; y: number }
  size: { width: number; height: number }
}

export interface DesignPage {
  id: string
  name: string
  elements: DesignElement[]
  settings: {
    backgroundColor?: string
    maxWidth?: number
    padding?: number
  }
}

export interface DesignConfig {
  pages: DesignPage[]
  globalStyles: {
    primaryColor: string
    secondaryColor: string
    fontFamily: string
    fontSize: number
    borderRadius: number
  }
  viewport: 'desktop' | 'tablet' | 'mobile'
}

interface UnifiedDesignStudioProps {
  campaignId: string
  initialConfig?: Partial<DesignConfig>
  brandColors?: { primary?: string; secondary?: string }
  onSave?: (config: DesignConfig) => Promise<void>
  className?: string
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: DesignConfig = {
  pages: [{
    id: 'main',
    name: 'Main Page',
    elements: [],
    settings: {
      backgroundColor: '#ffffff',
      maxWidth: 1200,
      padding: 24,
    },
  }],
  globalStyles: {
    primaryColor: '#2563eb',
    secondaryColor: '#64748b',
    fontFamily: 'Inter',
    fontSize: 16,
    borderRadius: 8,
  },
  viewport: 'desktop',
}

// ============================================================================
// Element Templates
// ============================================================================

const ELEMENT_TEMPLATES: Array<{
  type: DesignElement['type']
  label: string
  icon: typeof Type
  defaultProps: Record<string, unknown>
}> = [
  {
    type: 'text',
    label: 'Text',
    icon: Type,
    defaultProps: { text: 'Enter text here', variant: 'body', align: 'left' },
  },
  {
    type: 'image',
    label: 'Image',
    icon: Image,
    defaultProps: { src: '', alt: '', objectFit: 'cover' },
  },
  {
    type: 'button',
    label: 'Button',
    icon: Layout,
    defaultProps: { text: 'Click me', variant: 'primary', size: 'medium' },
  },
  {
    type: 'section',
    label: 'Section',
    icon: Layers,
    defaultProps: { background: 'transparent', padding: 32 },
  },
  {
    type: 'spacer',
    label: 'Spacer',
    icon: Grid,
    defaultProps: { height: 40 },
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: Minus,
    defaultProps: { style: 'solid', color: '#e2e8f0' },
  },
]

// ============================================================================
// Sidebar Panel
// ============================================================================

interface SidebarPanelProps {
  config: DesignConfig
  onUpdateStyles: (styles: Partial<DesignConfig['globalStyles']>) => void
  onAddElement: (type: DesignElement['type']) => void
  selectedElement: DesignElement | null
  onUpdateElement: (id: string, updates: Partial<DesignElement>) => void
}

function SidebarPanel({
  config,
  onUpdateStyles,
  onAddElement,
  selectedElement,
  onUpdateElement,
}: SidebarPanelProps) {
  return (
    <div className="w-64 border-r bg-background h-full overflow-y-auto">
      <Tabs defaultValue="elements" className="h-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="elements">
            <Layers className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="styles">
            <Palette className="h-4 w-4" />
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4" />
          </TabsTrigger>
        </TabsList>

        {/* Elements Tab */}
        <TabsContent value="elements" className="p-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Add Elements</h4>
            <div className="grid grid-cols-2 gap-2">
              {ELEMENT_TEMPLATES.map((template) => (
                <Button
                  key={template.type}
                  variant="outline"
                  size="sm"
                  className="flex flex-col h-auto py-3"
                  onClick={() => onAddElement(template.type)}
                >
                  <template.icon className="h-4 w-4 mb-1" />
                  <span className="text-xs">{template.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Selected Element Properties */}
          {selectedElement && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">
                {ELEMENT_TEMPLATES.find(t => t.type === selectedElement.type)?.label} Properties
              </h4>
              
              {selectedElement.type === 'text' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Text</Label>
                    <Input
                      value={selectedElement.props.text as string}
                      onChange={(e) => onUpdateElement(selectedElement.id, {
                        props: { ...selectedElement.props, text: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Variant</Label>
                    <Select
                      value={selectedElement.props.variant as string}
                      onValueChange={(v) => onUpdateElement(selectedElement.id, {
                        props: { ...selectedElement.props, variant: v }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="h1">Heading 1</SelectItem>
                        <SelectItem value="h2">Heading 2</SelectItem>
                        <SelectItem value="h3">Heading 3</SelectItem>
                        <SelectItem value="body">Body</SelectItem>
                        <SelectItem value="caption">Caption</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {selectedElement.type === 'button' && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Button Text</Label>
                    <Input
                      value={selectedElement.props.text as string}
                      onChange={(e) => onUpdateElement(selectedElement.id, {
                        props: { ...selectedElement.props, text: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Style</Label>
                    <Select
                      value={selectedElement.props.variant as string}
                      onValueChange={(v) => onUpdateElement(selectedElement.id, {
                        props: { ...selectedElement.props, variant: v }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="primary">Primary</SelectItem>
                        <SelectItem value="secondary">Secondary</SelectItem>
                        <SelectItem value="outline">Outline</SelectItem>
                        <SelectItem value="ghost">Ghost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Styles Tab */}
        <TabsContent value="styles" className="p-4 space-y-4">
          <div>
            <Label className="text-xs">Primary Color</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="color"
                value={config.globalStyles.primaryColor}
                onChange={(e) => onUpdateStyles({ primaryColor: e.target.value })}
                className="w-10 h-10 p-1 cursor-pointer"
              />
              <Input
                value={config.globalStyles.primaryColor}
                onChange={(e) => onUpdateStyles({ primaryColor: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Secondary Color</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="color"
                value={config.globalStyles.secondaryColor}
                onChange={(e) => onUpdateStyles({ secondaryColor: e.target.value })}
                className="w-10 h-10 p-1 cursor-pointer"
              />
              <Input
                value={config.globalStyles.secondaryColor}
                onChange={(e) => onUpdateStyles({ secondaryColor: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Font Family</Label>
            <Select
              value={config.globalStyles.fontFamily}
              onValueChange={(v) => onUpdateStyles({ fontFamily: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Inter">Inter</SelectItem>
                <SelectItem value="Roboto">Roboto</SelectItem>
                <SelectItem value="Open Sans">Open Sans</SelectItem>
                <SelectItem value="Poppins">Poppins</SelectItem>
                <SelectItem value="Montserrat">Montserrat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Border Radius</Label>
            <Slider
              value={[config.globalStyles.borderRadius]}
              onValueChange={([v]) => onUpdateStyles({ borderRadius: v })}
              min={0}
              max={24}
              step={2}
              className="mt-2"
            />
            <span className="text-xs text-muted-foreground">
              {config.globalStyles.borderRadius}px
            </span>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="p-4 space-y-4">
          <div>
            <Label className="text-xs">Page Background</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type="color"
                value={config.pages[0]?.settings.backgroundColor || '#ffffff'}
                className="w-10 h-10 p-1 cursor-pointer"
              />
              <Input
                value={config.pages[0]?.settings.backgroundColor || '#ffffff'}
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Max Width</Label>
            <Input
              type="number"
              value={config.pages[0]?.settings.maxWidth || 1200}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Padding</Label>
            <Slider
              value={[config.pages[0]?.settings.padding || 24]}
              min={0}
              max={64}
              step={8}
              className="mt-2"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================================================
// Canvas Preview
// ============================================================================

interface CanvasPreviewProps {
  config: DesignConfig
  selectedElementId: string | null
  onSelectElement: (id: string | null) => void
}

function CanvasPreview({ config, selectedElementId, onSelectElement }: CanvasPreviewProps) {
  const viewportWidths = {
    desktop: 'w-full',
    tablet: 'w-[768px]',
    mobile: 'w-[375px]',
  }

  const page = config.pages[0]

  return (
    <div className="flex-1 bg-muted/30 p-8 overflow-auto">
      <div 
        className={cn(
          "mx-auto bg-card shadow-lg transition-all",
          viewportWidths[config.viewport]
        )}
        style={{
          backgroundColor: page?.settings.backgroundColor,
          maxWidth: page?.settings.maxWidth,
          padding: page?.settings.padding,
          minHeight: 600,
          fontFamily: config.globalStyles.fontFamily,
          borderRadius: config.globalStyles.borderRadius,
        }}
        onClick={() => onSelectElement(null)}
      >
        {page?.elements.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <Layout className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              Click elements in the sidebar to start building
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {page?.elements.map((element) => (
              <div
                key={element.id}
                className={cn(
                  "p-2 rounded cursor-pointer transition-all",
                  selectedElementId === element.id
                    ? "ring-2 ring-primary ring-offset-2"
                    : "hover:ring-2 hover:ring-muted"
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectElement(element.id)
                }}
              >
                {element.type === 'text' && (
                  <p
                    className={cn(
                      element.props.variant === 'h1' && 'text-4xl font-bold',
                      element.props.variant === 'h2' && 'text-3xl font-semibold',
                      element.props.variant === 'h3' && 'text-2xl font-medium',
                      element.props.variant === 'body' && 'text-base',
                      element.props.variant === 'caption' && 'text-sm text-muted-foreground',
                    )}
                    style={{ textAlign: element.props.align as 'left' | 'center' | 'right' }}
                  >
                    {element.props.text as string}
                  </p>
                )}
                {element.type === 'button' && (
                  <button
                    className={cn(
                      "px-4 py-2 rounded font-medium",
                      element.props.variant === 'primary' && 'text-white',
                      element.props.variant === 'secondary' && 'text-white',
                      element.props.variant === 'outline' && 'border',
                    )}
                    style={{
                      backgroundColor: 
                        element.props.variant === 'primary' ? config.globalStyles.primaryColor :
                        element.props.variant === 'secondary' ? config.globalStyles.secondaryColor :
                        'transparent',
                      borderColor: config.globalStyles.primaryColor,
                      borderRadius: config.globalStyles.borderRadius,
                    }}
                  >
                    {element.props.text as string}
                  </button>
                )}
                {element.type === 'spacer' && (
                  <div style={{ height: element.props.height as number }} />
                )}
                {element.type === 'divider' && (
                  <hr
                    style={{
                      borderStyle: element.props.style as string,
                      borderColor: element.props.color as string,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function UnifiedDesignStudio({
  campaignId,
  initialConfig,
  brandColors,
  onSave,
  className,
}: UnifiedDesignStudioProps) {
  const { toast } = useToast()
  const [config, setConfig] = useState<DesignConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
    globalStyles: {
      ...DEFAULT_CONFIG.globalStyles,
      ...initialConfig?.globalStyles,
      primaryColor: brandColors?.primary || DEFAULT_CONFIG.globalStyles.primaryColor,
      secondaryColor: brandColors?.secondary || DEFAULT_CONFIG.globalStyles.secondaryColor,
    },
  })
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const selectedElement = config.pages[0]?.elements.find(e => e.id === selectedElementId) || null

  const handleUpdateStyles = useCallback((updates: Partial<DesignConfig['globalStyles']>) => {
    setConfig(prev => ({
      ...prev,
      globalStyles: { ...prev.globalStyles, ...updates },
    }))
  }, [])

  const handleAddElement = useCallback((type: DesignElement['type']) => {
    const template = ELEMENT_TEMPLATES.find(t => t.type === type)
    if (!template) return

    const newElement: DesignElement = {
      id: crypto.randomUUID(),
      type,
      props: { ...template.defaultProps },
      position: { x: 0, y: 0 },
      size: { width: 100, height: 50 },
    }

    setConfig(prev => ({
      ...prev,
      pages: prev.pages.map((page, idx) =>
        idx === 0
          ? { ...page, elements: [...page.elements, newElement] }
          : page
      ),
    }))

    setSelectedElementId(newElement.id)
  }, [])

  const handleUpdateElement = useCallback((id: string, updates: Partial<DesignElement>) => {
    setConfig(prev => ({
      ...prev,
      pages: prev.pages.map((page, idx) =>
        idx === 0
          ? {
              ...page,
              elements: page.elements.map(el =>
                el.id === id ? { ...el, ...updates } : el
              ),
            }
          : page
      ),
    }))
  }, [])

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      await onSave(config)
      toast({ title: 'Design saved successfully' })
    } catch (error) {
      toast({ title: 'Failed to save', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{sidebarOpen ? 'Hide' : 'Show'} Sidebar</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <UiSeparator orientation="vertical" className="h-6" />

          <Button variant="ghost" size="icon" disabled>
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled>
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        {/* Viewport Switcher */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(['desktop', 'tablet', 'mobile'] as const).map((viewport) => {
            const Icon = viewport === 'desktop' ? Monitor : viewport === 'tablet' ? Tablet : Smartphone
            return (
              <Button
                key={viewport}
                variant={config.viewport === viewport ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setConfig(prev => ({ ...prev, viewport }))}
              >
                <Icon className="h-4 w-4" />
              </Button>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" size="sm">
            <Code className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <SidebarPanel
            config={config}
            onUpdateStyles={handleUpdateStyles}
            onAddElement={handleAddElement}
            selectedElement={selectedElement}
            onUpdateElement={handleUpdateElement}
          />
        )}

        <CanvasPreview
          config={config}
          selectedElementId={selectedElementId}
          onSelectElement={setSelectedElementId}
        />
      </div>
    </div>
  )
}
