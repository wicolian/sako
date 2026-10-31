'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ChevronRight,
  AlertTriangle,
  Clock,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { ReviewQueueItem } from '@/app/api/review-queue/route'

export default function ReviewsPage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ReviewQueueItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchQueue()
  }, [])

  async function fetchQueue() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/review-queue')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data.items ?? [])
    } catch (err) {
      setError('Failed to load review queue. Please try again.')
      console.error('Review queue fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  async function submitDecision(action: 'approve' | 'reject' | 'request_changes') {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          requestId: selected.requestId,
          comment: comment || undefined,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setDialogOpen(false)
      setSelected(null)
      setComment('')
      fetchQueue()
    } catch (err) {
      console.error('Review submit error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  function openDialog(item: ReviewQueueItem) {
    setSelected(item)
    setComment('')
    setDialogOpen(true)
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            Review Queue
          </h1>
          <p className="text-muted-foreground mt-1">Campaigns awaiting your approval</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {items.length} pending
        </Badge>
      </div>

      {/* Queue */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading review queue...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
              <p className="text-lg font-medium">{error}</p>
              <Button onClick={fetchQueue} className="mt-4">
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-muted-foreground mt-1">No campaigns pending review</p>
              <Button asChild className="mt-4">
                <Link href="/campaigns">View All Campaigns</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.requestId} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{item.campaignStatus}</Badge>
                      <Badge variant="secondary">
                        Stage {item.currentStage.index + 1} of {item.totalStages}:{' '}
                        {item.currentStage.name}
                      </Badge>
                      {item.currentStage.approverRoles.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Users className="w-3 h-3 mr-1" />
                          {item.currentStage.approverRoles.join(', ')}
                        </Badge>
                      )}
                    </div>

                    <p className="text-lg font-medium mb-1">{item.campaignName}</p>

                    {item.currentStage.instructions && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {item.currentStage.instructions}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        {item.currentStage.approvalsReceived} /{' '}
                        {item.currentStage.requiredApprovers} approvals
                      </span>
                      {item.currentStage.escalationHours && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Escalates after {item.currentStage.escalationHours}h
                        </span>
                      )}
                      <span>
                        Submitted {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive hover:bg-red-50"
                      onClick={() => openDialog(item)}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={async () => {
                        setSelected(item)
                        // Inline approve without opening dialog
                        setSubmitting(true)
                        try {
                          const res = await fetch('/api/approvals', {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'approve',
                              requestId: item.requestId,
                            }),
                          })
                          if (res.ok) fetchQueue()
                        } finally {
                          setSubmitting(false)
                          setSelected(null)
                        }
                      }}
                      disabled={submitting && selected?.requestId === item.requestId}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/campaigns/${item.campaignId}`}>
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Reject / Needs Changes Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Campaign</DialogTitle>
            <DialogDescription>
              {selected ? `Reviewing: ${selected.campaignName}` : 'Provide feedback'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label>Comment (optional)</Label>
              <Textarea
                placeholder="Add feedback for the campaign author..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              className="text-amber-500 hover:text-amber-500"
              onClick={() => submitDecision('request_changes')}
              disabled={submitting}
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Needs Changes
            </Button>
            <Button
              variant="destructive"
              onClick={() => submitDecision('reject')}
              disabled={submitting}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
