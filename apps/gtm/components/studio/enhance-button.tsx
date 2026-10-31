'use client'

/**
 * Enhance Button Component
 * 
 * Provides AI-powered enhancement of Studio app instructions.
 * Features:
 * - One-click instruction improvement
 * - Shows before/after diff
 * - Explains improvements made
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Wand2, Check, X, AlertCircle, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { AppInput } from '@/lib/studio/types'

interface EnhanceButtonProps {
  instructions: string
  inputs: AppInput[]
  appCategory?: string
  onAccept: (enhanced: string) => void
  disabled?: boolean
}

interface EnhancedResult {
  enhanced: string
  improvements: string[]
  suggestedStructure?: string
  suggestedVariables: Array<{
    name: string
    reason: string
  }>
  confidence: number
}

export function EnhanceButton({
  instructions,
  inputs,
  appCategory,
  onAccept,
  disabled,
}: EnhanceButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [result, setResult] = useState<EnhancedResult | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  
  const enhanceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/studio/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions,
          inputs,
          appCategory,
        }),
      })
      
      if (!res.ok) throw new Error('Failed to enhance instructions')
      return res.json() as Promise<EnhancedResult>
    },
    onSuccess: (data) => {
      setResult(data)
      setShowDialog(true)
    },
  })
  
  const handleAccept = () => {
    if (result) {
      onAccept(result.enhanced)
      setShowDialog(false)
      setResult(null)
    }
  }
  
  const handleReject = () => {
    setShowDialog(false)
    setResult(null)
  }
  
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => enhanceMutation.mutate()}
        disabled={disabled || enhanceMutation.isPending || !instructions.trim()}
        className="gap-2"
      >
        {enhanceMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="h-4 w-4" />
        )}
        {enhanceMutation.isPending ? 'Enhancing...' : 'Enhance with AI'}
      </Button>
      
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Enhanced Instructions
            </DialogTitle>
            <DialogDescription>
              Review the AI-enhanced instructions below
            </DialogDescription>
          </DialogHeader>
          
          {result && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {/* Confidence Score */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Enhancement confidence:
                  </span>
                  <Progress value={result.confidence * 100} className="w-24 h-2" />
                  <span className="text-sm font-medium">
                    {Math.round(result.confidence * 100)}%
                  </span>
                </div>
                
                {/* Improvements */}
                {result.improvements.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Improvements Made
                    </h4>
                    <ul className="space-y-1">
                      {result.improvements.map((improvement, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Suggested Variables */}
                {result.suggestedVariables.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Suggested New Variables
                    </h4>
                    <div className="space-y-2">
                      {result.suggestedVariables.map((variable, i) => (
                        <div
                          key={i}
                          className="p-2 bg-amber-50  rounded-md border border-amber-200 dark:border-amber-800"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {`{{${variable.name}}}`}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {variable.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Enhanced Instructions */}
                <div>
                  <Collapsible open={showDiff} onOpenChange={setShowDiff}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Enhanced Instructions</h4>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7">
                          {showDiff ? 'Hide original' : 'Compare with original'}
                          <ChevronDown className={cn(
                            'h-4 w-4 ml-1 transition-transform',
                            showDiff && 'rotate-180'
                          )} />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    
                    <CollapsibleContent>
                      <div className="mb-3 p-3 bg-muted rounded-md">
                        <p className="text-xs text-muted-foreground mb-1 font-medium">
                          Original:
                        </p>
                        <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                          {instructions}
                        </pre>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {result.enhanced}
                    </pre>
                  </div>
                </div>
                
                {/* Suggested Structure */}
                {result.suggestedStructure && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">
                      Suggested Output Structure
                    </h4>
                    <div className="p-3 bg-muted rounded-md">
                      <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                        {result.suggestedStructure}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleReject}>
              <X className="h-4 w-4 mr-2" />
              Keep Original
            </Button>
            <Button onClick={handleAccept}>
              <Check className="h-4 w-4 mr-2" />
              Use Enhanced
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Instruction Analyzer Component
 * 
 * Shows real-time analysis of instructions quality.
 */
interface InstructionAnalyzerProps {
  instructions: string
  inputs: AppInput[]
}

interface AnalysisIssue {
  type: 'warning' | 'error' | 'suggestion'
  message: string
}

export function InstructionAnalyzer({ instructions, inputs }: InstructionAnalyzerProps) {
  // Perform analysis client-side
  const analyze = (): { issues: AnalysisIssue[]; score: number } => {
    const issues: AnalysisIssue[] = []
    let score = 100
    
    if (!instructions.trim()) {
      return { issues: [{ type: 'error', message: 'Instructions are empty' }], score: 0 }
    }
    
    // Check length
    if (instructions.length < 50) {
      issues.push({ type: 'warning', message: 'Instructions are very short' })
      score -= 15
    }
    
    // Check for variable usage
    const usedVars = instructions.match(/\{\{(\w+)\}\}/g) || []
    const usedVarNames = usedVars.map(v => v.replace(/\{\{|\}\}/g, ''))
    const inputNames = inputs.map(i => i.name)
    
    // Unused inputs
    for (const input of inputs) {
      if (!usedVarNames.includes(input.name)) {
        issues.push({
          type: 'warning',
          message: `Input "${input.label}" is not used`,
        })
        score -= 10
      }
    }
    
    // Undefined variables
    for (const varName of usedVarNames) {
      if (!inputNames.includes(varName)) {
        issues.push({
          type: 'error',
          message: `Variable "{{${varName}}}" is not defined`,
        })
        score -= 20
      }
    }
    
    return { issues, score: Math.max(0, score) }
  }
  
  const { issues, score } = analyze()
  
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-500">
        <Check className="h-4 w-4" />
        Instructions look good!
      </div>
    )
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Quality score:</span>
        <Progress value={score} className="w-20 h-2" />
        <span className={cn(
          'text-sm font-medium',
          score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-destructive'
        )}>
          {score}/100
        </span>
      </div>
      <div className="space-y-1">
        {issues.map((issue, i) => (
          <div
            key={i}
            className={cn(
              'text-xs flex items-start gap-1.5',
              issue.type === 'error' && 'text-destructive',
              issue.type === 'warning' && 'text-amber-500',
              issue.type === 'suggestion' && 'text-blue-500'
            )}
          >
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            {issue.message}
          </div>
        ))}
      </div>
    </div>
  )
}
