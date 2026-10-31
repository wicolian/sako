'use client'

import { useEffect, useState } from 'react'
import { 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Loader2, 
  Save, 
  TrendingUp,
  XCircle,
  Info
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'

interface BudgetStatus {
  currentSpend: number
  hardCap: number | null
  percentUsed: number | null
  remaining: number | null
  isBlocked: boolean
  alertLevel: 'normal' | 'warning' | 'critical' | 'exceeded'
  forecast: {
    endOfMonthEstimate: number
    willExceed: boolean
    daysUntilExceeded: number | null
  }
}

interface BudgetConfig {
  monthlyHardCapCents: number | null
  alertThresholds: number[]
  notifyEmails: string[]
  autoTopUp: boolean
  autoTopUpAmount: number
}

interface BudgetData {
  status: BudgetStatus
  config: BudgetConfig
  alerts: Array<{
    id: string
    threshold_percent: number
    current_spend: number
    triggered_at: string
  }>
  canManage: boolean
}

export function BudgetManager() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<BudgetData | null>(null)
  
  // Form state
  const [hardCapDollars, setHardCapDollars] = useState<string>('')
  const [notifyEmails, setNotifyEmails] = useState<string>('')
  const [enableHardCap, setEnableHardCap] = useState(false)

  useEffect(() => {
    loadBudget()
  }, [])

  const loadBudget = async () => {
    try {
      const res = await fetch('/api/budget')
      if (res.ok) {
        const budgetData = await res.json()
        setData(budgetData)
        
        // Initialize form state
        if (budgetData.config.monthlyHardCapCents !== null) {
          setEnableHardCap(true)
          setHardCapDollars((budgetData.config.monthlyHardCapCents / 100).toString())
        }
        setNotifyEmails(budgetData.config.notifyEmails.join(', '))
      }
    } catch (error) {
      console.error('Failed to load budget:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveBudget = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/budget', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthlyHardCapDollars: enableHardCap ? parseFloat(hardCapDollars) || null : null,
          notifyEmails: notifyEmails.split(',').map(e => e.trim()).filter(Boolean),
        }),
      })
      
      if (res.ok) {
        const result = await res.json()
        setData(d => d ? { ...d, status: result.status, config: result.config } : null)
        toast({ title: 'Budget settings saved' })
      } else {
        const error = await res.json()
        toast({ title: 'Error', description: error.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Failed to load budget data</p>
        </CardContent>
      </Card>
    )
  }

  const { status, config, canManage } = data
  
  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`
  
  const getAlertColor = (level: BudgetStatus['alertLevel']) => {
    switch (level) {
      case 'exceeded': return 'text-destructive'
      case 'critical': return 'text-red-500'
      case 'warning': return 'text-amber-500'
      default: return 'text-emerald-500'
    }
  }

  const getAlertBadge = (level: BudgetStatus['alertLevel']) => {
    switch (level) {
      case 'exceeded': return <Badge variant="destructive">Budget Exceeded</Badge>
      case 'critical': return <Badge className="bg-red-500">Critical</Badge>
      case 'warning': return <Badge className="bg-amber-500">Warning</Badge>
      default: return <Badge className="bg-emerald-500">Normal</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            Budget Management
          </CardTitle>
          <CardDescription>
            Control AI spending with hard caps and alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Alert Banner if exceeded or critical */}
          {status.alertLevel === 'exceeded' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Budget Exceeded</AlertTitle>
              <AlertDescription>
                Your workspace has exceeded its monthly budget limit. AI operations are blocked until the limit is increased or the month resets.
              </AlertDescription>
            </Alert>
          )}
          
          {status.alertLevel === 'critical' && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Approaching Limit</AlertTitle>
              <AlertDescription>
                You&apos;ve used {status.percentUsed?.toFixed(0)}% of your monthly budget. Consider increasing your limit.
              </AlertDescription>
            </Alert>
          )}

          {/* Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Current Spend</p>
              <p className="text-2xl font-bold">{formatCents(status.currentSpend)}</p>
            </div>
            
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Budget Limit</p>
              <p className="text-2xl font-bold">
                {status.hardCap !== null ? formatCents(status.hardCap) : 'Unlimited'}
              </p>
            </div>
            
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className={`text-2xl font-bold ${getAlertColor(status.alertLevel)}`}>
                {status.remaining !== null ? formatCents(status.remaining) : '—'}
              </p>
            </div>
            
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1">{getAlertBadge(status.alertLevel)}</div>
            </div>
          </div>

          {/* Progress Bar */}
          {status.percentUsed !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Budget Usage</span>
                <span className={getAlertColor(status.alertLevel)}>
                  {status.percentUsed.toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={Math.min(status.percentUsed, 100)} 
                className={status.alertLevel === 'exceeded' ? '[&>div]:bg-destructive' : ''}
              />
            </div>
          )}

          {/* Forecast */}
          {status.forecast && status.hardCap !== null && (
            <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg">
              <TrendingUp className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">End of Month Forecast</p>
                <p className="text-sm text-muted-foreground">
                  Based on current usage, you&apos;re projected to spend{' '}
                  <span className="font-medium">{formatCents(status.forecast.endOfMonthEstimate)}</span> this month.
                  {status.forecast.willExceed && (
                    <span className="text-amber-500">
                      {' '}This exceeds your budget by {formatCents(status.forecast.endOfMonthEstimate - status.hardCap!)}.
                    </span>
                  )}
                  {status.forecast.daysUntilExceeded !== null && status.forecast.daysUntilExceeded > 0 && (
                    <span className="text-muted-foreground">
                      {' '}At current rate, you&apos;ll hit your limit in ~{status.forecast.daysUntilExceeded} days.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Budget Configuration */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable Hard Cap */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-hard-cap">Enable Budget Hard Cap</Label>
                <p className="text-sm text-muted-foreground">
                  Block AI operations when budget is exceeded
                </p>
              </div>
              <Switch
                id="enable-hard-cap"
                checked={enableHardCap}
                onCheckedChange={setEnableHardCap}
              />
            </div>

            {/* Hard Cap Amount */}
            {enableHardCap && (
              <div className="space-y-2">
                <Label htmlFor="hard-cap">Monthly Budget Limit ($)</Label>
                <Input
                  id="hard-cap"
                  type="number"
                  min="0"
                  step="10"
                  placeholder="e.g., 500"
                  value={hardCapDollars}
                  onChange={(e) => setHardCapDollars(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  AI operations will be blocked when this limit is reached
                </p>
              </div>
            )}

            {/* Notification Emails */}
            <div className="space-y-2">
              <Label htmlFor="notify-emails">Alert Notification Emails</Label>
              <Input
                id="notify-emails"
                type="text"
                placeholder="email1@example.com, email2@example.com"
                value={notifyEmails}
                onChange={(e) => setNotifyEmails(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of emails to notify at 50%, 80%, 90%, 100% of budget
              </p>
            </div>

            {/* Info about thresholds */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Alerts are sent automatically when usage reaches 50%, 80%, 90%, and 100% of your budget limit.
              </AlertDescription>
            </Alert>

            <Button onClick={saveBudget} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Budget Settings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
