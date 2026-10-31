/**
 * Studio Types
 * 
 * Type definitions for the no-code AI app builder.
 */

export interface StudioApp {
  id: string
  workspace_id: string
  name: string
  description?: string
  icon: string
  category: 'content' | 'email' | 'social' | 'ads' | 'custom'
  
  // Builder configuration
  inputs: AppInput[]
  instructions: string // Dynamic instructions with {{placeholders}}
  example_output?: string
  
  // AI configuration
  model: string
  temperature: number
  max_tokens?: number
  
  // Context attachments
  knowledge_items: string[]
  default_brand_id?: string
  default_audience_id?: string
  
  // Publishing
  visibility: 'private' | 'workspace' | 'public'
  published_at?: string
  
  // Stats
  run_count: number
  last_run_at?: string
  
  // Ownership
  created_by: string
  created_at: string
  updated_at: string
}

export interface AppInput {
  id: string
  name: string // Variable name for referencing (e.g., "product_name")
  label: string // Display label
  type: AppInputType
  required: boolean
  placeholder?: string
  default_value?: string
  options?: string[] // For dropdown/checkboxes
  description?: string
  knowledge_filter?: string // For file_upload: filter KB items
}

export type AppInputType = 
  | 'short_answer'
  | 'paragraph'
  | 'dropdown'
  | 'checkboxes'
  | 'tags'
  | 'file_upload'

export interface AppRun {
  id: string
  app_id: string
  user_id: string
  inputs: Record<string, unknown>
  output?: string
  model: string
  tokens_used?: number
  latency_ms?: number
  brand_id?: string
  audience_id?: string
  knowledge_items: string[]
  status: 'running' | 'completed' | 'failed'
  error_message?: string
  created_at: string
}

export interface CreateAppInput {
  name: string
  description?: string
  icon?: string
  category?: StudioApp['category']
  inputs?: AppInput[]
  instructions: string
  example_output?: string
  model?: string
  temperature?: number
  max_tokens?: number
  knowledge_items?: string[]
  default_brand_id?: string
  default_audience_id?: string
}

export interface RunAppInput {
  inputs: Record<string, unknown>
  brand_id?: string
  audience_id?: string
  knowledge_ids?: string[]
}

// Default models from the allowlist (OpenRouter Mar 2026 - LATEST!)
// Note: gpt-*pro and *codex excluded for cost
export const STUDIO_MODELS = [
  { id: 'openai/gpt-5.3-chat', name: 'GPT-5.3 Chat', provider: 'OpenAI', tier: 'fast', context: '128K' },
  { id: 'openai/gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI', tier: 'balanced', context: '1.05M' },
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', tier: 'creative', context: '1M' },
  { id: 'anthropic/claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'Anthropic', tier: 'reasoning', context: '1M' },
  { id: 'google/gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', provider: 'Google', tier: 'multimodal', context: '1M', isNew: true },
] as const

export const APP_CATEGORIES = [
  { id: 'content', label: 'Content', icon: '📝', description: 'Blog posts, articles, copy' },
  { id: 'email', label: 'Email', icon: '📧', description: 'Email campaigns, sequences' },
  { id: 'social', label: 'Social', icon: '📱', description: 'Social media posts' },
  { id: 'ads', label: 'Ads', icon: '📢', description: 'Ad copy, headlines' },
  { id: 'custom', label: 'Custom', icon: '🔧', description: 'Custom use cases' },
] as const

export const INPUT_TYPES = [
  { id: 'short_answer', label: 'Short Answer', description: 'Single line text input' },
  { id: 'paragraph', label: 'Paragraph', description: 'Multi-line text area' },
  { id: 'dropdown', label: 'Dropdown', description: 'Select from options' },
  { id: 'checkboxes', label: 'Checkboxes', description: 'Multiple selection' },
  { id: 'tags', label: 'Tags', description: 'Comma-separated tags' },
  { id: 'file_upload', label: 'Knowledge File', description: 'Select from Knowledge Base' },
] as const
