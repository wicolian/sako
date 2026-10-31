'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Mail,
  Share2,
  Image,
  Video,
  Presentation,
  MoreHorizontal,
  ArrowUpDown,
  Edit3,
  Sparkles,
  Copy,
  Trash2,
  CheckCircle2,
  Clock,
  Send,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ProjectAsset } from './infinite-canvas'

interface TableViewProps {
  assets: ProjectAsset[]
  selectedAssetId: string | null
  onAssetSelect: (assetId: string | null) => void
  onAssetEdit: (assetId: string) => void
  onAssetDuplicate: (assetId: string) => void
  onAssetDelete: (assetId: string) => void
  onAssetRegenerate: (assetId: string) => void
}

const ASSET_CONFIG = {
  landing_page: { icon: FileText, label: 'Landing Page', color: 'text-blue-500' },
  email: { icon: Mail, label: 'Email', color: 'text-amber-500' },
  social_post: { icon: Share2, label: 'Social Post', color: 'text-pink-500' },
  ad_creative: { icon: Image, label: 'Ad Creative', color: 'text-purple-500' },
  video_script: { icon: Video, label: 'Video Script', color: 'text-emerald-500' },
  sales_deck: { icon: Presentation, label: 'Sales Deck', color: 'text-indigo-500' },
}

const STATUS_CONFIG = {
  draft: { icon: Edit3, label: 'Draft', variant: 'secondary' as const },
  review: { icon: Clock, label: 'In Review', variant: 'outline' as const },
  approved: { icon: CheckCircle2, label: 'Approved', variant: 'default' as const },
  published: { icon: Send, label: 'Published', variant: 'default' as const },
}

type SortField = 'name' | 'type' | 'status' | 'updated'
type SortDirection = 'asc' | 'desc'

export function TableView({
  assets,
  selectedAssetId,
  onAssetSelect,
  onAssetEdit,
  onAssetDuplicate,
  onAssetDelete,
  onAssetRegenerate,
}: TableViewProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<string | null>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortedAssets = [...assets]
    .filter((asset) => !filterType || asset.type === filterType)
    .sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedAssets.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedAssets.map((a) => a.id)))
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Badge variant="secondary">
              {selectedIds.size} selected
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {filterType ? ASSET_CONFIG[filterType as keyof typeof ASSET_CONFIG]?.label : 'All Types'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterType(null)}>
                All Types
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {Object.entries(ASSET_CONFIG).map(([key, config]) => (
                <DropdownMenuItem key={key} onClick={() => setFilterType(key)}>
                  <config.icon className={cn('h-4 w-4 mr-2', config.color)} />
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => selectedIds.forEach(onAssetRegenerate)}>
              <Sparkles className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => selectedIds.forEach(onAssetDelete)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedIds.size === sortedAssets.length && sortedAssets.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('name')}
                >
                  Name
                  <ArrowUpDown className="h-4 w-4 ml-2" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('type')}
                >
                  Type
                  <ArrowUpDown className="h-4 w-4 ml-2" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('status')}
                >
                  Status
                  <ArrowUpDown className="h-4 w-4 ml-2" />
                </Button>
              </TableHead>
              <TableHead>Content Preview</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAssets.map((asset, index) => {
              const config = ASSET_CONFIG[asset.type]
              const statusConfig = STATUS_CONFIG[asset.status]
              const Icon = config.icon
              const StatusIcon = statusConfig.icon

              return (
                <motion.tr
                  key={asset.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedAssetId === asset.id && 'bg-primary/5',
                    'hover:bg-muted/50'
                  )}
                  onClick={() => onAssetSelect(asset.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(asset.id)}
                      onCheckedChange={() => toggleSelect(asset.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4', config.color)} />
                      <span className="font-medium">{asset.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {config.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig.variant}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground line-clamp-1 max-w-[300px]">
                      {(asset.content?.headline as string) || 'No content yet'}
                    </p>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onAssetEdit(asset.id)}>
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAssetRegenerate(asset.id)}>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Regenerate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAssetDuplicate(asset.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onAssetDelete(asset.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </motion.tr>
              )
            })}
          </TableBody>
        </Table>

        {sortedAssets.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No assets found
          </div>
        )}
      </div>
    </div>
  )
}
