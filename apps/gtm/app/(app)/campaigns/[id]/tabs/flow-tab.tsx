'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  Connection,
  Edge,
  Node,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Play, Clock, Mail, GitBranch, Bell, Square, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { compileFlow, validateFlow } from '@/lib/flow/compiler'
import type { Campaign, FollowupFlow } from '@/lib/supabase/types'

interface FlowTabProps {
  campaign: Campaign
  flow: FollowupFlow | null
}

const nodeTypes = [
  { type: 'trigger', label: 'Trigger', icon: Play, style: 'bg-primary/20 border-primary text-primary' },
  { type: 'delay', label: 'Wait', icon: Clock, style: 'bg-muted/50 border-border text-muted-foreground' },
  { type: 'email', label: 'Send Email', icon: Mail, style: 'bg-info/20 border-info/50 text-info' },
  { type: 'condition', label: 'Condition', icon: GitBranch, style: 'bg-purple/20 border-purple/50 text-purple' },
  { type: 'notify', label: 'Notify', icon: Bell, style: 'bg-warning/20 border-warning/50 text-warning' },
  { type: 'end', label: 'End', icon: Square, style: 'bg-muted/50 border-border text-muted-foreground' },
]

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Form Submitted' },
    position: { x: 250, y: 0 },
    className: 'bg-primary/20 border-primary text-primary border-2 rounded-lg px-4 py-2 font-medium shadow-sm',
  },
]

const initialEdges: Edge[] = []

export function FlowTab({ campaign, flow }: FlowTabProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[] } | null>(null)

  // Parse existing flow or use defaults
  const savedNodes = flow?.graph_json
    ? ((flow.graph_json as { nodes?: Node[] }).nodes || initialNodes)
    : initialNodes
  const savedEdges = flow?.graph_json
    ? ((flow.graph_json as { edges?: Edge[] }).edges || initialEdges)
    : initialEdges

  const [nodes, setNodes, onNodesChange] = useNodesState(savedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(savedEdges)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const addNode = (type: string) => {
    const nodeConfig = nodeTypes.find((n) => n.type === type)
    if (!nodeConfig) return

    const newNode: Node = {
      id: `${Date.now()}`,
      type: type === 'trigger' ? 'input' : type === 'end' ? 'output' : 'default',
      data: { label: nodeConfig.label },
      position: { x: 250, y: nodes.length * 100 },
      className: `${nodeConfig.style} border rounded-lg px-4 py-2 font-medium shadow-sm`,
    }
    setNodes((nds) => [...nds, newNode])
  }

  const saveFlow = async () => {
    setSaving(true)
    try {
      const graphJson = { nodes, edges }

      if (flow) {
        await fetch(`/api/flows/${flow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ graph_json: graphJson }),
        })
      } else {
        await fetch(`/api/flows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_id: campaign.id,
            graph_json: graphJson,
          }),
        })
      }
      toast({ title: 'Saved', description: 'Flow saved successfully.' })
      router.refresh()
    } catch (error) {
      console.error('Failed to save flow:', error)
      toast({ title: 'Error', description: 'Failed to save flow.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const compileAndValidate = async () => {
    setCompiling(true)
    try {
      // Validate first using React Flow nodes/edges directly
      const validation = validateFlow(nodes, edges)
      setValidationResult({ valid: validation.isValid, errors: validation.errors })

      if (!validation.isValid) {
        toast({ 
          title: 'Validation Failed', 
          description: validation.errors[0] || 'Flow has errors.',
          variant: 'destructive'
        })
        setCompiling(false)
        return
      }

      // Compile the flow
      const compiled = compileFlow(nodes, edges)

      // Save the compiled flow
      const graphJson = { nodes, edges }
      
      if (flow) {
        await fetch(`/api/flows/${flow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            graph_json: graphJson,
            compiled_json: compiled,
          }),
        })
      } else {
        await fetch(`/api/flows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_id: campaign.id,
            graph_json: graphJson,
            compiled_json: compiled,
          }),
        })
      }

      toast({ title: 'Compiled', description: 'Flow validated and compiled successfully.' })
      router.refresh()
    } catch (error) {
      console.error('Failed to compile flow:', error)
      toast({ title: 'Error', description: 'Failed to compile flow.', variant: 'destructive' })
    } finally {
      setCompiling(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Sidebar - Node Palette */}
      <div className="w-64 border-r p-4 space-y-4">
        <div>
          <h3 className="font-medium mb-2">Flow Nodes</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Drag nodes to build your follow-up sequence
          </p>
        </div>

        <div className="space-y-2">
          {nodeTypes.map((node) => (
            <button
              key={node.type}
              onClick={() => addNode(node.type)}
              className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <div className={`w-8 h-8 rounded flex items-center justify-center border ${node.style}`}>
                <node.icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">{node.label}</span>
            </button>
          ))}
        </div>

        <div className="pt-4 border-t space-y-2">
          <Button onClick={saveFlow} disabled={saving} variant="outline" className="w-full">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Save Draft
          </Button>
          <Button onClick={compileAndValidate} disabled={compiling} className="w-full">
            {compiling ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            )}
            Compile & Validate
          </Button>
          {validationResult && (
            <div className={`p-3 rounded-lg text-sm ${
              validationResult.valid 
                ? 'bg-primary/10 text-primary' 
                : 'bg-destructive/10 text-destructive'
            }`}>
              {validationResult.valid ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Flow is valid
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-4 h-4" />
                    Validation errors:
                  </div>
                  <ul className="list-disc list-inside text-xs">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Flow Editor */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          colorMode="system"
          className="bg-background"
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </div>
    </div>
  )
}
