'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Copy, MoreHorizontal, Trash2, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

interface ApiKeysTableProps {
  keys: ApiKey[]
  onRevoke: (keyId: string) => Promise<void>
}

export function ApiKeysTable({ keys, onRevoke }: ApiKeysTableProps) {
  const { toast } = useToast()
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})

  const handleCopyPrefix = async (prefix: string) => {
    await navigator.clipboard.writeText(prefix + '...')
    toast({ title: 'Copied', description: 'Key prefix copied to clipboard' })
  }

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId)
    try {
      await onRevoke(keyId)
      toast({ title: 'Key revoked', description: 'The API key has been revoked' })
    } catch {
      toast({ title: 'Error', description: 'Failed to revoke key', variant: 'destructive' })
    } finally {
      setRevokingId(null)
    }
  }

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }))
  }

  if (keys.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No API keys created yet.</p>
        <p className="text-xs mt-1">Create one to access the ClaimsOS API.</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Last Used</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {keys.map((key) => (
          <TableRow key={key.id}>
            <TableCell className="font-medium">{key.name}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                  {showKeys[key.id] ? key.key_prefix : key.key_prefix.slice(0, 8) + '•••••••••'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => toggleKeyVisibility(key.id)}
                >
                  {showKeys[key.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopyPrefix(key.key_prefix)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </TableCell>
            <TableCell>
              {key.is_active ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-green-800  ">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">Revoked</Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {key.last_used_at
                ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })
                : 'Never'}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handleRevoke(key.id)}
                    disabled={revokingId === key.id || !key.is_active}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Revoke Key
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
