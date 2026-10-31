/**
 * Unsplash API Client
 * 
 * Integration with Unsplash for free high-quality images:
 * - Search photos
 * - Get random photos
 * - Track downloads (required by API)
 */

// ============================================================================
// Types
// ============================================================================

export interface UnsplashPhoto {
  id: string
  width: number
  height: number
  color: string
  blur_hash: string
  description?: string
  alt_description?: string
  urls: {
    raw: string
    full: string
    regular: string
    small: string
    thumb: string
  }
  links: {
    self: string
    html: string
    download: string
    download_location: string
  }
  user: {
    id: string
    username: string
    name: string
    portfolio_url?: string
    profile_image: {
      small: string
      medium: string
      large: string
    }
  }
  tags?: Array<{
    title: string
  }>
}

export interface UnsplashSearchResult {
  total: number
  total_pages: number
  results: UnsplashPhoto[]
}

export interface SearchPhotosOptions {
  query: string
  page?: number
  perPage?: number
  orientation?: 'landscape' | 'portrait' | 'squarish'
  color?: string
  orderBy?: 'relevant' | 'latest'
}

// ============================================================================
// Unsplash Client
// ============================================================================

const UNSPLASH_API_URL = 'https://api.unsplash.com'
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

/**
 * Search for photos
 */
export async function searchPhotos(
  options: SearchPhotosOptions
): Promise<UnsplashSearchResult> {
  const {
    query,
    page = 1,
    perPage = 20,
    orientation,
    color,
    orderBy = 'relevant',
  } = options

  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(perPage),
    order_by: orderBy,
  })

  if (orientation) params.set('orientation', orientation)
  if (color) params.set('color', color)

  const response = await fetch(
    `${UNSPLASH_API_URL}/search/photos?${params}`,
    {
      headers: {
        'Authorization': `Client-ID ${ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Get random photos
 */
export async function getRandomPhotos(options?: {
  count?: number
  query?: string
  orientation?: 'landscape' | 'portrait' | 'squarish'
  topics?: string[]
}): Promise<UnsplashPhoto[]> {
  const params = new URLSearchParams({
    count: String(options?.count || 10),
  })

  if (options?.query) params.set('query', options.query)
  if (options?.orientation) params.set('orientation', options.orientation)
  if (options?.topics?.length) params.set('topics', options.topics.join(','))

  const response = await fetch(
    `${UNSPLASH_API_URL}/photos/random?${params}`,
    {
      headers: {
        'Authorization': `Client-ID ${ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Get a specific photo
 */
export async function getPhoto(photoId: string): Promise<UnsplashPhoto> {
  const response = await fetch(
    `${UNSPLASH_API_URL}/photos/${photoId}`,
    {
      headers: {
        'Authorization': `Client-ID ${ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Track a download (required by Unsplash API guidelines)
 */
export async function trackDownload(downloadLocation: string): Promise<void> {
  await fetch(downloadLocation, {
    headers: {
      'Authorization': `Client-ID ${ACCESS_KEY}`,
    },
  })
}

/**
 * Get curated photos (editor's picks)
 */
export async function getCuratedPhotos(options?: {
  page?: number
  perPage?: number
  orderBy?: 'latest' | 'oldest' | 'popular'
}): Promise<UnsplashPhoto[]> {
  const params = new URLSearchParams({
    page: String(options?.page || 1),
    per_page: String(options?.perPage || 20),
    order_by: options?.orderBy || 'popular',
  })

  const response = await fetch(
    `${UNSPLASH_API_URL}/photos?${params}`,
    {
      headers: {
        'Authorization': `Client-ID ${ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Get photos from a collection
 */
export async function getCollectionPhotos(
  collectionId: string,
  options?: {
    page?: number
    perPage?: number
  }
): Promise<UnsplashPhoto[]> {
  const params = new URLSearchParams({
    page: String(options?.page || 1),
    per_page: String(options?.perPage || 20),
  })

  const response = await fetch(
    `${UNSPLASH_API_URL}/collections/${collectionId}/photos?${params}`,
    {
      headers: {
        'Authorization': `Client-ID ${ACCESS_KEY}`,
        'Accept-Version': 'v1',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// Curated Collections for Common Use Cases
// ============================================================================

export const CURATED_COLLECTIONS = {
  business: '317099', // Business & Work
  technology: '3330448', // Technology
  nature: '3330452', // Nature
  architecture: '1065976', // Architecture
  food: '3330445', // Food & Drink
  travel: '3330448', // Travel
  people: '1068844', // People
  abstract: '311028', // Textures & Patterns
  minimal: '327760', // Minimal
  dark: '1052783', // Dark
}

export const COLOR_OPTIONS = [
  { id: 'black_and_white', label: 'Black & White' },
  { id: 'black', label: 'Black' },
  { id: 'white', label: 'White' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'orange', label: 'Orange' },
  { id: 'red', label: 'Red' },
  { id: 'purple', label: 'Purple' },
  { id: 'magenta', label: 'Magenta' },
  { id: 'green', label: 'Green' },
  { id: 'teal', label: 'Teal' },
  { id: 'blue', label: 'Blue' },
]

export const ORIENTATION_OPTIONS = [
  { id: 'landscape', label: 'Landscape' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'squarish', label: 'Square' },
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get optimized image URL with parameters
 */
export function getOptimizedUrl(
  photo: UnsplashPhoto,
  options?: {
    width?: number
    height?: number
    quality?: number
    fit?: 'crop' | 'clamp' | 'fill'
    format?: 'auto' | 'webp' | 'jpg'
  }
): string {
  const params = new URLSearchParams()

  if (options?.width) params.set('w', String(options.width))
  if (options?.height) params.set('h', String(options.height))
  if (options?.quality) params.set('q', String(options.quality))
  if (options?.fit) params.set('fit', options.fit)
  if (options?.format) params.set('fm', options.format)

  const separator = photo.urls.raw.includes('?') ? '&' : '?'
  return `${photo.urls.raw}${separator}${params.toString()}`
}

/**
 * Format attribution as required by Unsplash
 */
export function formatAttribution(photo: UnsplashPhoto): string {
  return `Photo by ${photo.user.name} on Unsplash`
}

/**
 * Get attribution link
 */
export function getAttributionLink(photo: UnsplashPhoto): string {
  return `${photo.links.html}?utm_source=sako&utm_medium=referral`
}

/**
 * Get photographer profile link
 */
export function getPhotographerLink(photo: UnsplashPhoto): string {
  return `https://unsplash.com/@${photo.user.username}?utm_source=sako&utm_medium=referral`
}
