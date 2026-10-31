/**
 * Integration Registry
 * 
 * Central registry for all platform integrations:
 * - Marketing Automation
 * - Website/CMS
 * - Advertising
 * - Communication
 * - Design
 * - Data
 * - Automation
 */

// ============================================================================
// Types
// ============================================================================

export type IntegrationCategory = 
  | 'marketing_automation'
  | 'website_cms'
  | 'advertising'
  | 'communication'
  | 'design'
  | 'data'
  | 'automation'
  | 'crm'
  | 'social'

export type IntegrationStatus = 'available' | 'connected' | 'error' | 'coming_soon'

export interface Integration {
  id: string
  name: string
  description: string
  category: IntegrationCategory
  icon: string
  color: string
  features: string[]
  authType: 'oauth' | 'api_key' | 'webhook'
  documentationUrl?: string
  status: IntegrationStatus
  isPremium?: boolean
  isNew?: boolean
}

export interface IntegrationConnection {
  id: string
  workspace_id: string
  integration_id: string
  status: 'active' | 'error' | 'disconnected'
  credentials_encrypted: string
  settings: Record<string, unknown>
  last_sync_at?: string
  error_message?: string
  created_at: string
  updated_at: string
}

// ============================================================================
// Integration Registry
// ============================================================================

export const INTEGRATIONS: Integration[] = [
  // Marketing Automation
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Marketing, sales, and service platform',
    category: 'marketing_automation',
    icon: '/integrations/hubspot.svg',
    color: '#FF7A59',
    features: [
      'Contact sync',
      'Email campaigns',
      'Landing pages',
      'Lead scoring',
      'Workflow triggers',
    ],
    authType: 'oauth',
    documentationUrl: 'https://docs.hubspot.com/docs/api',
    status: 'available',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Enterprise CRM and marketing cloud',
    category: 'marketing_automation',
    icon: '/integrations/salesforce.svg',
    color: '#00A1E0',
    features: [
      'Lead management',
      'Campaign sync',
      'Content delivery',
      'Analytics',
    ],
    authType: 'oauth',
    status: 'available',
  },
  {
    id: 'marketo',
    name: 'Marketo',
    description: 'Adobe marketing automation',
    category: 'marketing_automation',
    icon: '/integrations/marketo.svg',
    color: '#5C4C9F',
    features: [
      'Lead nurturing',
      'Email marketing',
      'Landing pages',
      'Analytics',
    ],
    authType: 'api_key',
    status: 'available',
    isPremium: true,
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Email marketing and automation',
    category: 'marketing_automation',
    icon: '/integrations/mailchimp.svg',
    color: '#FFE01B',
    features: [
      'Email campaigns',
      'Audience management',
      'Templates',
      'Analytics',
    ],
    authType: 'oauth',
    status: 'available',
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    description: 'E-commerce email and SMS marketing',
    category: 'marketing_automation',
    icon: '/integrations/klaviyo.svg',
    color: '#1A1A1A',
    features: [
      'Email flows',
      'SMS marketing',
      'Segmentation',
      'Analytics',
    ],
    authType: 'api_key',
    status: 'available',
  },
  {
    id: 'activecampaign',
    name: 'ActiveCampaign',
    description: 'Customer experience automation',
    category: 'marketing_automation',
    icon: '/integrations/activecampaign.svg',
    color: '#356AE6',
    features: [
      'Email automation',
      'CRM',
      'Lead scoring',
      'Messaging',
    ],
    authType: 'api_key',
    status: 'available',
  },

  // Website/CMS
  {
    id: 'webflow',
    name: 'Webflow',
    description: 'Visual web development platform',
    category: 'website_cms',
    icon: '/integrations/webflow.svg',
    color: '#4353FF',
    features: [
      'Page publishing',
      'Content sync',
      'CMS updates',
      'Asset management',
    ],
    authType: 'oauth',
    status: 'available',
    isNew: true,
  },
  {
    id: 'wordpress',
    name: 'WordPress',
    description: 'Content management system',
    category: 'website_cms',
    icon: '/integrations/wordpress.svg',
    color: '#21759B',
    features: [
      'Post publishing',
      'Page management',
      'Media upload',
      'SEO updates',
    ],
    authType: 'api_key',
    status: 'available',
  },
  {
    id: 'framer',
    name: 'Framer',
    description: 'Design and publish websites',
    category: 'website_cms',
    icon: '/integrations/framer.svg',
    color: '#0055FF',
    features: [
      'Page publishing',
      'Component sync',
      'CMS content',
    ],
    authType: 'api_key',
    status: 'available',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'E-commerce platform',
    category: 'website_cms',
    icon: '/integrations/shopify.svg',
    color: '#96BF48',
    features: [
      'Product management',
      'Page content',
      'Blog posts',
      'Collections',
    ],
    authType: 'oauth',
    status: 'available',
  },

  // Advertising
  {
    id: 'meta_ads',
    name: 'Meta Ads',
    description: 'Facebook and Instagram advertising',
    category: 'advertising',
    icon: '/integrations/meta.svg',
    color: '#1877F2',
    features: [
      'Ad creation',
      'Campaign management',
      'Audience targeting',
      'Performance data',
    ],
    authType: 'oauth',
    status: 'available',
  },
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Search and display advertising',
    category: 'advertising',
    icon: '/integrations/google-ads.svg',
    color: '#4285F4',
    features: [
      'Campaign management',
      'Ad groups',
      'Keywords',
      'Performance data',
    ],
    authType: 'oauth',
    status: 'available',
  },
  {
    id: 'linkedin_ads',
    name: 'LinkedIn Ads',
    description: 'B2B advertising platform',
    category: 'advertising',
    icon: '/integrations/linkedin.svg',
    color: '#0A66C2',
    features: [
      'Sponsored content',
      'Lead gen forms',
      'Audience targeting',
      'Analytics',
    ],
    authType: 'oauth',
    status: 'available',
  },
  {
    id: 'tiktok_ads',
    name: 'TikTok Ads',
    description: 'Short-form video advertising',
    category: 'advertising',
    icon: '/integrations/tiktok.svg',
    color: '#000000',
    features: [
      'Video ads',
      'Spark ads',
      'Audience management',
      'Analytics',
    ],
    authType: 'oauth',
    status: 'available',
    isNew: true,
  },

  // Communication
  {
    id: 'slack',
    name: 'Slack',
    description: 'Team communication',
    category: 'communication',
    icon: '/integrations/slack.svg',
    color: '#4A154B',
    features: [
      'Notifications',
      'Slash commands',
      'AI assistant',
      'Approval workflows',
    ],
    authType: 'oauth',
    status: 'available',
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    description: 'Enterprise collaboration',
    category: 'communication',
    icon: '/integrations/teams.svg',
    color: '#6264A7',
    features: [
      'Notifications',
      'Tabs',
      'Bots',
      'Workflows',
    ],
    authType: 'oauth',
    status: 'coming_soon',
  },

  // Design
  {
    id: 'figma',
    name: 'Figma',
    description: 'Collaborative design tool',
    category: 'design',
    icon: '/integrations/figma.svg',
    color: '#F24E1E',
    features: [
      'Design import',
      'Copy sync',
      'Components',
      'Asset export',
    ],
    authType: 'oauth',
    status: 'available',
  },
  {
    id: 'canva',
    name: 'Canva',
    description: 'Online design platform',
    category: 'design',
    icon: '/integrations/canva.svg',
    color: '#00C4CC',
    features: [
      'Template access',
      'Design export',
      'Brand kit',
    ],
    authType: 'oauth',
    status: 'available',
  },

  // Data
  {
    id: 'bigquery',
    name: 'Google BigQuery',
    description: 'Data warehouse analytics',
    category: 'data',
    icon: '/integrations/bigquery.svg',
    color: '#4285F4',
    features: [
      'Data export',
      'Query execution',
      'Dashboard sync',
    ],
    authType: 'oauth',
    status: 'available',
    isPremium: true,
  },
  {
    id: 'segment',
    name: 'Segment',
    description: 'Customer data platform',
    category: 'data',
    icon: '/integrations/segment.svg',
    color: '#52BD95',
    features: [
      'Event tracking',
      'User profiles',
      'Destinations',
    ],
    authType: 'api_key',
    status: 'available',
    isPremium: true,
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Product analytics',
    category: 'data',
    icon: '/integrations/mixpanel.svg',
    color: '#7856FF',
    features: [
      'Event tracking',
      'Funnels',
      'Cohorts',
    ],
    authType: 'api_key',
    status: 'coming_soon',
  },

  // Automation
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Workflow automation',
    category: 'automation',
    icon: '/integrations/zapier.svg',
    color: '#FF4A00',
    features: [
      'Triggers',
      'Actions',
      '5000+ apps',
    ],
    authType: 'webhook',
    status: 'available',
  },
  {
    id: 'make',
    name: 'Make',
    description: 'Visual automation platform',
    category: 'automation',
    icon: '/integrations/make.svg',
    color: '#6D00CC',
    features: [
      'Scenarios',
      'Webhooks',
      'Data transforms',
    ],
    authType: 'webhook',
    status: 'available',
  },
  {
    id: 'pabbly',
    name: 'Pabbly Connect',
    description: 'Affordable automation',
    category: 'automation',
    icon: '/integrations/pabbly.svg',
    color: '#FF6B00',
    features: [
      'Workflows',
      'Webhooks',
      'Multi-step',
    ],
    authType: 'webhook',
    status: 'available',
  },

  // Social
  {
    id: 'buffer',
    name: 'Buffer',
    description: 'Social media management',
    category: 'social',
    icon: '/integrations/buffer.svg',
    color: '#168EEA',
    features: [
      'Post scheduling',
      'Analytics',
      'Queue management',
    ],
    authType: 'oauth',
    status: 'available',
  },
  {
    id: 'hootsuite',
    name: 'Hootsuite',
    description: 'Social media management',
    category: 'social',
    icon: '/integrations/hootsuite.svg',
    color: '#000000',
    features: [
      'Publishing',
      'Monitoring',
      'Analytics',
    ],
    authType: 'oauth',
    status: 'coming_soon',
  },
]

// ============================================================================
// Registry Functions
// ============================================================================

/**
 * Get all integrations
 */
export function getAllIntegrations(): Integration[] {
  return INTEGRATIONS
}

/**
 * Get integration by ID
 */
export function getIntegration(id: string): Integration | undefined {
  return INTEGRATIONS.find(i => i.id === id)
}

/**
 * Get integrations by category
 */
export function getIntegrationsByCategory(category: IntegrationCategory): Integration[] {
  return INTEGRATIONS.filter(i => i.category === category)
}

/**
 * Get available integrations
 */
export function getAvailableIntegrations(): Integration[] {
  return INTEGRATIONS.filter(i => i.status === 'available')
}

/**
 * Get premium integrations
 */
export function getPremiumIntegrations(): Integration[] {
  return INTEGRATIONS.filter(i => i.isPremium)
}

/**
 * Get new integrations
 */
export function getNewIntegrations(): Integration[] {
  return INTEGRATIONS.filter(i => i.isNew)
}

/**
 * Search integrations
 */
export function searchIntegrations(query: string): Integration[] {
  const lowerQuery = query.toLowerCase()
  return INTEGRATIONS.filter(i => 
    i.name.toLowerCase().includes(lowerQuery) ||
    i.description.toLowerCase().includes(lowerQuery) ||
    i.features.some(f => f.toLowerCase().includes(lowerQuery))
  )
}

// ============================================================================
// Category Metadata
// ============================================================================

export const INTEGRATION_CATEGORIES: {
  id: IntegrationCategory
  name: string
  description: string
  icon: string
}[] = [
  {
    id: 'marketing_automation',
    name: 'Marketing Automation',
    description: 'Email, campaigns, and lead nurturing',
    icon: '📧',
  },
  {
    id: 'website_cms',
    name: 'Website & CMS',
    description: 'Content management and publishing',
    icon: '🌐',
  },
  {
    id: 'advertising',
    name: 'Advertising',
    description: 'Paid media and ad platforms',
    icon: '📢',
  },
  {
    id: 'communication',
    name: 'Communication',
    description: 'Team chat and notifications',
    icon: '💬',
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Design tools and asset management',
    icon: '🎨',
  },
  {
    id: 'data',
    name: 'Data & Analytics',
    description: 'Data warehouses and analytics',
    icon: '📊',
  },
  {
    id: 'automation',
    name: 'Automation',
    description: 'Workflow and process automation',
    icon: '⚡',
  },
  {
    id: 'social',
    name: 'Social Media',
    description: 'Social media management',
    icon: '📱',
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Customer relationship management',
    icon: '👥',
  },
]

export function getCategoryInfo(category: IntegrationCategory) {
  return INTEGRATION_CATEGORIES.find(c => c.id === category)
}
