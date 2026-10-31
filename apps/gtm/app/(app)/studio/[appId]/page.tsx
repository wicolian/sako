'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Save,
  Play,
  Settings,
  Plus,
  Trash2,
  GripVertical,
  Sparkles,
  ChevronDown,
  Eye,
  Code,
  Globe,
  Lock,
  Users,
  Loader2,
  Wand2,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { StudioApp, AppInput, STUDIO_MODELS, APP_CATEGORIES, INPUT_TYPES } from '@/lib/studio/types'

export default function AppBuilderPage() {
  const params = useParams()
  const router = useRouter()
  const appId = params.appId as string

  const [app, setApp] = useState<StudioApp | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('inputs')
  const [previewMode, setPreviewMode] = useState<'preview' | 'code'>('preview')

  useEffect(() => {
    fetchApp()
  }, [appId])

  const fetchApp = async () => {
    try {
      const response = await fetch(`/api/studio/apps/${appId}`)
      if (!response.ok) throw new Error('Failed to fetch app')
      const data = await response.json()
      setApp(data)
    } catch (error) {
      console.error('Failed to fetch app:', error)
      toast.error('Failed to load app')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!app) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/studio/apps/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: app.name,
          description: app.description,
          icon: app.icon,
          category: app.category,
          inputs: app.inputs,
          instructions: app.instructions,
          example_output: app.example_output,
          model: app.model,
          temperature: app.temperature,
          max_tokens: app.max_tokens,
          knowledge_items: app.knowledge_items,
          default_brand_id: app.default_brand_id,
          default_audience_id: app.default_audience_id,
        }),
      })

      if (!response.ok) throw new Error('Failed to save app')
      toast.success('App saved!')
    } catch (error) {
      console.error('Failed to save app:', error)
      toast.error('Failed to save app')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!app) return
    try {
      const newVisibility = app.visibility === 'workspace' ? 'private' : 'workspace'
      const response = await fetch(`/api/studio/apps/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility: newVisibility,
          published_at: newVisibility === 'workspace' ? new Date().toISOString() : null,
        }),
      })

      if (!response.ok) throw new Error('Failed to update visibility')
      setApp({ ...app, visibility: newVisibility })
      toast.success(newVisibility === 'workspace' ? 'App published to workspace!' : 'App made private')
    } catch (error) {
      console.error('Failed to update visibility:', error)
      toast.error('Failed to update visibility')
    }
  }

  const addInput = () => {
    if (!app) return
    const newInput: AppInput = {
      id: `input_${Date.now()}`,
      name: `input_${app.inputs.length + 1}`,
      label: `Input ${app.inputs.length + 1}`,
      type: 'short_answer',
      required: false,
    }
    setApp({ ...app, inputs: [...app.inputs, newInput] })
  }

  const updateInput = (index: number, updates: Partial<AppInput>) => {
    if (!app) return
    const newInputs = [...app.inputs]
    newInputs[index] = { ...newInputs[index], ...updates }
    setApp({ ...app, inputs: newInputs })
  }

  const removeInput = (index: number) => {
    if (!app) return
    const newInputs = app.inputs.filter((_, i) => i !== index)
    setApp({ ...app, inputs: newInputs })
  }

  const insertPlaceholder = (inputName: string) => {
    if (!app) return
    const placeholder = `{{${inputName}}}`
    setApp({
      ...app,
      instructions: app.instructions + placeholder,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] min-h-screen bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!app) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <p className="text-muted-foreground">App not found</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between bg-card border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/studio')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
            {app.icon}
          </div>
          <div>
            <Input
              value={app.name}
              onChange={(e) => setApp({ ...app, name: e.target.value })}
              className="font-semibold h-7 border-none p-0 focus-visible:ring-0 text-base"
            />
          </div>
          <Badge variant="outline">
            {app.visibility === 'private' ? (
              <Lock className="h-3 w-3 mr-1" />
            ) : (
              <Users className="h-3 w-3 mr-1" />
            )}
            {app.visibility}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/studio/${appId}/run`)}>
            <Play className="h-4 w-4 mr-2" />
            Test
          </Button>
          <Button variant="outline" size="sm" onClick={handlePublish}>
            {app.visibility === 'workspace' ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Make Private
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Publish
              </>
            )}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Inputs */}
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Input Fields</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Define what users will provide when running this app
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {app.inputs.map((input, index) => (
                <motion.div
                  key={input.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg border bg-background group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <Input
                        value={input.label}
                        onChange={(e) => updateInput(index, { label: e.target.value })}
                        className="h-7 text-sm font-medium"
                        placeholder="Label"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => removeInput(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Variable</Label>
                        <Input
                          value={input.name}
                          onChange={(e) =>
                            updateInput(index, { name: e.target.value.replace(/\s+/g, '_').toLowerCase() })
                          }
                          className="h-7 text-xs font-mono"
                          placeholder="variable_name"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Type</Label>
                        <Select
                          value={input.type}
                          onValueChange={(value) => updateInput(index, { type: value as AppInput['type'] })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INPUT_TYPES.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(input.type === 'dropdown' || input.type === 'checkboxes') && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Options (comma-separated)</Label>
                        <Input
                          value={input.options?.join(', ') || ''}
                          onChange={(e) =>
                            updateInput(index, { options: e.target.value.split(',').map((s) => s.trim()) })
                          }
                          className="h-7 text-xs"
                          placeholder="Option 1, Option 2, Option 3"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={input.required}
                          onCheckedChange={(checked) => updateInput(index, { required: checked })}
                          className="h-4 w-7"
                        />
                        <Label className="text-[10px]">Required</Label>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => insertPlaceholder(input.name)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Insert
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
              <Button variant="outline" className="w-full" onClick={addInput}>
                <Plus className="h-4 w-4 mr-2" />
                Add Input Field
              </Button>
            </div>
          </ScrollArea>
        </div>

        {/* Center Panel - Instructions */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Instructions</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Tell the AI what to do. Use {"{{variable}}"} to insert input values.
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Wand2 className="h-4 w-4 mr-2" />
              Enhance with AI
            </Button>
          </div>
          <div className="flex-1 p-4">
            <Textarea
              value={app.instructions}
              onChange={(e) => setApp({ ...app, instructions: e.target.value })}
              placeholder="Write your instructions here. Use {{input_name}} to reference input values.

Example:
Write a compelling {{content_type}} about {{topic}}.
The target audience is {{audience}}.
Keep the tone {{tone}} and focus on {{key_points}}.
Include a strong call-to-action at the end."
              className="h-full font-mono text-sm resize-none"
            />
          </div>
          <Separator />
          <div className="p-4">
            <Label className="text-sm font-medium">Example Output (optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Show the AI an example of what you expect
            </p>
            <Textarea
              value={app.example_output || ''}
              onChange={(e) => setApp({ ...app, example_output: e.target.value })}
              placeholder="Paste an example of ideal output here..."
              rows={4}
              className="font-mono text-sm"
            />
          </div>
        </div>

        {/* Right Panel - Settings */}
        <div className="w-72 border-l bg-card flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />
              AI Settings
            </h2>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Model Selection */}
              <div className="space-y-2">
                <Label>Model</Label>
                <Select
                  value={app.model}
                  onValueChange={(value) => setApp({ ...app, model: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STUDIO_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col">
                          <span>{model.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {model.provider}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Temperature</Label>
                  <span className="text-sm font-mono">{app.temperature}</span>
                </div>
                <Slider
                  value={[app.temperature]}
                  onValueChange={([value]) => setApp({ ...app, temperature: value })}
                  min={0}
                  max={1}
                  step={0.1}
                />
                <p className="text-[10px] text-muted-foreground">
                  Lower = more focused, Higher = more creative
                </p>
              </div>

              {/* Max Tokens */}
              <div className="space-y-2">
                <Label>Max Output Length</Label>
                <Input
                  type="number"
                  value={app.max_tokens || ''}
                  onChange={(e) =>
                    setApp({ ...app, max_tokens: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  placeholder="No limit"
                />
                <p className="text-[10px] text-muted-foreground">
                  Leave empty for no limit
                </p>
              </div>

              <Separator />

              {/* Category */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={app.category}
                  onValueChange={(value) => setApp({ ...app, category: value as StudioApp['category'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          {cat.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={app.description || ''}
                  onChange={(e) => setApp({ ...app, description: e.target.value })}
                  placeholder="What does this app do?"
                  rows={2}
                />
              </div>

              {/* Icon */}
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex gap-1 flex-wrap">
                  {['🤖', '✨', '📝', '📧', '📱', '📢', '🎯', '💡', '🔥', '⚡'].map(
                    (icon) => (
                      <Button
                        key={icon}
                        variant={app.icon === icon ? 'secondary' : 'outline'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setApp({ ...app, icon })}
                      >
                        {icon}
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
