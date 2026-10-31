/**
 * Visual Workflow Builder Unit Tests
 */

import { describe, it, expect } from 'vitest'

describe('Visual Workflow Builder', () => {
  describe('Node Types', () => {
    type NodeType = 'trigger' | 'action' | 'condition' | 'delay' | 'output'

    interface WorkflowNode {
      id: string
      type: NodeType
      position: { x: number; y: number }
      data: Record<string, unknown>
    }

    const NODE_CONFIGS: Record<NodeType, { label: string; color: string; icon: string }> = {
      trigger: { label: 'Trigger', color: '#4ade80', icon: 'play' },
      action: { label: 'Action', color: '#60a5fa', icon: 'cog' },
      condition: { label: 'Condition', color: '#fbbf24', icon: 'git-branch' },
      delay: { label: 'Delay', color: '#a78bfa', icon: 'clock' },
      output: { label: 'Output', color: '#f472b6', icon: 'flag' },
    }

    it('has all required node types', () => {
      expect(Object.keys(NODE_CONFIGS)).toContain('trigger')
      expect(Object.keys(NODE_CONFIGS)).toContain('action')
      expect(Object.keys(NODE_CONFIGS)).toContain('condition')
      expect(Object.keys(NODE_CONFIGS)).toContain('delay')
      expect(Object.keys(NODE_CONFIGS)).toContain('output')
    })

    it('each node has label and color', () => {
      for (const config of Object.values(NODE_CONFIGS)) {
        expect(config.label).toBeDefined()
        expect(config.color).toMatch(/^#[0-9a-f]{6}$/i)
      }
    })
  })

  describe('Edge Validation', () => {
    interface Edge {
      source: string
      target: string
      sourceHandle?: string
      targetHandle?: string
    }

    interface Node {
      id: string
      type: string
    }

    const canConnect = (source: Node, target: Node): boolean => {
      // Output nodes cannot have outgoing connections
      if (source.type === 'output') return false

      // Trigger nodes cannot be targets
      if (target.type === 'trigger') return false

      // Cannot connect to self
      if (source.id === target.id) return false

      return true
    }

    it('allows trigger to action', () => {
      const result = canConnect(
        { id: '1', type: 'trigger' },
        { id: '2', type: 'action' }
      )
      expect(result).toBe(true)
    })

    it('prevents output from having outgoing', () => {
      const result = canConnect(
        { id: '1', type: 'output' },
        { id: '2', type: 'action' }
      )
      expect(result).toBe(false)
    })

    it('prevents trigger from being target', () => {
      const result = canConnect(
        { id: '1', type: 'action' },
        { id: '2', type: 'trigger' }
      )
      expect(result).toBe(false)
    })

    it('prevents self-connection', () => {
      const result = canConnect(
        { id: '1', type: 'action' },
        { id: '1', type: 'action' }
      )
      expect(result).toBe(false)
    })
  })

  describe('Workflow Validation', () => {
    interface Workflow {
      nodes: { id: string; type: string }[]
      edges: { source: string; target: string }[]
    }

    const validateWorkflow = (workflow: Workflow): { valid: boolean; errors: string[] } => {
      const errors: string[] = []

      // Must have exactly one trigger
      const triggers = workflow.nodes.filter(n => n.type === 'trigger')
      if (triggers.length === 0) {
        errors.push('Workflow must have a trigger')
      } else if (triggers.length > 1) {
        errors.push('Workflow can only have one trigger')
      }

      // Must have at least one output
      const outputs = workflow.nodes.filter(n => n.type === 'output')
      if (outputs.length === 0) {
        errors.push('Workflow must have at least one output')
      }

      // All non-trigger nodes must have incoming edges
      const targetIds = new Set(workflow.edges.map(e => e.target))
      for (const node of workflow.nodes) {
        if (node.type !== 'trigger' && !targetIds.has(node.id)) {
          errors.push(`Node "${node.id}" has no incoming connection`)
        }
      }

      return { valid: errors.length === 0, errors }
    }

    it('validates complete workflow', () => {
      const workflow: Workflow = {
        nodes: [
          { id: '1', type: 'trigger' },
          { id: '2', type: 'action' },
          { id: '3', type: 'output' },
        ],
        edges: [
          { source: '1', target: '2' },
          { source: '2', target: '3' },
        ],
      }
      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(true)
    })

    it('rejects workflow without trigger', () => {
      const workflow: Workflow = {
        nodes: [
          { id: '1', type: 'action' },
          { id: '2', type: 'output' },
        ],
        edges: [{ source: '1', target: '2' }],
      }
      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Workflow must have a trigger')
    })

    it('rejects workflow without output', () => {
      const workflow: Workflow = {
        nodes: [
          { id: '1', type: 'trigger' },
          { id: '2', type: 'action' },
        ],
        edges: [{ source: '1', target: '2' }],
      }
      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Workflow must have at least one output')
    })

    it('rejects disconnected nodes', () => {
      const workflow: Workflow = {
        nodes: [
          { id: '1', type: 'trigger' },
          { id: '2', type: 'action' },
          { id: '3', type: 'output' },
        ],
        edges: [{ source: '1', target: '3' }], // Node 2 is disconnected
      }
      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
    })
  })

  describe('Position Calculations', () => {
    interface Position {
      x: number
      y: number
    }

    const GRID_SIZE = 20

    const snapToGrid = (pos: Position): Position => ({
      x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
    })

    const getNextNodePosition = (existingNodes: Position[]): Position => {
      if (existingNodes.length === 0) {
        return { x: 100, y: 100 }
      }

      const rightmost = Math.max(...existingNodes.map(n => n.x))
      return { x: rightmost + 200, y: 100 }
    }

    it('snaps to grid', () => {
      expect(snapToGrid({ x: 105, y: 117 })).toEqual({ x: 100, y: 120 })
      expect(snapToGrid({ x: 115, y: 123 })).toEqual({ x: 120, y: 120 })
    })

    it('places first node at default position', () => {
      const pos = getNextNodePosition([])
      expect(pos.x).toBe(100)
      expect(pos.y).toBe(100)
    })

    it('places new nodes to the right', () => {
      const pos = getNextNodePosition([
        { x: 100, y: 100 },
        { x: 300, y: 100 },
      ])
      expect(pos.x).toBe(500) // 300 + 200
    })
  })
})
