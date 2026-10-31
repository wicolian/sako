'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Settings,
  Share2,
  Loader2,
  MessageSquare,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { InfiniteCanvas, ProjectAsset } from '@/components/canvas/infinite-canvas'
import { TableView } from '@/components/canvas/table-view'
import { ProjectSettingsPanel } from '@/components/canvas/project-settings-panel'
import { ViewModeToggle, type ViewMode } from '@/components/canvas/view-mode-toggle'
import { PrivateChatPanel } from '@/components/canvas/private-chat-panel'

interface Project {
  id: string
  name: string
  description?: string
  icon: string
  color: string
  brand_id?: string
  audience_id?: string
  campaign_goals?: string
  tone_override?: string
  keywords_include: string[]
  keywords_avoid: string[]
  custom_instructions?: string
}

interface Brand {
  id: string
  name: string
  primary_color: string
}

interface Audience {
  id: string
  name: string
  description?: string
}

export default function ProjectCanvasPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [project, setProject] = useState<Project | null>(null)
  const [assets, setAssets] = useState<ProjectAsset[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('canvas')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [workspaceMembers, setWorkspaceMembers] = useState<Array<{
    id: string
    email: string
    name?: string
    avatar_url?: string
  }>>([])
  const [isAssetEditorOpen, setIsAssetEditorOpen] = useState(false)
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [assetEditorName, setAssetEditorName] = useState('')
  const [assetEditorContent, setAssetEditorContent] = useState('')
  const [isSavingAssetEdit, setIsSavingAssetEdit] = useState(false)


  useEffect(() => {
    fetchProjectData()
  }, [projectId])

  const fetchProjectData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Get workspace ID
      const { data: membershipData } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      const typedMembership = membershipData as { workspace_id: string } | null
      if (!typedMembership) {
        toast.error('No workspace found')
        return
      }

      const wsId = typedMembership.workspace_id
      setWorkspaceId(wsId)
      setCurrentUserId(user.id)

      // Fetch project, assets, brands, audiences, and workspace members in parallel
      const [projectResult, assetsResult, brandsResult, audiencesResult, membersResult] = await Promise.all([
        supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single(),
        supabase
          .from('project_assets')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at'),
        supabase
          .from('brands')
          .select('id, name, primary_color')
          .eq('workspace_id', wsId),
        supabase
          .from('audiences')
          .select('id, name, description')
          .eq('workspace_id', wsId),
        supabase
          .from('workspace_members')
          .select('user_id, role')
          .eq('workspace_id', wsId),
      ])

      if (projectResult.error) throw projectResult.error

      setProject(projectResult.data)
      setAssets(
        (assetsResult.data || []).map((a: Record<string, unknown>) => ({
          id: a.id as string,
          name: a.name as string,
          type: a.type as ProjectAsset['type'],
          status: a.status as ProjectAsset['status'],
          position: { x: a.position_x as number, y: a.position_y as number },
          content: a.content as Record<string, unknown>,
          html: a.html as string | undefined,
          connectedTo: (a.connected_to as string[]) || [],
        }))
      )
      setBrands(brandsResult.data || [])
      setAudiences(audiencesResult.data || [])
      
      // Format workspace members for chat panel
      if (membersResult.data) {
        const membersList = membersResult.data.map((m: { user_id: string; role: string }) => ({
          id: m.user_id,
          email: `user-${m.user_id.slice(0, 8)}@workspace.local`, // Placeholder, would fetch actual user data
          name: `Team Member`,
        }))
        setWorkspaceMembers(membersList)
      }
    } catch (error) {
      console.error('Failed to fetch project:', error)
      toast.error('Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const handleAssetsChange = useCallback((newAssets: ProjectAsset[]) => {
    setAssets(newAssets)
  }, [])

  const handleAddAsset = useCallback(
    async (type: ProjectAsset['type'], position: { x: number; y: number }) => {
      try {
        const response = await fetch(`/api/projects/${projectId}/assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `New ${type.replace('_', ' ')}`,
            type,
            position_x: position.x,
            position_y: position.y,
          }),
        })

        if (!response.ok) throw new Error('Failed to create asset')

        const newAsset = await response.json()
        setAssets((prev) => [
          ...prev,
          {
            id: newAsset.id,
            name: newAsset.name,
            type: newAsset.type,
            status: newAsset.status,
            position: { x: newAsset.position_x, y: newAsset.position_y },
            content: newAsset.content || {},
            connectedTo: [],
          },
        ])
        setSelectedAssetId(newAsset.id)
        toast.success('Asset created')
      } catch (error) {
        console.error('Failed to create asset:', error)
        toast.error('Failed to create asset')
      }
    },
    [projectId]
  )

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      // Save asset positions
      const updates = assets.map((a) => ({
        id: a.id,
        position_x: a.position.x,
        position_y: a.position.y,
        connected_to: a.connectedTo || [],
      }))

      const response = await fetch(`/api/projects/${projectId}/assets/batch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) throw new Error('Failed to save')
      toast.success('Changes saved')
    } catch (error) {
      console.error('Failed to save:', error)
      toast.error('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }, [projectId, assets])

  const handleSettingsSave = useCallback(async () => {
    if (!project) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: project.brand_id,
          audience_id: project.audience_id,
          campaign_goals: project.campaign_goals,
          tone_override: project.tone_override,
          keywords_include: project.keywords_include,
          keywords_avoid: project.keywords_avoid,
          custom_instructions: project.custom_instructions,
        }),
      })

      if (!response.ok) throw new Error('Failed to save settings')
      toast.success('Settings saved')
      setSettingsOpen(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }, [projectId, project])

  const handleAssetEdit = useCallback((assetId: string) => {
    const asset = assets.find((item) => item.id === assetId)
    if (!asset) {
      toast.error('Asset not found')
      return
    }

    setEditingAssetId(assetId)
    setAssetEditorName(asset.name)
    setAssetEditorContent(JSON.stringify(asset.content || {}, null, 2))
    setIsAssetEditorOpen(true)
  }, [assets])

  const handleSaveAssetEdit = useCallback(async () => {
    if (!editingAssetId) return

    let parsedContent: Record<string, unknown> = {}
    if (assetEditorContent.trim()) {
      try {
        parsedContent = JSON.parse(assetEditorContent) as Record<string, unknown>
      } catch {
        toast.error('Content must be valid JSON')
        return
      }
    }

    setIsSavingAssetEdit(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/assets/${editingAssetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: assetEditorName.trim() || 'Untitled Asset',
          content: parsedContent,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update asset')
      }

      const updated = await response.json()
      setAssets((prev) =>
        prev.map((asset) =>
          asset.id === editingAssetId
            ? {
                ...asset,
                name: updated.name,
                content: (updated.content as Record<string, unknown>) || {},
              }
            : asset
        )
      )

      toast.success('Asset updated')
      setIsAssetEditorOpen(false)
      setEditingAssetId(null)
    } catch (error) {
      console.error('Failed to update asset:', error)
      toast.error('Failed to update asset')
    } finally {
      setIsSavingAssetEdit(false)
    }
  }, [assetEditorContent, assetEditorName, editingAssetId, projectId])

  const handleAssetDuplicate = useCallback(
    async (assetId: string) => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/assets/${assetId}/duplicate`,
          { method: 'POST' }
        )
        if (!response.ok) throw new Error('Failed to duplicate')
        const newAsset = await response.json()
        setAssets((prev) => [
          ...prev,
          {
            id: newAsset.id,
            name: newAsset.name,
            type: newAsset.type,
            status: newAsset.status,
            position: { x: newAsset.position_x, y: newAsset.position_y },
            content: newAsset.content || {},
            connectedTo: [],
          },
        ])
        toast.success('Asset duplicated')
      } catch (error) {
        console.error('Failed to duplicate:', error)
        toast.error('Failed to duplicate asset')
      }
    },
    [projectId]
  )

  const handleAssetDelete = useCallback(
    async (assetId: string) => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/assets/${assetId}`,
          { method: 'DELETE' }
        )
        if (!response.ok) throw new Error('Failed to delete')
        setAssets((prev) => prev.filter((a) => a.id !== assetId))
        if (selectedAssetId === assetId) {
          setSelectedAssetId(null)
        }
        toast.success('Asset deleted')
      } catch (error) {
        console.error('Failed to delete:', error)
        toast.error('Failed to delete asset')
      }
    },
    [projectId, selectedAssetId]
  )

  const handleAssetRegenerate = useCallback(
    async (assetId: string) => {
      toast.loading('Regenerating asset…', { id: `regen-${assetId}` })
      try {
        const res = await fetch(
          `/api/projects/${projectId}/assets/${assetId}/regenerate`,
          { method: 'POST' }
        )
        if (!res.ok) {
          const data = await res.json() as { error?: string }
          toast.error(data.error ?? 'Regeneration failed', { id: `regen-${assetId}` })
          return
        }
        const { asset: updated } = await res.json() as { asset: { id: string; content: Record<string, unknown>; status: ProjectAsset['status'] } }
        setAssets((prev) =>
          prev.map((a) =>
            a.id === updated.id ? { ...a, content: updated.content, status: updated.status } : a
          )
        )
        toast.success('Asset regenerated', { id: `regen-${assetId}` })
      } catch {
        toast.error('Regeneration failed', { id: `regen-${assetId}` })
      }
    },
    [projectId]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] min-h-screen bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between bg-card border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/canvas')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${project.color}20` }}
          >
            {project.icon}
          </div>
          <div>
            <h1 className="font-semibold">{project.name}</h1>
            {project.description && (
              <p className="text-xs text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <ViewModeToggle
            mode={viewMode}
            onChange={setViewMode}
            variant="compact"
          />
          
          <div className="w-px h-6 bg-border mx-1" />
          
          {/* Private Chat */}
          {workspaceId && currentUserId && (
            <PrivateChatPanel
              workspaceId={workspaceId}
              projectId={projectId}
              currentUserId={currentUserId}
              workspaceMembers={workspaceMembers}
            />
          )}
          
          <Button variant="outline" size="sm">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      <Dialog
        open={isAssetEditorOpen}
        onOpenChange={(open) => {
          setIsAssetEditorOpen(open)
          if (!open) {
            setEditingAssetId(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Update asset name and content payload. Content must be valid JSON.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="asset-name">Name</Label>
              <Input
                id="asset-name"
                value={assetEditorName}
                onChange={(event) => setAssetEditorName(event.target.value)}
                placeholder="Asset name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-content">Content JSON</Label>
              <Textarea
                id="asset-content"
                value={assetEditorContent}
                onChange={(event) => setAssetEditorContent(event.target.value)}
                rows={10}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssetEditorOpen(false)
                setEditingAssetId(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveAssetEdit} disabled={isSavingAssetEdit}>
              {isSavingAssetEdit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Canvas/Table View */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'canvas' ? (
          <InfiniteCanvas
            projectId={projectId}
            projectName={project.name}
            assets={assets}
            onAssetsChange={handleAssetsChange}
            onAssetSelect={setSelectedAssetId}
            selectedAssetId={selectedAssetId}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddAsset={handleAddAsset}
            onSave={handleSave}
            isSaving={isSaving}
          />
        ) : (
          <div className="h-full flex flex-col">
            <TableView
              assets={assets}
              selectedAssetId={selectedAssetId}
              onAssetSelect={setSelectedAssetId}
              onAssetEdit={handleAssetEdit}
              onAssetDuplicate={handleAssetDuplicate}
              onAssetDelete={handleAssetDelete}
              onAssetRegenerate={handleAssetRegenerate}
            />
          </div>
        )}
      </div>

      {/* Project Settings Panel */}
      <ProjectSettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={{
          brandId: project.brand_id,
          audienceId: project.audience_id,
          campaignGoals: project.campaign_goals,
          toneOverride: project.tone_override,
          keywordsInclude: project.keywords_include || [],
          keywordsAvoid: project.keywords_avoid || [],
          customInstructions: project.custom_instructions,
        }}
        onSettingsChange={(settings) =>
          setProject({
            ...project,
            brand_id: settings.brandId,
            audience_id: settings.audienceId,
            campaign_goals: settings.campaignGoals,
            tone_override: settings.toneOverride,
            keywords_include: settings.keywordsInclude,
            keywords_avoid: settings.keywordsAvoid,
            custom_instructions: settings.customInstructions,
          })
        }
        brands={brands}
        audiences={audiences}
        onSave={handleSettingsSave}
        isSaving={isSaving}
      />
    </div>
  )
}
