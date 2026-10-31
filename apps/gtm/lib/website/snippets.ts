/**
 * Snippets System
 * 
 * Reusable patterns and effects:
 * - Animation presets
 * - Interaction patterns
 * - Custom CSS effects
 * - User-saved snippets
 */

import { createServiceClient } from '@/lib/supabase/service'

// ============================================================================
// Types
// ============================================================================

export interface Snippet {
  id: string
  workspace_id?: string
  name: string
  description?: string
  type: SnippetType
  category: string
  html?: string
  css?: string
  js?: string
  thumbnail_url?: string
  preview_url?: string
  is_public: boolean
  usage_count: number
  created_by?: string
  created_at: string
  updated_at: string
}

export type SnippetType = 'animation' | 'interaction' | 'layout' | 'effect' | 'component'

export interface CreateSnippetInput {
  workspaceId?: string
  name: string
  description?: string
  type: SnippetType
  category: string
  html?: string
  css?: string
  js?: string
  thumbnailUrl?: string
  previewUrl?: string
  isPublic?: boolean
}

// ============================================================================
// Built-in Snippets
// ============================================================================

export const BUILT_IN_SNIPPETS: Omit<Snippet, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'created_by'>[] = [
  // Animations
  {
    name: 'Fade In Up',
    description: 'Element fades in while moving up',
    type: 'animation',
    category: 'entrance',
    css: `@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fadeInUp 0.5s ease-out forwards;
}`,
    is_public: true,
  },
  {
    name: 'Fade In Down',
    description: 'Element fades in while moving down',
    type: 'animation',
    category: 'entrance',
    css: `@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-down {
  animation: fadeInDown 0.5s ease-out forwards;
}`,
    is_public: true,
  },
  {
    name: 'Scale In',
    description: 'Element scales up from smaller size',
    type: 'animation',
    category: 'entrance',
    css: `@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.scale-in {
  animation: scaleIn 0.3s ease-out forwards;
}`,
    is_public: true,
  },
  {
    name: 'Slide In Left',
    description: 'Element slides in from the left',
    type: 'animation',
    category: 'entrance',
    css: `@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.slide-in-left {
  animation: slideInLeft 0.4s ease-out forwards;
}`,
    is_public: true,
  },
  {
    name: 'Bounce',
    description: 'Bouncy attention-grabbing animation',
    type: 'animation',
    category: 'attention',
    css: `@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-20px);
  }
  60% {
    transform: translateY(-10px);
  }
}

.bounce {
  animation: bounce 1s ease infinite;
}`,
    is_public: true,
  },
  {
    name: 'Pulse',
    description: 'Subtle pulsing scale effect',
    type: 'animation',
    category: 'attention',
    css: `@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.pulse {
  animation: pulse 2s ease-in-out infinite;
}`,
    is_public: true,
  },
  {
    name: 'Shake',
    description: 'Horizontal shake for errors',
    type: 'animation',
    category: 'attention',
    css: `@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.shake {
  animation: shake 0.5s ease-in-out;
}`,
    is_public: true,
  },

  // Interactions
  {
    name: 'Hover Lift',
    description: 'Card lifts on hover with shadow',
    type: 'interaction',
    category: 'hover',
    css: `.hover-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
}`,
    is_public: true,
  },
  {
    name: 'Hover Scale',
    description: 'Element scales up on hover',
    type: 'interaction',
    category: 'hover',
    css: `.hover-scale {
  transition: transform 0.2s ease;
}

.hover-scale:hover {
  transform: scale(1.05);
}`,
    is_public: true,
  },
  {
    name: 'Hover Glow',
    description: 'Glowing effect on hover',
    type: 'interaction',
    category: 'hover',
    css: `.hover-glow {
  transition: box-shadow 0.3s ease;
}

.hover-glow:hover {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
}`,
    is_public: true,
  },
  {
    name: 'Button Press',
    description: 'Button press effect on click',
    type: 'interaction',
    category: 'click',
    css: `.button-press {
  transition: transform 0.1s ease;
}

.button-press:active {
  transform: scale(0.95);
}`,
    is_public: true,
  },

  // Effects
  {
    name: 'Glass Effect',
    description: 'Frosted glass background',
    type: 'effect',
    category: 'background',
    css: `.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}`,
    is_public: true,
  },
  {
    name: 'Gradient Text',
    description: 'Gradient fill for text',
    type: 'effect',
    category: 'text',
    css: `.gradient-text {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}`,
    is_public: true,
  },
  {
    name: 'Soft Shadow',
    description: 'Modern soft shadow',
    type: 'effect',
    category: 'shadow',
    css: `.soft-shadow {
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.02),
    0 4px 8px rgba(0, 0, 0, 0.04),
    0 8px 16px rgba(0, 0, 0, 0.06);
}`,
    is_public: true,
  },
  {
    name: 'Glow Shadow',
    description: 'Colored glow effect',
    type: 'effect',
    category: 'shadow',
    css: `.glow-shadow {
  box-shadow: 0 0 30px rgba(99, 102, 241, 0.3);
}`,
    is_public: true,
  },

  // Layout
  {
    name: 'Container',
    description: 'Responsive centered container',
    type: 'layout',
    category: 'container',
    css: `.container {
  width: 100%;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 1rem;
  padding-right: 1rem;
}

@media (min-width: 768px) {
  .container {
    padding-left: 2rem;
    padding-right: 2rem;
  }
}`,
    is_public: true,
  },
  {
    name: 'Grid Auto-fit',
    description: 'Auto-responsive grid',
    type: 'layout',
    category: 'grid',
    css: `.grid-auto {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}`,
    is_public: true,
  },
]

// ============================================================================
// Snippet Manager
// ============================================================================

export class SnippetManager {
  /**
   * Create a snippet
   */
  static async createSnippet(
    userId: string,
    input: CreateSnippetInput
  ): Promise<Snippet> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('snippets')
      .insert({
        workspace_id: input.workspaceId,
        name: input.name,
        description: input.description,
        type: input.type,
        category: input.category,
        html: input.html,
        css: input.css,
        js: input.js,
        thumbnail_url: input.thumbnailUrl,
        preview_url: input.previewUrl,
        is_public: input.isPublic || false,
        created_by: userId,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create snippet: ${error.message}`)
    }

    return data
  }

  /**
   * Get snippets
   */
  static async getSnippets(options?: {
    workspaceId?: string
    type?: SnippetType
    category?: string
    includePublic?: boolean
  }): Promise<Snippet[]> {
    const supabase = createServiceClient()

    let query = supabase.from('snippets').select('*')

    if (options?.workspaceId) {
      if (options.includePublic !== false) {
        query = query.or(`workspace_id.eq.${options.workspaceId},is_public.eq.true`)
      } else {
        query = query.eq('workspace_id', options.workspaceId)
      }
    } else if (options?.includePublic !== false) {
      query = query.eq('is_public', true)
    }

    if (options?.type) {
      query = query.eq('type', options.type)
    }

    if (options?.category) {
      query = query.eq('category', options.category)
    }

    query = query.order('usage_count', { ascending: false })

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get snippets: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get a single snippet
   */
  static async getSnippet(snippetId: string): Promise<Snippet | null> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('snippets')
      .select('*')
      .eq('id', snippetId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to get snippet: ${error.message}`)
    }

    return data
  }

  /**
   * Update a snippet
   */
  static async updateSnippet(
    snippetId: string,
    input: Partial<CreateSnippetInput>
  ): Promise<Snippet> {
    const supabase = createServiceClient()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (input.name !== undefined) updateData.name = input.name
    if (input.description !== undefined) updateData.description = input.description
    if (input.type !== undefined) updateData.type = input.type
    if (input.category !== undefined) updateData.category = input.category
    if (input.html !== undefined) updateData.html = input.html
    if (input.css !== undefined) updateData.css = input.css
    if (input.js !== undefined) updateData.js = input.js
    if (input.thumbnailUrl !== undefined) updateData.thumbnail_url = input.thumbnailUrl
    if (input.isPublic !== undefined) updateData.is_public = input.isPublic

    const { data, error } = await supabase
      .from('snippets')
      .update(updateData)
      .eq('id', snippetId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update snippet: ${error.message}`)
    }

    return data
  }

  /**
   * Delete a snippet
   */
  static async deleteSnippet(snippetId: string): Promise<void> {
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('snippets')
      .delete()
      .eq('id', snippetId)

    if (error) {
      throw new Error(`Failed to delete snippet: ${error.message}`)
    }
  }

  /**
   * Increment usage count
   */
  static async incrementUsage(snippetId: string): Promise<void> {
    const supabase = createServiceClient()

    await supabase.rpc('increment_snippet_usage', { snippet_id: snippetId })
  }

  /**
   * Save snippet to user's collection
   */
  static async saveSnippet(userId: string, snippetId: string): Promise<void> {
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('user_snippets')
      .insert({
        user_id: userId,
        snippet_id: snippetId,
      })

    if (error && error.code !== '23505') { // Ignore duplicate error
      throw new Error(`Failed to save snippet: ${error.message}`)
    }
  }

  /**
   * Remove snippet from user's collection
   */
  static async unsaveSnippet(userId: string, snippetId: string): Promise<void> {
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('user_snippets')
      .delete()
      .eq('user_id', userId)
      .eq('snippet_id', snippetId)

    if (error) {
      throw new Error(`Failed to unsave snippet: ${error.message}`)
    }
  }

  /**
   * Get user's saved snippets
   */
  static async getSavedSnippets(userId: string): Promise<Snippet[]> {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('user_snippets')
      .select('snippet:snippets(*)')
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to get saved snippets: ${error.message}`)
    }

    return (data || []).map(d => d.snippet as unknown as Snippet)
  }
}

// ============================================================================
// Snippet Categories
// ============================================================================

export const SNIPPET_CATEGORIES = {
  animation: [
    { id: 'entrance', name: 'Entrance' },
    { id: 'exit', name: 'Exit' },
    { id: 'attention', name: 'Attention' },
    { id: 'loop', name: 'Looping' },
  ],
  interaction: [
    { id: 'hover', name: 'Hover' },
    { id: 'click', name: 'Click' },
    { id: 'scroll', name: 'Scroll' },
    { id: 'drag', name: 'Drag' },
  ],
  layout: [
    { id: 'container', name: 'Container' },
    { id: 'grid', name: 'Grid' },
    { id: 'flex', name: 'Flexbox' },
    { id: 'spacing', name: 'Spacing' },
  ],
  effect: [
    { id: 'background', name: 'Background' },
    { id: 'shadow', name: 'Shadow' },
    { id: 'text', name: 'Text' },
    { id: 'border', name: 'Border' },
  ],
  component: [
    { id: 'button', name: 'Button' },
    { id: 'card', name: 'Card' },
    { id: 'nav', name: 'Navigation' },
    { id: 'form', name: 'Form' },
  ],
}
