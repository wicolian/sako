import { describe, it, expect } from 'vitest'
import { validateFlow, compileFlow } from '../lib/flow/compiler'
import type { Node, Edge } from '@xyflow/react'

describe('Flow Compiler', () => {
  describe('validateFlow', () => {
    it('rejects empty flows', () => {
      const result = validateFlow([], [])
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Flow is empty - add at least a trigger node')
    })

    it('requires a trigger node', () => {
      const nodes: Node[] = [
        { id: '1', type: 'default', data: { label: 'Action' }, position: { x: 0, y: 0 } },
      ]
      
      const result = validateFlow(nodes, [])
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Flow must have a trigger node')
    })

    it('rejects multiple triggers', () => {
      const nodes: Node[] = [
        { id: '1', type: 'input', data: { label: 'Trigger 1' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'input', data: { label: 'Trigger 2' }, position: { x: 0, y: 100 } },
      ]
      
      const result = validateFlow(nodes, [])
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Flow can only have one trigger node')
    })

    it('detects simple cycles', () => {
      const nodes: Node[] = [
        { id: '1', type: 'input', data: { label: 'Trigger' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'default', data: { label: 'Action' }, position: { x: 0, y: 100 } },
      ]
      const edges: Edge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '1' }, // Cycle back to trigger
      ]
      
      const result = validateFlow(nodes, edges)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Flow contains a cycle - remove circular connections')
    })

    it('detects complex cycles', () => {
      const nodes: Node[] = [
        { id: '1', type: 'input', data: { label: 'Trigger' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'default', data: { label: 'A' }, position: { x: 0, y: 100 } },
        { id: '3', type: 'default', data: { label: 'B' }, position: { x: 0, y: 200 } },
        { id: '4', type: 'default', data: { label: 'C' }, position: { x: 0, y: 300 } },
      ]
      const edges: Edge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
        { id: 'e3', source: '3', target: '4' },
        { id: 'e4', source: '4', target: '2' }, // Cycle: 2 -> 3 -> 4 -> 2
      ]
      
      const result = validateFlow(nodes, edges)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Flow contains a cycle - remove circular connections')
    })

    it('validates a correct linear flow', () => {
      const nodes: Node[] = [
        { id: '1', type: 'input', data: { label: 'Form Submit' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'default', data: { label: 'Send Email' }, position: { x: 0, y: 100 } },
        { id: '3', type: 'output', data: { label: 'End' }, position: { x: 0, y: 200 } },
      ]
      const edges: Edge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
      ]
      
      const result = validateFlow(nodes, edges)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('compileFlow', () => {
    it('compiles a valid flow', () => {
      const nodes: Node[] = [
        { id: '1', type: 'input', data: { label: 'Form Submit' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'default', data: { label: 'Send Email', emailId: 'email-123' }, position: { x: 0, y: 100 } },
        { id: '3', type: 'output', data: { label: 'End' }, position: { x: 0, y: 200 } },
      ]
      const edges: Edge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
      ]
      
      const result = compileFlow(nodes, edges)
      expect(result.isValid).toBe(true)
      expect(result.trigger.type).toBe('trigger')
      expect(result.steps).toHaveLength(3)
    })

    it('returns errors for invalid flow', () => {
      const nodes: Node[] = [
        { id: '1', type: 'default', data: { label: 'Action' }, position: { x: 0, y: 0 } },
      ]
      
      const result = compileFlow(nodes, [])
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('builds correct adjacency for branching flows', () => {
      const nodes: Node[] = [
        { id: '1', type: 'input', data: { label: 'Trigger' }, position: { x: 0, y: 0 } },
        { id: '2', type: 'default', data: { label: 'Condition' }, position: { x: 0, y: 100 } },
        { id: '3', type: 'default', data: { label: 'Branch A' }, position: { x: -100, y: 200 } },
        { id: '4', type: 'default', data: { label: 'Branch B' }, position: { x: 100, y: 200 } },
      ]
      const edges: Edge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
        { id: 'e3', source: '2', target: '4' },
      ]
      
      const result = compileFlow(nodes, edges)
      expect(result.isValid).toBe(true)
      
      const conditionStep = result.steps.find((s) => s.id === '2')
      expect(conditionStep?.nextSteps).toHaveLength(2)
      expect(conditionStep?.nextSteps).toContain('3')
      expect(conditionStep?.nextSteps).toContain('4')
    })
  })
})
