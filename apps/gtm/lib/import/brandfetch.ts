export interface BrandfetchColor {
  hex: string
  type?: string | null
}

export interface BrandfetchFont {
  name?: string | null
  type?: string | null
  origin?: string | null
  originId?: string | null
}

export interface BrandfetchLink {
  name?: string | null
  url?: string | null
}

interface BrandfetchLogoFormat {
  src?: string | null
  format?: string | null
  height?: number | null
  width?: number | null
  background?: string | null
}

interface BrandfetchLogo {
  theme?: string | null
  type?: string | null
  formats?: BrandfetchLogoFormat[] | null
}

export interface BrandfetchResponse {
  name?: string | null
  domain?: string | null
  description?: string | null
  longDescription?: string | null
  links?: BrandfetchLink[] | null
  logos?: BrandfetchLogo[] | null
  colors?: BrandfetchColor[] | null
  fonts?: BrandfetchFont[] | null
  images?: Array<Record<string, unknown>> | null
  qualityScore?: number | null
}

export interface BrandfetchMetadata {
  source: 'brandfetch'
  domain: string
  websiteUrl: string
  name?: string
  description?: string
  longDescription?: string
  logoPrimaryUrl?: string
  logoPrimaryDarkUrl?: string
  logoIconUrl?: string
  faviconUrl?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  palette: string[]
  fontFamily?: string
  fontHeading?: string
  socialLinks: Record<string, string>
  qualityScore: number | null
  raw: BrandfetchResponse
}

export function extractCanonicalDomain(inputUrl: string): string {
  const hostname = new URL(inputUrl).hostname.toLowerCase()
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname
}

export async function fetchBrandfetchMetadata(inputUrl: string): Promise<BrandfetchMetadata | null> {
  const apiKey = process.env.BRANDFETCH_SECRET_API_KEY
  if (!apiKey) {
    return null
  }

  const domain = extractCanonicalDomain(inputUrl)
  const response = await fetch(`https://api.brandfetch.io/v2/brands/domain/${encodeURIComponent(domain)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Brandfetch request failed with ${response.status}`)
  }

  const payload = (await response.json()) as BrandfetchResponse

  return normalizeBrandfetchResponse(domain, payload)
}

export function normalizeBrandfetchResponse(domain: string, payload: BrandfetchResponse): BrandfetchMetadata {
  const primaryLogo = selectLogo(payload.logos ?? [], (logo) => logo.type !== 'icon' && logo.theme !== 'dark')
  const darkLogo = selectLogo(payload.logos ?? [], (logo) => logo.type !== 'icon' && logo.theme === 'dark')
  const iconLogo = selectLogo(payload.logos ?? [], (logo) => logo.type === 'icon')

  const palette = (payload.colors ?? [])
    .map((color) => color.hex?.trim())
    .filter((color): color is string => Boolean(color))

  const primaryColor =
    (payload.colors ?? []).find((color) => color.type === 'accent')?.hex ||
    (payload.colors ?? []).find((color) => color.type === 'brand')?.hex ||
    palette[0]

  const secondaryColor =
    (payload.colors ?? []).find((color) => color.type === 'dark')?.hex ||
    palette.find((entry) => entry !== primaryColor) ||
    primaryColor

  const accentColor =
    (payload.colors ?? []).find((color) => color.type === 'light')?.hex ||
    palette.find((entry) => entry !== primaryColor && entry !== secondaryColor) ||
    primaryColor

  const headingFont =
    (payload.fonts ?? []).find((font) => (font.type || '').toLowerCase().includes('title'))?.name ||
    (payload.fonts ?? []).find((font) => (font.type || '').toLowerCase().includes('heading'))?.name ||
    payload.fonts?.[0]?.name ||
    undefined

  const bodyFont =
    (payload.fonts ?? []).find((font) => (font.type || '').toLowerCase().includes('body'))?.name ||
    payload.fonts?.[1]?.name ||
    headingFont

  const socialLinks = Object.fromEntries(
    (payload.links ?? [])
      .map((link) => [link.name?.trim().toLowerCase(), link.url?.trim()] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))
  )

  return {
    source: 'brandfetch',
    domain,
    websiteUrl: `https://${payload.domain || domain}`,
    name: payload.name || undefined,
    description: payload.description || undefined,
    longDescription: payload.longDescription || undefined,
    logoPrimaryUrl: primaryLogo,
    logoPrimaryDarkUrl: darkLogo,
    logoIconUrl: iconLogo,
    faviconUrl: iconLogo,
    primaryColor,
    secondaryColor,
    accentColor,
    palette,
    fontFamily: bodyFont || undefined,
    fontHeading: headingFont || undefined,
    socialLinks,
    qualityScore: payload.qualityScore ?? null,
    raw: payload,
  }
}

function selectLogo(logos: BrandfetchLogo[], predicate: (logo: BrandfetchLogo) => boolean): string | undefined {
  const logo = logos.find(predicate)
  if (!logo?.formats?.length) {
    return undefined
  }

  const preferredFormat =
    logo.formats.find((format) => format.format === 'svg' && format.src) ||
    logo.formats.find((format) => format.src)

  return preferredFormat?.src || undefined
}
