'use client'

/**
 * Validator Input - Text input with industry selector
 * 
 * Main input component for the /gate page.
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Sparkles } from 'lucide-react'
import { POLICY_PRESETS } from '@/lib/claims/policy-presets'
import { getExamplesForIndustry, type ExampleClaim } from '@/lib/claims/example-claims'

interface ValidatorInputProps {
  onValidate: (text: string, industry: string) => Promise<void>
  isLoading: boolean
  remainingValidations?: number
  className?: string
}

export function ValidatorInput({ 
  onValidate, 
  isLoading, 
  remainingValidations,
  className 
}: ValidatorInputProps) {
  const [text, setText] = useState('')
  const [industry, setIndustry] = useState('saas_b2b')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || isLoading) return
    await onValidate(text, industry)
  }
  
  const handleExampleClick = (example: ExampleClaim) => {
    setText(example.text)
  }
  
  const examples = getExamplesForIndustry(industry)
  const selectedPreset = POLICY_PRESETS.find(p => p.id === industry)
  
  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      {/* Industry Selector */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-foreground mb-2 block">
            Industry
          </label>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              {POLICY_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  <span className="flex items-center gap-2">
                    <span>{preset.icon}</span>
                    <span>{preset.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPreset && (
            <p className="text-xs text-muted-foreground mt-1">
              {selectedPreset.description}
            </p>
          )}
        </div>
      </div>
      
      {/* Text Input */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Marketing Copy
        </label>
        <Textarea
          placeholder="Paste your marketing copy, landing page text, ad copy, or any claims you want to validate..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[200px] resize-y"
          disabled={isLoading}
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-muted-foreground">
            {text.length} characters
          </span>
          {remainingValidations !== undefined && (
            <span className="text-xs text-muted-foreground">
              {remainingValidations} validations remaining today
            </span>
          )}
        </div>
      </div>
      
      {/* Quick Examples */}
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
          Quick Examples
        </label>
        <div className="flex flex-wrap gap-2">
          {examples.slice(0, 4).map((example, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleExampleClick(example)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border transition-colors',
                'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
                example.expectedStatus === 'approved' && 'border-emerald-500/20 hover:border-emerald-500/40',
                example.expectedStatus === 'needs_proof' && 'border-amber-500/20 hover:border-amber-500/40',
                example.expectedStatus === 'blocked' && 'border-red-500/20 hover:border-red-500/40'
              )}
            >
              {truncateText(example.text, 50)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Submit Button */}
      <Button 
        type="submit" 
        size="lg" 
        className="w-full"
        disabled={!text.trim() || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Validating...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Check Compliance
          </>
        )}
      </Button>
    </form>
  )
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
