'use client'

/**
 * Request Detail Page - View and manage a single request
 */

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Loader2,
  Wand2,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  User,
  FileText,
  Image,
  Mail,
  Presentation,
  Share2,
  MoreHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { NotFoundState } from '@/components/ui/error-state'
import type { Request, RequestStatus, FeedbackEntry } from '@/lib/requests/request-types'

const STATUS_COLORS: Record<RequestStatus, string> = {
  new: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  review: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  approved: 'bg-green-500/10 text-emerald-500 border-green-500/20',
  done: 'bg-muted/100/10 text-muted-foreground border-gray-500/20',
  cancelled: 'bg-red-500/10 text-destructive border-red-500/20',
}

const ASSET_ICONS: Record<string, React.ElementType> = {
  landing_page: FileText,
  ads: Image,
  emails: Mail,
  deck: Presentation,
  social: Share2,
  other: MoreHorizontal,
}

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [request, setRequest] = useState<Request | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [comment, setComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)
  
  useEffect(() => {
    fetch(`/api/requests/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.request) {
          setRequest(data.request)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])
  
  const handleStatusChange = async (newStatus: RequestStatus) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await response.json()
      if (data.request) {
        setRequest(data.request)
        toast.success('Status updated')
      }
    } catch (error) {
      toast.error('Failed to update status')
    } finally {
      setUpdating(false)
    }
  }
  
  const handleAddComment = async () => {
    if (!comment.trim()) return
    
    setAddingComment(true)
    try {
      const response = await fetch(`/api/requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment, type: 'comment' }),
      })
      const data = await response.json()
      if (data.request) {
        setRequest(data.request)
        setComment('')
        toast.success('Comment added')
      }
    } catch (error) {
      toast.error('Failed to add comment')
    } finally {
      setAddingComment(false)
    }
  }
  
  const handleGenerateKit = () => {
    // Redirect to kit wizard with request context
    const params = new URLSearchParams({
      source: 'request',
      requestId: id,
      assetType: request?.assetType || '',
      audience: request?.brief.audience || '',
      offer: request?.brief.offer || '',
    })
    router.push(`/kit/new?${params.toString()}`)
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 min-h-screen bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  if (!request) {
    return <NotFoundState resource="request" backHref="/requests" />
  }
  
  const AssetIcon = ASSET_ICONS[request.assetType] || MoreHorizontal
  
  return (
    <div className="container max-w-3xl py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/requests')}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Requests
      </Button>
      
      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <AssetIcon className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">{request.title}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={STATUS_COLORS[request.status]}>
                    {request.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-muted-foreground">•</span>
                  <span>{request.assetType.replace('_', ' ')}</span>
                </CardDescription>
              </div>
            </div>
            
            {/* Status Selector */}
            <Select
              value={request.status}
              onValueChange={(value: RequestStatus) => handleStatusChange(value)}
              disabled={updating}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Brief */}
          {request.brief.audience && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Audience</div>
              <p>{request.brief.audience}</p>
            </div>
          )}
          {request.brief.offer && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Offer</div>
              <p>{request.brief.offer}</p>
            </div>
          )}
          {request.brief.context && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Context</div>
              <p className="whitespace-pre-wrap">{request.brief.context}</p>
            </div>
          )}
          
          {/* Metadata */}
          <div className="flex flex-wrap gap-4 pt-4 border-t text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Created {new Date(request.createdAt).toLocaleDateString()}
            </span>
            {request.dueDate && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Due {new Date(request.dueDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <Button onClick={handleGenerateKit} className="flex-1">
          <Wand2 className="w-4 h-4 mr-2" />
          Generate with AI
        </Button>
        {request.kitId && (
          <Button variant="outline" onClick={() => router.push(`/kit/${request.kitId}`)}>
            View Generated Kit
          </Button>
        )}
      </div>
      
      {/* Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Comments ({request.feedback.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Comment List */}
          {request.feedback.length > 0 ? (
            <div className="space-y-3">
              {request.feedback.map((fb: FeedbackEntry) => (
                <div key={fb.id} className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{fb.userName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(fb.createdAt).toLocaleString()}
                    </span>
                    {fb.type !== 'comment' && (
                      <Badge variant="outline" className="text-xs">
                        {fb.type === 'approval' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {fb.type === 'rejection' && <XCircle className="w-3 h-3 mr-1" />}
                        {fb.type}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{fb.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No comments yet</p>
          )}
          
          {/* Add Comment */}
          <div className="pt-4 border-t">
            <Textarea
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={!comment.trim() || addingComment}
              >
                {addingComment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Add Comment'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
