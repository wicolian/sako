/**
 * Dimension Presets
 *
 * All platform-specific dimensions for social, deck, ad, and email assets.
 * Used by canvas editors and render pipelines.
 */

export interface DimensionPreset {
  width: number
  height: number | null // null = dynamic height (email)
  label: string
  aspectRatio?: string
}

export const DIMENSION_PRESETS = {
  social: {
    instagram_post: { width: 1080, height: 1080, label: 'Instagram Post (1:1)', aspectRatio: '1:1' },
    instagram_story: { width: 1080, height: 1920, label: 'Instagram Story (9:16)', aspectRatio: '9:16' },
    instagram_reel: { width: 1080, height: 1920, label: 'Instagram Reel Cover (9:16)', aspectRatio: '9:16' },
    linkedin: { width: 1200, height: 627, label: 'LinkedIn Post (1.91:1)', aspectRatio: '1.91:1' },
    linkedin_article: { width: 1200, height: 644, label: 'LinkedIn Article (1.86:1)', aspectRatio: '1.86:1' },
    twitter: { width: 1200, height: 675, label: 'Twitter/X Post (16:9)', aspectRatio: '16:9' },
    facebook: { width: 1200, height: 630, label: 'Facebook Post (1.91:1)', aspectRatio: '1.91:1' },
    facebook_cover: { width: 820, height: 312, label: 'Facebook Cover (2.63:1)', aspectRatio: '2.63:1' },
    pinterest: { width: 1000, height: 1500, label: 'Pinterest Pin (2:3)', aspectRatio: '2:3' },
    tiktok: { width: 1080, height: 1920, label: 'TikTok Cover (9:16)', aspectRatio: '9:16' },
  },
  deck: {
    slide_16_9: { width: 1920, height: 1080, label: 'Slide 16:9', aspectRatio: '16:9' },
    slide_4_3: { width: 1024, height: 768, label: 'Slide 4:3', aspectRatio: '4:3' },
    slide_widescreen: { width: 1920, height: 800, label: 'Widescreen', aspectRatio: '12:5' },
  },
  ad: {
    facebook_feed: { width: 1200, height: 628, label: 'Facebook Feed', aspectRatio: '1.91:1' },
    facebook_story: { width: 1080, height: 1920, label: 'Facebook Story', aspectRatio: '9:16' },
    instagram_feed: { width: 1080, height: 1080, label: 'Instagram Feed', aspectRatio: '1:1' },
    google_display: { width: 300, height: 250, label: 'Google Display (300×250)' },
    google_leaderboard: { width: 728, height: 90, label: 'Leaderboard (728×90)' },
    google_skyscraper: { width: 160, height: 600, label: 'Skyscraper (160×600)' },
    google_rectangle: { width: 336, height: 280, label: 'Large Rectangle (336×280)' },
    linkedin_sponsored: { width: 1200, height: 627, label: 'LinkedIn Sponsored', aspectRatio: '1.91:1' },
  },
  email: {
    standard: { width: 600, height: null, label: 'Email (600px width)' },
    wide: { width: 640, height: null, label: 'Email Wide (640px)' },
  },
} as const satisfies Record<string, Record<string, DimensionPreset>>

/**
 * Get default dimensions for an asset type and optional channel
 */
export function getDefaultDimensions(
  type: string,
  channel?: string
): { width: number; height: number } {
  switch (type) {
    case 'social': {
      const key = channel ?? 'linkedin'
      const preset = (DIMENSION_PRESETS.social as Record<string, DimensionPreset>)[key]
      return { width: preset?.width ?? 1200, height: preset?.height ?? 627 }
    }
    case 'deck':
      return { width: 1920, height: 1080 }
    case 'ad': {
      const key = channel ? `${channel}_feed` : 'facebook_feed'
      const preset = (DIMENSION_PRESETS.ad as Record<string, DimensionPreset>)[key]
      return { width: preset?.width ?? 1200, height: preset?.height ?? 628 }
    }
    case 'email':
      return { width: 600, height: 800 }
    case 'landing':
      return { width: 1440, height: 900 }
    default:
      return { width: 1200, height: 627 }
  }
}

/**
 * Get all presets for a given asset type
 */
export function getPresetsForType(
  type: string
): Array<DimensionPreset & { key: string }> {
  const presetGroup = DIMENSION_PRESETS[type as keyof typeof DIMENSION_PRESETS]
  if (!presetGroup) return []

  return Object.entries(presetGroup).map(([key, preset]) => ({
    key,
    ...preset,
  }))
}
