'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Share2,
  Copy,
  Check,
  Globe,
  Lock,
  Users,
  X,
  UserPlus,
  Loader2,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Permission = 'view' | 'edit' | 'admin'

interface SharedUser {
  id: string
  email: string
  name?: string
  avatar_url?: string
  permission: Permission
}

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
}

export function ShareDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
}: ShareDialogProps) {
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [publicLink, setPublicLink] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePermission, setInvitePermission] = useState<Permission>('view')
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      loadShareSettings()
    }
  }, [open, projectId])

  const loadShareSettings = async () => {
    setLoading(true)
    const supabase = createClient()

    // Get project sharing settings
    const { data: project } = await supabase
      .from('projects')
      .select('is_public, public_link')
      .eq('id', projectId)
      .single() as { data: { is_public?: boolean; public_link?: string } | null }

    if (project) {
      setIsPublic(project.is_public || false)
      setPublicLink(project.public_link || `${window.location.origin}/view/${projectId}`)
    }

    // Get shared users
    type ShareResult = { id: string; permission: string; user: { id: string; email: string; name?: string; avatar_url?: string } }
    const { data: shares } = await supabase
      .from('project_shares')
      .select(`
        id,
        permission,
        user:users(id, email, name, avatar_url)
      `)
      .eq('project_id', projectId) as { data: ShareResult[] | null }

    if (shares) {
      setSharedUsers(shares.map(s => ({
        id: s.id,
        email: s.user?.email || '',
        name: s.user?.name,
        avatar_url: s.user?.avatar_url,
        permission: s.permission as Permission,
      })))
    }

    setLoading(false)
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return

    setInviting(true)
    try {
      const response = await fetch('/api/projects/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          email: inviteEmail.trim(),
          permission: invitePermission,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to invite')
      }

      toast.success(`Invited ${inviteEmail} with ${invitePermission} access`)
      setInviteEmail('')
      loadShareSettings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  const updatePermission = async (shareId: string, permission: Permission) => {
    const supabase = createClient()
    await (supabase as unknown as { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<void> } } })
      .from('project_shares')
      .update({ permission })
      .eq('id', shareId)

    setSharedUsers(prev =>
      prev.map(u => u.id === shareId ? { ...u, permission } : u)
    )
    toast.success('Permission updated')
  }

  const removeUser = async (shareId: string) => {
    const supabase = createClient()
    await supabase
      .from('project_shares')
      .delete()
      .eq('id', shareId)

    setSharedUsers(prev => prev.filter(u => u.id !== shareId))
    toast.success('Access removed')
  }

  const togglePublic = async () => {
    const supabase = createClient()
    const newValue = !isPublic

    await (supabase as unknown as { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<void> } } })
      .from('projects')
      .update({ is_public: newValue })
      .eq('id', projectId)

    setIsPublic(newValue)
    toast.success(newValue ? 'Project is now public' : 'Project is now private')
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(publicLink)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Share "{projectName}"
          </DialogTitle>
          <DialogDescription>
            Invite team members or make the project public.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Invite by email */}
            <div className="space-y-2">
              <Label>Invite people</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Email address"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviting}
                />
                <Select
                  value={invitePermission}
                  onValueChange={(v) => setInvitePermission(v as Permission)}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View</SelectItem>
                    <SelectItem value="edit">Edit</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Shared users */}
            {sharedUsers.length > 0 && (
              <div className="space-y-2">
                <Label>People with access</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {sharedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback>
                            {user.name?.[0] || user.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user.name || user.email}
                          </p>
                          {user.name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.permission}
                          onValueChange={(v) => updatePermission(user.id, v as Permission)}
                        >
                          <SelectTrigger className="h-8 w-20 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">View</SelectItem>
                            <SelectItem value="edit">Edit</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeUser(user.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Public access */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Globe className="h-5 w-5 text-green-500" />
                  ) : (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium">Public access</p>
                    <p className="text-xs text-muted-foreground">
                      {isPublic ? 'Anyone with the link can view' : 'Only invited people can access'}
                    </p>
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={togglePublic} />
              </div>

              {isPublic && (
                <div className="flex gap-2">
                  <Input
                    value={publicLink}
                    readOnly
                    className="text-sm font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
