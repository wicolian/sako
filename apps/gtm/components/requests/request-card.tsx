'use client'

/**
 * Request Card - Display a request in the queue
 */

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Request, RequestStatus, Priority } from '@/lib/requests/request-types'
import {
  FileText,
  Image,
  Mail,
  Presentation,
  Share2,
  MoreHorizontal,
  Clock,
  User,
} from 'lucide-react'

const STATUS_COLORS: Record<RequestStatus, string> = {
  new: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  review: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  approved: 'bg-green-500/10 text-emerald-500 border-green-500/20',
  done: 'bg-muted/100/10 text-muted-foreground border-gray-500/20',
  cancelled: 'bg-red-500/10 text-destructive border-red-500/20',
}

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: 'bg-red-500/10 text-destructive',
  normal: 'bg-muted/100/10 text-muted-foreground',
  low: 'bg-blue-500/10 text-blue-500',
}

const ASSET_ICONS = {
  landing_page: FileText,
  ads: Image,
  emails: Mail,
  deck: Presentation,
  social: Share2,
  other: MoreHorizontal,
}

interface RequestCardProps {
  request: Request
  onClick?: () => void
}

export function RequestCard({ request, onClick }: RequestCardProps) {
  const AssetIcon = ASSET_ICONS[request.assetType] || MoreHorizontal
  
  return (
    <Card 
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <AssetIcon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{request.title}</h3>
              <Badge variant="outline" className={STATUS_COLORS[request.status]}>
                {request.status.replace('_', ' ')}
              </Badge>
              {request.priority !== 'normal' && (
                <Badge variant="outline" className={PRIORITY_COLORS[request.priority]}>
                  {request.priority}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {request.brief.offer || request.brief.context || 'No description'}
            </p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(request.createdAt).toLocaleDateString()}
              </span>
              {request.dueDate && (
                <span className={`flex items-center gap-1 ${
                  new Date(request.dueDate) < new Date() && request.status !== 'done' 
                    ? 'text-red-500' 
                    : ''
                }`}>
                  Due {new Date(request.dueDate).toLocaleDateString()}
                </span>
              )}
              {request.assigneeName && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {request.assigneeName}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
