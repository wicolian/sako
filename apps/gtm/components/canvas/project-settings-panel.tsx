'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  X,
  Palette,
  Users,
  Target,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Check,
  Plus,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface Brand {
  id: string
  name: string
  primary_color: string
}

interface Audience {
  id: string
  name: string
  description?: string
}

interface ProjectSettings {
  brandId?: string
  audienceId?: string
  campaignGoals?: string
  toneOverride?: string
  keywordsInclude: string[]
  keywordsAvoid: string[]
  customInstructions?: string
}

interface ProjectSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  settings: ProjectSettings
  onSettingsChange: (settings: ProjectSettings) => void
  brands: Brand[]
  audiences: Audience[]
  onSave: () => void
  isSaving?: boolean
}

const TONE_OPTIONS = [
  'Professional',
  'Casual',
  'Friendly',
  'Authoritative',
  'Playful',
  'Urgent',
  'Empathetic',
  'Bold',
  'Minimal',
]

export function ProjectSettingsPanel({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  brands,
  audiences,
  onSave,
  isSaving,
}: ProjectSettingsPanelProps) {
  const [newKeywordInclude, setNewKeywordInclude] = useState('')
  const [newKeywordAvoid, setNewKeywordAvoid] = useState('')

  const selectedBrand = brands.find((b) => b.id === settings.brandId)
  const selectedAudience = audiences.find((a) => a.id === settings.audienceId)

  const addKeyword = (type: 'include' | 'avoid') => {
    const keyword = type === 'include' ? newKeywordInclude : newKeywordAvoid
    if (!keyword.trim()) return

    const field = type === 'include' ? 'keywordsInclude' : 'keywordsAvoid'
    const existing = settings[field] || []
    if (!existing.includes(keyword.trim())) {
      onSettingsChange({
        ...settings,
        [field]: [...existing, keyword.trim()],
      })
    }
    
    if (type === 'include') {
      setNewKeywordInclude('')
    } else {
      setNewKeywordAvoid('')
    }
  }

  const removeKeyword = (type: 'include' | 'avoid', keyword: string) => {
    const field = type === 'include' ? 'keywordsInclude' : 'keywordsAvoid'
    onSettingsChange({
      ...settings,
      [field]: (settings[field] || []).filter((k) => k !== keyword),
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed right-0 top-0 h-full w-[400px] bg-card border-l shadow-2xl z-50 flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Project Settings</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Brand Voice */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Brand Voice</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select a brand to apply its voice, colors, and style to all assets.
                </p>
                <Select
                  value={settings.brandId || ''}
                  onValueChange={(value) =>
                    onSettingsChange({ ...settings, brandId: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: brand.primary_color }}
                          />
                          {brand.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBrand && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <div
                      className="w-8 h-8 rounded-lg"
                      style={{ backgroundColor: selectedBrand.primary_color }}
                    />
                    <span className="text-sm font-medium">{selectedBrand.name}</span>
                    <Check className="h-4 w-4 text-green-500 ml-auto" />
                  </div>
                )}
              </div>

              <Separator />

              {/* Target Audience */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Target Audience</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select an audience to tailor messaging and tone.
                </p>
                <Select
                  value={settings.audienceId || ''}
                  onValueChange={(value) =>
                    onSettingsChange({ ...settings, audienceId: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an audience" />
                  </SelectTrigger>
                  <SelectContent>
                    {audiences.map((audience) => (
                      <SelectItem key={audience.id} value={audience.id}>
                        {audience.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAudience && (
                  <div className="p-2 bg-muted rounded-lg">
                    <p className="text-sm font-medium">{selectedAudience.name}</p>
                    {selectedAudience.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedAudience.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Campaign Goals */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Campaign Goals</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  What do you want to achieve with this campaign?
                </p>
                <Textarea
                  placeholder="e.g., Increase demo signups by 30%, Launch new feature awareness..."
                  value={settings.campaignGoals || ''}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, campaignGoals: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <Separator />

              {/* Tone Override */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Tone Override</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Override the brand voice tone for this project.
                </p>
                <Select
                  value={settings.toneOverride || ''}
                  onValueChange={(value) =>
                    onSettingsChange({ ...settings, toneOverride: value || undefined })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use brand default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Use brand default</SelectItem>
                    {TONE_OPTIONS.map((tone) => (
                      <SelectItem key={tone} value={tone.toLowerCase()}>
                        {tone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Keywords to Include */}
              <div className="space-y-3">
                <Label className="font-medium text-emerald-500">Keywords to Include</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add keyword..."
                    value={newKeywordInclude}
                    onChange={(e) => setNewKeywordInclude(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addKeyword('include')}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => addKeyword('include')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(settings.keywordsInclude || []).map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive/20"
                      onClick={() => removeKeyword('include', keyword)}
                    >
                      {keyword}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Keywords to Avoid */}
              <div className="space-y-3">
                <Label className="font-medium text-destructive">Keywords to Avoid</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add keyword..."
                    value={newKeywordAvoid}
                    onChange={(e) => setNewKeywordAvoid(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addKeyword('avoid')}
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => addKeyword('avoid')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(settings.keywordsAvoid || []).map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => removeKeyword('avoid', keyword)}
                    >
                      {keyword}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Custom Instructions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <Label className="font-medium">Custom AI Instructions</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Additional instructions for AI generation in this project.
                </p>
                <Textarea
                  placeholder="e.g., Always include a customer quote, Focus on ROI metrics..."
                  value={settings.customInstructions || ''}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, customInstructions: e.target.value })
                  }
                  rows={4}
                />
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button className="w-full" onClick={onSave} disabled={isSaving}>
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
