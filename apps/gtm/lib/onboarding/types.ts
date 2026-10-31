/**
 * Onboarding Types
 * 
 * Defines the structure for the onboarding wizard flow.
 */

export type OnboardingStep = 
  | 'welcome'
  | 'workspace'
  | 'industry'
  | 'integration'
  | 'compliance'
  | 'complete'

export interface OnboardingState {
  currentStep: OnboardingStep
  completed: boolean
  data: {
    workspaceName?: string
    industry?: string
    companySize?: string
    primaryGoal?: string
    connectedProviders?: string[]
    policyTemplateId?: string
  }
}

export interface WorkspaceSetupData {
  name: string
  industry: string
  companySize: 'solo' | 'small' | 'medium' | 'large' | 'enterprise'
  primaryGoal: 'landing-pages' | 'email-campaigns' | 'full-gtm' | 'compliance-only'
}

export const INDUSTRIES = [
  { id: 'saas', label: 'SaaS / Technology', icon: '💻' },
  { id: 'fintech', label: 'Fintech / Financial Services', icon: '💰' },
  { id: 'healthcare', label: 'Healthcare / Life Sciences', icon: '🏥' },
  { id: 'ecommerce', label: 'E-commerce / Retail', icon: '🛒' },
  { id: 'agency', label: 'Marketing Agency', icon: '📊' },
  { id: 'b2b', label: 'B2B Services', icon: '🤝' },
  { id: 'education', label: 'Education / EdTech', icon: '📚' },
  { id: 'other', label: 'Other', icon: '🌐' },
] as const

export const COMPANY_SIZES = [
  { id: 'solo', label: 'Just me', description: '1 person' },
  { id: 'small', label: 'Small team', description: '2-10 people' },
  { id: 'medium', label: 'Growing company', description: '11-50 people' },
  { id: 'large', label: 'Large company', description: '51-200 people' },
  { id: 'enterprise', label: 'Enterprise', description: '200+ people' },
] as const

export const PRIMARY_GOALS = [
  { 
    id: 'landing-pages', 
    label: 'Build landing pages fast', 
    description: 'AI-powered page generation with compliance',
    icon: '🚀' 
  },
  { 
    id: 'email-campaigns', 
    label: 'Scale email campaigns', 
    description: 'Multi-channel deployment with tracking',
    icon: '📧' 
  },
  { 
    id: 'full-gtm', 
    label: 'Full GTM automation', 
    description: 'End-to-end campaign orchestration',
    icon: '🎯' 
  },
  { 
    id: 'compliance-only', 
    label: 'Compliance checking only', 
    description: 'Validate claims with ClaimsOS API',
    icon: '✅' 
  },
] as const

export const RECOMMENDED_PROVIDERS = [
  { id: 'hubspot', name: 'HubSpot', category: 'Marketing Automation', popular: true },
  { id: 'webflow', name: 'Webflow', category: 'Website Builder', popular: true },
  { id: 'mailchimp', name: 'Mailchimp', category: 'Email Marketing', popular: true },
  { id: 'figma', name: 'Figma', category: 'Design Tool', popular: false },
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', popular: false },
  { id: 'slack', name: 'Slack', category: 'Team Notifications', popular: true },
] as const

export const POLICY_TEMPLATES = [
  { id: 'default', name: 'General Marketing', description: 'Standard marketing compliance', recommended: true },
  { id: 'soc2-saas', name: 'SOC2 SaaS', description: 'For security-focused companies', recommended: false },
  { id: 'hipaa-healthcare', name: 'HIPAA Healthcare', description: 'Medical compliance', recommended: false },
  { id: 'fintech-strict', name: 'Fintech', description: 'Financial regulations', recommended: false },
  { id: 'gdpr-eu', name: 'GDPR Europe', description: 'EU data privacy', recommended: false },
] as const
