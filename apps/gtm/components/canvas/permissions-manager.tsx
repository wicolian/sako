'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Shield,
  Eye,
  Pencil,
  Crown,
  Lock,
  Unlock,
  Users,
  FileText,
  MessageSquare,
  Settings,
  Download,
  Upload,
  Trash2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Role = 'viewer' | 'editor' | 'admin' | 'owner'

interface Permission {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  roles: Role[]
}

const PERMISSIONS: Permission[] = [
  {
    id: 'view',
    name: 'View content',
    description: 'View all project content and assets',
    icon: <Eye className="h-4 w-4" />,
    roles: ['viewer', 'editor', 'admin', 'owner'],
  },
  {
    id: 'edit',
    name: 'Edit content',
    description: 'Create and edit campaigns, assets, and messages',
    icon: <Pencil className="h-4 w-4" />,
    roles: ['editor', 'admin', 'owner'],
  },
  {
    id: 'comment',
    name: 'Comment',
    description: 'Add comments and feedback',
    icon: <MessageSquare className="h-4 w-4" />,
    roles: ['viewer', 'editor', 'admin', 'owner'],
  },
  {
    id: 'export',
    name: 'Export',
    description: 'Download and export content',
    icon: <Download className="h-4 w-4" />,
    roles: ['editor', 'admin', 'owner'],
  },
  {
    id: 'import',
    name: 'Import',
    description: 'Upload and import content',
    icon: <Upload className="h-4 w-4" />,
    roles: ['editor', 'admin', 'owner'],
  },
  {
    id: 'manage_users',
    name: 'Manage access',
    description: 'Invite and manage team members',
    icon: <Users className="h-4 w-4" />,
    roles: ['admin', 'owner'],
  },
  {
    id: 'settings',
    name: 'Project settings',
    description: 'Configure project settings and integrations',
    icon: <Settings className="h-4 w-4" />,
    roles: ['admin', 'owner'],
  },
  {
    id: 'delete',
    name: 'Delete',
    description: 'Delete project and all content',
    icon: <Trash2 className="h-4 w-4" />,
    roles: ['owner'],
  },
]

const ROLE_INFO: Record<Role, { label: string; description: string; icon: React.ReactNode }> = {
  viewer: {
    label: 'Viewer',
    description: 'Can view content and add comments',
    icon: <Eye className="h-4 w-4" />,
  },
  editor: {
    label: 'Editor',
    description: 'Can create and edit content',
    icon: <Pencil className="h-4 w-4" />,
  },
  admin: {
    label: 'Admin',
    description: 'Full access except delete',
    icon: <Shield className="h-4 w-4" />,
  },
  owner: {
    label: 'Owner',
    description: 'Full access including delete',
    icon: <Crown className="h-4 w-4" />,
  },
}

interface PermissionsManagerProps {
  projectId: string
  currentUserRole: Role
}

export function PermissionsManager({ projectId, currentUserRole }: PermissionsManagerProps) {
  const [defaultRole, setDefaultRole] = useState<Role>('viewer')
  const [requireApproval, setRequireApproval] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [projectId])

  const loadSettings = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('projects')
      .select('default_role, require_approval')
      .eq('id', projectId)
      .single() as { data: { default_role?: string; require_approval?: boolean } | null }

    if (data) {
      setDefaultRole((data.default_role as Role) || 'viewer')
      setRequireApproval(data.require_approval !== false)
    }
    setLoading(false)
  }

  const saveSettings = async () => {
    setSaving(true)
    const supabase = createClient()
    
    const { error } = await (supabase as unknown as { from: (t: string) => { update: (v: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: Error | null }> } } })
      .from('projects')
      .update({
        default_role: defaultRole,
        require_approval: requireApproval,
      })
      .eq('id', projectId)

    if (error) {
      toast.error('Failed to save settings')
    } else {
      toast.success('Permissions updated')
    }
    setSaving(false)
  }

  const canManageRole = (targetRole: Role): boolean => {
    const hierarchy: Role[] = ['viewer', 'editor', 'admin', 'owner']
    return hierarchy.indexOf(currentUserRole) > hierarchy.indexOf(targetRole)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Role Permissions Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Role Permissions
          </CardTitle>
          <CardDescription>
            What each role can do in this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium">Permission</th>
                  {(Object.keys(ROLE_INFO) as Role[]).map(role => (
                    <th key={role} className="px-4 py-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {ROLE_INFO[role].icon}
                        <span className="text-xs font-medium">{ROLE_INFO[role].label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map(permission => (
                  <tr key={permission.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{permission.icon}</span>
                        <div>
                          <p className="text-sm font-medium">{permission.name}</p>
                          <p className="text-xs text-muted-foreground">{permission.description}</p>
                        </div>
                      </div>
                    </td>
                    {(Object.keys(ROLE_INFO) as Role[]).map(role => (
                      <td key={role} className="px-4 py-3 text-center">
                        {permission.roles.includes(role) ? (
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 ">
                            <Unlock className="h-3.5 w-3.5 text-emerald-500 " />
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted">
                            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Default Settings */}
      {(currentUserRole === 'admin' || currentUserRole === 'owner') && (
        <Card>
          <CardHeader>
            <CardTitle>Access Settings</CardTitle>
            <CardDescription>
              Configure default permissions for new members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Default role for new members</Label>
                <p className="text-xs text-muted-foreground">
                  Role assigned when someone joins via link
                </p>
              </div>
              <Select
                value={defaultRole}
                onValueChange={(v) => setDefaultRole(v as Role)}
                disabled={!canManageRole(defaultRole)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  {currentUserRole === 'owner' && (
                    <SelectItem value="admin">Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Require approval for new members</Label>
                <p className="text-xs text-muted-foreground">
                  Admins must approve before granting access
                </p>
              </div>
              <Switch
                checked={requireApproval}
                onCheckedChange={setRequireApproval}
              />
            </div>

            <Button onClick={saveSettings} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
