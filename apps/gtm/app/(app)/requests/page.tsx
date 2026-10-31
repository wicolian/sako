'use client'

/**
 * Requests Page - Request OS Dashboard
 * 
 * Lists all requests with filters, stats, and quick actions.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  Mail,
  Image,
  Presentation,
  Share2,
  MoreHorizontal,
} from 'lucide-react'
import type { Request, RequestStats, RequestStatus, AssetType, Priority } from '@/lib/requests/request-types'

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

const ASSET_ICONS: Record<AssetType, React.ElementType> = {
  landing_page: FileText,
  ads: Image,
  emails: Mail,
  deck: Presentation,
  social: Share2,
  other: MoreHorizontal,
}

export default function RequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<Request[]>([])
  const [stats, setStats] = useState<RequestStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  
  // Fetch requests and stats
  useEffect(() => {
    Promise.all([
      fetch('/api/requests').then(res => res.json()),
      fetch('/api/requests?stats=true').then(res => res.json()),
    ])
      .then(([requestsData, statsData]) => {
        setRequests(requestsData.requests || [])
        setStats(statsData.stats)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])
  
  // Filter requests
  const filteredRequests = requests.filter(req => {
    if (search && !req.title.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    if (statusFilter !== 'all' && req.status !== statusFilter) {
      return false
    }
    return true
  })
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 min-h-screen bg-background text-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  
  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Requests</h1>
          <p className="text-muted-foreground">Manage marketing asset requests</p>
        </div>
        <Button onClick={() => router.push('/requests/new')}>
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byStatus.in_progress || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byStatus.done || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.overdueCount}</div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">No requests found</h3>
            <p className="text-muted-foreground mb-4">
              {search || statusFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first request to get started'}
            </p>
            <Button onClick={() => router.push('/requests/new')}>
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const AssetIcon = ASSET_ICONS[req.assetType]
            return (
              <Card 
                key={req.id} 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => router.push(`/requests/${req.id}`)}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <AssetIcon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{req.title}</h3>
                        <Badge variant="outline" className={STATUS_COLORS[req.status]}>
                          {req.status.replace('_', ' ')}
                        </Badge>
                        {req.priority !== 'normal' && (
                          <Badge variant="outline" className={PRIORITY_COLORS[req.priority]}>
                            {req.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {req.brief.offer || 'No description'}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Created {new Date(req.createdAt).toLocaleDateString()}</span>
                        {req.dueDate && (
                          <span className={new Date(req.dueDate) < new Date() && req.status !== 'done' ? 'text-red-500' : ''}>
                            Due {new Date(req.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        {req.feedback.length > 0 && (
                          <span>{req.feedback.length} comments</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
