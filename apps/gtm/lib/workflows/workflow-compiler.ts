/**
 * Workflow Compiler (Phase 4.3)
 * 
 * Visual workflow bimport { Database } from '@/lib/supabase/types'

uilder execution engine.
 * Compiles workflow definitions into executable sequences.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface WorkflowNode {
  id: string
  type: 'trigger' | 'action' | 'condition' | 'delay' | 'output'
  name: string
  config: Record<string, unknown>
  position: { x: number; y: number }
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
  condition?: string
}

export interface WorkflowDefinition {
  id: string
  workspace_id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkflowExecution {
  id: string
  workflow_id: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  trigger_data?: Record<string, unknown>
  current_node_id?: string
  results: Record<string, unknown>
  started_at: string
  completed_at?: string
  error?: string
}

// Node type handlers
type NodeHandler = (
  node: WorkflowNode,
  context: Record<string, unknown>
) => Promise<{ output: unknown; nextNodeId?: string }>

const nodeHandlers: Record<string, NodeHandler> = {
  /**
   * Trigger nodes - start the workflow
   */
  trigger: async (node, context) => {
    // Trigger nodes just pass through the input data
    return { output: context.triggerData || {} }
  },

  /**
   * Action nodes - perform operations
   */
  action: async (node, context) => {
    const actionType = node.config.actionType as string

    switch (actionType) {
      case 'generate_content': {
        // Would call AI generation
        return {
          output: {
            content: 'Generated content placeholder',
            timestamp: new Date().toISOString(),
          },
        }
      }

      case 'validate_claim': {
        // Would call claim validation
        return {
          output: {
            isValid: true,
            score: 85,
          },
        }
      }

      case 'send_email': {
        // Would send email
        return {
          output: {
            sent: true,
            messageId: `msg_${Date.now()}`,
          },
        }
      }

      case 'update_campaign': {
        // Would update campaign
        return {
          output: {
            updated: true,
          },
        }
      }

      case 'deploy': {
        // Would trigger deployment
        return {
          output: {
            deploymentId: `deploy_${Date.now()}`,
            status: 'queued',
          },
        }
      }

      case 'webhook': {
        // Would call external webhook
        const url = node.config.webhookUrl as string
        if (url) {
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(context),
            })
            return {
              output: {
                status: response.status,
                success: response.ok,
              },
            }
          } catch (error) {
            return {
              output: {
                error: (error as Error).message,
                success: false,
              },
            }
          }
        }
        return { output: { success: false, error: 'No webhook URL' } }
      }

      default:
        return { output: { error: `Unknown action type: ${actionType}` } }
    }
  },

  /**
   * Condition nodes - branch logic
   */
  condition: async (node, context) => {
    const field = node.config.field as string
    const operator = node.config.operator as string
    const value = node.config.value

    // Get the value from context
    const fieldValue = getNestedValue(context, field)

    // Evaluate condition
    let result = false
    switch (operator) {
      case 'equals':
        result = fieldValue === value
        break
      case 'not_equals':
        result = fieldValue !== value
        break
      case 'contains':
        result = String(fieldValue).includes(String(value))
        break
      case 'greater_than':
        result = Number(fieldValue) > Number(value)
        break
      case 'less_than':
        result = Number(fieldValue) < Number(value)
        break
      case 'is_empty':
        result = !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0)
        break
      case 'is_not_empty':
        result = Boolean(fieldValue) && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0)
        break
    }

    // Return which branch to take
    return {
      output: { condition_result: result },
      nextNodeId: result
        ? (node.config.trueNodeId as string)
        : (node.config.falseNodeId as string),
    }
  },

  /**
   * Delay nodes - wait before continuing
   */
  delay: async (node, _context) => {
    const delayMs = ((node.config.delayMinutes as number) || 0) * 60 * 1000

    // In a real implementation, this would schedule continuation
    // For now, we just simulate a short delay
    await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 1000)))

    return { output: { delayed: true, delayMs } }
  },

  /**
   * Output nodes - end the workflow
   */
  output: async (node, context) => {
    // Output nodes collect final results
    const outputMapping = node.config.mapping as Record<string, string> | undefined

    if (outputMapping) {
      const output: Record<string, unknown> = {}
      for (const [outputKey, sourcePath] of Object.entries(outputMapping)) {
        output[outputKey] = getNestedValue(context, sourcePath)
      }
      return { output }
    }

    return { output: context }
  },
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

/**
 * Compile and execute a workflow
 */
export async function executeWorkflow(
  workflowId: string,
  triggerData: Record<string, unknown>
): Promise<WorkflowExecution> {
  const supabase = createServiceClient()

  // Get workflow definition
  const { data: workflow, error: fetchError } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', workflowId)
    .eq('is_active', true)
    .maybeSingle()

  if (fetchError || !workflow) {
    throw new Error('Workflow not found or inactive')
  }

  const definition = workflow as WorkflowDefinition

  // Create execution record
  const { data: execution, error: createError } = await supabase
    .from('workflow_executions')
    .insert({
      workflow_id: workflowId,
      status: 'running',
      trigger_data: triggerData,
      results: {},
      started_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle()

  if (createError || !execution) {
    throw new Error('Failed to create execution record')
  }

  // Build node map for quick lookup
  const nodeMap = new Map(definition.nodes.map(n => [n.id, n]))
  
  // Build adjacency list for edges
  const edgeMap = new Map<string, WorkflowEdge[]>()
  for (const edge of definition.edges) {
    const edges = edgeMap.get(edge.source) || []
    edges.push(edge)
    edgeMap.set(edge.source, edges)
  }

  // Find trigger node
  const triggerNode = definition.nodes.find(n => n.type === 'trigger')
  if (!triggerNode) {
    throw new Error('Workflow has no trigger node')
  }

  // Execute workflow
  const context: Record<string, unknown> = { triggerData }
  const results: Record<string, unknown> = {}
  let currentNodeId: string | undefined = triggerNode.id
  let error: string | undefined

  try {
    while (currentNodeId) {
      const node = nodeMap.get(currentNodeId)
      if (!node) {
        throw new Error(`Node not found: ${currentNodeId}`)
      }

      // Update current node
      await supabase
        .from('workflow_executions')
        .update({ current_node_id: currentNodeId })
        .eq('id', execution.id)

      // Execute node
      const handler = nodeHandlers[node.type]
      if (!handler) {
        throw new Error(`Unknown node type: ${node.type}`)
      }

      const result = await handler(node, context)
      results[node.id] = result.output
      context[`node_${node.id}`] = result.output

      // Find next node
      if (result.nextNodeId) {
        // Condition node specified next node
        currentNodeId = result.nextNodeId
      } else {
        // Follow edges
        const edges = edgeMap.get(currentNodeId)
        if (edges && edges.length > 0) {
          // For now, just take the first edge
          // A real implementation would handle multiple edges
          currentNodeId = edges[0].target
        } else {
          // No more edges - workflow complete
          currentNodeId = undefined
        }
      }
    }
  } catch (err) {
    error = (err as Error).message
  }

  // Update execution record
  const finalStatus = error ? 'failed' : 'completed'
  await supabase
    .from('workflow_executions')
    .update({
      status: finalStatus,
      results,
      error,
      completed_at: new Date().toISOString(),
    })
    .eq('id', execution.id)

  return {
    id: execution.id,
    workflow_id: workflowId,
    status: finalStatus,
    trigger_data: triggerData,
    results,
    started_at: execution.started_at,
    completed_at: new Date().toISOString(),
    error,
  }
}

/**
 * Get workflow by ID
 */
export async function getWorkflow(workflowId: string): Promise<WorkflowDefinition | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', workflowId)
    .maybeSingle()

  if (error) {
    return null
  }

  return data as WorkflowDefinition
}

/**
 * Get workflow executions
 */
export async function getWorkflowExecutions(
  workflowId: string,
  limit: number = 20
): Promise<WorkflowExecution[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('workflow_executions')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) {
    return []
  }

  return data as WorkflowExecution[]
}

/**
 * Cancel a running workflow execution
 */
export async function cancelWorkflowExecution(executionId: string): Promise<boolean> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('workflow_executions')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', executionId)
    .eq('status', 'running')

  return !error
}

/**
 * Validate workflow definition
 */
export function validateWorkflow(definition: Partial<WorkflowDefinition>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!definition.nodes || definition.nodes.length === 0) {
    errors.push('Workflow must have at least one node')
  }

  // Check for trigger node
  const triggerNodes = definition.nodes?.filter(n => n.type === 'trigger') || []
  if (triggerNodes.length === 0) {
    errors.push('Workflow must have a trigger node')
  } else if (triggerNodes.length > 1) {
    errors.push('Workflow can only have one trigger node')
  }

  // Check for orphan nodes (no incoming or outgoing edges)
  if (definition.nodes && definition.edges) {
    const connectedNodes = new Set<string>()
    for (const edge of definition.edges) {
      connectedNodes.add(edge.source)
      connectedNodes.add(edge.target)
    }

    for (const node of definition.nodes) {
      if (node.type !== 'trigger' && !connectedNodes.has(node.id)) {
        errors.push(`Node "${node.name}" is not connected to the workflow`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
