export type PlanId = 'free' | 'solo' | 'team' | 'growth' | 'enterprise';

export interface PlanLimits {
  campaigns: number // -1 = unlimited
  apiCalls: number
  providers: string[] | 'all'
  templates: string[] | 'all'
  sakoEscalation: boolean
  designPlayground?: boolean
  aiAgent?: boolean
  performancePrediction?: boolean
  multiAssetGeneration?: boolean
  sso?: boolean
  customTemplates?: boolean
  prioritySupport?: boolean
  dedicatedManager?: boolean
  // Additional limits for usage metering
  aiGenerationsPerMonth?: number | 'unlimited'
  campaignsPerMonth?: number | 'unlimited'
  brands?: number | 'unlimited'
  teamSeats?: number | 'unlimited'
  apiCallsPerMonth?: number | 'unlimited'
  publishesPerMonth?: number | 'unlimited'
}

export interface Plan {
  id: PlanId
  name: string
  price: number // monthly USD
  stripePriceId?: string
  limits: PlanLimits
  features: string[]
  popular?: boolean
  badge?: string
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    limits: {
      campaigns: 2,
      apiCalls: 100,
      providers: [],
      templates: ['default-b2b-saas'],
      sakoEscalation: false,
      designPlayground: false,
      aiAgent: false,
      performancePrediction: false,
      multiAssetGeneration: false,
      brands: 1,
      teamSeats: 1,
      aiGenerationsPerMonth: 25,
      publishesPerMonth: 0,
      apiCallsPerMonth: 100,
    },
    features: [
      '1 seat',
      '1 brand',
      'URL import + brand extraction',
      'Claims review workspace',
      'No direct deploys or premium exports',
    ],
  },
  solo: {
    id: 'solo',
    name: 'Solo',
    price: 99,
    stripePriceId: process.env.STRIPE_PRICE_SOLO ?? process.env.STRIPE_PRICE_PRO,
    limits: {
      campaigns: 10,
      apiCalls: 1000,
      providers: ['hubspot', 'mailchimp', 'webflow', 'framer', 'notion'],
      templates: ['default-b2b-saas', 'minimal-agency'],
      sakoEscalation: false,
      designPlayground: true,
      aiAgent: true,
      performancePrediction: false,
      multiAssetGeneration: true,
      brands: 1,
      teamSeats: 1,
      aiGenerationsPerMonth: 250,
      publishesPerMonth: 30,
    },
    features: [
      '1 seat',
      '1 brand',
      '30 publishes / month',
      'Core GTM Brain sources',
      'Compliance checks',
      'Asset editor + exports',
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 599,
    stripePriceId: process.env.STRIPE_PRICE_TEAM ?? process.env.STRIPE_PRICE_MAX,
    popular: true,
    limits: {
      campaigns: 50,
      apiCalls: 10000,
      providers: 'all',
      templates: 'all',
      sakoEscalation: false,
      designPlayground: true,
      aiAgent: true,
      performancePrediction: true,
      multiAssetGeneration: true,
      brands: 2,
      teamSeats: 5,
      aiGenerationsPerMonth: 1500,
      publishesPerMonth: 200,
    },
    features: [
      '5 seats',
      '2 brands',
      '200 publishes / month',
      'GitHub + site builder import',
      'Approvals and audit trail',
      'Multi-asset generation',
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 1499,
    stripePriceId: process.env.STRIPE_PRICE_GROWTH ?? process.env.STRIPE_PRICE_ENTERPRISE,
    limits: {
      campaigns: 150,
      apiCalls: 50000,
      providers: 'all',
      templates: 'all',
      sakoEscalation: true,
      designPlayground: true,
      aiAgent: true,
      performancePrediction: true,
      multiAssetGeneration: true,
      prioritySupport: true,
      brands: 5,
      teamSeats: 15,
      aiGenerationsPerMonth: 6000,
      publishesPerMonth: 1000,
    },
    features: [
      '15 seats',
      '5 brands',
      '1,000 publishes / month',
      'Unlimited source connections',
      'Advanced approvals and versioned Brain snapshots',
      'Priority support',
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 6000,
    badge: 'Custom',
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE,
    limits: {
      campaigns: -1,
      apiCalls: -1,
      providers: 'all',
      templates: 'all',
      sakoEscalation: true,
      designPlayground: true,
      aiAgent: true,
      performancePrediction: true,
      multiAssetGeneration: true,
      sso: true,
      customTemplates: true,
      prioritySupport: true,
      dedicatedManager: true,
      brands: 'unlimited',
      teamSeats: 'unlimited',
      aiGenerationsPerMonth: 'unlimited',
      publishesPerMonth: 'unlimited',
    },
    features: [
      'Unlimited seats, brands, and publishes',
      'SSO/SAML',
      'Regional approval policies',
      'Dedicated support and SLA',
    ],
  },
}

const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  free: 'free',
  starter: 'solo',
  pro: 'team',
  max: 'growth',
  scale: 'growth',
  core: 'growth',
  ops: 'growth',
}

export function normalizePlanId(planId: string | null | undefined): PlanId {
  if (!planId) {
    return 'free'
  }

  const normalized = planId.toLowerCase()

  if (normalized in PLANS) {
    return normalized as PlanId
  }
  return LEGACY_PLAN_MAP[normalized] ?? 'free'
}

export function getPlan(planId: string): Plan {
  return PLANS[normalizePlanId(planId)] || PLANS.free
}

export function getPlanLimits(planId: string): PlanLimits {
  return getPlan(planId).limits
}

export function canUseFeature(planId: string, feature: keyof PlanLimits): boolean {
  const limits = getPlanLimits(planId)
  const value = limits[feature]
  
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  if (Array.isArray(value) || value === 'all') {
    return true
  }
  return false
}

export function isWithinLimit(planId: string, metric: 'campaigns' | 'apiCalls' | 'brands' | 'teamSeats', currentUsage: number): boolean {
  const limits = getPlanLimits(planId)
  const limit = limits[metric]
  
  if (limit === -1 || limit === 'unlimited') return true // Unlimited
  if (typeof limit !== 'number') return true
  return currentUsage < limit
}

/**
 * Get brand limit for a plan
 */
export function getBrandLimit(planId: string): number | 'unlimited' {
  const limits = getPlanLimits(planId)
  return limits.brands || 1
}

/**
 * Get team seat limit for a plan
 */
export function getTeamSeatLimit(planId: string): number | 'unlimited' {
  const limits = getPlanLimits(planId)
  return limits.teamSeats || 1
}

/**
 * Check if workspace can add more brands
 */
export function canAddBrand(planId: string, currentBrandCount: number): boolean {
  const limit = getBrandLimit(planId)
  if (limit === 'unlimited') return true
  return currentBrandCount < limit
}
