'use client'

/**
 * Content Queue Client Component
 */

import { useState } from 'react'

interface QueueItem {
  id: string
  scheduled_for: string | null
  status: string
  asset_documents: {
    id: string
    title: string | null
    asset_type: string
    channel: string | null
    compliance_status: string
    rendered_image_url: string | null
  } | null
}

interface Props {
  items: QueueItem[]
}

type ItemLoadingState = 'approving' | 'publishing' | null

interface PublishResult {
  success: boolean
  status: string
  postId?: string
  postUrl?: string
  error?: string
}

export function ContentQueueClient({ items: initialItems }: Props) {
  const [items, setItems] = useState(initialItems)
  const [loadingStates, setLoadingStates] = useState<Record<string, ItemLoadingState>>({})
  const [errorStates, setErrorStates] = useState<Record<string, string | null>>({})

  const setLoading = (itemId: string, state: ItemLoadingState) => {
    setLoadingStates((prev) => ({ ...prev, [itemId]: state }))
  }

  const setError = (itemId: string, message: string | null) => {
    setErrorStates((prev) => ({ ...prev, [itemId]: message }))
  }

  const handleApprove = async (itemId: string) => {
    setError(itemId, null)
    setLoading(itemId, 'approving')
    try {
      const res = await fetch(`/api/automations/queue/${itemId}/approve`, {
        method: 'POST',
      })
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status: 'approved' } : item
          )
        )
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(itemId, body.error ?? 'Failed to approve item')
      }
    } catch {
      setError(itemId, 'Network error while approving')
    } finally {
      setLoading(itemId, null)
    }
  }

  const handleReject = async (itemId: string) => {
    setError(itemId, null)
    const res = await fetch(`/api/automations/queue/${itemId}/reject`, {
      method: 'POST',
    })
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== itemId))
    }
  }

  const handlePublish = async (itemId: string) => {
    setError(itemId, null)
    setLoading(itemId, 'publishing')
    try {
      const res = await fetch(`/api/automations/queue/${itemId}/publish`, {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as PublishResult & { error?: string }
      if (res.ok && body.success) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status: 'published' } : item
          )
        )
      } else {
        setError(itemId, body.error ?? 'Publish failed')
      }
    } catch {
      setError(itemId, 'Network error while publishing')
    } finally {
      setLoading(itemId, null)
    }
  }

  const handleApproveAndPublish = async (itemId: string) => {
    setError(itemId, null)

    // Step 1: Approve
    setLoading(itemId, 'approving')
    let approveOk = false
    try {
      const res = await fetch(`/api/automations/queue/${itemId}/approve`, {
        method: 'POST',
      })
      if (res.ok) {
        approveOk = true
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status: 'approved' } : item
          )
        )
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(itemId, body.error ?? 'Failed to approve item')
      }
    } catch {
      setError(itemId, 'Network error while approving')
    }

    if (!approveOk) {
      setLoading(itemId, null)
      return
    }

    // Step 2: Publish
    setLoading(itemId, 'publishing')
    try {
      const res = await fetch(`/api/automations/queue/${itemId}/publish`, {
        method: 'POST',
      })
      const body = (await res.json().catch(() => ({}))) as PublishResult & { error?: string }
      if (res.ok && body.success) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, status: 'published' } : item
          )
        )
      } else {
        setError(itemId, body.error ?? 'Publish failed')
      }
    } catch {
      setError(itemId, 'Network error while publishing')
    } finally {
      setLoading(itemId, null)
    }
  }

  const pendingItems = items.filter((i) => i.status === 'pending_review')
  const approvedItems = items.filter((i) => i.status === 'approved')

  return (
    <div className="space-y-8">
      {/* Pending Review */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          Pending Review ({pendingItems.length})
        </h2>
        {pendingItems.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            No content pending review. Automations will generate content based on their schedule.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                loadingState={loadingStates[item.id] ?? null}
                errorMessage={errorStates[item.id] ?? null}
                onApprove={() => handleApprove(item.id)}
                onApproveAndPublish={() => handleApproveAndPublish(item.id)}
                onReject={() => handleReject(item.id)}
                onEdit={() => {
                  if (item.asset_documents) {
                    window.location.href = `/assets/${item.asset_documents.asset_type}/${item.asset_documents.id}`
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Approved */}
      {approvedItems.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">
            Approved ({approvedItems.length})
          </h2>
          <div className="space-y-3">
            {approvedItems.map((item) => (
              <QueueCard
                key={item.id}
                item={item}
                loadingState={loadingStates[item.id] ?? null}
                errorMessage={errorStates[item.id] ?? null}
                approved
                onPublish={() => handlePublish(item.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function QueueCard({
  item,
  loadingState,
  errorMessage,
  onApprove,
  onApproveAndPublish,
  onReject,
  onEdit,
  onPublish,
  approved,
}: {
  item: QueueItem
  loadingState: ItemLoadingState
  errorMessage: string | null
  onApprove?: () => void
  onApproveAndPublish?: () => void
  onReject?: () => void
  onEdit?: () => void
  onPublish?: () => void
  approved?: boolean
}) {
  const asset = item.asset_documents
  const complianceColors: Record<string, string> = {
    clean: 'bg-emerald-900/50 text-emerald-400',
    warning: 'bg-amber-900/50 text-amber-400',
    blocked: 'bg-red-900/50 text-red-400',
  }

  const isLoading = loadingState !== null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 p-4 bg-card/40 backdrop-blur-sm border border-border/50 rounded-xl">
        {/* Preview thumbnail */}
        <div className="w-20 h-14 bg-muted/50 rounded-lg overflow-hidden shrink-0">
          {asset?.rendered_image_url ? (
            <img
              src={asset.rendered_image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/80 text-xs">
              {asset?.asset_type ?? 'asset'}
            </div>
          )}
        </div>

        {/* Content info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {asset?.title ?? 'Untitled'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground uppercase">
              {asset?.asset_type}
            </span>
            {asset?.channel && (
              <span className="text-xs text-muted-foreground/80">{asset.channel}</span>
            )}
            {item.scheduled_for && (
              <span className="text-xs text-muted-foreground">
                {new Date(item.scheduled_for).toLocaleDateString()} at{' '}
                {new Date(item.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {asset?.compliance_status && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${complianceColors[asset.compliance_status] ?? ''}`}>
                {asset.compliance_status}
              </span>
            )}
          </div>
        </div>

        {/* Actions — pending items */}
        {!approved && (
          <div className="flex items-center gap-2 shrink-0">
            {onEdit && (
              <button
                onClick={onEdit}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs bg-muted/50 text-foreground/90 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit
              </button>
            )}
            {onReject && (
              <button
                onClick={onReject}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject
              </button>
            )}
            {onApprove && (
              <button
                onClick={onApprove}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs bg-muted/50 text-emerald-400 border border-emerald-700/50 rounded-lg hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve
              </button>
            )}
            {onApproveAndPublish && (
              <button
                onClick={onApproveAndPublish}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {loadingState === 'approving' && (
                  <span className="inline-block w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {loadingState === 'publishing' && (
                  <span className="inline-block w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {loadingState === 'approving'
                  ? 'Approving…'
                  : loadingState === 'publishing'
                  ? 'Publishing…'
                  : 'Approve & Publish'}
              </button>
            )}
          </div>
        )}

        {/* Actions — approved items */}
        {approved && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded">
              Approved
            </span>
            {onPublish && (
              <button
                onClick={onPublish}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {loadingState === 'publishing' && (
                  <span className="inline-block w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {loadingState === 'publishing' ? 'Publishing…' : 'Publish'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inline error */}
      {errorMessage && (
        <p className="text-xs text-red-400 px-1">{errorMessage}</p>
      )}
    </div>
  )
}
