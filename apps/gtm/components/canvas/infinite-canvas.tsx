'use client'

import { useCallback, useRef, useState } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  FileText, 
  Mail, 
  Share2, 
  Image, 
  Video, 
  Presentation,
  LayoutGrid,
  Table,
  Sparkles,
  Save,
  Download,
  Users,
  MessageSquare,
  Settings,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { AssetNode, AssetNodeData } from './asset-node'

export interface ProjectAsset {
  id: string
  name: string
  type: 'landing_page' | 'email' | 'social_post' | 'ad_creative' | 'video_script' | 'sales_deck'
  status: 'draft' | 'review' | 'approved' | 'published'
  position: { x: number; y: number }
  content?: Record<string, unknown>
  html?: string
  connectedTo?: string[]
}

interface InfiniteCanvasProps {
  projectId: string
  projectName: string
  assets: ProjectAsset[]
  onAssetsChange: (assets: ProjectAsset[]) => void
  onAssetSelect: (assetId: string | null) => void
  selectedAssetId: string | null
  viewMode: 'canvas' | 'table'
  onViewModeChange: (mode: 'canvas' | 'table') => void
  onAddAsset: (type: ProjectAsset['type'], position: { x: number; y: number }) => void
  onSave: () => void
  isSaving?: boolean
  collaborators?: Array<{ id: string; name: string; color: string; cursor?: { x: number; y: number } }>
}

const nodeTypes = {
  asset: AssetNode,
} as const

const ASSET_TYPES = [
  { id: 'landing_page', label: 'Landing Page', icon: FileText, color: 'from-blue-500 to-cyan-500' },
  { id: 'email', label: 'Email', icon: Mail, color: 'from-amber-500 to-orange-500' },
  { id: 'social_post', label: 'Social Post', icon: Share2, color: 'from-pink-500 to-rose-500' },
  { id: 'ad_creative', label: 'Ad Creative', icon: Image, color: 'from-purple-500 to-violet-500' },
  { id: 'video_script', label: 'Video Script', icon: Video, color: 'from-emerald-500 to-teal-500' },
  { id: 'sales_deck', label: 'Sales Deck', icon: Presentation, color: 'from-indigo-500 to-blue-500' },
] as const

function InfiniteCanvasInner({
  projectId,
  projectName,
  assets,
  onAssetsChange,
  onAssetSelect,
  selectedAssetId,
  viewMode,
  onViewModeChange,
  onAddAsset,
  onSave,
  isSaving,
  collaborators = [],
}: InfiniteCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, getViewport } = useReactFlow()
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [addMenuPosition, setAddMenuPosition] = useState({ x: 0, y: 0 })

  // Convert assets to React Flow nodes
  const initialNodes: Node<AssetNodeData>[] = assets.map((asset) => ({
    id: asset.id,
    type: 'asset',
    position: asset.position,
    data: {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      status: asset.status,
      content: asset.content,
      isSelected: asset.id === selectedAssetId,
      onSelect: () => onAssetSelect(asset.id),
    },
    selected: asset.id === selectedAssetId,
  }))

  // Convert connections to edges
  const initialEdges: Edge[] = assets
    .filter((asset) => asset.connectedTo && asset.connectedTo.length > 0)
    .flatMap((asset) =>
      (asset.connectedTo || []).map((targetId) => ({
        id: `${asset.id}-${targetId}`,
        source: asset.id,
        target: targetId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
      }))
    )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }, eds))
      // Update asset connections
      const updatedAssets = assets.map((asset) => {
        if (asset.id === params.source) {
          return {
            ...asset,
            connectedTo: [...(asset.connectedTo || []), params.target!],
          }
        }
        return asset
      })
      onAssetsChange(updatedAssets)
    },
    [assets, onAssetsChange, setEdges]
  )

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const updatedAssets = assets.map((asset) =>
        asset.id === node.id ? { ...asset, position: node.position } : asset
      )
      onAssetsChange(updatedAssets)
    },
    [assets, onAssetsChange]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onAssetSelect(node.id)
    },
    [onAssetSelect]
  )

  const onPaneClick = useCallback(() => {
    onAssetSelect(null)
    setShowAddMenu(false)
  }, [onAssetSelect])

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setAddMenuPosition({ x: event.clientX, y: event.clientY })
      setShowAddMenu(true)
    },
    [screenToFlowPosition]
  )

  const handleAddAsset = useCallback(
    (type: ProjectAsset['type']) => {
      const flowPosition = screenToFlowPosition(addMenuPosition)
      onAddAsset(type, flowPosition)
      setShowAddMenu(false)
    },
    [addMenuPosition, onAddAsset, screenToFlowPosition]
  )

  return (
    <div className="h-full w-full relative" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="hsl(var(--muted-foreground) / 0.2)"
        />
        
        <Controls 
          className="!bg-card !border-border !rounded-lg !shadow-lg"
          showInteractive={false}
        />
        
        <MiniMap
          className="!bg-card !border-border !rounded-lg"
          nodeColor={(node) => {
            const assetType = ASSET_TYPES.find((t) => t.id === (node.data as AssetNodeData)?.type)
            return assetType ? 'hsl(var(--primary))' : 'hsl(var(--muted))'
          }}
          maskColor="hsl(var(--background) / 0.8)"
        />

        {/* Top Panel */}
        <Panel position="top-left" className="flex items-center gap-2">
          <Badge variant="outline" className="bg-card px-3 py-1.5">
            <Sparkles className="h-3 w-3 mr-1.5 text-primary" />
            {projectName}
          </Badge>
          <Badge variant="secondary" className="px-2 py-1">
            {assets.length} assets
          </Badge>
        </Panel>

        <Panel position="top-right" className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-card border rounded-lg p-0.5">
            <Button
              variant={viewMode === 'canvas' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => onViewModeChange('canvas')}
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              Canvas
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2"
              onClick={() => onViewModeChange('table')}
            >
              <Table className="h-4 w-4 mr-1" />
              Table
            </Button>
          </div>

          {/* Collaborators */}
          {collaborators.length > 0 && (
            <div className="flex items-center -space-x-2">
              {collaborators.slice(0, 3).map((user) => (
                <div
                  key={user.id}
                  className="h-7 w-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium text-white"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {collaborators.length > 3 && (
                <div className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium">
                  +{collaborators.length - 3}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Asset
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {ASSET_TYPES.map((type) => (
                <DropdownMenuItem
                  key={type.id}
                  onClick={() => {
                    const viewport = getViewport()
                    onAddAsset(type.id as ProjectAsset['type'], { 
                      x: -viewport.x / viewport.zoom + 400, 
                      y: -viewport.y / viewport.zoom + 300 
                    })
                  }}
                >
                  <type.icon className="h-4 w-4 mr-2" />
                  {type.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Panel>
      </ReactFlow>

      {/* Context Menu for Adding Assets */}
      <AnimatePresence>
        {showAddMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 bg-card border rounded-lg shadow-xl p-2 min-w-[200px]"
            style={{ left: addMenuPosition.x, top: addMenuPosition.y }}
          >
            <p className="px-2 py-1 text-xs text-muted-foreground uppercase tracking-wider">
              Add Asset
            </p>
            {ASSET_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleAddAsset(type.id as ProjectAsset['type'])}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-sm"
              >
                <div className={cn('w-6 h-6 rounded flex items-center justify-center bg-gradient-to-br', type.color)}>
                  <type.icon className="h-3 w-3 text-white" />
                </div>
                {type.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collaborator Cursors */}
      {collaborators
        .filter((c) => c.cursor)
        .map((user) => (
          <motion.div
            key={user.id}
            className="fixed pointer-events-none z-50"
            initial={false}
            animate={{ x: user.cursor!.x, y: user.cursor!.y }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="drop-shadow-md"
            >
              <path
                d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 01.35-.15h6.87a.5.5 0 00.35-.85L6.35 2.86a.5.5 0 00-.85.35z"
                fill={user.color}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>
            <span
              className="absolute top-5 left-3 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </span>
          </motion.div>
        ))}
    </div>
  )
}

export function InfiniteCanvas(props: InfiniteCanvasProps) {
  return (
    <ReactFlowProvider>
      <InfiniteCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
