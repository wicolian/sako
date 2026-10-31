/**
 * HTML Patcher Utilities
 *
 * Functions for modifying HTML strings based on node IDs.
 * All editable nodes should have a `data-node-id` attribute.
 */

export interface ParsedNode {
  nodeId: string
  tagName: string
  textContent: string
  href?: string
  classes: string
  style: string
  id?: string
  parentNodeId?: string
  childNodeIds: string[]
}

export interface SpacingOverrides {
  marginTop?: string
  marginBottom?: string
  marginLeft?: string
  marginRight?: string
  paddingTop?: string
  paddingBottom?: string
  paddingLeft?: string
  paddingRight?: string
}

export interface TypographyOverrides {
  fontFamily?: string
  fontWeight?: string
  fontSize?: string
  lineHeight?: string
  textAlign?: string
  letterSpacing?: string
}

export interface ColorOverrides {
  textColor?: string
  backgroundColor?: string
  borderColor?: string
}

export interface SizeOverrides {
  width?: string
  height?: string
  maxWidth?: string
  maxHeight?: string
}

export interface HtmlSectionNode {
  id: string
  label: string
  tagName: string
  index: number
}

/**
 * Parse HTML string and extract node information by ID
 */
export function getNodeById(html: string, nodeId: string): ParsedNode | null {
  if (typeof window === 'undefined') return null
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const el = doc.querySelector(`[data-node-id="${nodeId}"]`)

    if (!el) return null

    const parent = el.parentElement?.closest('[data-node-id]')
    const parentNodeId = parent ? (parent as HTMLElement).dataset.nodeId : undefined

    const childNodeIds: string[] = []
    el.querySelectorAll('[data-node-id]').forEach((child) => {
      if (child.parentElement?.closest('[data-node-id]') === el) {
        childNodeIds.push((child as HTMLElement).dataset.nodeId!)
      }
    })

    return {
      nodeId,
      tagName: el.tagName.toLowerCase(),
      textContent: getDirectTextContent(el),
      href: el.getAttribute('href') || undefined,
      classes: el.getAttribute('class') || '',
      style: el.getAttribute('style') || '',
      id: el.getAttribute('id') || undefined,
      parentNodeId,
      childNodeIds,
    }
  } catch (e) {
    console.error('getNodeById error:', e)
    return null
  }
}

function getDirectTextContent(el: Element): string {
  let text = ''
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || ''
    }
  }
  return text.trim()
}

/**
 * Get the full element hierarchy for breadcrumb display
 */
export function getNodeHierarchy(html: string, nodeId: string): ParsedNode[] {
  if (typeof window === 'undefined') return []
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const el = doc.querySelector(`[data-node-id="${nodeId}"]`)

    if (!el) return []

    const hierarchy: ParsedNode[] = []
    let current: Element | null = el

    while (current && current !== doc.body) {
      const currentNodeId = (current as HTMLElement).dataset?.nodeId
      if (currentNodeId) {
        const node = getNodeById(html, currentNodeId)
        if (node) hierarchy.unshift(node)
      }
      current = current.parentElement
    }

    return hierarchy
  } catch (e) {
    console.error('getNodeHierarchy error:', e)
    return []
  }
}

/**
 * Patch text content of an element
 */
export function patchText(html: string, nodeId: string, newText: string): string {
  if (typeof window === 'undefined') return html
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const el = doc.querySelector(`[data-node-id="${nodeId}"]`)

    if (!el) return html

    const childElements = Array.from(el.children)
    el.textContent = newText
    childElements.forEach((child) => el.appendChild(child))

    return serializeDocument(doc)
  } catch (e) {
    console.error('patchText error:', e)
    return html
  }
}

/**
 * Patch href attribute
 */
export function patchHref(html: string, nodeId: string, href: string): string {
  if (typeof window === 'undefined') return html
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const el = doc.querySelector(`[data-node-id="${nodeId}"]`)

    if (!el) return html

    if (href) {
      el.setAttribute('href', href)
    } else {
      el.removeAttribute('href')
    }

    return serializeDocument(doc)
  } catch (e) {
    console.error('patchHref error:', e)
    return html
  }
}

/**
 * Patch class attribute
 */
export function patchClasses(html: string, nodeId: string, classes: string): string {
  if (typeof window === 'undefined') return html
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const el = doc.querySelector(`[data-node-id="${nodeId}"]`)

    if (!el) return html

    if (classes) {
      el.setAttribute('class', classes)
    } else {
      el.removeAttribute('class')
    }

    return serializeDocument(doc)
  } catch (e) {
    console.error('patchClasses error:', e)
    return html
  }
}

/**
 * Patch spacing using Tailwind classes
 */
export function patchSpacing(html: string, nodeId: string, overrides: SpacingOverrides): string {
  if (typeof window === 'undefined') return html
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const el = doc.querySelector(`[data-node-id="${nodeId}"]`)

    if (!el) return html

    let classes = el.getAttribute('class') || ''

    // Remove existing spacing classes
    const spacingPatterns = [
      /\bm[trblxy]?-\d+\b/g,
      /\bp[trblxy]?-\d+\b/g,
      /\b-?m[trblxy]?-\[\d+px\]\b/g,
      /\bp[trblxy]?-\[\d+px\]\b/g,
    ]

    spacingPatterns.forEach((pattern) => {
      classes = classes.replace(pattern, '')
    })

    classes = classes.replace(/\s+/g, ' ').trim()

    // Add new spacing classes
    const spacingClasses: string[] = []

    if (overrides.marginTop) spacingClasses.push(`mt-${overrides.marginTop}`)
    if (overrides.marginBottom) spacingClasses.push(`mb-${overrides.marginBottom}`)
    if (overrides.marginLeft) spacingClasses.push(`ml-${overrides.marginLeft}`)
    if (overrides.marginRight) spacingClasses.push(`mr-${overrides.marginRight}`)
    if (overrides.paddingTop) spacingClasses.push(`pt-${overrides.paddingTop}`)
    if (overrides.paddingBottom) spacingClasses.push(`pb-${overrides.paddingBottom}`)
    if (overrides.paddingLeft) spacingClasses.push(`pl-${overrides.paddingLeft}`)
    if (overrides.paddingRight) spacingClasses.push(`pr-${overrides.paddingRight}`)

    if (spacingClasses.length > 0) {
      classes = `${classes} ${spacingClasses.join(' ')}`.trim()
    }

    el.setAttribute('class', classes)

    return serializeDocument(doc)
  } catch (e) {
    console.error('patchSpacing error:', e)
    return html
  }
}

/**
 * Patch typography using Tailwind classes
 */
export function patchTypography(html: string, nodeId: string, overrides: TypographyOverrides): string {
  if (typeof window === 'undefined') return html
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const el = doc.querySelector(`[data-node-id="${nodeId}"]`)

    if (!el) return html

    let classes = el.getAttribute('class') || ''

    // Remove existing typography classes
    const typographyPatterns = [
      /\bfont-(sans|serif|mono|thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g,
      /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g,
      /\btext-(left|center|right|justify)\b/g,
      /\bleading-(none|tight|snug|normal|relaxed|loose|\d+)\b/g,
      /\btracking-(tighter|tight|normal|wide|wider|widest)\b/g,
    ]

    typographyPatterns.forEach((pattern) => {
      classes = classes.replace(pattern, '')
    })

    classes = classes.replace(/\s+/g, ' ').trim()

    // Add new typography classes
    const typoClasses: string[] = []

    if (overrides.fontFamily) typoClasses.push(`font-${overrides.fontFamily}`)
    if (overrides.fontWeight) typoClasses.push(`font-${overrides.fontWeight}`)
    if (overrides.fontSize) typoClasses.push(`text-${overrides.fontSize}`)
    if (overrides.textAlign) typoClasses.push(`text-${overrides.textAlign}`)
    if (overrides.lineHeight) typoClasses.push(`leading-${overrides.lineHeight}`)
    if (overrides.letterSpacing) typoClasses.push(`tracking-${overrides.letterSpacing}`)

    if (typoClasses.length > 0) {
      classes = `${classes} ${typoClasses.join(' ')}`.trim()
    }

    el.setAttribute('class', classes)

    return serializeDocument(doc)
  } catch (e) {
    console.error('patchTypography error:', e)
    return html
  }
}

/**
 * Patch colors using Tailwind classes
 */
export function patchColors(html: string, nodeId: string, overrides: ColorOverrides): string {
  if (typeof window === 'undefined') return html
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const el = doc.querySelector(`[data-node-id="${nodeId}"]`)

    if (!el) return html

    let classes = el.getAttribute('class') || ''

    // Remove existing color classes
    const colorPatterns = [
      /\btext-[a-z]+-\d{2,3}\b/g,
      /\btext-\[#[0-9a-fA-F]{3,8}\]\b/g,
      /\bbg-[a-z]+-\d{2,3}\b/g,
      /\bbg-\[#[0-9a-fA-F]{3,8}\]\b/g,
      /\bborder-[a-z]+-\d{2,3}\b/g,
      /\bborder-\[#[0-9a-fA-F]{3,8}\]\b/g,
      /\btext-(white|black|transparent|current)\b/g,
      /\bbg-(white|black|transparent|current)\b/g,
    ]

    colorPatterns.forEach((pattern) => {
      classes = classes.replace(pattern, '')
    })

    classes = classes.replace(/\s+/g, ' ').trim()

    // Add new color classes
    const colorClasses: string[] = []

    if (overrides.textColor) {
      if (overrides.textColor.startsWith('#')) {
        colorClasses.push(`text-[${overrides.textColor}]`)
      } else {
        colorClasses.push(`text-${overrides.textColor}`)
      }
    }

    if (overrides.backgroundColor) {
      if (overrides.backgroundColor.startsWith('#')) {
        colorClasses.push(`bg-[${overrides.backgroundColor}]`)
      } else {
        colorClasses.push(`bg-${overrides.backgroundColor}`)
      }
    }

    if (overrides.borderColor) {
      if (overrides.borderColor.startsWith('#')) {
        colorClasses.push(`border-[${overrides.borderColor}]`)
      } else {
        colorClasses.push(`border-${overrides.borderColor}`)
      }
    }

    if (colorClasses.length > 0) {
      classes = `${classes} ${colorClasses.join(' ')}`.trim()
    }

    el.setAttribute('class', classes)

    return serializeDocument(doc)
  } catch (e) {
    console.error('patchColors error:', e)
    return html
  }
}

/**
 * Extract current styles from a node
 */
export function extractNodeStyles(html: string, nodeId: string): {
  spacing: SpacingOverrides
  typography: TypographyOverrides
  colors: ColorOverrides
  size: SizeOverrides
} {
  const defaults = {
    spacing: {},
    typography: {},
    colors: {},
    size: {},
  }

  if (typeof window === 'undefined') return defaults

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const el = doc.querySelector(`[data-node-id="${nodeId}"]`)

    if (!el) return defaults

    const classes = el.getAttribute('class') || ''

    // Extract spacing
    const spacing: SpacingOverrides = {}
    const mtMatch = classes.match(/\bmt-(\d+)\b/)
    const mbMatch = classes.match(/\bmb-(\d+)\b/)
    const mlMatch = classes.match(/\bml-(\d+)\b/)
    const mrMatch = classes.match(/\bmr-(\d+)\b/)
    const ptMatch = classes.match(/\bpt-(\d+)\b/)
    const pbMatch = classes.match(/\bpb-(\d+)\b/)
    const plMatch = classes.match(/\bpl-(\d+)\b/)
    const prMatch = classes.match(/\bpr-(\d+)\b/)

    if (mtMatch) spacing.marginTop = mtMatch[1]
    if (mbMatch) spacing.marginBottom = mbMatch[1]
    if (mlMatch) spacing.marginLeft = mlMatch[1]
    if (mrMatch) spacing.marginRight = mrMatch[1]
    if (ptMatch) spacing.paddingTop = ptMatch[1]
    if (pbMatch) spacing.paddingBottom = pbMatch[1]
    if (plMatch) spacing.paddingLeft = plMatch[1]
    if (prMatch) spacing.paddingRight = prMatch[1]

    // Extract typography
    const typography: TypographyOverrides = {}
    const fontFamilyMatch = classes.match(/\bfont-(sans|serif|mono)\b/)
    const fontWeightMatch = classes.match(
      /\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/
    )
    const fontSizeMatch = classes.match(
      /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/
    )
    const textAlignMatch = classes.match(/\btext-(left|center|right|justify)\b/)
    const lineHeightMatch = classes.match(/\bleading-(none|tight|snug|normal|relaxed|loose|\d+)\b/)
    const letterSpacingMatch = classes.match(/\btracking-(tighter|tight|normal|wide|wider|widest)\b/)

    if (fontFamilyMatch) typography.fontFamily = fontFamilyMatch[1]
    if (fontWeightMatch) typography.fontWeight = fontWeightMatch[1]
    if (fontSizeMatch) typography.fontSize = fontSizeMatch[1]
    if (textAlignMatch) typography.textAlign = textAlignMatch[1]
    if (lineHeightMatch) typography.lineHeight = lineHeightMatch[1]
    if (letterSpacingMatch) typography.letterSpacing = letterSpacingMatch[1]

    // Extract colors
    const colors: ColorOverrides = {}
    const textColorMatch =
      classes.match(/\btext-([a-z]+-\d{2,3}|white|black)\b/) ||
      classes.match(/\btext-\[(#[0-9a-fA-F]{3,8})\]/)
    const bgColorMatch =
      classes.match(/\bbg-([a-z]+-\d{2,3}|white|black)\b/) ||
      classes.match(/\bbg-\[(#[0-9a-fA-F]{3,8})\]/)
    const borderColorMatch =
      classes.match(/\bborder-([a-z]+-\d{2,3}|white|black)\b/) ||
      classes.match(/\bborder-\[(#[0-9a-fA-F]{3,8})\]/)

    if (textColorMatch) colors.textColor = textColorMatch[1]
    if (bgColorMatch) colors.backgroundColor = bgColorMatch[1]
    if (borderColorMatch) colors.borderColor = borderColorMatch[1]

    // Extract size
    const size: SizeOverrides = {}
    const widthMatch =
      classes.match(/\bw-(\d+|full|auto|screen)\b/) || classes.match(/\bw-\[(\d+px|\d+%)\]/)
    const heightMatch =
      classes.match(/\bh-(\d+|full|auto|screen)\b/) || classes.match(/\bh-\[(\d+px|\d+%)\]/)
    const maxWidthMatch = classes.match(
      /\bmax-w-(\d+|full|auto|screen|xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|prose)\b/
    )
    const maxHeightMatch = classes.match(/\bmax-h-(\d+|full|auto|screen)\b/)

    if (widthMatch) size.width = widthMatch[1]
    if (heightMatch) size.height = heightMatch[1]
    if (maxWidthMatch) size.maxWidth = maxWidthMatch[1]
    if (maxHeightMatch) size.maxHeight = maxHeightMatch[1]

    return { spacing, typography, colors, size }
  } catch (e) {
    console.error('extractNodeStyles error:', e)
    return defaults
  }
}

/**
 * Get sections in order for drag-and-drop UI
 */
export function getSections(html: string): HtmlSectionNode[] {
  if (typeof window === 'undefined') return []
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const body = doc.body

    const sections: HtmlSectionNode[] = []

    const children = body.children
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement
      const nodeId = child.dataset.nodeId
      const sectionId = child.dataset.sectionId
      const sectionLabel = child.dataset.sectionLabel
      const sectionType = child.dataset.sectionType

      if (['script', 'style'].includes(child.tagName.toLowerCase())) continue

      if (nodeId || sectionId) {
        let label = sectionLabel || sectionType || ''

        if (!label) {
          const heading = child.querySelector('h1, h2, h3')
          if (heading) {
            label = heading.textContent?.trim().substring(0, 30) || ''
          }
        }

        if (!label) {
          const tagName = child.tagName.toLowerCase()
          const readableName =
            tagName === 'section'
              ? 'Section'
              : tagName === 'nav'
                ? 'Navigation'
                : tagName === 'header'
                  ? 'Header'
                  : tagName === 'footer'
                    ? 'Footer'
                    : tagName === 'main'
                      ? 'Main'
                      : tagName === 'article'
                        ? 'Article'
                        : tagName === 'div'
                          ? 'Block'
                          : tagName
          label = `${readableName} ${sections.length + 1}`
        }

        sections.push({
          id: nodeId || sectionId || `section-${i}`,
          tagName: child.tagName.toLowerCase(),
          label,
          index: sections.length,
        })
      }
    }

    return sections
  } catch (e) {
    console.error('getSections error:', e)
    return []
  }
}

/**
 * Move a section up or down
 */
export function moveSection(html: string, sectionId: string, direction: 'up' | 'down'): string {
  if (typeof window === 'undefined') return html
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const body = doc.body

    const section = doc.querySelector(`[data-node-id="${sectionId}"]`)
    if (!section) return html

    const siblings = Array.from(body.children).filter((child) => {
      const el = child as HTMLElement
      return el.dataset.nodeId && !['script', 'style'].includes(el.tagName.toLowerCase())
    })

    const currentIndex = siblings.findIndex((s) => (s as HTMLElement).dataset.nodeId === sectionId)
    if (currentIndex === -1) return html

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= siblings.length) return html

    const neighbor = siblings[targetIndex]

    section.remove()

    if (direction === 'up') {
      body.insertBefore(section, neighbor)
    } else {
      body.insertBefore(section, neighbor.nextSibling)
    }

    return serializeDocument(doc)
  } catch (e) {
    console.error('moveSection error:', e)
    return html
  }
}

/**
 * Remove a section
 */
export function removeSection(html: string, sectionId: string): string {
  if (typeof window === 'undefined') return html
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const section = doc.querySelector(`[data-node-id="${sectionId}"]`)
    if (!section) return html

    section.remove()

    return serializeDocument(doc)
  } catch (e) {
    console.error('removeSection error:', e)
    return html
  }
}

/**
 * Insert HTML after a section
 */
export function insertSectionAfter(html: string, afterSectionId: string, newHtml: string): string {
  if (typeof window === 'undefined') return html
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const section = doc.querySelector(`[data-node-id="${afterSectionId}"]`)
    if (!section) return html

    const tempDiv = doc.createElement('div')
    tempDiv.innerHTML = newHtml

    const parent = section.parentElement
    if (parent) {
      const nextSibling = section.nextSibling
      Array.from(tempDiv.children).forEach((child) => {
        parent.insertBefore(child, nextSibling)
      })
    }

    return serializeDocument(doc)
  } catch (e) {
    console.error('insertSectionAfter error:', e)
    return html
  }
}

function serializeDocument(doc: Document): string {
  const doctype = doc.doctype
    ? `<!DOCTYPE ${doc.doctype.name}${doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : ''}${doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : ''}>`
    : '<!DOCTYPE html>'

  return doctype + '\n' + doc.documentElement.outerHTML
}
