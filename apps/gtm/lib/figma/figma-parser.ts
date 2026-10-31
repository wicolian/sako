/**
 * Figma Parser
 * 
 * Converts Figma nodes to WebsiteSection format
 */

import type { 
  FigmaNode, 
  FigmaFill, 
  FigmaTextStyle,
  FigmaColor,
} from './figma-client'
import { figmaColorToHex } from './figma-client'
import type { 
  WebsiteSection, 
  WebsiteDesign, 
  SectionType,
  SectionContent,
  SectionStyles,
  GlobalStyles,
} from '@/lib/website/ai-designer'

export interface ParsedDesign {
  name: string
  sections: WebsiteSection[]
  globalStyles: GlobalStyles
  extractedColors: string[]
  extractedFonts: string[]
}

/**
 * Parse a Figma frame/node into a WebsiteSection
 */
export function parseFigmaNode(node: FigmaNode, order: number): WebsiteSection {
  const sectionType = inferSectionType(node)
  const content = extractContent(node)
  const styles = extractStyles(node)

  return {
    id: `figma-${node.id}-${Date.now()}`,
    type: sectionType,
    order,
    content,
    styles,
  }
}

/**
 * Parse an entire Figma file/page into sections
 */
export function parseFigmaPage(nodes: FigmaNode[]): ParsedDesign {
  const sections: WebsiteSection[] = []
  const colors = new Set<string>()
  const fonts = new Set<string>()

  // Process each top-level frame as a section
  nodes.forEach((node, index) => {
    if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'SECTION') {
      sections.push(parseFigmaNode(node, index))
      
      // Extract colors and fonts
      extractColorsFromNode(node, colors)
      extractFontsFromNode(node, fonts)
    }
  })

  // Determine global styles from extracted data
  const globalStyles = inferGlobalStyles(Array.from(colors), Array.from(fonts))

  return {
    name: 'Imported Design',
    sections,
    globalStyles,
    extractedColors: Array.from(colors),
    extractedFonts: Array.from(fonts),
  }
}

/**
 * Infer section type from node name and structure
 */
function inferSectionType(node: FigmaNode): SectionType {
  const name = node.name.toLowerCase()

  // Check by name patterns
  if (name.includes('hero') || name.includes('header') || name.includes('banner')) {
    return 'hero'
  }
  if (name.includes('feature') || name.includes('benefit')) {
    return 'features'
  }
  if (name.includes('testimonial') || name.includes('review') || name.includes('quote')) {
    return 'testimonials'
  }
  if (name.includes('pricing') || name.includes('plan')) {
    return 'pricing'
  }
  if (name.includes('faq') || name.includes('question')) {
    return 'faq'
  }
  if (name.includes('cta') || name.includes('call to action') || name.includes('signup')) {
    return 'cta'
  }
  if (name.includes('about') || name.includes('story')) {
    return 'about'
  }
  if (name.includes('team') || name.includes('people')) {
    return 'team'
  }
  if (name.includes('contact') || name.includes('form')) {
    return 'contact'
  }
  if (name.includes('stat') || name.includes('number') || name.includes('metric')) {
    return 'stats'
  }
  if (name.includes('logo') || name.includes('partner') || name.includes('client')) {
    return 'logos'
  }
  if (name.includes('gallery') || name.includes('portfolio')) {
    return 'gallery'
  }
  if (name.includes('footer')) {
    return 'cta' // Footer is often a CTA
  }

  // Check by structure
  const hasRepeatingChildren = hasRepeatingPattern(node)
  if (hasRepeatingChildren) {
    return 'features' // Default repeating pattern to features
  }

  return 'custom'
}

/**
 * Extract content from a node
 */
function extractContent(node: FigmaNode): SectionContent {
  const content: SectionContent = {}
  const textNodes = findTextNodes(node)

  // Sort by size (largest text is likely headline)
  textNodes.sort((a, b) => {
    const sizeA = a.style?.fontSize || 0
    const sizeB = b.style?.fontSize || 0
    return sizeB - sizeA
  })

  // Assign text to content fields
  if (textNodes.length > 0) {
    content.headline = textNodes[0].characters
  }
  if (textNodes.length > 1) {
    content.subheadline = textNodes[1].characters
  }
  if (textNodes.length > 2) {
    content.description = textNodes.slice(2).map(t => t.characters).join(' ')
  }

  // Find button-like elements for CTA
  const buttons = findButtonNodes(node)
  if (buttons.length > 0) {
    const buttonText = findTextNodes(buttons[0])[0]
    content.cta = {
      text: buttonText?.characters || 'Learn More',
      link: '#',
      variant: 'primary',
    }
  }
  if (buttons.length > 1) {
    const buttonText = findTextNodes(buttons[1])[0]
    content.secondaryCta = {
      text: buttonText?.characters || 'Learn More',
      link: '#',
    }
  }

  // Find repeating items (for features, testimonials, etc.)
  const items = extractItems(node)
  if (items.length > 0) {
    content.items = items
  }

  return content
}

/**
 * Extract styles from a node
 */
function extractStyles(node: FigmaNode): SectionStyles {
  const styles: SectionStyles = {
    layout: 'centered',
    alignment: 'center',
    background: 'white',
    spacing: 'normal',
  }

  // Determine layout from auto-layout
  if (node.layoutMode === 'HORIZONTAL') {
    styles.layout = 'split'
  } else if (node.layoutMode === 'VERTICAL') {
    styles.layout = 'list'
  }

  // Check for grid patterns
  const hasGrid = hasGridPattern(node)
  if (hasGrid) {
    styles.layout = 'cards'
    styles.columns = countGridColumns(node)
  }

  // Determine alignment
  if (node.primaryAxisAlignItems === 'MIN') {
    styles.alignment = 'left'
  } else if (node.primaryAxisAlignItems === 'MAX') {
    styles.alignment = 'right'
  }

  // Determine background
  if (node.fills && node.fills.length > 0) {
    const fill = node.fills.find(f => f.visible !== false)
    if (fill?.type === 'SOLID' && fill.color) {
      const brightness = getBrightness(fill.color)
      if (brightness < 0.3) {
        styles.background = 'dark'
      } else if (brightness < 0.95) {
        styles.background = 'light'
      }
    } else if (fill?.type === 'GRADIENT_LINEAR' || fill?.type === 'GRADIENT_RADIAL') {
      styles.background = 'gradient'
    }
  }

  // Determine spacing from padding
  const padding = Math.max(
    node.paddingTop || 0,
    node.paddingBottom || 0
  )
  if (padding < 40) {
    styles.spacing = 'compact'
  } else if (padding > 80) {
    styles.spacing = 'spacious'
  }

  return styles
}

/**
 * Find all text nodes in a subtree
 */
function findTextNodes(node: FigmaNode): FigmaNode[] {
  const textNodes: FigmaNode[] = []

  function traverse(n: FigmaNode) {
    if (n.type === 'TEXT' && n.characters) {
      textNodes.push(n)
    }
    if (n.children) {
      n.children.forEach(traverse)
    }
  }

  traverse(node)
  return textNodes
}

/**
 * Find button-like nodes
 */
function findButtonNodes(node: FigmaNode): FigmaNode[] {
  const buttons: FigmaNode[] = []

  function traverse(n: FigmaNode) {
    const name = n.name.toLowerCase()
    if (
      (name.includes('button') || name.includes('btn') || name.includes('cta')) &&
      (n.type === 'FRAME' || n.type === 'INSTANCE' || n.type === 'COMPONENT')
    ) {
      buttons.push(n)
    }
    if (n.children) {
      n.children.forEach(traverse)
    }
  }

  traverse(node)
  return buttons
}

/**
 * Extract repeating items from a node
 */
function extractItems(node: FigmaNode): Array<{ title: string; description: string; icon?: string }> {
  const items: Array<{ title: string; description: string; icon?: string }> = []

  if (!node.children) return items

  // Look for repeating frame patterns
  const frameChildren = node.children.filter(c => 
    c.type === 'FRAME' || c.type === 'INSTANCE' || c.type === 'COMPONENT'
  )

  // If we have 2+ similar frames, treat them as items
  if (frameChildren.length >= 2) {
    frameChildren.forEach(child => {
      const texts = findTextNodes(child)
      if (texts.length > 0) {
        items.push({
          title: texts[0].characters || '',
          description: texts.slice(1).map(t => t.characters).join(' ') || '',
        })
      }
    })
  }

  return items
}

/**
 * Check if node has repeating child pattern
 */
function hasRepeatingPattern(node: FigmaNode): boolean {
  if (!node.children || node.children.length < 2) return false

  const frameChildren = node.children.filter(c => 
    c.type === 'FRAME' || c.type === 'INSTANCE'
  )

  return frameChildren.length >= 2
}

/**
 * Check if node has grid pattern
 */
function hasGridPattern(node: FigmaNode): boolean {
  if (!node.children || node.children.length < 2) return false

  // Check if children are arranged in rows
  const frameChildren = node.children.filter(c => 
    c.type === 'FRAME' || c.type === 'INSTANCE'
  )

  if (frameChildren.length < 3) return false

  // Check for similar Y positions (same row)
  const yPositions = frameChildren
    .map(c => c.absoluteBoundingBox?.y || 0)
    .filter((y, i, arr) => arr.indexOf(y) === i)

  return yPositions.length < frameChildren.length
}

/**
 * Count grid columns
 */
function countGridColumns(node: FigmaNode): number {
  if (!node.children) return 3

  const frameChildren = node.children.filter(c => 
    c.type === 'FRAME' || c.type === 'INSTANCE'
  )

  // Count items in the first row
  const firstRowY = frameChildren[0]?.absoluteBoundingBox?.y || 0
  const firstRowItems = frameChildren.filter(c => 
    Math.abs((c.absoluteBoundingBox?.y || 0) - firstRowY) < 10
  )

  return Math.min(Math.max(firstRowItems.length, 2), 4)
}

/**
 * Get brightness of a color (0-1)
 */
function getBrightness(color: FigmaColor): number {
  return (color.r * 299 + color.g * 587 + color.b * 114) / 1000
}

/**
 * Extract colors from a node tree
 */
function extractColorsFromNode(node: FigmaNode, colors: Set<string>): void {
  if (node.fills) {
    node.fills.forEach(fill => {
      if (fill.type === 'SOLID' && fill.color) {
        colors.add(figmaColorToHex(fill.color))
      }
    })
  }

  if (node.children) {
    node.children.forEach(child => extractColorsFromNode(child, colors))
  }
}

/**
 * Extract fonts from a node tree
 */
function extractFontsFromNode(node: FigmaNode, fonts: Set<string>): void {
  if (node.type === 'TEXT' && node.style?.fontFamily) {
    fonts.add(node.style.fontFamily)
  }

  if (node.children) {
    node.children.forEach(child => extractFontsFromNode(child, fonts))
  }
}

/**
 * Infer global styles from extracted data
 */
function inferGlobalStyles(colors: string[], fonts: string[]): GlobalStyles {
  // Use the first saturated color as primary
  const primaryColor = colors.find(c => {
    const r = parseInt(c.slice(1, 3), 16)
    const g = parseInt(c.slice(3, 5), 16)
    const b = parseInt(c.slice(5, 7), 16)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const saturation = max === 0 ? 0 : (max - min) / max
    return saturation > 0.3 && max > 50
  }) || '#6366f1'

  return {
    colorScheme: 'light',
    primaryColor,
    secondaryColor: colors[1] || primaryColor,
    accentColor: colors[2] || '#f59e0b',
    fontHeading: fonts[0] || 'Inter',
    fontBody: fonts[1] || fonts[0] || 'Inter',
    borderRadius: 'medium',
    buttonStyle: 'solid',
  }
}
