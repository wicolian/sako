'use client'

import { useState } from 'react'
import { Check, AlertTriangle, Loader2, Settings2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  AVAILABLE_MODELS,
  getModelsForTier,
  getDefaultModelId,
  estimateCostPer1KOutput,
  isValidModelForTier,
  type ModelPreferences,
  type UserControllableTier,
  type AvailableModel,
} from '@/lib/ai/openrouter'
import { canUseAdvancedModelPicker } from '@/lib/features/plan-gates'
import type { PlanId } from '@/lib/billing/plans'

// ── Preset Profiles ─────────────────────────────────────────────────────────

type PresetKey = 'efficient' | 'balanced' | 'quality'

/**
 * Preset profiles map to concrete ModelPreferences.
 * Empty object = all defaults (Balanced preset).
 * Only CREATIVE and REASONING are changed per preset —
 * they drive 67% of cost (55% creative + 12% reasoning).
 *
 * NOTE: "Efficient" preset swaps expensive models for cost-optimized alternatives.
 * It is NOT faster (throughput) — the label reflects cost, not latency.
 * Balanced REASONING default is already gemini-3.1-pro-preview (the fast/cheap option);
 * Efficient brings CREATIVE down from claude-sonnet-4.6 to gpt-5.2 for further savings.
 */
const PRESETS: Record<PresetKey, Partial<ModelPreferences>> = {
  efficient: {
    // CREATIVE overridden to deepseek-v3.2 ($0.28/M) — ~59% total savings vs Balanced.
    // REASONING default (gemini-3.1-pro-preview @ $8/M) is already cheapest — unchanged.
    // Note: deepseek-v3.2 is excellent for bulk copy but not brand-critical messaging.
    // Users who need brand precision should stay on Balanced or Quality.
    creative: 'deepseek/deepseek-v3.2',
  },
  balanced: {},
  quality: {
    creative: 'anthropic/claude-opus-4.6',   // upgrade: sonnet → opus for creative
    reasoning: 'anthropic/claude-opus-4.6',  // upgrade: gemini-preview → opus for reasoning
  },
}

const PRESET_META: Record<PresetKey, { label: string; description: string }> = {
  efficient: {
    label: 'Efficient',
    description: 'Optimized for cost — slightly lower quality',
  },
  balanced: {
    label: 'Balanced',
    description: 'Recommended — current defaults',
  },
  quality: {
    label: 'Quality',
    description: 'Best output quality, higher cost',
  },
}

/**
 * Usage weights by tier (fraction of total AI spend).
 * STRUCTURED omitted — mirrors BALANCED default, not counted separately.
 */
const USAGE_WEIGHTS: Partial<Record<UserControllableTier, number>> = {
  creative: 0.55,
  fast: 0.25,
  reasoning: 0.12,
  balanced: 0.08,
}

/**
 * Computes cost multiplier relative to Balanced defaults.
 * 1.0 = same cost as Balanced. 0.84 = 16% cheaper.
 */
function computeRelativeCost(prefs: Partial<ModelPreferences>): number {
  const tiers = Object.keys(USAGE_WEIGHTS) as UserControllableTier[]
  let thisCost = 0
  let balancedCost = 0

  for (const tier of tiers) {
    const weight = USAGE_WEIGHTS[tier] ?? 0
    const defaultModel = getDefaultModelId(tier)
    const override = prefs[tier]
    const selectedModel =
      override && isValidModelForTier(override, tier) ? override : defaultModel

    thisCost += estimateCostPer1KOutput(selectedModel) * weight
    balancedCost += estimateCostPer1KOutput(defaultModel) * weight
  }

  return balancedCost === 0 ? 1 : thisCost / balancedCost
}

function getCostBadgeText(presetKey: PresetKey): string {
  if (presetKey === 'balanced') return 'Recommended'
  const ratio = computeRelativeCost(PRESETS[presetKey])
  if (ratio < 1) {
    const saving = Math.round((1 - ratio) * 100)
    return `~${saving}% cheaper`
  }
  const extra = Math.round((ratio - 1) * 100)
  return `~${extra}% more`
}

/**
 * Determines which preset card should be active, or 'custom' if
 * saved preferences don't match any preset exactly.
 */
function getActivePreset(prefs: ModelPreferences): PresetKey | 'custom' {
  const tiers: UserControllableTier[] = ['fast', 'balanced', 'creative', 'reasoning', 'structured']

  for (const [key, presetPrefs] of Object.entries(PRESETS) as [PresetKey, Partial<ModelPreferences>][]) {
    const isMatch = tiers.every(tier => {
      const presetValue = presetPrefs[tier]
      const savedValue = prefs[tier]
      // Both absent or both equal the same non-default → match
      if (!presetValue && !savedValue) return true
      // Preset has no override → saved should also have none (or the tier's default)
      if (!presetValue && savedValue) {
        return savedValue === getDefaultModelId(tier)
      }
      return presetValue === savedValue
    })
    if (isMatch) return key
  }
  return 'custom'
}

// ── Tier Metadata ────────────────────────────────────────────────────────────

const TIER_META: Record<UserControllableTier, { label: string; description: string }> = {
  fast: {
    label: 'Fast',
    description: 'Language detection, evidence evaluation, bulk operations, quick validations',
  },
  balanced: {
    label: 'Balanced',
    description: 'HTML generation, SEO analysis, structured JSON outputs',
  },
  creative: {
    label: 'Creative',
    description: 'Ad copy, social posts, email content, video scripts, headlines',
  },
  reasoning: {
    label: 'Reasoning',
    description: 'Campaign orchestration, competitor research, compliance review, investor decks',
  },
  structured: {
    label: 'Structured / JSON',
    description: 'SEO analysis, schema extraction, segment analysis — requires reliable JSON output',
  },
}

// Provider badge colors
const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: 'bg-green-600',
  Anthropic: 'bg-purple-600',
  Google: 'bg-blue-600',
  xAI: 'bg-muted',
  Meta: 'bg-blue-800',
  DeepSeek: 'bg-teal-600',
}

// ── ModelCard ────────────────────────────────────────────────────────────────

function ModelCard({
  model,
  isSelected,
  onSelect,
}: {
  model: AvailableModel
  isSelected: boolean
  onSelect: () => void
}) {
  const costPer1K = estimateCostPer1KOutput(model.id)
  const providerColor = PROVIDER_COLORS[model.provider] ?? 'bg-muted'

  return (
    <TooltipProvider>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer',
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-muted-foreground/40 bg-card',
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0',
              providerColor,
            )}
          >
            {model.provider[0]}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-medium text-sm">{model.label}</span>
              {model.isDefault && (
                <Badge variant="secondary" className="text-xs h-4 px-1.5">
                  Default
                </Badge>
              )}
              {model.isPreview && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-xs h-4 px-1.5 border-yellow-500 text-amber-500"
                    >
                      Preview
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    Preview models may have lower rate limits
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{model.provider}</p>
            <p className="text-xs text-muted-foreground mt-1">
              ~${costPer1K.toFixed(4)} / 1K output tokens
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {model.strengths.slice(0, 3).map(s => (
                <span
                  key={s}
                  className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
                >
                  {s}
                </span>
              ))}
            </div>
            {model.note && (
              <p className="text-xs text-muted-foreground/70 italic mt-2">{model.note}</p>
            )}
          </div>

          {isSelected && (
            <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          )}
        </div>
      </button>
    </TooltipProvider>
  )
}

// ── PresetCard ────────────────────────────────────────────────────────────────

function PresetCard({
  presetKey,
  isSelected,
  onSelect,
}: {
  presetKey: PresetKey
  isSelected: boolean
  onSelect: () => void
}) {
  const meta = PRESET_META[presetKey]
  const costText = getCostBadgeText(presetKey)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative w-full text-left p-5 rounded-xl border-2 transition-all cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/40 bg-card',
      )}
    >
      {isSelected && (
        <div className="absolute top-3 right-3">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
        </div>
      )}
      <p className="font-semibold text-base mb-1">{meta.label}</p>
      <p className="text-sm text-muted-foreground">{meta.description}</p>
      <div className="mt-3">
        <Badge
          variant={presetKey === 'balanced' ? 'secondary' : 'outline'}
          className="text-xs"
        >
          {costText}
        </Badge>
      </div>
    </button>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ModelPickerSettingsProps {
  initialPreferences: ModelPreferences
  planId?: PlanId | null
  subscriptionStatus?: string | null
}

export function ModelPickerSettings({
  initialPreferences,
  planId,
  subscriptionStatus,
}: ModelPickerSettingsProps) {
  const { toast } = useToast()
  const [localPrefs, setLocalPrefs] = useState<ModelPreferences>(initialPreferences)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const canUseAdvanced = canUseAdvancedModelPicker(planId ?? undefined, subscriptionStatus ?? undefined)
  const activePreset = getActivePreset(localPrefs)
  const isDirty = JSON.stringify(localPrefs) !== JSON.stringify(initialPreferences)

  // Check if any selected model is a preview model
  const hasPreviewModel = (Object.entries(localPrefs) as [UserControllableTier, string | undefined][])
    .some(([tier, modelId]) => {
      if (!modelId) return false
      return AVAILABLE_MODELS.some(m => m.id === modelId && m.tier === tier && m.isPreview)
    })

  function applyPreset(preset: PresetKey) {
    setLocalPrefs(PRESETS[preset])
  }

  function setTierModel(tier: UserControllableTier, modelId: string) {
    setLocalPrefs(prev => ({ ...prev, [tier]: modelId }))
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const res = await fetch('/api/settings/models', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localPrefs),
      })
      if (res.ok) {
        toast({ title: 'Model preferences saved' })
      } else {
        const err = await res.json() as { error?: string }
        toast({
          title: 'Save failed',
          description: err.error ?? 'Unknown error',
          variant: 'destructive',
        })
        setLocalPrefs(initialPreferences) // Revert on error
      }
    } catch {
      toast({ title: 'Save failed', description: 'Network error', variant: 'destructive' })
      setLocalPrefs(initialPreferences)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleReset() {
    const res = await fetch('/api/settings/models', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      setLocalPrefs({})
      toast({ title: 'Reset to defaults' })
    } else {
      toast({ title: 'Reset failed', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Preview model warning */}
      {hasPreviewModel && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200  dark:border-yellow-900">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            One or more selected models are in preview — they may have lower rate limits
            and could affect generation reliability.
          </p>
        </div>
      )}

      {/* Simple Mode — Preset Cards */}
      <div>
        <h3 className="text-sm font-medium mb-1">Quality profile</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Controls which AI models generate your content. Balanced is the recommended default.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['efficient', 'balanced', 'quality'] as PresetKey[]).map(preset => (
            <PresetCard
              key={preset}
              presetKey={preset}
              isSelected={activePreset === preset}
              onSelect={() => applyPreset(preset)}
            />
          ))}
        </div>

        {/* Custom state — shown when advanced mode diverges from presets */}
        {activePreset === 'custom' && (
          <div className="mt-3 flex items-center justify-between p-4 rounded-lg border border-dashed border-muted-foreground/40">
            <div>
              <p className="text-sm font-medium">Custom configuration</p>
              <p className="text-xs text-muted-foreground">
                Your per-tier model selections don&apos;t match any preset
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(true)}
            >
              <Settings2 className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
        )}
      </div>

      {/* Advanced Mode toggle */}
      {canUseAdvanced && (
        <div className="flex items-center gap-3 py-2 border-t">
          <Switch
            id="advanced-model-control"
            checked={showAdvanced}
            onCheckedChange={setShowAdvanced}
          />
          <Label htmlFor="advanced-model-control" className="cursor-pointer">
            <span className="font-medium">Advanced Model Control</span>
            <span className="text-muted-foreground text-xs ml-2">
              Pick specific models per tier
            </span>
          </Label>
        </div>
      )}

      {/* Advanced Mode — Per-Tier Picker */}
      {showAdvanced && canUseAdvanced && (
        <div className="space-y-6">
          {(['fast', 'balanced', 'creative', 'reasoning', 'structured'] as UserControllableTier[]).map(tier => {
            const meta = TIER_META[tier]
            const models = getModelsForTier(tier)
            const selectedId = localPrefs[tier] ?? getDefaultModelId(tier)

            return (
              <div key={tier}>
                <div className="mb-3">
                  <h4 className="text-sm font-medium">{meta.label}</h4>
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {models.map(model => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      isSelected={model.id === selectedId}
                      onSelect={() => setTierModel(tier, model.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Save/Reset actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <button
          type="button"
          onClick={handleReset}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset to defaults
        </button>
        <Button onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
