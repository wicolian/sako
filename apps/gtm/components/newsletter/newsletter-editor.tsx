'use client'

/**
 * Newsletter Visual Editor
 * 
 * WYSIWYG newsletter editing with:
 * - Drag-and-drop sections
 * - Color scheme editor
 * - Typography controls
 * - Email client frame previews
 */

import { useState, useCallback } from 'react'
import { motion, Reorder, AnimatePresence } from 'framer-motion'
import {
  Type,
  Image as ImageIcon,
  Square,
  Columns,
  ArrowRight,
  Minus,
  Trash2,
  Plus,
  GripVertical,
  Palette,
  Eye,
  Smartphone,
  Monitor,
  Mail,
  Copy,
  Undo2,
  Redo2,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
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
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// Section types
export type SectionType = 'header' | 'hero' | 'text' | 'image' | 'cta' | 'columns' | 'divider' | 'footer'

export interface NewsletterSection {
  id: string
  type: SectionType
  content: Record<string, unknown>
  styles?: Record<string, string | number>
}

export interface ColorScheme {
  background: string
  text: string
  accent: string
  buttonBackground: string
  buttonText: string
  headerBackground: string
  footerBackground: string
}

export interface Typography {
  headingFont: string
  bodyFont: string
  headingSize: number
  bodySize: number
  lineHeight: number
}

export interface NewsletterContent {
  subject: string
  preheader: string
  sections: NewsletterSection[]
  colorScheme: ColorScheme
  typography: Typography
}

interface NewsletterEditorProps {
  content: NewsletterContent
  onChange: (content: NewsletterContent) => void
  className?: string
}

const SECTION_TYPES: { type: SectionType; label: string; icon: typeof Type }[] = [
  { type: 'header', label: 'Header', icon: Type },
  { type: 'hero', label: 'Hero', icon: ImageIcon },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'cta', label: 'CTA Button', icon: ArrowRight },
  { type: 'columns', label: 'Columns', icon: Columns },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'footer', label: 'Footer', icon: Square },
]

const FONT_OPTIONS = [
  'Arial, sans-serif',
  'Georgia, serif',
  'Helvetica, Arial, sans-serif',
  'Times New Roman, serif',
  'Verdana, sans-serif',
  'Trebuchet MS, sans-serif',
]

export function NewsletterEditor({
  content,
  onChange,
  className,
}: NewsletterEditorProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [activePanel, setActivePanel] = useState<'sections' | 'colors' | 'typography'>('sections')

  const selectedSection = content.sections.find(s => s.id === selectedSectionId)

  const updateContent = useCallback((updates: Partial<NewsletterContent>) => {
    onChange({ ...content, ...updates })
  }, [content, onChange])

  const addSection = useCallback((type: SectionType) => {
    const newSection: NewsletterSection = {
      id: `section-${Date.now()}`,
      type,
      content: getDefaultContent(type),
    }
    updateContent({
      sections: [...content.sections, newSection],
    })
    setSelectedSectionId(newSection.id)
  }, [content.sections, updateContent])

  const updateSection = useCallback((sectionId: string, updates: Partial<NewsletterSection>) => {
    const sections = content.sections.map(s =>
      s.id === sectionId ? { ...s, ...updates } : s
    )
    updateContent({ sections })
  }, [content.sections, updateContent])

  const deleteSection = useCallback((sectionId: string) => {
    const sections = content.sections.filter(s => s.id !== sectionId)
    updateContent({ sections })
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null)
    }
  }, [content.sections, selectedSectionId, updateContent])

  const duplicateSection = useCallback((sectionId: string) => {
    const sectionIndex = content.sections.findIndex(s => s.id === sectionId)
    if (sectionIndex === -1) return

    const original = content.sections[sectionIndex]
    const duplicate: NewsletterSection = {
      ...original,
      id: `section-${Date.now()}`,
      content: { ...original.content },
    }

    const sections = [...content.sections]
    sections.splice(sectionIndex + 1, 0, duplicate)
    updateContent({ sections })
  }, [content.sections, updateContent])

  const reorderSections = useCallback((newOrder: NewsletterSection[]) => {
    updateContent({ sections: newOrder })
  }, [updateContent])

  return (
    <div className={cn('flex h-full', className)}>
      {/* Left Panel - Section List & Add */}
      <div className="w-64 border-r bg-card flex flex-col">
        {/* Panel Tabs */}
        <div className="p-2 border-b">
          <div className="flex gap-1">
            <Button
              variant={activePanel === 'sections' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setActivePanel('sections')}
            >
              Sections
            </Button>
            <Button
              variant={activePanel === 'colors' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setActivePanel('colors')}
            >
              <Palette className="h-3 w-3 mr-1" />
              Colors
            </Button>
            <Button
              variant={activePanel === 'typography' ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setActivePanel('typography')}
            >
              <Type className="h-3 w-3 mr-1" />
              Type
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {activePanel === 'sections' && (
            <div className="p-3 space-y-4">
              {/* Add Section */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Add Section</Label>
                <div className="grid grid-cols-2 gap-1">
                  {SECTION_TYPES.map((sec) => {
                    const Icon = sec.icon
                    return (
                      <button
                        key={sec.type}
                        onClick={() => addSection(sec.type)}
                        className="flex items-center gap-2 p-2 rounded border hover:bg-muted text-xs transition-colors"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {sec.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <Separator />

              {/* Section List */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Sections ({content.sections.length})
                </Label>
                <Reorder.Group
                  axis="y"
                  values={content.sections}
                  onReorder={reorderSections}
                  className="space-y-1"
                >
                  {content.sections.map((section) => {
                    const config = SECTION_TYPES.find(s => s.type === section.type)
                    const Icon = config?.icon || Square
                    return (
                      <Reorder.Item
                        key={section.id}
                        value={section}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded border cursor-pointer group',
                          selectedSectionId === section.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted'
                        )}
                        onClick={() => setSelectedSectionId(section.id)}
                      >
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                        <Icon className="h-3.5 w-3.5" />
                        <span className="flex-1 text-xs truncate">
                          {config?.label || section.type}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSection(section.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </Reorder.Item>
                    )
                  })}
                </Reorder.Group>
              </div>
            </div>
          )}

          {activePanel === 'colors' && (
            <div className="p-3 space-y-4">
              <ColorPicker
                label="Background"
                value={content.colorScheme.background}
                onChange={(v) => updateContent({
                  colorScheme: { ...content.colorScheme, background: v },
                })}
              />
              <ColorPicker
                label="Text"
                value={content.colorScheme.text}
                onChange={(v) => updateContent({
                  colorScheme: { ...content.colorScheme, text: v },
                })}
              />
              <ColorPicker
                label="Accent"
                value={content.colorScheme.accent}
                onChange={(v) => updateContent({
                  colorScheme: { ...content.colorScheme, accent: v },
                })}
              />
              <ColorPicker
                label="Button Background"
                value={content.colorScheme.buttonBackground}
                onChange={(v) => updateContent({
                  colorScheme: { ...content.colorScheme, buttonBackground: v },
                })}
              />
              <ColorPicker
                label="Button Text"
                value={content.colorScheme.buttonText}
                onChange={(v) => updateContent({
                  colorScheme: { ...content.colorScheme, buttonText: v },
                })}
              />
            </div>
          )}

          {activePanel === 'typography' && (
            <div className="p-3 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Heading Font</Label>
                <Select
                  value={content.typography.headingFont}
                  onValueChange={(v) => updateContent({
                    typography: { ...content.typography, headingFont: v },
                  })}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(font => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font.split(',')[0]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Body Font</Label>
                <Select
                  value={content.typography.bodyFont}
                  onValueChange={(v) => updateContent({
                    typography: { ...content.typography, bodyFont: v },
                  })}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(font => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font.split(',')[0]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Heading Size</Label>
                  <span className="text-xs text-muted-foreground">{content.typography.headingSize}px</span>
                </div>
                <Slider
                  value={[content.typography.headingSize]}
                  onValueChange={([v]) => updateContent({
                    typography: { ...content.typography, headingSize: v },
                  })}
                  min={18}
                  max={48}
                  step={2}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Body Size</Label>
                  <span className="text-xs text-muted-foreground">{content.typography.bodySize}px</span>
                </div>
                <Slider
                  value={[content.typography.bodySize]}
                  onValueChange={([v]) => updateContent({
                    typography: { ...content.typography, bodySize: v },
                  })}
                  min={12}
                  max={20}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Line Height</Label>
                  <span className="text-xs text-muted-foreground">{content.typography.lineHeight}</span>
                </div>
                <Slider
                  value={[content.typography.lineHeight]}
                  onValueChange={([v]) => updateContent({
                    typography: { ...content.typography, lineHeight: v },
                  })}
                  min={1.2}
                  max={2}
                  step={0.1}
                />
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Center - Preview */}
      <div className="flex-1 flex flex-col bg-muted/30">
        {/* Preview Header */}
        <div className="h-12 px-4 border-b bg-card flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Input
              value={content.subject}
              onChange={(e) => updateContent({ subject: e.target.value })}
              placeholder="Subject line..."
              className="w-64 h-8 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex border rounded-md">
              <Button
                variant={previewMode === 'desktop' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-r-none"
                onClick={() => setPreviewMode('desktop')}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={previewMode === 'mobile' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-l-none"
                onClick={() => setPreviewMode('mobile')}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Email Preview */}
        <ScrollArea className="flex-1 p-6">
          <div className="flex justify-center">
            <EmailFrame mode={previewMode}>
              <div
                className="min-h-full"
                style={{
                  backgroundColor: content.colorScheme.background,
                  color: content.colorScheme.text,
                  fontFamily: content.typography.bodyFont,
                  fontSize: content.typography.bodySize,
                  lineHeight: content.typography.lineHeight,
                }}
              >
                {content.sections.map((section) => (
                  <SectionRenderer
                    key={section.id}
                    section={section}
                    colorScheme={content.colorScheme}
                    typography={content.typography}
                    isSelected={selectedSectionId === section.id}
                    onClick={() => setSelectedSectionId(section.id)}
                  />
                ))}
              </div>
            </EmailFrame>
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Section Properties */}
      {selectedSection && (
        <div className="w-72 border-l bg-card">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-medium text-sm">
              {SECTION_TYPES.find(s => s.type === selectedSection.type)?.label}
            </h3>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => duplicateSection(selectedSection.id)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicate</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteSection(selectedSection.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <ScrollArea className="h-[calc(100%-57px)]">
            <div className="p-4">
              <SectionProperties
                section={selectedSection}
                onChange={(updates) => updateSection(selectedSection.id, updates)}
              />
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

// Helper Components
interface ColorPickerProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-8 p-1 cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-8 text-xs font-mono"
        />
      </div>
    </div>
  )
}

interface EmailFrameProps {
  mode: 'desktop' | 'mobile'
  children: React.ReactNode
}

function EmailFrame({ mode, children }: EmailFrameProps) {
  const width = mode === 'desktop' ? 600 : 375

  return (
    <div
      className="bg-card rounded-lg shadow-lg overflow-hidden transition-all duration-300"
      style={{ width, minHeight: 400 }}
    >
      {/* Email client header */}
      <div className="h-10 bg-muted/20 border-b flex items-center px-3 gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <Mail className="h-4 w-4 text-muted-foreground ml-2" />
        <span className="text-xs text-muted-foreground">Email Preview</span>
      </div>

      {/* Email content */}
      <div className="overflow-auto">
        {children}
      </div>
    </div>
  )
}

interface SectionRendererProps {
  section: NewsletterSection
  colorScheme: ColorScheme
  typography: Typography
  isSelected: boolean
  onClick: () => void
}

function SectionRenderer({
  section,
  colorScheme,
  typography,
  isSelected,
  onClick,
}: SectionRendererProps) {
  const content = section.content

  return (
    <div
      className={cn(
        'relative cursor-pointer transition-all',
        isSelected && 'ring-2 ring-primary ring-inset'
      )}
      onClick={onClick}
    >
      {section.type === 'header' && (
        <div
          className="p-4 text-center"
          style={{ backgroundColor: colorScheme.headerBackground || colorScheme.accent }}
        >
          <h1
            style={{
              fontFamily: typography.headingFont,
              fontSize: typography.headingSize,
              color: colorScheme.buttonText,
              margin: 0,
            }}
          >
            {(content.text as string) || 'Newsletter Header'}
          </h1>
        </div>
      )}

      {section.type === 'hero' && (
        <div className="p-6 text-center">
          <div
            className="w-full h-48 rounded mb-4 flex items-center justify-center"
            style={{ backgroundColor: colorScheme.accent + '20' }}
          >
            <ImageIcon className="w-12 h-12" style={{ color: colorScheme.accent }} />
          </div>
          <h2
            style={{
              fontFamily: typography.headingFont,
              fontSize: typography.headingSize * 0.8,
            }}
          >
            {(content.headline as string) || 'Hero Headline'}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {(content.subheadline as string) || 'Supporting text goes here'}
          </p>
        </div>
      )}

      {section.type === 'text' && (
        <div className="px-6 py-4">
          <p>{(content.text as string) || 'Enter your text content here...'}</p>
        </div>
      )}

      {section.type === 'image' && (
        <div className="p-6">
          <div
            className="w-full h-40 rounded flex items-center justify-center"
            style={{ backgroundColor: colorScheme.accent + '20' }}
          >
            <ImageIcon className="w-12 h-12" style={{ color: colorScheme.accent }} />
          </div>
        </div>
      )}

      {section.type === 'cta' && (
        <div className="p-6 text-center">
          <button
            style={{
              backgroundColor: colorScheme.buttonBackground,
              color: colorScheme.buttonText,
              padding: '12px 32px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            {(content.text as string) || 'Click Here'}
          </button>
        </div>
      )}

      {section.type === 'divider' && (
        <div className="px-6 py-4">
          <hr style={{ borderColor: colorScheme.accent + '40' }} />
        </div>
      )}

      {section.type === 'footer' && (
        <div
          className="p-6 text-center text-sm"
          style={{
            backgroundColor: colorScheme.footerBackground || colorScheme.background,
            color: colorScheme.text + '99',
          }}
        >
          <p>{(content.text as string) || 'Company Name | Unsubscribe'}</p>
        </div>
      )}

      {section.type === 'columns' && (
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded" style={{ backgroundColor: colorScheme.accent + '10' }}>
              <h4 style={{ fontFamily: typography.headingFont }}>
                {(content.leftTitle as string) || 'Column 1'}
              </h4>
              <p className="text-sm mt-2">
                {(content.leftText as string) || 'Left column content'}
              </p>
            </div>
            <div className="p-4 rounded" style={{ backgroundColor: colorScheme.accent + '10' }}>
              <h4 style={{ fontFamily: typography.headingFont }}>
                {(content.rightTitle as string) || 'Column 2'}
              </h4>
              <p className="text-sm mt-2">
                {(content.rightText as string) || 'Right column content'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface SectionPropertiesProps {
  section: NewsletterSection
  onChange: (updates: Partial<NewsletterSection>) => void
}

function SectionProperties({ section, onChange }: SectionPropertiesProps) {
  const updateContent = (key: string, value: unknown) => {
    onChange({ content: { ...section.content, [key]: value } })
  }

  switch (section.type) {
    case 'header':
    case 'footer':
    case 'text':
    case 'cta':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Text</Label>
            <Textarea
              value={(section.content.text as string) || ''}
              onChange={(e) => updateContent('text', e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>
          {section.type === 'cta' && (
            <div className="space-y-2">
              <Label className="text-xs">Link URL</Label>
              <Input
                value={(section.content.url as string) || ''}
                onChange={(e) => updateContent('url', e.target.value)}
                placeholder="https://..."
                className="text-sm h-8"
              />
            </div>
          )}
        </div>
      )

    case 'hero':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Headline</Label>
            <Input
              value={(section.content.headline as string) || ''}
              onChange={(e) => updateContent('headline', e.target.value)}
              className="text-sm h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subheadline</Label>
            <Textarea
              value={(section.content.subheadline as string) || ''}
              onChange={(e) => updateContent('subheadline', e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Image URL</Label>
            <Input
              value={(section.content.imageUrl as string) || ''}
              onChange={(e) => updateContent('imageUrl', e.target.value)}
              placeholder="https://..."
              className="text-sm h-8"
            />
          </div>
        </div>
      )

    case 'columns':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Left Column Title</Label>
            <Input
              value={(section.content.leftTitle as string) || ''}
              onChange={(e) => updateContent('leftTitle', e.target.value)}
              className="text-sm h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Left Column Text</Label>
            <Textarea
              value={(section.content.leftText as string) || ''}
              onChange={(e) => updateContent('leftText', e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Right Column Title</Label>
            <Input
              value={(section.content.rightTitle as string) || ''}
              onChange={(e) => updateContent('rightTitle', e.target.value)}
              className="text-sm h-8"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Right Column Text</Label>
            <Textarea
              value={(section.content.rightText as string) || ''}
              onChange={(e) => updateContent('rightText', e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
      )

    default:
      return (
        <p className="text-sm text-muted-foreground">
          No editable properties for this section type.
        </p>
      )
  }
}

// Default content for new sections
function getDefaultContent(type: SectionType): Record<string, unknown> {
  switch (type) {
    case 'header':
      return { text: 'Newsletter Title' }
    case 'hero':
      return { headline: 'Main Headline', subheadline: 'Supporting text goes here' }
    case 'text':
      return { text: 'Enter your content here...' }
    case 'cta':
      return { text: 'Shop Now', url: '' }
    case 'footer':
      return { text: '© 2026 Company Name. All rights reserved.' }
    case 'columns':
      return { leftTitle: 'Feature 1', leftText: 'Description', rightTitle: 'Feature 2', rightText: 'Description' }
    default:
      return {}
  }
}
