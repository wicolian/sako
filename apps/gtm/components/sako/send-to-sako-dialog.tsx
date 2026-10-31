'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Users, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  FileText,
  Copy,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface SendToSakoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
  campaignName: string
  currentVersion?: number
}

type Priority = 'low' | 'normal' | 'high' | 'urgent'
type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'review' | 'completed' | 'cancelled'
type EscalationState = 'form' | 'submitting' | 'success' | 'error' | 'permission_denied'
type CampaignVersion = {
  id: string
  version_number: number
  version_tag?: string | null
  is_current?: boolean
  created_at: string
}

interface EscalationResult {
  success: boolean
  sendId?: string
  taskId?: string
  escalationId?: string
  snapshotId?: string
  taskUrlClient?: string
  taskUrlStudio?: string
  estimatedDelivery?: string
  status?: string
  message?: string
  isDuplicate?: boolean
}

interface TaskStatusResponse {
  task?: {
    id: string
    status: TaskStatus
    priority: string
    title: string
    assignedTo?: string
    estimatedDelivery?: string
    deliverables?: Array<{ name: string; url: string; type: string }>
    createdAt: string
    updatedAt: string
  }
}

const priorityInfo = {
  low: {
    label: 'Low',
    time: '5 business days',
    color: 'bg-slate-100 text-slate-800 border-border/50',
    description: 'Lower priority queue',
  },
  normal: { 
    label: 'Normal', 
    time: '2-3 business days', 
    color: 'bg-blue-500/10 text-blue-800 border-blue-200',
    description: 'Standard turnaround time'
  },
  high: { 
    label: 'High', 
    time: '1 business day', 
    color: 'bg-amber-500/10 text-amber-800 border-amber-200',
    description: 'Faster turnaround'
  },
  urgent: { 
    label: 'Urgent', 
    time: 'Same day', 
    color: 'bg-destructive/10 text-red-800 border-red-200',
    description: 'Priority handling'
  },
}

export function SendToSakoDialog({ 
  open, 
  onOpenChange, 
  campaignId, 
  campaignName,
  currentVersion = 1 
}: SendToSakoDialogProps) {
  const { toast } = useToast()
  const [priority, setPriority] = useState<Priority>('normal')
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [state, setState] = useState<EscalationState>('form')
  const [result, setResult] = useState<EscalationResult | null>(null)
  const [taskStatus, setTaskStatus] = useState<TaskStatusResponse | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [copied, setCopied] = useState(false)
  const [versions, setVersions] = useState<CampaignVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string>('')
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number>(currentVersion)
  const idempotencyKeysByVersion = useRef<Record<string, string>>({})

  const getVersionKey = useCallback(() => {
    const versionKey = selectedVersionId || `v${selectedVersionNumber}`
    if (!idempotencyKeysByVersion.current[versionKey]) {
      idempotencyKeysByVersion.current[versionKey] = `${campaignId}:${versionKey}`
    }
    return idempotencyKeysByVersion.current[versionKey]
  }, [campaignId, selectedVersionId, selectedVersionNumber])

  // Clean up polling on unmount or close
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
    }
  }, [pollingInterval])

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setState('form')
      setResult(null)
      setTaskStatus(null)
      setReason('')
      setNotes('')
      setPriority('normal')
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const fetchVersions = async () => {
      try {
        const response = await fetch(`/api/versions?campaignId=${campaignId}`)
        if (!response.ok) throw new Error('Failed to load versions')
        const data = await response.json()
        const availableVersions = (data.versions || []) as CampaignVersion[]
        setVersions(availableVersions)

        const defaultVersion =
          availableVersions.find((version) => version.is_current) || availableVersions[0]

        if (defaultVersion) {
          setSelectedVersionId(defaultVersion.id)
          setSelectedVersionNumber(defaultVersion.version_number)
        } else {
          setSelectedVersionId('')
          setSelectedVersionNumber(currentVersion)
        }
      } catch (error) {
        console.error('Failed to fetch campaign versions:', error)
        setVersions([])
        setSelectedVersionId('')
        setSelectedVersionNumber(currentVersion)
      }
    }

    fetchVersions()
  }, [open, campaignId, currentVersion])

  const handleSubmit = useCallback(async () => {
    if (!reason.trim()) {
      toast({
        title: 'Reason required',
        description: 'Please describe what you\'d like the designers to improve.',
        variant: 'destructive',
      })
      return
    }

    const idempotencyKey = getVersionKey()
    setState('submitting')

    try {
      const response = await fetch('/api/sako/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          reason: reason.trim(),
          priority,
          additionalNotes: notes.trim(),
          idempotencyKey,
          versionId: selectedVersionId || undefined,
          versionLabel: `v${selectedVersionNumber}`,
        }),
      })

      const data: EscalationResult = await response.json()

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 403) {
          setState('permission_denied')
          setResult(data)
        } else {
          setState('error')
          setResult(data)
        }
        return
      }

      setResult(data)
      setState('success')

      if (data.isDuplicate) {
        toast({
          title: 'Already sent',
          description: 'This campaign version has already been sent to Sako.',
        })
      } else {
        toast({
          title: 'Sent to Sako!',
          description: 'Your request has been submitted to the design team.',
        })
      }

      // Start polling for status updates if we have a task ID
      if (data.taskId) {
        startPolling(data.taskId)
      }
    } catch (error) {
      console.error('Escalation failed:', error)
      setState('error')
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send to Sako',
      })
    }
  }, [
    campaignId,
    reason,
    priority,
    notes,
    selectedVersionId,
    selectedVersionNumber,
    getVersionKey,
    toast,
  ])

  const startPolling = useCallback((taskId: string) => {
    // Initial fetch
    fetchTaskStatus(taskId)

    // Set up polling every 10 seconds
    const interval = setInterval(() => {
      fetchTaskStatus(taskId)
    }, 10000)

    setPollingInterval(interval)
  }, [])

  const fetchTaskStatus = async (taskId: string) => {
    try {
      const response = await fetch(`/api/sako/status?taskId=${taskId}`)
      if (response.ok) {
        const data: TaskStatusResponse = await response.json()
        setTaskStatus(data)

        // Stop polling if task is in a final state
        if (data.task?.status === 'completed' || data.task?.status === 'cancelled') {
          if (pollingInterval) {
            clearInterval(pollingInterval)
            setPollingInterval(null)
          }
        }
      }
    } catch (error) {
      console.error('Status fetch error:', error)
    }
  }

  const handleClose = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
    onOpenChange(false)
  }

  const handleRetry = () => {
    setState('form')
    setResult(null)
  }

  const copyTaskId = () => {
    if (result?.taskId) {
      navigator.clipboard.writeText(result.taskId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const renderStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-muted-foreground" />
      case 'assigned':
        return <Users className="w-5 h-5 text-blue-500" />
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      case 'review':
        return <AlertCircle className="w-5 h-5 text-amber-500" />
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'cancelled':
        return <ShieldAlert className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5" />
    }
  }

  const renderStatusBadge = (status: TaskStatus) => {
    const styles = {
      pending: 'bg-slate-100 text-slate-800 border-border/50',
      assigned: 'bg-blue-500/10 text-blue-800 border-blue-200',
      in_progress: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      review: 'bg-amber-500/10 text-amber-800 border-amber-200',
      completed: 'bg-emerald-500/10 text-green-800 border-emerald-500/20',
      cancelled: 'bg-destructive/10 text-red-800 border-red-200',
    }

    return (
      <Badge className={cn(styles[status], 'border capitalize')}>
        {status.replace('_', ' ')}
      </Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Send to Sako Designers
          </DialogTitle>
          <DialogDescription>
            Get professional designers to finesse your campaign. Available with Max plan or higher.
          </DialogDescription>
        </DialogHeader>

        {state === 'form' && (
          <div className="space-y-5">
            {/* Campaign Info */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{campaignName}</span>
                <Badge variant="secondary" className="ml-auto">
                  v{selectedVersionNumber}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Version to Send</Label>
              <Select
                value={selectedVersionId || `fallback-v${selectedVersionNumber}`}
                onValueChange={(value) => {
                  if (value.startsWith('fallback-v')) {
                    setSelectedVersionId('')
                    setSelectedVersionNumber(currentVersion)
                    return
                  }

                  const selected = versions.find((version) => version.id === value)
                  setSelectedVersionId(value)
                  if (selected) {
                    setSelectedVersionNumber(selected.version_number)
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {versions.length > 0 ? (
                    versions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        v{version.version_number}
                        {version.version_tag ? ` • ${version.version_tag}` : ''}
                        {version.is_current ? ' • Current' : ''}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={`fallback-v${currentVersion}`}>
                      v{currentVersion} • Current
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Selection */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priorityInfo).map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2">
                          <Badge className={info.color} variant="secondary">
                            {info.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{info.time}</span>
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {info.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {priorityInfo[priority].description} • {priorityInfo[priority].time}
              </p>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">What would you like us to improve? *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., The headlines feel too generic. I want something more punchy that resonates with our target audience."
                className="min-h-[100px]"
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any brand guidelines, specific preferences, or reference examples..."
                className="min-h-[80px]"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!reason.trim()}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                Send to Sako
              </Button>
            </DialogFooter>
          </div>
        )}

        {state === 'submitting' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <div className="text-center space-y-1">
              <p className="font-medium">Sending to Sako...</p>
              <p className="text-sm text-muted-foreground">
                Creating task and saving snapshot
              </p>
            </div>
          </div>
        )}

        {state === 'success' && result && (
          <div className="space-y-5">
            {/* Success Header */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10  flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 " />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {result.isDuplicate ? 'Already Sent!' : 'Sent to Sako!'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {result.isDuplicate 
                    ? 'This version has already been submitted.'
                    : 'Your request is now in the design queue.'
                  }
                </p>
              </div>
            </div>

            {/* Task Details */}
            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Task ID</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background px-2 py-1 rounded">
                    {result.taskId}
                  </code>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={copyTaskId}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              {result.estimatedDelivery && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated Delivery</span>
                  <span className="text-sm font-medium">
                    {new Date(result.estimatedDelivery).toLocaleDateString()}
                  </span>
                </div>
              )}

              {taskStatus?.task && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <div className="flex items-center gap-2">
                    {renderStatusIcon(taskStatus.task.status)}
                    {renderStatusBadge(taskStatus.task.status)}
                  </div>
                </div>
              )}

              {taskStatus?.task?.assignedTo && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Assigned To</span>
                  <span className="text-sm font-medium">{taskStatus.task.assignedTo}</span>
                </div>
              )}
            </div>

            {(result.taskUrlClient || result.taskUrlStudio) && (
              <div className="grid grid-cols-1 gap-2">
                {result.taskUrlClient && (
                  <Button asChild variant="outline">
                    <a href={result.taskUrlClient} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Task (Client)
                    </a>
                  </Button>
                )}
                {result.taskUrlStudio && (
                  <Button asChild variant="outline">
                    <a href={result.taskUrlStudio} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Task (Studio)
                    </a>
                  </Button>
                )}
              </div>
            )}

            {/* Live Status */}
            {taskStatus?.task && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Live Status</Label>
                  {pollingInterval && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Updating...
                    </div>
                  )}
                </div>

                {/* Deliverables */}
                {taskStatus.task.deliverables && taskStatus.task.deliverables.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Deliverables</span>
                    {taskStatus.task.deliverables.map((deliverable, i) => (
                      <a
                        key={i}
                        href={deliverable.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-2 bg-green-50  rounded-lg hover:bg-emerald-500/10 dark:hover:bg-green-900/30 transition-colors"
                      >
                        <span className="text-sm font-medium">{deliverable.name}</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-destructive/10  flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive " />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Something went wrong</h3>
                <p className="text-sm text-muted-foreground">
                  {result?.message || 'Failed to send to Sako. Please try again.'}
                </p>
              </div>
            </div>

            <Alert variant="destructive">
              <AlertDescription>
                You can safely retry without creating duplicates. The request is idempotent.
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleRetry} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Try Again
              </Button>
            </DialogFooter>
          </div>
        )}

        {state === 'permission_denied' && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-amber-500/10  flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-amber-500 " />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Upgrade Required</h3>
                <p className="text-sm text-muted-foreground">
                  {result?.message || 'Sako escalation requires a Max plan or higher.'}
                </p>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                The Max plan includes access to our professional design team, 
                priority support, and advanced features.
              </AlertDescription>
            </Alert>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose}>
                Maybe Later
              </Button>
              <Button onClick={() => window.open('/settings/billing', '_blank')}>
                View Plans
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
