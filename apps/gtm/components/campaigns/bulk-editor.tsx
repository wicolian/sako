'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MoreVertical,
  Trash2,
  Copy,
  Edit2,
  Download,
  Check,
  X,
  ChevronDown,
  Search,
  Filter,
  ArrowUpDown,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Asset {
  id: string
  name: string
  type: 'ad' | 'email' | 'social' | 'landing'
  status: 'draft' | 'review' | 'approved' | 'published'
  headline?: string
  body?: string
  cta?: string
  platform?: string
  created_at: string
  updated_at: string
}

interface BulkEditorProps {
  assets: Asset[]
  onUpdate: (ids: string[], updates: Partial<Asset>) => Promise<void>
  onDelete: (ids: string[]) => Promise<void>
  onDuplicate: (ids: string[]) => Promise<void>
  onExport: (ids: string[]) => Promise<void>
  onRegenerate: (ids: string[]) => Promise<void>
}

type SortField = 'name' | 'type' | 'status' | 'updated_at'
type SortOrder = 'asc' | 'desc'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-muted/100' },
  { value: 'review', label: 'In Review', color: 'bg-amber-500' },
  { value: 'approved', label: 'Approved', color: 'bg-green-500' },
  { value: 'published', label: 'Published', color: 'bg-blue-500' },
]

export function BulkEditor({
  assets,
  onUpdate,
  onDelete,
  onDuplicate,
  onExport,
  onRegenerate,
}: BulkEditorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('updated_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [isProcessing, setIsProcessing] = useState(false)

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let filtered = assets.filter(asset => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (
          !asset.name.toLowerCase().includes(query) &&
          !asset.headline?.toLowerCase().includes(query) &&
          !asset.body?.toLowerCase().includes(query)
        ) {
          return false
        }
      }
      if (statusFilter !== 'all' && asset.status !== statusFilter) return false
      if (typeFilter !== 'all' && asset.type !== typeFilter) return false
      return true
    })

    // Sort
    filtered.sort((a, b) => {
      let aVal: string | number = a[sortField] as string
      let bVal: string | number = b[sortField] as string
      
      if (sortField === 'updated_at') {
        aVal = new Date(aVal as string).getTime()
        bVal = new Date(bVal as string).getTime()
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [assets, searchQuery, statusFilter, typeFilter, sortField, sortOrder])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredAssets.map(a => a.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const startEditing = (id: string, field: string, currentValue: string) => {
    setEditingCell({ id, field })
    setEditValue(currentValue || '')
  }

  const saveEdit = async () => {
    if (!editingCell) return

    setIsProcessing(true)
    try {
      await onUpdate([editingCell.id], { [editingCell.field]: editValue })
      toast.success('Updated')
    } catch (error) {
      toast.error('Failed to update')
    } finally {
      setIsProcessing(false)
      setEditingCell(null)
    }
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const handleBulkStatusChange = async (status: string) => {
    if (selectedIds.size === 0) return

    setIsProcessing(true)
    try {
      await onUpdate(Array.from(selectedIds), { status: status as Asset['status'] })
      toast.success(`Updated ${selectedIds.size} assets`)
    } catch (error) {
      toast.error('Failed to update')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} assets?`)) return

    setIsProcessing(true)
    try {
      await onDelete(Array.from(selectedIds))
      setSelectedIds(new Set())
      toast.success(`Deleted ${selectedIds.size} assets`)
    } catch (error) {
      toast.error('Failed to delete')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkDuplicate = async () => {
    if (selectedIds.size === 0) return

    setIsProcessing(true)
    try {
      await onDuplicate(Array.from(selectedIds))
      toast.success(`Duplicated ${selectedIds.size} assets`)
    } catch (error) {
      toast.error('Failed to duplicate')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedIds.size === 0) return

    setIsProcessing(true)
    try {
      await onExport(Array.from(selectedIds))
      toast.success('Export started')
    } catch (error) {
      toast.error('Failed to export')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBulkRegenerate = async () => {
    if (selectedIds.size === 0) return

    setIsProcessing(true)
    try {
      await onRegenerate(Array.from(selectedIds))
      toast.success('Regenerating assets...')
    } catch (error) {
      toast.error('Failed to regenerate')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map(status => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="ad">Ad</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="landing">Landing Page</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-2"
            >
              <Badge variant="secondary">
                {selectedIds.size} selected
              </Badge>

              <Select onValueChange={handleBulkStatusChange}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Set status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkRegenerate}
                disabled={isProcessing}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Regenerate
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDuplicate}
                disabled={isProcessing}
              >
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkExport}
                disabled={isProcessing}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isProcessing}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === filteredAssets.length && filteredAssets.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>
                <div className="flex items-center gap-1">
                  Name
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('type')}>
                <div className="flex items-center gap-1">
                  Type
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead>Headline</TableHead>
              <TableHead>Body (Preview)</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort('status')}>
                <div className="flex items-center gap-1">
                  Status
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No assets found
                </TableCell>
              </TableRow>
            ) : (
              filteredAssets.map(asset => (
                <TableRow
                  key={asset.id}
                  className={cn(selectedIds.has(asset.id) && 'bg-primary/5')}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(asset.id)}
                      onCheckedChange={() => toggleSelect(asset.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {asset.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {editingCell?.id === asset.id && editingCell.field === 'headline' ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit()
                            if (e.key === 'Escape') cancelEdit()
                          }}
                        />
                        <Button size="icon" className="h-8 w-8" onClick={saveEdit}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="cursor-pointer hover:bg-muted px-2 py-1 rounded"
                        onDoubleClick={() => startEditing(asset.id, 'headline', asset.headline || '')}
                      >
                        {asset.headline || '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48">
                    <span className="truncate block text-muted-foreground text-sm">
                      {asset.body?.slice(0, 50) || '-'}
                      {(asset.body?.length || 0) > 50 && '...'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {editingCell?.id === asset.id && editingCell.field === 'status' ? (
                      <Select
                        value={editValue}
                        onValueChange={(v) => {
                          setEditValue(v)
                          onUpdate([asset.id], { status: v as Asset['status'] })
                          setEditingCell(null)
                        }}
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        className={cn(
                          'cursor-pointer',
                          STATUS_OPTIONS.find(s => s.value === asset.status)?.color,
                          'text-white'
                        )}
                        onClick={() => startEditing(asset.id, 'status', asset.status)}
                      >
                        {STATUS_OPTIONS.find(s => s.value === asset.status)?.label}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEditing(asset.id, 'headline', asset.headline || '')}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate([asset.id])}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRegenerate([asset.id])}>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Regenerate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDelete([asset.id])}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredAssets.length} of {assets.length} assets
        </span>
        <span>
          Double-click cells to edit
        </span>
      </div>
    </div>
  )
}
