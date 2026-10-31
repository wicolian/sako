export function resolveCampaignBrandId(campaign: Record<string, unknown>): string | undefined {
  const directBrandId = typeof campaign.brand_id === 'string' ? campaign.brand_id : undefined
  if (directBrandId) {
    return directBrandId
  }

  const constraints = getCampaignConstraints(campaign)
  const fallbackBrandId = constraints.linked_brand_id
  return typeof fallbackBrandId === 'string' ? fallbackBrandId : undefined
}

export function attachCampaignBrandId<T extends Record<string, unknown>>(campaign: T): T & { brand_id?: string } {
  const resolvedBrandId = resolveCampaignBrandId(campaign)
  if (resolvedBrandId && typeof campaign.brand_id !== 'string') {
    return {
      ...campaign,
      brand_id: resolvedBrandId,
    }
  }

  return campaign as T & { brand_id?: string }
}

export function mergeCampaignBrandConstraint(
  constraints: Record<string, unknown> | null | undefined,
  brandId: string | null | undefined
): Record<string, unknown> | null {
  const nextConstraints = constraints ? { ...constraints } : {}
  if (brandId) {
    nextConstraints.linked_brand_id = brandId
  }

  return Object.keys(nextConstraints).length > 0 ? nextConstraints : null
}

export function isMissingCampaignBrandIdColumnError(message: string | undefined): boolean {
  if (!message) {
    return false
  }

  return (
    message.includes("Could not find the 'brand_id' column of 'campaigns'") ||
    message.includes('column "brand_id" of relation "campaigns" does not exist')
  )
}

function getCampaignConstraints(campaign: Record<string, unknown>): Record<string, unknown> {
  const constraints = campaign.constraints
  if (constraints && typeof constraints === 'object' && !Array.isArray(constraints)) {
    return constraints as Record<string, unknown>
  }

  return {}
}
