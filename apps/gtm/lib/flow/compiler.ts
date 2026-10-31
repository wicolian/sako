// Flow compiler for follow-up sequences
// Validates and compiles React Flow graph to deployable workflow plan

import type { Node, Edge } from '@xyflow/react'

export interface FlowNode {
  id: string
  type: 'trigger' | 'delay' | 'email' | 'condition' | 'notify' | 'end'
  data: Record<string, unknown>
}

export interface CompiledStep {
  id: string
  type: string
  config: Record<string, unknown>
  nextSteps: string[]
}

export interface CompiledFlow {
  trigger: CompiledStep
  steps: CompiledStep[]
  isValid: boolean
  errors: string[]
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

// Detect cycles using DFS
function hasCycle(nodes: Node[], edges: Edge[]): boolean {
  const adjacencyList = new Map<string, string[]>()
  
  // Build adjacency list
  for (const node of nodes) {
    adjacencyList.set(node.id, [])
  }
  for (const edge of edges) {
    const targets = adjacencyList.get(edge.source) || []
    targets.push(edge.target)
    adjacencyList.set(edge.source, targets)
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true // Cycle detected
    if (visited.has(nodeId)) return false

    visited.add(nodeId)
    inStack.add(nodeId)

    const neighbors = adjacencyList.get(nodeId) || []
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true
    }

    inStack.delete(nodeId)
    return false
  }

  for (const node of nodes) {
    if (dfs(node.id)) return true
  }

  return false
}

export function validateFlow(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: string[] = []

  // Check for empty graph
  if (nodes.length === 0) {
    errors.push('Flow is empty - add at least a trigger node')
    return { isValid: false, errors }
  }

  // Check for trigger node (accept 'input', 'trigger', or type containing 'trigger')
  const triggerNodes = nodes.filter((n) => 
    n.type === 'input' || n.type === 'trigger' || n.type?.toLowerCase().includes('trigger')
  )
  if (triggerNodes.length === 0) {
    errors.push('Flow must have a trigger node')
  }
  if (triggerNodes.length > 1) {
    errors.push('Flow can only have one trigger node')
  }

  // Check for cycles
  if (hasCycle(nodes, edges)) {
    errors.push('Flow contains a cycle - remove circular connections')
  }

  // Check for disconnected nodes (no incoming or outgoing edges)
  const connectedNodes = new Set<string>()
  for (const edge of edges) {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  }

  // Allow trigger and end nodes to be disconnected from one side
  const nonTriggerEndNodes = nodes.filter(
    (n) => n.type !== 'input' && n.type !== 'output'
  )
  for (const node of nonTriggerEndNodes) {
    if (!connectedNodes.has(node.id)) {
      errors.push(`Node "${node.data.label || node.id}" is not connected`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function compileFlow(nodes: Node[], edges: Edge[]): CompiledFlow {
  const validation = validateFlow(nodes, edges)
  
  if (!validation.isValid) {
    return {
      trigger: { id: '', type: '', config: {}, nextSteps: [] },
      steps: [],
      isValid: false,
      errors: validation.errors,
    }
  }

  // Build adjacency list
  const adjacencyList = new Map<string, string[]>()
  for (const node of nodes) {
    adjacencyList.set(node.id, [])
  }
  for (const edge of edges) {
    const targets = adjacencyList.get(edge.source) || []
    targets.push(edge.target)
    adjacencyList.set(edge.source, targets)
  }

  // Convert nodes to steps
  const steps: CompiledStep[] = nodes.map((node) => ({
    id: node.id,
    type: mapNodeType(node.type || 'default'),
    config: node.data as Record<string, unknown>,
    nextSteps: adjacencyList.get(node.id) || [],
  }))

  // Find trigger
  const trigger = steps.find((s) => s.type === 'trigger') || steps[0]

  return {
    trigger,
    steps,
    isValid: true,
    errors: [],
  }
}

function mapNodeType(type: string): string {
  switch (type) {
    case 'input':
      return 'trigger'
    case 'output':
      return 'end'
    default:
      return type
  }
}
