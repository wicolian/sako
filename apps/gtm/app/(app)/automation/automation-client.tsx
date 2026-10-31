'use client'

/**
 * Automation Dashboard Client Component
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AUTOMATION_PRESETS, type AutomationType } from '@/lib/automation/automation-engine'
import { Play, Pause, Zap, Plus, Clock, Settings, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface AutomationRule {
  id: string
  name: string
  type: string
  schedule: string
  status: string
  last_run_at: string | null
  config: Record<string, unknown>
}

interface Props {
  initialRules: AutomationRule[]
  brands: Array<{ id: string; name: string }>
  workspaceId: string
}

export function AutomationDashboardClient({ initialRules, brands, workspaceId }: Props) {
  const [rules, setRules] = useState(initialRules)
  const [creating, setCreating] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<AutomationType>('daily_linkedin')
  const [selectedBrand, setSelectedBrand] = useState(brands[0]?.id ?? '')

  const handleCreate = async () => {
    if (!selectedBrand) return
    setCreating(true)

    try {
      const res = await fetch('/api/automations/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedPreset,
          brandId: selectedBrand,
        }),
      })

      if (res.ok) {
        const { rule } = await res.json()
        setRules((prev) => [rule, ...prev])
      }
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (ruleId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'

    await fetch(`/api/automations/playbooks/${ruleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, status: newStatus } : r))
    )
  }

  return (
    <div className="space-y-10">
      {/* Create new automation */}
      <Card className="bg-card/40 border-border/50 backdrop-blur-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
        <CardContent className="p-8 relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Create Automation Playbook</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {(Object.entries(AUTOMATION_PRESETS) as [AutomationType, (typeof AUTOMATION_PRESETS)[AutomationType]][]).map(
              ([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setSelectedPreset(key)}
                  className={`p-5 rounded-xl border text-left transition-all ${
                    selectedPreset === key
                      ? 'border-primary bg-primary/5 shadow-[0_0_15px_rgba(132,204,22,0.1)]'
                      : 'border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/30'
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                    {preset.name}
                    {selectedPreset === key && <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{preset.description}</p>
                </button>
              )
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full sm:w-auto flex-1 bg-background text-foreground text-sm px-4 py-2.5 rounded-lg border border-border/50 focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="">Select brand...</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <Button
              onClick={handleCreate}
              disabled={creating || !selectedBrand}
              size="lg"
              className="w-full sm:w-auto shadow-lg shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {creating ? 'Creating...' : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Playbook
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rules list */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5 text-muted-foreground" />
          Active Playbooks
        </h2>
        {rules.length === 0 ? (
          <Card className="border-dashed border-border/50 bg-transparent">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-1">No automations running</p>
              <p className="text-sm text-muted-foreground">Select a preset above to create your first scheduled playbook.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {rules.map((rule, i) => (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={`border-border/50 transition-all ${rule.status === 'active' ? 'bg-card/40 hover:border-primary/50' : 'bg-muted/10 opacity-75'}`}>
                    <CardContent className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${rule.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {rule.status === 'active' ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-base">{rule.name}</h3>
                            <Badge variant={rule.status === 'active' ? 'default' : 'secondary'} className={
                              rule.status === 'active' 
                                ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20' 
                                : 'text-xs uppercase tracking-wider'
                            }>
                              {rule.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {rule.schedule}
                            </span>
                            {rule.last_run_at && (
                              <>
                                <span>•</span>
                                <span>Last run: {new Date(rule.last_run_at).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggle(rule.id, rule.status)}
                        className={`relative w-14 h-7 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background ${
                          rule.status === 'active' ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-card transition-transform ${
                            rule.status === 'active' ? 'translate-x-7' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
