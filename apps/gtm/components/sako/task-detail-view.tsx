'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface TaskDetailViewProps {
  taskId: string
  operatorMode?: boolean
}

type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'review' | 'completed' | 'cancelled'

interface SakoTaskResponse {
  task?: {
    id: string
    status: TaskStatus
    priority: string
    title: string
    brief: string
    assignedTo?: string
    estimatedDelivery?: string
    deliverables?: Array<{ type: string; url: string }>
    createdAt: string
    updatedAt: string
  }
  error?: string
}

interface SnapshotResponse {
  taskId: string
  source: 'task_composer_snapshots' | 'composer_snapshots'
  snapshotId?: string
  versionLabel?: string
  assetType?: string
  createdAt?: string
  html?: string
  metadata?: Record<string, unknown>
  renderUrl: string
}

const STATUS_OPTIONS: TaskStatus[] = ['assigned', 'in_progress', 'review', 'completed', 'cancelled']

export function TaskDetailView({ taskId, operatorMode = false }: TaskDetailViewProps) {
  const [task, setTask] = useState<SakoTaskResponse['task']>()
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [taskRes, snapshotRes] = await Promise.all([
        fetch(`/api/sako/tasks/${taskId}`),
        fetch(`/api/tasks/${taskId}/composer-snapshot`),
      ])

      const taskData = (await taskRes.json()) as SakoTaskResponse
      if (!taskRes.ok) {
        throw new Error(taskData.error || 'Failed to load task')
      }

      setTask(taskData.task)

      if (snapshotRes.ok) {
        const snapshotData = (await snapshotRes.json()) as SnapshotResponse
        setSnapshot(snapshotData)
      } else {
        setSnapshot(null)
      }
    } catch (error) {
      console.error('Failed to load Sako task detail:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load task')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    load()
  }, [load])

  const handleTransition = useCallback(
    async (nextStatus: TaskStatus) => {
      if (!operatorMode) return

      setUpdating(true)
      try {
        const response = await fetch(`/api/sako/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: nextStatus,
            notes: notes.trim() || undefined,
            revisionRequested: nextStatus === 'review',
          }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to transition task')
        }

        setTask(data.task)
        toast.success(`Task moved to ${nextStatus.replace('_', ' ')}`)
      } catch (error) {
        console.error('Failed to transition task:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to transition task')
      } finally {
        setUpdating(false)
      }
    },
    [operatorMode, taskId, notes]
  )

  const handleClientReview = useCallback(
    async (outcome: 'accepted' | 'rejected') => {
      if (operatorMode) return

      setUpdating(true)
      try {
        const response = await fetch(`/api/sako/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outcome,
            notes: notes.trim() || undefined,
            revisionRequested: outcome === 'rejected',
          }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit review')
        }

        setTask(data.task)
        toast.success(outcome === 'accepted' ? 'Approved and completed' : 'Revision requested')
      } catch (error) {
        console.error('Failed to submit client review:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to submit review')
      } finally {
        setUpdating(false)
      }
    },
    [operatorMode, taskId, notes]
  )

  const snapshotDownloadName = useMemo(() => {
    if (!snapshot?.snapshotId) return `composer-snapshot-${taskId}.html`
    return `composer-snapshot-${snapshot.snapshotId}.html`
  }, [snapshot?.snapshotId, taskId])

  const downloadSnapshot = useCallback(() => {
    if (!snapshot?.html) {
      toast.error('Snapshot content unavailable')
      return
    }

    const blob = new Blob([snapshot.html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = snapshotDownloadName
    link.click()
    URL.revokeObjectURL(url)
  }, [snapshot?.html, snapshotDownloadName])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="container max-w-4xl py-8">
        <p className="text-muted-foreground">Task not found.</p>
      </div>
    )
  }

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href={operatorMode ? '/studio/tasks' : '/sako/tasks'}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tasks
          </Link>
        </Button>

        <Badge variant="outline" className="capitalize">
          {task.status.replace('_', ' ')}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{task.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">{task.brief}</div>
          <div className="text-xs text-muted-foreground">
            Created {new Date(task.createdAt).toLocaleString()}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Composer Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Generated in Composer
                  {snapshot.versionLabel ? ` (${snapshot.versionLabel})` : ''}
                </span>
                {snapshot.createdAt && <span>• {new Date(snapshot.createdAt).toLocaleString()}</span>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadSnapshot}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Snapshot
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={snapshot.renderUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Preview
                  </a>
                </Button>
              </div>
              <iframe
                title="Composer Snapshot Preview"
                src={snapshot.renderUrl}
                className="w-full h-[520px] rounded-md border"
                sandbox=""
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No snapshot available for this task.</p>
          )}
        </CardContent>
      </Card>

      {operatorMode && (
        <Card>
          <CardHeader>
            <CardTitle>Studio Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="transition-notes">Transition Notes</Label>
              <Textarea
                id="transition-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional operator note"
                rows={3}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => (
                <Button
                  key={status}
                  variant={task.status === status ? 'default' : 'outline'}
                  disabled={updating}
                  onClick={() => handleTransition(status)}
                >
                  {status.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!operatorMode && (
        <Card>
          <CardHeader>
            <CardTitle>Client Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="client-review-notes">Review Notes</Label>
              <Textarea
                id="client-review-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional approval/revision notes"
                rows={3}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={updating} onClick={() => handleClientReview('accepted')}>
                Approve and Complete
              </Button>
              <Button
                variant="outline"
                disabled={updating}
                onClick={() => handleClientReview('rejected')}
              >
                Request Revision
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
