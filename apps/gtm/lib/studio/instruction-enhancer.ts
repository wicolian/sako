/**
 * Studio Instruction Enhancer
 * 
 * AI-powered enhancement of app instructions for better output quality.
 * Features:
 * - Instruction clarity improvement
 * - Structure recommendations
 * - Variable placeholder suggestions
 * - Example output generation
 */

import { generateText, streamText } from '@/lib/ai/langsmith-ai'
import { getModel } from '@/lib/ai/model-router'
import type { AppInput } from './types'

// ============================================================================
// Types
// ============================================================================

export interface EnhanceInstructionsOptions {
  currentInstructions: string
  inputs: AppInput[]
  appCategory?: string
  desiredOutput?: string
}

export interface EnhancedInstructions {
  enhanced: string
  improvements: string[]
  suggestedStructure?: string
  suggestedVariables: Array<{
    name: string
    reason: string
  }>
  confidence: number
}

export interface SuggestedResponseOptions {
  input: AppInput
  context?: string
  count?: number
}

export interface InstructionTemplate {
  id: string
  name: string
  category: string
  template: string
  variables: string[]
  description: string
}

// ============================================================================
// Instruction Enhancer
// ============================================================================

/**
 * Enhance app instructions using AI
 */
export async function enhanceInstructions(
  options: EnhanceInstructionsOptions
): Promise<EnhancedInstructions> {
  const { currentInstructions, inputs, appCategory, desiredOutput } = options
  
  const inputList = inputs.map(i => `- ${i.name} (${i.type}): ${i.label}`).join('\n')
  
  const prompt = `You are an expert prompt engineer. Enhance these instructions for an AI app builder.

Current Instructions:
${currentInstructions}

Available Input Variables:
${inputList || 'None defined yet'}

App Category: ${appCategory || 'General'}
${desiredOutput ? `Desired Output Type: ${desiredOutput}` : ''}

Please enhance these instructions to be:
1. Clear and specific about what the AI should produce
2. Well-structured with logical sections
3. Using {{variable_name}} placeholders for all dynamic inputs
4. Including tone, style, and format guidance
5. Having clear success criteria

Return a JSON object with:
{
  "enhanced": "The improved instructions text",
  "improvements": ["List of specific improvements made"],
  "suggestedStructure": "Optional suggested structure for the output",
  "suggestedVariables": [{"name": "var_name", "reason": "Why this variable would help"}],
  "confidence": 0.0-1.0 confidence score
}

Only return valid JSON, no other text.`

  const model = await getModel('anthropic/claude-sonnet-4.6')
  
  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.7,
  })
  
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }
    
    const result = JSON.parse(jsonMatch[0])
    
    return {
      enhanced: result.enhanced || currentInstructions,
      improvements: result.improvements || [],
      suggestedStructure: result.suggestedStructure,
      suggestedVariables: result.suggestedVariables || [],
      confidence: result.confidence || 0.5,
    }
  } catch (error) {
    console.error('Failed to parse enhanced instructions:', error)
    return {
      enhanced: currentInstructions,
      improvements: ['Could not enhance instructions. Please try again.'],
      suggestedVariables: [],
      confidence: 0,
    }
  }
}

/**
 * Generate suggested responses for an input field
 */
export async function generateSuggestedResponses(
  options: SuggestedResponseOptions
): Promise<string[]> {
  const { input, context, count = 5 } = options
  
  const prompt = `Generate ${count} realistic example values for this input field:

Field Name: ${input.label}
Field Type: ${input.type}
${input.description ? `Description: ${input.description}` : ''}
${input.placeholder ? `Placeholder hint: ${input.placeholder}` : ''}
${context ? `App Context: ${context}` : ''}

Requirements:
- Generate ${count} diverse, realistic examples
- Match the expected format for the field type
- Be specific and actionable
- Vary in length/complexity

Return ONLY a JSON array of ${count} strings, no other text.
Example: ["Example 1", "Example 2", "Example 3"]`

  const model = await getModel('openai/gpt-5.3-chat')
  
  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.8,
  })
  
  try {
    const suggestions = JSON.parse(text)
    if (Array.isArray(suggestions)) {
      return suggestions.slice(0, count)
    }
    return []
  } catch {
    // Try to extract array from response
    const arrayMatch = text.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]).slice(0, count)
      } catch {
        return []
      }
    }
    return []
  }
}

/**
 * Generate example output for the app
 */
export async function generateExampleOutput(
  instructions: string,
  inputs: AppInput[],
  sampleInputs?: Record<string, string>
): Promise<string> {
  // Create sample input values if not provided
  const samples = sampleInputs || {}
  for (const input of inputs) {
    if (!samples[input.name]) {
      samples[input.name] = input.default_value || `[${input.label}]`
    }
  }
  
  // Replace placeholders with sample values
  let populatedInstructions = instructions
  for (const [key, value] of Object.entries(samples)) {
    populatedInstructions = populatedInstructions.replace(
      new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
      value
    )
  }
  
  const model = await getModel('anthropic/claude-sonnet-4.6')

  const { text } = await generateText({
    model,
    prompt: populatedInstructions,
    temperature: 0.7,
    maxOutputTokens: 1000,
  })
  
  return text
}

/**
 * Analyze instructions for potential issues
 */
export function analyzeInstructions(instructions: string, inputs: AppInput[]): {
  issues: Array<{ type: 'warning' | 'error' | 'suggestion'; message: string }>
  score: number
} {
  const issues: Array<{ type: 'warning' | 'error' | 'suggestion'; message: string }> = []
  let score = 100
  
  // Check if instructions are empty
  if (!instructions.trim()) {
    issues.push({ type: 'error', message: 'Instructions are empty' })
    return { issues, score: 0 }
  }
  
  // Check instruction length
  if (instructions.length < 50) {
    issues.push({ type: 'warning', message: 'Instructions are very short. Add more detail for better results.' })
    score -= 15
  }
  
  // Check for variable usage
  const usedVariables = instructions.match(/\{\{(\w+)\}\}/g) || []
  const usedVarNames = usedVariables.map(v => v.replace(/\{\{|\}\}/g, ''))
  
  // Check if all defined inputs are used
  for (const input of inputs) {
    if (!usedVarNames.includes(input.name)) {
      issues.push({
        type: 'warning',
        message: `Input "${input.label}" ({{${input.name}}}) is defined but not used in instructions`,
      })
      score -= 10
    }
  }
  
  // Check for undefined variables
  const inputNames = inputs.map(i => i.name)
  for (const varName of usedVarNames) {
    if (!inputNames.includes(varName)) {
      issues.push({
        type: 'error',
        message: `Variable "{{${varName}}}" is used but not defined as an input`,
      })
      score -= 20
    }
  }
  
  // Check for common best practices
  if (!instructions.toLowerCase().includes('format') && !instructions.toLowerCase().includes('structure')) {
    issues.push({
      type: 'suggestion',
      message: 'Consider adding output format/structure guidance',
    })
    score -= 5
  }
  
  if (!instructions.toLowerCase().includes('tone') && !instructions.toLowerCase().includes('style')) {
    issues.push({
      type: 'suggestion',
      message: 'Consider specifying desired tone or style',
    })
    score -= 5
  }
  
  if (instructions.length > 3000) {
    issues.push({
      type: 'warning',
      message: 'Instructions are very long. Consider being more concise.',
    })
    score -= 10
  }
  
  return { issues, score: Math.max(0, score) }
}

// ============================================================================
// Instruction Templates
// ============================================================================

export const INSTRUCTION_TEMPLATES: InstructionTemplate[] = [
  {
    id: 'blog-post',
    name: 'Blog Post Generator',
    category: 'content',
    description: 'Generate SEO-optimized blog posts',
    variables: ['topic', 'keywords', 'word_count', 'tone'],
    template: `Write a comprehensive blog post about {{topic}}.

Target keywords: {{keywords}}
Approximate length: {{word_count}} words
Tone: {{tone}}

Requirements:
- Include an engaging introduction with a hook
- Use H2 and H3 subheadings for structure
- Include relevant statistics or examples
- End with a clear conclusion and call-to-action
- Optimize for the target keywords naturally

Format the output in Markdown.`,
  },
  {
    id: 'email-sequence',
    name: 'Email Sequence Writer',
    category: 'email',
    description: 'Create multi-email nurture sequences',
    variables: ['product', 'goal', 'email_count', 'audience'],
    template: `Create a {{email_count}}-email nurture sequence for {{product}}.

Goal: {{goal}}
Target audience: {{audience}}

For each email, include:
1. Subject line (with emoji option)
2. Preview text
3. Email body with personalization tokens
4. Call-to-action button text

The sequence should:
- Build progressively from awareness to conversion
- Address common objections
- Include social proof elements
- Have clear next steps

Format each email clearly separated.`,
  },
  {
    id: 'social-thread',
    name: 'Social Media Thread',
    category: 'social',
    description: 'Create engaging social media threads',
    variables: ['topic', 'platform', 'thread_length', 'key_points'],
    template: `Create a {{thread_length}}-post thread about {{topic}} for {{platform}}.

Key points to cover:
{{key_points}}

Requirements:
- Start with a compelling hook
- Each post should stand alone but flow naturally
- Include relevant hashtags
- End with engagement questions
- Stay within platform character limits

Format: Number each post (1/X format) with a blank line between.`,
  },
  {
    id: 'ad-copy',
    name: 'Ad Copy Generator',
    category: 'ads',
    description: 'Create high-converting ad copy',
    variables: ['product', 'benefit', 'audience', 'platform', 'cta'],
    template: `Write compelling ad copy for {{product}}.

Main benefit: {{benefit}}
Target audience: {{audience}}
Platform: {{platform}}
Call-to-action: {{cta}}

Create 3 variations:
1. Benefit-focused (lead with the transformation)
2. Problem-focused (address the pain point)
3. Social proof-focused (lead with credibility)

For each variation, provide:
- Headline (25 chars max)
- Primary text (125 chars max)
- Description (if applicable)

Make it scroll-stopping and action-oriented.`,
  },
  {
    id: 'product-description',
    name: 'Product Description',
    category: 'content',
    description: 'Write compelling product descriptions',
    variables: ['product_name', 'features', 'target_customer', 'price_point'],
    template: `Write a compelling product description for {{product_name}}.

Key features:
{{features}}

Target customer: {{target_customer}}
Price positioning: {{price_point}}

Include:
- A headline that captures attention
- 2-3 sentence hook addressing the customer's desire
- Feature-benefit bullets (emphasize benefits over features)
- Trust indicators
- Clear call-to-action

Tone should match the price positioning (premium = sophisticated, budget = friendly).`,
  },
]

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): InstructionTemplate | undefined {
  return INSTRUCTION_TEMPLATES.find(t => t.id === templateId)
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): InstructionTemplate[] {
  return INSTRUCTION_TEMPLATES.filter(t => t.category === category)
}
