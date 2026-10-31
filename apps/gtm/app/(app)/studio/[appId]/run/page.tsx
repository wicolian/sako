'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Play,
  Copy,
  Download,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { StudioApp, AppInput } from '@/lib/studio/types'

export default function AppRunPage() {
  const params = useParams()
  const router = useRouter()
  const appId = params.appId as string

  const [app, setApp] = useState<StudioApp | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [inputs, setInputs] = useState<Record<string, unknown>>({})
  const [output, setOutput] = useState<string | null>(null)
  const [runStats, setRunStats] = useState<{ tokensUsed?: number; latencyMs?: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchApp()
  }, [appId])

  const fetchApp = async () => {
    try {
      const response = await fetch(`/api/studio/apps/${appId}`)
      if (!response.ok) throw new Error('Failed to fetch app')
      const data = await response.json()
      setApp(data)
      
      // Initialize inputs with default values
      const initialInputs: Record<string, unknown> = {}
      for (const input of data.inputs) {
        if (input.default_value) {
          initialInputs[input.name] = input.default_value
        } else if (input.type === 'checkboxes') {
          initialInputs[input.name] = []
        } else {
          initialInputs[input.name] = ''
        }
      }
      setInputs(initialInputs)
    } catch (error) {
      console.error('Failed to fetch app:', error)
      toast.error('Failed to load app')
    } finally {
      setLoading(false)
    }
  }

  const handleRun = async () => {
    if (!app) return
    
    setRunning(true)
    setOutput(null)
    setError(null)
    setRunStats(null)

    try {
      const response = await fetch(`/api/studio/apps/${appId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to run app')
      }

      setOutput(data.output)
      setRunStats({
        tokensUsed: data.tokensUsed,
        latencyMs: data.latencyMs,
      })
      toast.success('Generation complete!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run app'
      setError(message)
      toast.error(message)
    } finally {
      setRunning(false)
    }
  }

  const handleCopy = async () => {
    if (output) {
      await navigator.clipboard.writeText(output)
      toast.success('Copied to clipboard!')
    }
  }

  const handleInputChange = (name: string, value: unknown) => {
    setInputs((prev) => ({ ...prev, [name]: value }))
  }

  const renderInput = (input: AppInput) => {
    const value = inputs[input.name]

    switch (input.type) {
      case 'short_answer':
        return (
          <Input
            value={String(value || '')}
            onChange={(e) => handleInputChange(input.name, e.target.value)}
            placeholder={input.placeholder}
          />
        )
      case 'paragraph':
        return (
          <Textarea
            value={String(value || '')}
            onChange={(e) => handleInputChange(input.name, e.target.value)}
            placeholder={input.placeholder}
            rows={4}
          />
        )
      case 'dropdown':
        return (
          <Select
            value={String(value || '')}
            onValueChange={(v) => handleInputChange(input.name, v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {input.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'checkboxes':
        return (
          <div className="space-y-2 min-h-screen bg-background text-foreground">
            {input.options?.map((option) => {
              const checked = Array.isArray(value) && value.includes(option)
              return (
                <div key={option} className="flex items-center gap-2">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(isChecked) => {
                      const currentValue = Array.isArray(value) ? value : []
                      if (isChecked) {
                        handleInputChange(input.name, [...currentValue, option])
                      } else {
                        handleInputChange(input.name, currentValue.filter((v) => v !== option))
                      }
                    }}
                  />
                  <Label className="font-normal">{option}</Label>
                </div>
              )
            })}
          </div>
        )
      case 'tags':
        return (
          <Input
            value={Array.isArray(value) ? value.join(', ') : String(value || '')}
            onChange={(e) =>
              handleInputChange(input.name, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
            }
            placeholder={input.placeholder || 'Enter comma-separated values'}
          />
        )
      default:
        return (
          <Input
            value={String(value || '')}
            onChange={(e) => handleInputChange(input.name, e.target.value)}
            placeholder={input.placeholder}
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
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
          <Button variant="ghost" size="icon" onClick={() => router.push(`/studio/${appId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
            {app.icon}
          </div>
          <div>
            <h1 className="font-semibold">{app.name}</h1>
            <p className="text-xs text-muted-foreground">{app.description || 'Run this app'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/studio/${appId}`)}>
            Edit App
          </Button>
          <Button size="sm" onClick={handleRun} disabled={running}>
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Run App
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Inputs */}
        <div className="w-96 border-r bg-card flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Inputs</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Fill in the fields to generate content
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {app.inputs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  This app has no input fields configured.
                </p>
              ) : (
                app.inputs.map((input) => (
                  <div key={input.id} className="space-y-2">
                    <Label className={cn(input.required && 'after:content-["*"] after:text-red-500 after:ml-1')}>
                      {input.label}
                    </Label>
                    {input.description && (
                      <p className="text-xs text-muted-foreground">{input.description}</p>
                    )}
                    {renderInput(input)}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t">
            <Button className="w-full" onClick={handleRun} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Panel - Output */}
        <div className="flex-1 flex flex-col bg-background">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Output</h2>
            {output && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleRun} disabled={running}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {running ? (
              <div className="flex flex-col items-center justify-center h-full">
                <motion.div
                  className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Sparkles className="h-8 w-8 text-primary" />
                </motion.div>
                <p className="text-sm text-muted-foreground">Generating content...</p>
              </div>
            ) : error ? (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Error
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{error}</p>
                </CardContent>
              </Card>
            ) : output ? (
              <div className="space-y-4">
                {runStats && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Complete
                    </span>
                    {runStats.tokensUsed && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-4 w-4" />
                        {runStats.tokensUsed} tokens
                      </span>
                    )}
                    {runStats.latencyMs && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {(runStats.latencyMs / 1000).toFixed(2)}s
                      </span>
                    )}
                  </div>
                )}
                <div className="p-4 rounded-lg border bg-card">
                  <pre className="whitespace-pre-wrap text-sm">{output}</pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Play className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold mb-2">Ready to Generate</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Fill in the inputs on the left and click "Generate" to create content with AI.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
