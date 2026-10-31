import type { ProviderCapabilityTier } from '@/lib/providers/registry'
import type { ProviderType } from '@/lib/providers/types'

export type ProviderSurfaceStatus = 'live' | 'beta' | 'coming_soon'
export type ProviderDeliveryMode = ProviderCapabilityTier | 'coming_soon'
export type ProviderCategory =
  | 'marketing_automation'
  | 'website_cms'
  | 'advertising'
  | 'analytics'
  | 'collaboration'

export interface ProviderCatalogItem {
  id: ProviderType
  name: string
  description: string
  category: ProviderCategory
  color: string
  iconLabel: string
  deliveryMode: ProviderDeliveryMode
  surfaceStatus: ProviderSurfaceStatus
  authType: 'oauth' | 'api_key' | 'webhook' | 'none'
  configured: boolean
  requiresConnection: boolean
  features: string[]
}

const PROVIDER_META: Record<ProviderType, Omit<ProviderCatalogItem, 'deliveryMode' | 'configured'>> = {
  hubspot: {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Direct deploy for landing pages and forms.',
    category: 'marketing_automation',
    color: '#FF7A59',
    iconLabel: 'HS',
    surfaceStatus: 'live',
    authType: 'oauth',
    requiresConnection: true,
    features: ['Landing page deploy', 'Form deploy', 'Lead capture'],
  },
  salesforce: {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Connection scaffolding exists, but campaign deploy is not wired.',
    category: 'marketing_automation',
    color: '#00A1E0',
    iconLabel: 'SF',
    surfaceStatus: 'coming_soon',
    authType: 'oauth',
    requiresConnection: true,
    features: ['OAuth scaffold'],
  },
  marketo: {
    id: 'marketo',
    name: 'Marketo',
    description: 'Connection scaffold only. No campaign deploy path yet.',
    category: 'marketing_automation',
    color: '#5C4C9F',
    iconLabel: 'MK',
    surfaceStatus: 'coming_soon',
    authType: 'api_key',
    requiresConnection: true,
    features: ['API key scaffold'],
  },
  activecampaign: {
    id: 'activecampaign',
    name: 'ActiveCampaign',
    description: 'Connection scaffold only. No campaign deploy path yet.',
    category: 'marketing_automation',
    color: '#356AE6',
    iconLabel: 'AC',
    surfaceStatus: 'coming_soon',
    authType: 'api_key',
    requiresConnection: true,
    features: ['API key scaffold'],
  },
  mailchimp: {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Connection scaffold only. No campaign deploy path yet.',
    category: 'marketing_automation',
    color: '#FFE01B',
    iconLabel: 'MC',
    surfaceStatus: 'coming_soon',
    authType: 'oauth',
    requiresConnection: true,
    features: ['OAuth scaffold'],
  },
  klaviyo: {
    id: 'klaviyo',
    name: 'Klaviyo',
    description: 'Connection scaffold only. No campaign deploy path yet.',
    category: 'marketing_automation',
    color: '#1A1A1A',
    iconLabel: 'KL',
    surfaceStatus: 'coming_soon',
    authType: 'api_key',
    requiresConnection: true,
    features: ['API key scaffold'],
  },
  webflow: {
    id: 'webflow',
    name: 'Webflow',
    description: 'Direct deploy exists, but it depends on OAuth setup and content-model fit.',
    category: 'website_cms',
    color: '#4353FF',
    iconLabel: 'WF',
    surfaceStatus: 'beta',
    authType: 'oauth',
    requiresConnection: true,
    features: ['Page deploy', 'CMS item deploy', 'Embedded forms'],
  },
  figma: {
    id: 'figma',
    name: 'Figma',
    description: 'Clipboard export for design handoff.',
    category: 'collaboration',
    color: '#111111',
    iconLabel: 'FG',
    surfaceStatus: 'live',
    authType: 'none',
    requiresConnection: false,
    features: ['Clipboard export'],
  },
  framer: {
    id: 'framer',
    name: 'Framer',
    description: 'Export/copy handoff is supported. Direct deploy is still beta-level.',
    category: 'website_cms',
    color: '#000000',
    iconLabel: 'FR',
    surfaceStatus: 'beta',
    authType: 'oauth',
    requiresConnection: true,
    features: ['Clipboard export', 'Project deploy beta'],
  },
  wordpress: {
    id: 'wordpress',
    name: 'WordPress',
    description: 'Provider scaffold exists, but launch-ready deploy is not wired.',
    category: 'website_cms',
    color: '#21759B',
    iconLabel: 'WP',
    surfaceStatus: 'coming_soon',
    authType: 'api_key',
    requiresConnection: true,
    features: ['Provider scaffold'],
  },
  shopify: {
    id: 'shopify',
    name: 'Shopify',
    description: 'Provider scaffold exists, but launch-ready deploy is not wired.',
    category: 'website_cms',
    color: '#96BF48',
    iconLabel: 'SH',
    surfaceStatus: 'coming_soon',
    authType: 'oauth',
    requiresConnection: true,
    features: ['Provider scaffold'],
  },
  'google-ads': {
    id: 'google-ads',
    name: 'Google Ads',
    description: 'Provider scaffold exists, but campaign deployment is not wired.',
    category: 'advertising',
    color: '#4285F4',
    iconLabel: 'GA',
    surfaceStatus: 'coming_soon',
    authType: 'oauth',
    requiresConnection: true,
    features: ['Provider scaffold'],
  },
  'meta-ads': {
    id: 'meta-ads',
    name: 'Meta Ads',
    description: 'Provider scaffold exists, but campaign deployment is not wired.',
    category: 'advertising',
    color: '#1877F2',
    iconLabel: 'MA',
    surfaceStatus: 'coming_soon',
    authType: 'oauth',
    requiresConnection: true,
    features: ['Provider scaffold'],
  },
  'linkedin-ads': {
    id: 'linkedin-ads',
    name: 'LinkedIn Ads',
    description: 'Provider scaffold exists, but campaign deployment is not wired.',
    category: 'advertising',
    color: '#0A66C2',
    iconLabel: 'LI',
    surfaceStatus: 'coming_soon',
    authType: 'oauth',
    requiresConnection: true,
    features: ['Provider scaffold'],
  },
  ga4: {
    id: 'ga4',
    name: 'GA4',
    description: 'Analytics provider scaffold only.',
    category: 'analytics',
    color: '#F9AB00',
    iconLabel: 'G4',
    surfaceStatus: 'coming_soon',
    authType: 'oauth',
    requiresConnection: true,
    features: ['Provider scaffold'],
  },
  amplitude: {
    id: 'amplitude',
    name: 'Amplitude',
    description: 'Analytics provider scaffold only.',
    category: 'analytics',
    color: '#1A73E8',
    iconLabel: 'AM',
    surfaceStatus: 'coming_soon',
    authType: 'api_key',
    requiresConnection: true,
    features: ['Provider scaffold'],
  },
  mixpanel: {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Analytics provider scaffold only.',
    category: 'analytics',
    color: '#7856FF',
    iconLabel: 'MX',
    surfaceStatus: 'coming_soon',
    authType: 'api_key',
    requiresConnection: true,
    features: ['Provider scaffold'],
  },
  segment: {
    id: 'segment',
    name: 'Segment',
    description: 'Analytics provider scaffold only.',
    category: 'analytics',
    color: '#3ECF8E',
    iconLabel: 'SG',
    surfaceStatus: 'coming_soon',
    authType: 'api_key',
    requiresConnection: true,
    features: ['Provider scaffold'],
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    description: 'Notification workflows exist, but campaign deploy is not a Slack action.',
    category: 'collaboration',
    color: '#4A154B',
    iconLabel: 'SL',
    surfaceStatus: 'beta',
    authType: 'oauth',
    requiresConnection: true,
    features: ['Notifications', 'Task updates'],
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    description: 'Provider scaffold exists, but launch-ready sync is not wired.',
    category: 'collaboration',
    color: '#111111',
    iconLabel: 'NO',
    surfaceStatus: 'coming_soon',
    authType: 'oauth',
    requiresConnection: true,
    features: ['Provider scaffold'],
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    description: 'Reserved for future custom provider adapters.',
    category: 'collaboration',
    color: '#6B7280',
    iconLabel: 'CU',
    surfaceStatus: 'coming_soon',
    authType: 'none',
    requiresConnection: false,
    features: ['Reserved'],
  },
}

function isConfigured(providerId: ProviderType): boolean {
  switch (providerId) {
    case 'hubspot':
      return Boolean(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET)
    case 'webflow':
      return Boolean(process.env.WEBFLOW_CLIENT_ID && process.env.WEBFLOW_CLIENT_SECRET)
    case 'framer':
      return Boolean(process.env.FRAMER_CLIENT_ID && process.env.FRAMER_CLIENT_SECRET)
    case 'figma':
      return Boolean(process.env.CODE_TO_DESIGN_API_KEY)
    case 'salesforce':
      return Boolean(process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET)
    case 'mailchimp':
    case 'activecampaign':
    case 'marketo':
    case 'klaviyo':
    case 'wordpress':
    case 'shopify':
    case 'ga4':
    case 'amplitude':
    case 'mixpanel':
    case 'segment':
    case 'slack':
    case 'notion':
    case 'google-ads':
    case 'meta-ads':
    case 'linkedin-ads':
      return true
    default:
      return false
  }
}

function getDeliveryMode(providerId: ProviderType): ProviderDeliveryMode {
  if (providerId === 'figma') return 'export_only'
  if (providerId === 'framer') return 'export_only'
  if (PROVIDER_META[providerId].surfaceStatus === 'coming_soon') return 'coming_soon'
  return 'direct_deploy'
}

export function getProviderCatalog(): ProviderCatalogItem[] {
  return Object.values(PROVIDER_META)
    .map((provider) => ({
      ...provider,
      deliveryMode: getDeliveryMode(provider.id),
      configured: isConfigured(provider.id),
    }))
}

export const PROVIDER_CATEGORIES: Array<{ id: ProviderCategory; name: string }> = [
  { id: 'marketing_automation', name: 'Marketing Automation' },
  { id: 'website_cms', name: 'Website & CMS' },
  { id: 'advertising', name: 'Advertising' },
  { id: 'analytics', name: 'Analytics' },
  { id: 'collaboration', name: 'Collaboration' },
]
