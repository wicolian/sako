'use client'

import { useState, useCallback, useRef } from 'react'
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeProps,
  Handle,
  Position,
  BackgroundVariant,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Play,
  Zap,
  Clock,
  GitBranch,
  MessageSquare,
  Send,
  Plus,
  Save,
  Trash2,
  Settings,
  Upload,
  Download,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/use-toast'

// ============================================================================
// Types
// ============================================================================

export type NodeType = 'trigger' | 'action' | 'condition' | 'delay' | 'output'

export interface WorkflowNodeData {
  label: string
  type: NodeType
  config?: Record<string, unknown>
  description?: string
  [key: string]: unknown
}

export interface WorkflowEdgeData {
  label?: string
  condition?: string
  [key: string]: unknown
}

// ============================================================================
// Node Type Configuration
// ============================================================================

const NODE_TYPES_CONFIG: Record<NodeType, {
  label: string
  icon: typeof Play
  color: string
  bgColor: string
  borderColor: string
  description: string
}> = {
  trigger: {
    label: 'Trigger',
    icon: Play,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    description: 'Starts the workflow',
  },
  action: {
    label: 'Action',
    icon: Zap,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Performs an operation',
  },
  condition: {
    label: 'Condition',
    icon: GitBranch,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    description: 'Branches based on conditions',
  },
  delay: {
    label: 'Delay',
    icon: Clock,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Waits before continuing',
  },
  output: {
    label: 'Output',
    icon: Send,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    description: 'End point of the workflow',
  },
}

// ============================================================================
// Custom Node Component
// ============================================================================

function WorkflowNode({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  const config = NODE_TYPES_CONFIG[data.type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 min-w-[180px] shadow-sm transition-all",
        config.bgColor,
        config.borderColor,
        selected && "ring-2 ring-offset-2 ring-primary"
      )}
    >
      {/* Input Handle (not for trigger) */}
      {data.type !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-muted-foreground border-2 border-white"
        />
      )}

      <div className="flex items-start gap-3">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center",
          config.bgColor,
          "border",
          config.borderColor
        )}>
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{data.label}</p>
          <p className="text-xs text-muted-foreground truncate">
            {data.description || config.description}
          </p>
        </div>
      </div>

      {/* Output Handle (not for output) */}
      {data.type !== 'output' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-muted-foreground border-2 border-white"
        />
      )}

      {/* Condition nodes have two output handles */}
      {data.type === 'condition' && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="w-3 h-3 !bg-red-500 border-2 border-white"
            style={{ top: '50%' }}
          />
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-xs text-red-500">
            No
          </div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-emerald-500">
            Yes
          </div>
        </>
      )}
    </div>
  )
}

const nodeTypes = {
  workflow: WorkflowNode,
}

// ============================================================================
// Node Panel
// ============================================================================

interface NodePanelProps {
  onAddNode: (type: NodeType) => void
}

function NodePanel({ onAddNode }: NodePanelProps) {
  return (
    <Card className="w-64 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Add Node</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {(Object.keys(NODE_TYPES_CONFIG) as NodeType[]).map((type) => {
          const config = NODE_TYPES_CONFIG[type]
          const Icon = config.icon
          
          return (
            <button
              key={type}
              onClick={() => onAddNode(type)}
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors",
                "hover:bg-muted"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                config.bgColor
              )}>
                <Icon className={cn("h-4 w-4", config.color)} />
              </div>
              <div>
                <p className="text-sm font-medium">{config.label}</p>
                <p className="text-xs text-muted-foreground">{config.description}</p>
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Node Configuration Sheet
// ============================================================================

interface NodeConfigSheetProps {
  node: Node<WorkflowNodeData> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, data: Partial<WorkflowNodeData>) => void
  onDelete: (id: string) => void
}

function NodeConfigSheet({
  node,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: NodeConfigSheetProps) {
  if (!node) return null

  const config = NODE_TYPES_CONFIG[node.data.type]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <config.icon className={cn("h-5 w-5", config.color)} />
            Configure {config.label}
          </SheetTitle>
          <SheetDescription>
            {config.description}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div>
            <Label>Label</Label>
            <Input
              value={node.data.label}
              onChange={(e) => onUpdate(node.id, { label: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={node.data.description || ''}
              onChange={(e) => onUpdate(node.id, { description: e.target.value })}
              className="mt-1"
              rows={3}
            />
          </div>

          {/* Type-specific configuration */}
          {node.data.type === 'trigger' && (
            <div>
              <Label>Trigger Type</Label>
              <Select
                value={(node.data.config?.triggerType as string) || 'manual'}
                onValueChange={(v) => onUpdate(node.id, {
                  config: { ...node.data.config, triggerType: v }
                })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="schedule">Scheduled</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="event">Event-based</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {node.data.type === 'action' && (
            <div>
              <Label>Action Type</Label>
              <Select
                value={(node.data.config?.actionType as string) || 'api_call'}
                onValueChange={(v) => onUpdate(node.id, {
                  config: { ...node.data.config, actionType: v }
                })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api_call">API Call</SelectItem>
                  <SelectItem value="send_email">Send Email</SelectItem>
                  <SelectItem value="update_record">Update Record</SelectItem>
                  <SelectItem value="ai_generate">AI Generate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {node.data.type === 'condition' && (
            <div>
              <Label>Condition</Label>
              <Textarea
                value={(node.data.config?.condition as string) || ''}
                onChange={(e) => onUpdate(node.id, {
                  config: { ...node.data.config, condition: e.target.value }
                })}
                className="mt-1"
                placeholder="e.g., status === 'approved'"
                rows={2}
              />
            </div>
          )}

          {node.data.type === 'delay' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Duration</Label>
                <Input
                  type="number"
                  value={(node.data.config?.duration as number) || 1}
                  onChange={(e) => onUpdate(node.id, {
                    config: { ...node.data.config, duration: parseInt(e.target.value) }
                  })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select
                  value={(node.data.config?.unit as string) || 'hours'}
                  onValueChange={(v) => onUpdate(node.id, {
                    config: { ...node.data.config, unit: v }
                  })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                onDelete(node.id)
                onOpenChange(false)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Node
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================================
// Main Component
// ============================================================================

interface WorkflowBuilderProps {
  workflowId?: string
  initialNodes?: Node<WorkflowNodeData>[]
  initialEdges?: Edge<WorkflowEdgeData>[]
  onSave?: (nodes: Node<WorkflowNodeData>[], edges: Edge<WorkflowEdgeData>[]) => Promise<void>
  className?: string
}

export function WorkflowBuilder({
  workflowId,
  initialNodes = [],
  initialEdges = [],
  onSave,
  className,
}: WorkflowBuilderProps) {
  const { toast } = useToast()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<WorkflowEdgeData>>(initialEdges)
  const [selectedNode, setSelectedNode] = useState<Node<WorkflowNodeData> | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Connect nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const nextEdge: Edge<WorkflowEdgeData> = {
        id: `edge-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        animated: true,
        style: { strokeWidth: 2 },
      }

      setEdges((eds) => addEdge(nextEdge, eds))
    },
    [setEdges]
  )

  // Add new node
  const handleAddNode = useCallback((type: NodeType) => {
    const config = NODE_TYPES_CONFIG[type]
    
    // Calculate position (snap to grid of 20px)
    const existingCount = nodes.filter(n => n.data.type === type).length
    const x = Math.round((100 + existingCount * 50) / 20) * 20
    const y = Math.round((100 + existingCount * 80) / 20) * 20

    const newNode: Node<WorkflowNodeData> = {
      id: `${type}-${Date.now()}`,
      type: 'workflow',
      position: { x, y },
      data: {
        label: `${config.label} ${existingCount + 1}`,
        type,
        description: config.description,
        config: {},
      },
    }

    setNodes((nds) => [...nds, newNode])
  }, [nodes, setNodes])

  // Update node data
  const handleUpdateNode = useCallback((id: string, data: Partial<WorkflowNodeData>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, ...data } }
          : node
      )
    )
  }, [setNodes])

  // Delete node
  const handleDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== id))
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id))
  }, [setNodes, setEdges])

  // Node click handler
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<WorkflowNodeData>) => {
    setSelectedNode(node)
    setConfigOpen(true)
  }, [])

  // Validate workflow
  const validateWorkflow = useCallback(() => {
    const triggers = nodes.filter((n) => n.data.type === 'trigger')
    const outputs = nodes.filter((n) => n.data.type === 'output')

    const errors: string[] = []

    if (triggers.length === 0) {
      errors.push('Workflow must have at least one Trigger')
    }
    if (triggers.length > 1) {
      errors.push('Workflow should have only one Trigger')
    }
    if (outputs.length === 0) {
      errors.push('Workflow must have at least one Output')
    }

    // Check for orphan nodes (no connections)
    const connectedNodes = new Set([
      ...edges.map((e) => e.source),
      ...edges.map((e) => e.target),
    ])
    const orphans = nodes.filter((n) =>
      n.data.type !== 'trigger' && !connectedNodes.has(n.id)
    )
    if (orphans.length > 0) {
      errors.push(`${orphans.length} node(s) are not connected`)
    }

    return errors
  }, [nodes, edges])

  // Save workflow
  const handleSave = async () => {
    const errors = validateWorkflow()
    if (errors.length > 0) {
      toast({
        title: 'Validation Failed',
        description: errors.join('. '),
        variant: 'destructive',
      })
      return
    }

    if (!onSave) return

    setIsSaving(true)
    try {
      await onSave(nodes, edges)
      toast({ title: 'Workflow saved successfully' })
    } catch (error) {
      toast({
        title: 'Failed to save',
        description: 'Please try again',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={cn("h-full w-full", className)} ref={reactFlowWrapper}>
      <ReactFlow<Node<WorkflowNodeData>, Edge<WorkflowEdgeData>>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        defaultEdgeOptions={{
          animated: true,
          style: { strokeWidth: 2 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as WorkflowNodeData
            const config = NODE_TYPES_CONFIG[data.type]
            return config.color.replace('text-', '').replace('-600', '')
          }}
          className="!bg-muted/50"
        />

        {/* Node Panel */}
        <Panel position="top-left">
          <NodePanel onAddNode={handleAddNode} />
        </Panel>

        {/* Actions Panel */}
        <Panel position="top-right">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </Panel>

        {/* Stats Panel */}
        <Panel position="bottom-left">
          <div className="flex items-center gap-4 bg-background/80 backdrop-blur px-3 py-2 rounded-lg shadow-sm">
            <span className="text-xs text-muted-foreground">
              {nodes.length} nodes
            </span>
            <span className="text-xs text-muted-foreground">
              {edges.length} connections
            </span>
          </div>
        </Panel>
      </ReactFlow>

      {/* Node Configuration Sheet */}
      <NodeConfigSheet
        node={selectedNode}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onUpdate={handleUpdateNode}
        onDelete={handleDeleteNode}
      />
    </div>
  )
}
