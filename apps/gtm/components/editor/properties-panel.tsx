'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Type, Palette, Box, Settings, Sparkles, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WebsiteSection, WebsiteDesign, SectionStyles } from '@/lib/website/ai-designer'

interface PropertiesPanelProps {
  section: WebsiteSection | undefined
  globalStyles: WebsiteDesign['globalStyles']
  onUpdateSection: (updates: Partial<WebsiteSection>) => void
  onUpdateGlobalStyles: (updates: Partial<WebsiteDesign['globalStyles']>) => void
}

export function PropertiesPanel({
  section,
  globalStyles,
  onUpdateSection,
  onUpdateGlobalStyles,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<'section' | 'style' | 'theme'>('section')

  return (
    <div className="w-72 bg-card border-l flex flex-col shrink-0">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-10 px-2">
          <TabsTrigger value="section" className="text-xs gap-1.5" disabled={!section}>
            <Box className="h-3.5 w-3.5" />
            Section
          </TabsTrigger>
          <TabsTrigger value="style" className="text-xs gap-1.5" disabled={!section}>
            <Palette className="h-3.5 w-3.5" />
            Style
          </TabsTrigger>
          <TabsTrigger value="theme" className="text-xs gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Theme
          </TabsTrigger>
        </TabsList>

        {/* Section Content Tab */}
        <TabsContent value="section" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
          {section ? (
            <SectionContentEditor section={section} onUpdate={onUpdateSection} />
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">
              Select a section to edit
            </div>
          )}
        </TabsContent>

        {/* Style Tab */}
        <TabsContent value="style" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
          {section ? (
            <SectionStyleEditor section={section} onUpdate={onUpdateSection} />
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">
              Select a section to edit
            </div>
          )}
        </TabsContent>

        {/* Theme Tab */}
        <TabsContent value="theme" className="flex-1 overflow-y-auto p-4 space-y-4 m-0">
          <ThemeEditor globalStyles={globalStyles} onUpdate={onUpdateGlobalStyles} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface SectionContentEditorProps {
  section: WebsiteSection
  onUpdate: (updates: Partial<WebsiteSection>) => void
}

function SectionContentEditor({ section, onUpdate }: SectionContentEditorProps) {
  const updateContent = (key: string, value: string) => {
    onUpdate({
      content: { ...section.content, [key]: value }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium capitalize">{section.type} Section</span>
      </div>

      {/* Headline */}
      <div className="space-y-2">
        <Label className="text-xs">Headline</Label>
        <Input
          value={section.content.headline || ''}
          onChange={(e) => updateContent('headline', e.target.value)}
          placeholder="Enter headline..."
        />
      </div>

      {/* Subheadline */}
      <div className="space-y-2">
        <Label className="text-xs">Subheadline</Label>
        <Textarea
          value={section.content.subheadline || ''}
          onChange={(e) => updateContent('subheadline', e.target.value)}
          placeholder="Enter subheadline..."
          rows={2}
        />
      </div>

      {/* Description */}
      {section.content.description !== undefined && (
        <div className="space-y-2">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={section.content.description || ''}
            onChange={(e) => updateContent('description', e.target.value)}
            placeholder="Enter description..."
            rows={3}
          />
        </div>
      )}

      {/* CTA */}
      {section.content.cta && (
        <div className="space-y-3 pt-3 border-t">
          <Label className="text-xs font-medium">Primary CTA</Label>
          <div className="space-y-2">
            <Input
              value={section.content.cta.text || ''}
              onChange={(e) => onUpdate({
                content: {
                  ...section.content,
                  cta: { ...section.content.cta!, text: e.target.value }
                }
              })}
              placeholder="Button text..."
            />
            <Input
              value={section.content.cta.link || ''}
              onChange={(e) => onUpdate({
                content: {
                  ...section.content,
                  cta: { ...section.content.cta!, link: e.target.value }
                }
              })}
              placeholder="Link URL..."
            />
          </div>
        </div>
      )}

      {/* Items (for features, testimonials, etc.) */}
      {section.content.items && section.content.items.length > 0 && (
        <div className="space-y-3 pt-3 border-t">
          <Label className="text-xs font-medium">Items ({section.content.items.length})</Label>
          <div className="space-y-2">
            {section.content.items.map((item, index) => (
              <div key={index} className="p-2 bg-muted rounded-md space-y-2">
                <Input
                  value={item.title}
                  onChange={(e) => {
                    const newItems = [...section.content.items!]
                    newItems[index] = { ...newItems[index], title: e.target.value }
                    onUpdate({ content: { ...section.content, items: newItems } })
                  }}
                  placeholder="Title..."
                  className="text-sm"
                />
                <Textarea
                  value={item.description}
                  onChange={(e) => {
                    const newItems = [...section.content.items!]
                    newItems[index] = { ...newItems[index], description: e.target.value }
                    onUpdate({ content: { ...section.content, items: newItems } })
                  }}
                  placeholder="Description..."
                  rows={2}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface SectionStyleEditorProps {
  section: WebsiteSection
  onUpdate: (updates: Partial<WebsiteSection>) => void
}

function SectionStyleEditor({ section, onUpdate }: SectionStyleEditorProps) {
  const updateStyles = (updates: Partial<SectionStyles>) => {
    onUpdate({
      styles: { ...section.styles, ...updates }
    })
  }

  return (
    <div className="space-y-4">
      {/* Layout */}
      <div className="space-y-2">
        <Label className="text-xs">Layout</Label>
        <Select
          value={section.styles.layout}
          onValueChange={(v) => updateStyles({ layout: v as SectionStyles['layout'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="centered">Centered</SelectItem>
            <SelectItem value="split">Split</SelectItem>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="list">List</SelectItem>
            <SelectItem value="cards">Cards</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alignment */}
      <div className="space-y-2">
        <Label className="text-xs">Alignment</Label>
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map((align) => (
            <Button
              key={align}
              variant={section.styles.alignment === align ? 'secondary' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => updateStyles({ alignment: align })}
            >
              {align === 'left' && <AlignLeft className="h-4 w-4" />}
              {align === 'center' && <AlignCenter className="h-4 w-4" />}
              {align === 'right' && <AlignRight className="h-4 w-4" />}
            </Button>
          ))}
        </div>
      </div>

      {/* Background */}
      <div className="space-y-2">
        <Label className="text-xs">Background</Label>
        <Select
          value={section.styles.background}
          onValueChange={(v) => updateStyles({ background: v as SectionStyles['background'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="white">White</SelectItem>
            <SelectItem value="light">Light Gray</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="gradient">Gradient</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Spacing */}
      <div className="space-y-2">
        <Label className="text-xs">Spacing</Label>
        <Select
          value={section.styles.spacing}
          onValueChange={(v) => updateStyles({ spacing: v as SectionStyles['spacing'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="spacious">Spacious</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Columns (for grid layouts) */}
      {(section.styles.layout === 'grid' || section.styles.layout === 'cards') && (
        <div className="space-y-2">
          <Label className="text-xs">Columns</Label>
          <Select
            value={String(section.styles.columns || 3)}
            onValueChange={(v) => updateStyles({ columns: parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 Columns</SelectItem>
              <SelectItem value="3">3 Columns</SelectItem>
              <SelectItem value="4">4 Columns</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

interface ThemeEditorProps {
  globalStyles: WebsiteDesign['globalStyles']
  onUpdate: (updates: Partial<WebsiteDesign['globalStyles']>) => void
}

function ThemeEditor({ globalStyles, onUpdate }: ThemeEditorProps) {
  return (
    <div className="space-y-4">
      {/* Color Scheme */}
      <div className="space-y-2">
        <Label className="text-xs">Color Scheme</Label>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((scheme) => (
            <Button
              key={scheme}
              variant={globalStyles.colorScheme === scheme ? 'secondary' : 'outline'}
              size="sm"
              className="flex-1 capitalize"
              onClick={() => onUpdate({ colorScheme: scheme })}
            >
              {scheme}
            </Button>
          ))}
        </div>
      </div>

      {/* Primary Color */}
      <div className="space-y-2">
        <Label className="text-xs">Primary Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={globalStyles.primaryColor}
            onChange={(e) => onUpdate({ primaryColor: e.target.value })}
            className="w-12 h-9 p-1 cursor-pointer"
          />
          <Input
            value={globalStyles.primaryColor}
            onChange={(e) => onUpdate({ primaryColor: e.target.value })}
            className="flex-1 font-mono text-sm"
          />
        </div>
      </div>

      {/* Secondary Color */}
      <div className="space-y-2">
        <Label className="text-xs">Secondary Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={globalStyles.secondaryColor || globalStyles.primaryColor}
            onChange={(e) => onUpdate({ secondaryColor: e.target.value })}
            className="w-12 h-9 p-1 cursor-pointer"
          />
          <Input
            value={globalStyles.secondaryColor || ''}
            onChange={(e) => onUpdate({ secondaryColor: e.target.value })}
            className="flex-1 font-mono text-sm"
            placeholder="Same as primary"
          />
        </div>
      </div>

      {/* Typography */}
      <div className="space-y-2 pt-3 border-t">
        <Label className="text-xs flex items-center gap-1.5">
          <Type className="h-3.5 w-3.5" />
          Heading Font
        </Label>
        <Select
          value={globalStyles.fontHeading}
          onValueChange={(v) => onUpdate({ fontHeading: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Inter">Inter</SelectItem>
            <SelectItem value="Poppins">Poppins</SelectItem>
            <SelectItem value="Roboto">Roboto</SelectItem>
            <SelectItem value="Open Sans">Open Sans</SelectItem>
            <SelectItem value="Montserrat">Montserrat</SelectItem>
            <SelectItem value="Playfair Display">Playfair Display</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Body Font</Label>
        <Select
          value={globalStyles.fontBody}
          onValueChange={(v) => onUpdate({ fontBody: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Inter">Inter</SelectItem>
            <SelectItem value="Roboto">Roboto</SelectItem>
            <SelectItem value="Open Sans">Open Sans</SelectItem>
            <SelectItem value="Lato">Lato</SelectItem>
            <SelectItem value="Source Sans Pro">Source Sans Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Border Radius */}
      <div className="space-y-2 pt-3 border-t">
        <Label className="text-xs">Border Radius</Label>
        <Select
          value={globalStyles.borderRadius}
          onValueChange={(v) => onUpdate({ borderRadius: v as WebsiteDesign['globalStyles']['borderRadius'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None (Sharp)</SelectItem>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
            <SelectItem value="full">Full (Pill)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Button Style */}
      <div className="space-y-2">
        <Label className="text-xs">Button Style</Label>
        <Select
          value={globalStyles.buttonStyle}
          onValueChange={(v) => onUpdate({ buttonStyle: v as WebsiteDesign['globalStyles']['buttonStyle'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="ghost">Ghost</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
