export function getBrandProfileHref(brandId?: string | null): string | null {
  return brandId ? `/brands/${brandId}` : null
}

export function getImportedCampaignHref(brandId?: string | null, sourceUrl?: string): string | null {
  if (!brandId) {
    return null
  }

  const encodedSourceUrl = sourceUrl ? encodeURIComponent(sourceUrl) : ''
  return `/campaigns/new?imported=1&brand=${brandId}${encodedSourceUrl ? `&sourceUrl=${encodedSourceUrl}` : ''}`
}
