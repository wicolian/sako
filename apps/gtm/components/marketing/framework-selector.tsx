'use client'

import { useState } from 'react'
import { 
  Lightbulb, 
  Sparkles, 
  BookOpen, 
  Zap, 
  Star,
  ChevronRight,
  Loader2,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { 
  AD_FRAMEWORKS, 
  type AdFramework, 
  type GeneratedFrameworkContent,
  getFrameworksByDifficulty,
} from '@/lib/marketing/ad-frameworks'

// ============================================================================
// Framework Card
// ============================================================================

interface FrameworkCardProps {
  framework: AdFramework
  onSelect: () => void
  isSelected?: boolean
}

function FrameworkCard({ framework, onSelect, isSelected }: FrameworkCardProps) {
  const difficultyColors = {
    beginner: 'bg-emerald-100 text-emerald-700',
    intermediate: 'bg-amber-500/10 text-amber-500',
    advanced: 'bg-destructive/10 text-destructive',
  }

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {framework.acronym || framework.name}
              {framework.effectivenessScore >= 8 && (
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              )}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {framework.name}
            </CardDescription>
          </div>
          <Badge className={cn("text-xs", difficultyColors[framework.difficulty])}>
            {framework.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {framework.description}
        </p>
        <div className="flex flex-wrap gap-1">
          {framework.bestFor.slice(0, 2).map((use) => (
            <Badge key={use} variant="secondary" className="text-xs">
              {use}
            </Badge>
          ))}
          {framework.bestFor.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{framework.bestFor.length - 2}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Framework Detail Dialog
// ============================================================================

interface FrameworkDetailProps {
  framework: AdFramework
  onGenerate: () => void
}

function FrameworkDetail({ framework, onGenerate }: FrameworkDetailProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-2">About this framework</h3>
        <p className="text-sm text-muted-foreground">{framework.description}</p>
      </div>

      <div>
        <h3 className="font-medium mb-3">Stages</h3>
        <Accordion type="single" collapsible className="w-full">
          {framework.stages.map((stage, index) => (
            <AccordionItem key={stage.name} value={stage.name}>
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  {stage.letter && (
                    <Badge variant="outline" className="font-mono">
                      {stage.letter}
                    </Badge>
                  )}
                  <span>{stage.name}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-sm space-y-3">
                <p className="text-muted-foreground">{stage.description}</p>
                {stage.example && (
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-xs text-muted-foreground mb-1">Example:</p>
                    <p className="italic">"{stage.example}"</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Tips:</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {stage.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div>
        <h3 className="font-medium mb-2">Best for</h3>
        <div className="flex flex-wrap gap-2">
          {framework.bestFor.map((use) => (
            <Badge key={use} variant="secondary">{use}</Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Difficulty: {framework.difficulty}</span>
          <span className="flex items-center gap-1">
            <Zap className="h-4 w-4" />
            Effectiveness: {framework.effectivenessScore}/10
          </span>
        </div>
        <Button onClick={onGenerate}>
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Copy
        </Button>
      </div>
    </div>
  )
}

// ============================================================================
// Framework Generator
// ============================================================================

interface FrameworkGeneratorProps {
  framework: AdFramework
  onComplete: (content: GeneratedFrameworkContent) => void
}

function FrameworkGenerator({ framework, onComplete }: FrameworkGeneratorProps) {
  const { toast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [product, setProduct] = useState('')
  const [audience, setAudience] = useState('')
  const [goal, setGoal] = useState('')
  const [tone, setTone] = useState('')
  const [generatedContent, setGeneratedContent] = useState<GeneratedFrameworkContent | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!product || !audience || !goal) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameworkId: framework.id,
          product,
          targetAudience: audience,
          goal,
          tone,
        }),
      })

      if (!response.ok) throw new Error('Generation failed')

      const data = await response.json()
      setGeneratedContent(data.content)
      onComplete(data.content)
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    if (generatedContent?.fullCopy) {
      await navigator.clipboard.writeText(generatedContent.fullCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-6">
      {!generatedContent ? (
        <>
          <div className="grid gap-4">
            <div>
              <Label htmlFor="product">Product/Service *</Label>
              <Input
                id="product"
                placeholder="e.g., AI-powered project management tool"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="audience">Target Audience *</Label>
              <Input
                id="audience"
                placeholder="e.g., Marketing managers at mid-size companies"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="goal">Campaign Goal *</Label>
              <Input
                id="goal"
                placeholder="e.g., Increase free trial signups"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tone">Tone (optional)</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="playful">Playful</SelectItem>
                  <SelectItem value="authoritative">Authoritative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || !product || !audience || !goal}
            className="w-full"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate {framework.acronym} Copy
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          {/* Stage-by-stage breakdown */}
          <div className="space-y-3">
            {framework.stages.map((stage) => (
              <div key={stage.name} className="bg-muted p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {stage.letter && (
                    <Badge variant="outline" className="font-mono">
                      {stage.letter}
                    </Badge>
                  )}
                  <span className="font-medium text-sm">{stage.name}</span>
                </div>
                <p className="text-sm">
                  {generatedContent.content[stage.name] || generatedContent.content[stage.name.toLowerCase()]}
                </p>
              </div>
            ))}
          </div>

          {/* Full copy */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Full Copy</h4>
              <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap">{generatedContent.fullCopy}</p>
          </div>

          {/* Suggestions */}
          {generatedContent.suggestions.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Suggestions
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {generatedContent.suggestions.map((suggestion, i) => (
                  <li key={i}>• {suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          <Button 
            variant="outline" 
            onClick={() => setGeneratedContent(null)}
            className="w-full"
          >
            Generate Another
          </Button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

interface FrameworkSelectorProps {
  onSelectFramework?: (framework: AdFramework) => void
  className?: string
}

export function FrameworkSelector({ onSelectFramework, className }: FrameworkSelectorProps) {
  const [filter, setFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all')
  const [selectedFramework, setSelectedFramework] = useState<AdFramework | null>(null)
  const [showGenerator, setShowGenerator] = useState(false)

  const filteredFrameworks = filter === 'all' 
    ? AD_FRAMEWORKS 
    : getFrameworksByDifficulty(filter)

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Marketing IQ
          </h2>
          <p className="text-sm text-muted-foreground">
            15+ proven advertising frameworks
          </p>
        </div>

        <Select 
          value={filter} 
          onValueChange={(v) => setFilter(v as typeof filter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Framework Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredFrameworks.map((framework) => (
          <Dialog key={framework.id}>
            <DialogTrigger asChild>
              <div>
                <FrameworkCard 
                  framework={framework} 
                  onSelect={() => {
                    setSelectedFramework(framework)
                    onSelectFramework?.(framework)
                  }}
                  isSelected={selectedFramework?.id === framework.id}
                />
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {framework.acronym || framework.name}
                  {framework.effectivenessScore >= 8 && (
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  )}
                </DialogTitle>
                <DialogDescription>{framework.name}</DialogDescription>
              </DialogHeader>
              
              {showGenerator ? (
                <FrameworkGenerator 
                  framework={framework}
                  onComplete={() => {}}
                />
              ) : (
                <FrameworkDetail 
                  framework={framework}
                  onGenerate={() => setShowGenerator(true)}
                />
              )}
            </DialogContent>
          </Dialog>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
        <span>{AD_FRAMEWORKS.length} frameworks available</span>
        <span>•</span>
        <span>{filteredFrameworks.length} shown</span>
      </div>
    </div>
  )
}
