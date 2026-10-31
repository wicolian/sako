'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  NodeProps,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Pause, Save, Plus, Zap, Clock, GitBranch, MessageSquare, Mail, 
  FileText, Bot, CheckCircle, XCircle, Settings, Trash2, Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface WorkflowNode {
  id: string
  type: 'trigger' | 'action' | 'condition' | 'delay' | 'output'
  data: {
    label: string
    config: Record<string, any>
    icon?: string
  }
  position: { x: number; y: number }
}

interface VisualWorkflowBuilderProps {
  workspaceId: string
  workflowId?: string
  initialNodes?: WorkflowNode[]
  initialEdges?: Edge[]
  onSave?: (nodes: Node[], edges: Edge[]) => void
}

// Node type configurations
const nodeTypeConfig = {
  trigger: {
    color: 'emerald',
    icon: Zap,
    label: 'Trigger',
    description: 'Start the workflow',
  },
  action: {
    color: 'blue',
    icon: Bot,
    label: 'Action',
    description: 'Perform an action',
  },
  condition: {
    color: 'amber',
    icon: GitBranch,
    label: 'Condition',
    description: 'Branch logic',
  },
  delay: {
    color: 'purple',
    icon: Clock,
    label: 'Delay',
    description: 'Wait before continuing',
  },
  output: {
    color: 'rose',
    icon: FileText,
    label: 'Output',
    description: 'End with output',
  },
}

// Custom node component
function CustomNode({ data, type, selected }: NodeProps) {
  const config = nodeTypeConfig[type as keyof typeof nodeTypeConfig] || nodeTypeConfig.action
  const Icon = config.icon

  const colorClasses = {
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      border: selected ? 'border-emerald-500 dark:border-emerald-400' : 'border-emerald-200 dark:border-emerald-800',
      icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      handle: 'bg-emerald-500',
    },
    blue: {
      bg: 'bg-blue-50 ',
      border: selected ? 'border-blue-500 dark:border-blue-400' : 'border-blue-200 dark:border-blue-800',
      icon: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 ',
      handle: 'bg-blue-500',
    },
    amber: {
      bg: 'bg-amber-50 ',
      border: selected ? 'border-amber-500 dark:border-amber-400' : 'border-amber-200 dark:border-amber-800',
      icon: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 ',
      handle: 'bg-amber-500',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/50',
      border: selected ? 'border-purple-500 dark:border-purple-400' : 'border-purple-200 dark:border-purple-800',
      icon: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
      handle: 'bg-purple-500',
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-950/50',
      border: selected ? 'border-rose-500 dark:border-rose-400' : 'border-rose-200 dark:border-rose-800',
      icon: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
      handle: 'bg-rose-500',
    },
  }

  const colors = colorClasses[config.color as keyof typeof colorClasses]

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 min-w-[180px] transition-all",
        colors.bg,
        colors.border,
        selected && "shadow-lg shadow-white/5"
      )}
    >
      {/* Input handle */}
      {type !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          className={cn("w-3 h-3 !border-2 !border-zinc-900", colors.handle)}
        />
      )}

      <div className="flex items-center gap-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colors.icon)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{data.label as string}</p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </div>
      </div>

      {/* Output handle(s) */}
      {type === 'condition' ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className={cn("w-3 h-3 !border-2 !border-zinc-900 !-left-1", colors.handle)}
            style={{ left: '25%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className={cn("w-3 h-3 !border-2 !border-zinc-900", colors.handle)}
            style={{ left: '75%' }}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-2">
            <span>Yes</span>
            <span>No</span>
          </div>
        </>
      ) : type !== 'output' ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className={cn("w-3 h-3 !border-2 !border-zinc-900", colors.handle)}
        />
      ) : null}
    </div>
  )
}

const nodeTypes = {
  trigger: CustomNode,
  action: CustomNode,
  condition: CustomNode,
  delay: CustomNode,
  output: CustomNode,
}

// Node palette items
const paletteItems = [
  { type: 'trigger', label: 'Trigger', icon: Zap, variants: [
    { id: 'campaign_created', label: 'Campaign Created' },
    { id: 'manual', label: 'Manual Trigger' },
    { id: 'scheduled', label: 'Scheduled' },
  ]},
  { type: 'action', label: 'Action', icon: Bot, variants: [
    { id: 'generate_content', label: 'Generate Content' },
    { id: 'validate_claims', label: 'Validate Claims' },
    { id: 'send_email', label: 'Send Email' },
    { id: 'create_asset', label: 'Create Asset' },
    { id: 'deploy', label: 'Deploy to Provider' },
  ]},
  { type: 'condition', label: 'Condition', icon: GitBranch, variants: [
    { id: 'compliance_check', label: 'Compliance Check' },
    { id: 'approval_status', label: 'Approval Status' },
    { id: 'custom', label: 'Custom Condition' },
  ]},
  { type: 'delay', label: 'Delay', icon: Clock, variants: [
    { id: 'wait_minutes', label: 'Wait Minutes' },
    { id: 'wait_hours', label: 'Wait Hours' },
    { id: 'wait_approval', label: 'Wait for Approval' },
  ]},
  { type: 'output', label: 'Output', icon: FileText, variants: [
    { id: 'success', label: 'Success' },
    { id: 'failure', label: 'Failure' },
    { id: 'notification', label: 'Send Notification' },
  ]},
]

export function VisualWorkflowBuilder({
  workspaceId,
  workflowId,
  initialNodes = [],
  initialEdges = [],
  onSave,
}: VisualWorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [showPalette, setShowPalette] = useState(true)
  const [saving, setSaving] = useState(false)

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#525252' },
          },
          eds
        )
      )
    },
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const addNode = useCallback((type: string, variant: { id: string; label: string }) => {
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type,
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: {
        label: variant.label,
        config: { variant: variant.id },
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes])

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelectedNode(null)
  }, [setNodes, setEdges])

  const duplicateNode = useCallback((node: Node) => {
    const newNode: Node = {
      ...node,
      id: `${node.type}_${Date.now()}`,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
      selected: false,
    }
    setNodes((nds) => [...nds, newNode])
  }, [setNodes])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Compile workflow
      const response = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          workflow_id: workflowId,
          nodes: nodes.map(n => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
          })),
          edges: edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
          })),
        }),
      })

      if (response.ok) {
        onSave?.(nodes, edges)
      }
    } catch (error) {
      console.error('Failed to save workflow:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-[calc(100vh-200px)] w-full flex bg-background rounded-xl border border-border overflow-hidden">
      {/* Node palette */}
      <AnimatePresence>
        {showPalette && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-border overflow-hidden"
          >
            <div className="p-4 w-[280px]">
              <h3 className="font-semibold mb-4">Add Nodes</h3>
              <div className="space-y-4">
                {paletteItems.map((item) => (
                  <div key={item.type}>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </div>
                    <div className="space-y-1">
                      {item.variants.map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() => addNode(item.type, variant)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm bg-card hover:bg-muted border border-border hover:border-border transition-colors"
                        >
                          {variant.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Background color="hsl(var(--border))" gap={20} size={1} />
          <Controls className="bg-card border-border rounded-lg overflow-hidden" />
          <MiniMap
            className="bg-card rounded-lg overflow-hidden"
            nodeColor={(node) => {
              const config = nodeTypeConfig[node.type as keyof typeof nodeTypeConfig]
              const colors: Record<string, string> = {
                emerald: '#10b981',
                blue: '#3b82f6',
                amber: '#f59e0b',
                purple: '#a855f7',
                rose: '#f43f5e',
              }
              return colors[config?.color] || '#525252'
            }}
          />
        </ReactFlow>

        {/* Toolbar */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPalette(!showPalette)}
            className="bg-card border-border"
          >
            <Plus className="w-4 h-4 mr-1" />
            {showPalette ? 'Hide' : 'Show'} Palette
          </Button>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-card border-border"
          >
            <Play className="w-4 h-4 mr-1" />
            Test Run
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>

        {/* Node stats */}
        <div className="absolute bottom-4 left-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{nodes.length} nodes</span>
          <span>{edges.length} connections</span>
        </div>
      </div>

      {/* Node editor panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-border overflow-hidden"
          >
            <div className="p-4 w-[320px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Node Settings</h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => duplicateNode(selectedNode)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive/80"
                    onClick={() => deleteNode(selectedNode.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Label</Label>
                  <Input
                    value={selectedNode.data.label as string}
                    onChange={(e) => {
                      setNodes((nds) =>
                        nds.map((n) =>
                          n.id === selectedNode.id
                            ? { ...n, data: { ...n.data, label: e.target.value } }
                            : n
                        )
                      )
                      setSelectedNode({
                        ...selectedNode,
                        data: { ...selectedNode.data, label: e.target.value },
                      })
                    }}
                    className="mt-1 bg-card border-border"
                  />
                </div>

                <div>
                  <Label>Type</Label>
                  <Badge variant="outline" className="mt-1 capitalize">
                    {selectedNode.type}
                  </Badge>
                </div>

                <div>
                  <Label>Configuration</Label>
                  <Textarea
                    value={JSON.stringify(selectedNode.data.config || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const config = JSON.parse(e.target.value)
                        setNodes((nds) =>
                          nds.map((n) =>
                            n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, config } }
                              : n
                          )
                        )
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    className="mt-1 h-32 font-mono text-xs bg-card border-border"
                  />
                </div>

                <div className="pt-4 border-t border-border">
                  <Label className="text-muted-foreground text-xs">Node ID</Label>
                  <p className="text-xs font-mono text-muted-foreground mt-1">
                    {selectedNode.id}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
