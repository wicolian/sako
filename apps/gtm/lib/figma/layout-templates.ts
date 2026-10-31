/**
 * Figma Layout Templates
 * 
 * Pre-built, proven layouts for each section type.
 * Used to generate structured Figma-compatible output.
 */

// ============================================================================
// Layout Types
// ============================================================================

export type SectionType = 'hero' | 'features' | 'social_proof' | 'cta' | 'pricing' | 'faq' | 'footer'

export type HeroVariant = 'centered' | 'left-right' | 'full-width-bg' | 'split-screen' | 'video'
export type FeaturesVariant = '3-column' | 'alternating' | 'bento' | 'spotlight'
export type SocialProofVariant = 'logo-bar' | 'testimonial-cards' | 'stats-row'
export type CTAVariant = 'simple-centered' | 'two-column' | 'full-width-gradient'

export interface LayoutTemplate {
  id: string
  name: string
  sectionType: SectionType
  variant: string
  description: string
  
  // Figma structure
  structure: {
    frame: FrameConfig
    children: ComponentConfig[]
  }
  
  // Default styles
  defaultStyles: {
    padding: string
    gap: string
    backgroundColor?: string
  }
  
  // Content slots
  contentSlots: ContentSlot[]
  
  // Recommended for
  recommendedFor: string[]
}

export interface FrameConfig {
  name: string
  layoutMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE'
  primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX'
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  itemSpacing: number
  fills?: FillConfig[]
}

export interface ComponentConfig {
  type: 'TEXT' | 'FRAME' | 'RECTANGLE' | 'IMAGE'
  name: string
  layoutAlign?: 'STRETCH' | 'INHERIT' | 'MIN' | 'CENTER' | 'MAX'
  layoutGrow?: number
  minWidth?: number
  maxWidth?: number
  textContent?: string
  fontSize?: number
  fontWeight?: number
  fills?: FillConfig[]
  children?: ComponentConfig[]
}

export interface FillConfig {
  type: 'SOLID' | 'GRADIENT_LINEAR'
  color?: { r: number; g: number; b: number }
  opacity?: number
  gradientStops?: Array<{ color: { r: number; g: number; b: number }; position: number }>
}

export interface ContentSlot {
  id: string
  name: string
  type: 'text' | 'image' | 'list' | 'component'
  required: boolean
  maxLength?: number
  placeholder?: string
}

// ============================================================================
// Hero Templates
// ============================================================================

const heroTemplates: LayoutTemplate[] = [
  {
    id: 'hero-centered',
    name: 'Centered Hero',
    sectionType: 'hero',
    variant: 'centered',
    description: 'Classic centered hero with headline, subheadline, and CTA',
    structure: {
      frame: {
        name: 'Hero - Centered',
        layoutMode: 'VERTICAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 120,
        paddingRight: 64,
        paddingBottom: 120,
        paddingLeft: 64,
        itemSpacing: 32,
      },
      children: [
        {
          type: 'TEXT',
          name: 'Headline',
          textContent: '{{headline}}',
          fontSize: 64,
          fontWeight: 700,
          layoutAlign: 'CENTER',
        },
        {
          type: 'TEXT',
          name: 'Subheadline',
          textContent: '{{subheadline}}',
          fontSize: 24,
          fontWeight: 400,
          layoutAlign: 'CENTER',
          maxWidth: 600,
        },
        {
          type: 'FRAME',
          name: 'CTA Group',
          layoutAlign: 'CENTER',
          children: [
            {
              type: 'RECTANGLE',
              name: 'Primary Button',
              fills: [{ type: 'SOLID', color: { r: 0.6, g: 0.9, b: 0.24 } }],
            },
          ],
        },
      ],
    },
    defaultStyles: {
      padding: '120px 64px',
      gap: '32px',
    },
    contentSlots: [
      { id: 'headline', name: 'Headline', type: 'text', required: true, maxLength: 80 },
      { id: 'subheadline', name: 'Subheadline', type: 'text', required: true, maxLength: 200 },
      { id: 'cta', name: 'CTA Text', type: 'text', required: true, maxLength: 30 },
      { id: 'hero_image', name: 'Hero Image', type: 'image', required: false },
    ],
    recommendedFor: ['product', 'saas', 'landing'],
  },
  {
    id: 'hero-left-right',
    name: 'Split Hero',
    sectionType: 'hero',
    variant: 'left-right',
    description: 'Two-column hero with text on left, visual on right',
    structure: {
      frame: {
        name: 'Hero - Split',
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'SPACE_BETWEEN',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 80,
        paddingRight: 64,
        paddingBottom: 80,
        paddingLeft: 64,
        itemSpacing: 64,
      },
      children: [
        {
          type: 'FRAME',
          name: 'Content',
          layoutGrow: 1,
          children: [],
        },
        {
          type: 'FRAME',
          name: 'Visual',
          layoutGrow: 1,
          children: [],
        },
      ],
    },
    defaultStyles: {
      padding: '80px 64px',
      gap: '64px',
    },
    contentSlots: [
      { id: 'headline', name: 'Headline', type: 'text', required: true },
      { id: 'subheadline', name: 'Subheadline', type: 'text', required: true },
      { id: 'cta', name: 'CTA Text', type: 'text', required: true },
      { id: 'visual', name: 'Visual', type: 'image', required: true },
    ],
    recommendedFor: ['product', 'feature', 'app'],
  },
  {
    id: 'hero-video',
    name: 'Video Hero',
    sectionType: 'hero',
    variant: 'video',
    description: 'Hero with video background or embedded video',
    structure: {
      frame: {
        name: 'Hero - Video',
        layoutMode: 'VERTICAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 160,
        paddingRight: 64,
        paddingBottom: 160,
        paddingLeft: 64,
        itemSpacing: 40,
      },
      children: [],
    },
    defaultStyles: {
      padding: '160px 64px',
      gap: '40px',
    },
    contentSlots: [
      { id: 'headline', name: 'Headline', type: 'text', required: true },
      { id: 'video_embed', name: 'Video', type: 'component', required: true },
    ],
    recommendedFor: ['demo', 'product', 'webinar'],
  },
]

// ============================================================================
// Features Templates
// ============================================================================

const featuresTemplates: LayoutTemplate[] = [
  {
    id: 'features-3col',
    name: '3-Column Features',
    sectionType: 'features',
    variant: '3-column',
    description: 'Classic three-column feature grid',
    structure: {
      frame: {
        name: 'Features - 3 Column',
        layoutMode: 'VERTICAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 80,
        paddingRight: 64,
        paddingBottom: 80,
        paddingLeft: 64,
        itemSpacing: 48,
      },
      children: [],
    },
    defaultStyles: {
      padding: '80px 64px',
      gap: '48px',
    },
    contentSlots: [
      { id: 'section_title', name: 'Section Title', type: 'text', required: false },
      { id: 'features', name: 'Features', type: 'list', required: true },
    ],
    recommendedFor: ['saas', 'product'],
  },
  {
    id: 'features-bento',
    name: 'Bento Grid Features',
    sectionType: 'features',
    variant: 'bento',
    description: 'Modern bento-style grid layout',
    structure: {
      frame: {
        name: 'Features - Bento',
        layoutMode: 'NONE',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 80,
        paddingRight: 64,
        paddingBottom: 80,
        paddingLeft: 64,
        itemSpacing: 16,
      },
      children: [],
    },
    defaultStyles: {
      padding: '80px 64px',
      gap: '16px',
    },
    contentSlots: [
      { id: 'section_title', name: 'Section Title', type: 'text', required: false },
      { id: 'bento_items', name: 'Bento Items', type: 'list', required: true },
    ],
    recommendedFor: ['product', 'tech', 'modern'],
  },
  {
    id: 'features-alternating',
    name: 'Alternating Features',
    sectionType: 'features',
    variant: 'alternating',
    description: 'Features that alternate left-right',
    structure: {
      frame: {
        name: 'Features - Alternating',
        layoutMode: 'VERTICAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 80,
        paddingRight: 64,
        paddingBottom: 80,
        paddingLeft: 64,
        itemSpacing: 80,
      },
      children: [],
    },
    defaultStyles: {
      padding: '80px 64px',
      gap: '80px',
    },
    contentSlots: [
      { id: 'features', name: 'Features', type: 'list', required: true },
    ],
    recommendedFor: ['product', 'feature'],
  },
  {
    id: 'features-spotlight',
    name: 'Feature Spotlight',
    sectionType: 'features',
    variant: 'spotlight',
    description: 'Single feature with large visual',
    structure: {
      frame: {
        name: 'Features - Spotlight',
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 80,
        paddingRight: 64,
        paddingBottom: 80,
        paddingLeft: 64,
        itemSpacing: 64,
      },
      children: [],
    },
    defaultStyles: {
      padding: '80px 64px',
      gap: '64px',
    },
    contentSlots: [
      { id: 'feature_title', name: 'Feature Title', type: 'text', required: true },
      { id: 'feature_description', name: 'Description', type: 'text', required: true },
      { id: 'feature_visual', name: 'Visual', type: 'image', required: true },
    ],
    recommendedFor: ['feature', 'update'],
  },
]

// ============================================================================
// Social Proof Templates
// ============================================================================

const socialProofTemplates: LayoutTemplate[] = [
  {
    id: 'proof-logos',
    name: 'Logo Bar',
    sectionType: 'social_proof',
    variant: 'logo-bar',
    description: 'Horizontal bar of customer/partner logos',
    structure: {
      frame: {
        name: 'Social Proof - Logos',
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 48,
        paddingRight: 64,
        paddingBottom: 48,
        paddingLeft: 64,
        itemSpacing: 48,
      },
      children: [],
    },
    defaultStyles: {
      padding: '48px 64px',
      gap: '48px',
    },
    contentSlots: [
      { id: 'logos', name: 'Logos', type: 'list', required: true },
    ],
    recommendedFor: ['enterprise', 'b2b'],
  },
  {
    id: 'proof-testimonials',
    name: 'Testimonial Cards',
    sectionType: 'social_proof',
    variant: 'testimonial-cards',
    description: 'Grid of testimonial cards with photos',
    structure: {
      frame: {
        name: 'Social Proof - Testimonials',
        layoutMode: 'VERTICAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 80,
        paddingRight: 64,
        paddingBottom: 80,
        paddingLeft: 64,
        itemSpacing: 32,
      },
      children: [],
    },
    defaultStyles: {
      padding: '80px 64px',
      gap: '32px',
    },
    contentSlots: [
      { id: 'section_title', name: 'Section Title', type: 'text', required: false },
      { id: 'testimonials', name: 'Testimonials', type: 'list', required: true },
    ],
    recommendedFor: ['saas', 'agency', 'consulting'],
  },
  {
    id: 'proof-stats',
    name: 'Stats Row',
    sectionType: 'social_proof',
    variant: 'stats-row',
    description: 'Horizontal row of key statistics',
    structure: {
      frame: {
        name: 'Social Proof - Stats',
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'SPACE_BETWEEN',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 64,
        paddingRight: 64,
        paddingBottom: 64,
        paddingLeft: 64,
        itemSpacing: 48,
      },
      children: [],
    },
    defaultStyles: {
      padding: '64px',
      gap: '48px',
      backgroundColor: '#f9fafb',
    },
    contentSlots: [
      { id: 'stats', name: 'Statistics', type: 'list', required: true },
    ],
    recommendedFor: ['enterprise', 'growth'],
  },
]

// ============================================================================
// CTA Templates
// ============================================================================

const ctaTemplates: LayoutTemplate[] = [
  {
    id: 'cta-centered',
    name: 'Simple Centered CTA',
    sectionType: 'cta',
    variant: 'simple-centered',
    description: 'Clean centered call-to-action',
    structure: {
      frame: {
        name: 'CTA - Centered',
        layoutMode: 'VERTICAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 80,
        paddingRight: 64,
        paddingBottom: 80,
        paddingLeft: 64,
        itemSpacing: 24,
      },
      children: [],
    },
    defaultStyles: {
      padding: '80px 64px',
      gap: '24px',
    },
    contentSlots: [
      { id: 'headline', name: 'Headline', type: 'text', required: true },
      { id: 'cta', name: 'CTA Text', type: 'text', required: true },
    ],
    recommendedFor: ['landing', 'product'],
  },
  {
    id: 'cta-gradient',
    name: 'Full-Width Gradient CTA',
    sectionType: 'cta',
    variant: 'full-width-gradient',
    description: 'Bold gradient background CTA',
    structure: {
      frame: {
        name: 'CTA - Gradient',
        layoutMode: 'VERTICAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 100,
        paddingRight: 64,
        paddingBottom: 100,
        paddingLeft: 64,
        itemSpacing: 32,
        fills: [
          {
            type: 'GRADIENT_LINEAR',
            gradientStops: [
              { color: { r: 0.4, g: 0.2, b: 0.9 }, position: 0 },
              { color: { r: 0.6, g: 0.3, b: 1 }, position: 1 },
            ],
          },
        ],
      },
      children: [],
    },
    defaultStyles: {
      padding: '100px 64px',
      gap: '32px',
    },
    contentSlots: [
      { id: 'headline', name: 'Headline', type: 'text', required: true },
      { id: 'subheadline', name: 'Subheadline', type: 'text', required: false },
      { id: 'cta', name: 'CTA Text', type: 'text', required: true },
    ],
    recommendedFor: ['saas', 'product', 'campaign'],
  },
  {
    id: 'cta-two-column',
    name: 'Two-Column CTA',
    sectionType: 'cta',
    variant: 'two-column',
    description: 'Split CTA with content and form',
    structure: {
      frame: {
        name: 'CTA - Two Column',
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'SPACE_BETWEEN',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 80,
        paddingRight: 64,
        paddingBottom: 80,
        paddingLeft: 64,
        itemSpacing: 64,
      },
      children: [],
    },
    defaultStyles: {
      padding: '80px 64px',
      gap: '64px',
    },
    contentSlots: [
      { id: 'headline', name: 'Headline', type: 'text', required: true },
      { id: 'subheadline', name: 'Subheadline', type: 'text', required: false },
      { id: 'form', name: 'Form', type: 'component', required: true },
    ],
    recommendedFor: ['lead-gen', 'newsletter'],
  },
]

// ============================================================================
// All Templates
// ============================================================================

export const ALL_TEMPLATES: LayoutTemplate[] = [
  ...heroTemplates,
  ...featuresTemplates,
  ...socialProofTemplates,
  ...ctaTemplates,
]

/**
 * Get templates by section type
 */
export function getTemplatesForSection(sectionType: SectionType): LayoutTemplate[] {
  return ALL_TEMPLATES.filter(t => t.sectionType === sectionType)
}

/**
 * Get a template by ID
 */
export function getTemplateById(templateId: string): LayoutTemplate | undefined {
  return ALL_TEMPLATES.find(t => t.id === templateId)
}

/**
 * Get recommended templates for a use case
 */
export function getRecommendedTemplates(useCase: string): LayoutTemplate[] {
  return ALL_TEMPLATES.filter(t => t.recommendedFor.includes(useCase))
}

/**
 * Get all hero variants
 */
export function getHeroTemplates(): LayoutTemplate[] {
  return getTemplatesForSection('hero')
}

/**
 * Get all features variants
 */
export function getFeaturesTemplates(): LayoutTemplate[] {
  return getTemplatesForSection('features')
}
