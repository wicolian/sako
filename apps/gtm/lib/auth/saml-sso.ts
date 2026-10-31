/**
 * SAML/SSO Enterprise Authentication (Phase 4.1)
 * 
 * Support for Okta, Auth0, Azure AD, and generic SAML 2.0 providers.
 */

import { createServiceClient } from '@/lib/supabase/service'

// ============================================================================
// Types
// ============================================================================

export type SSOProvider = 'okta' | 'auth0' | 'azure_ad' | 'google_workspace' | 'custom_saml'

export interface SSOConfig {
  id: string
  workspaceId: string
  provider: SSOProvider
  enabled: boolean
  
  // Provider-specific config
  domain?: string
  clientId?: string
  clientSecret?: string // Stored encrypted
  
  // SAML config
  entityId?: string
  ssoUrl?: string
  sloUrl?: string
  certificate?: string
  
  // Settings
  enforceSSO: boolean
  autoProvision: boolean
  defaultRole: 'member' | 'viewer'
  allowedDomains: string[]
  
  // Metadata
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

export interface SSOSession {
  id: string
  userId: string
  workspaceId: string
  provider: SSOProvider
  providerUserId: string
  attributes: Record<string, unknown>
  expiresAt: string
  createdAt: string
}

export interface SSOProviderInfo {
  provider: SSOProvider
  name: string
  logo: string
  description: string
  setupUrl?: string
  features: string[]
}

// ============================================================================
// Provider Information
// ============================================================================

export const SSO_PROVIDERS: SSOProviderInfo[] = [
  {
    provider: 'okta',
    name: 'Okta',
    logo: '/logos/okta.svg',
    description: 'Enterprise-grade identity management',
    setupUrl: 'https://developer.okta.com/docs/guides/',
    features: ['SAML 2.0', 'OIDC', 'SCIM', 'MFA'],
  },
  {
    provider: 'auth0',
    name: 'Auth0',
    logo: '/logos/auth0.svg',
    description: 'Flexible authentication platform',
    setupUrl: 'https://auth0.com/docs/authenticate/protocols/saml',
    features: ['SAML 2.0', 'OIDC', 'Social Login', 'MFA'],
  },
  {
    provider: 'azure_ad',
    name: 'Azure Active Directory',
    logo: '/logos/azure-ad.svg',
    description: 'Microsoft enterprise identity',
    setupUrl: 'https://learn.microsoft.com/en-us/azure/active-directory/saas-apps/',
    features: ['SAML 2.0', 'OIDC', 'Microsoft 365', 'Conditional Access'],
  },
  {
    provider: 'google_workspace',
    name: 'Google Workspace',
    logo: '/logos/google.svg',
    description: 'Google enterprise authentication',
    setupUrl: 'https://support.google.com/a/answer/6087519',
    features: ['SAML 2.0', 'OIDC', 'Google Apps', 'MFA'],
  },
  {
    provider: 'custom_saml',
    name: 'Custom SAML 2.0',
    logo: '/logos/saml.svg',
    description: 'Any SAML 2.0 compatible provider',
    features: ['SAML 2.0', 'Custom Configuration'],
  },
]

// ============================================================================
// SSO Configuration Management
// ============================================================================

/**
 * Get SSO configuration for a workspace
 */
export async function getSSOConfig(workspaceId: string): Promise<SSOConfig | null> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('sso_configs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single()
  
  if (error || !data) return null
  
  return {
    id: data.id,
    workspaceId: data.workspace_id,
    provider: data.provider,
    enabled: data.enabled,
    domain: data.domain,
    clientId: data.client_id,
    entityId: data.entity_id,
    ssoUrl: data.sso_url,
    sloUrl: data.slo_url,
    certificate: data.certificate,
    enforceSSO: data.enforce_sso,
    autoProvision: data.auto_provision,
    defaultRole: data.default_role,
    allowedDomains: data.allowed_domains || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    lastUsedAt: data.last_used_at,
  }
}

/**
 * Create or update SSO configuration
 */
export async function upsertSSOConfig(
  workspaceId: string,
  config: Partial<Omit<SSOConfig, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
): Promise<SSOConfig | null> {
  const supabase = createServiceClient()
  
  const { data, error } = await supabase
    .from('sso_configs')
    .upsert({
      workspace_id: workspaceId,
      provider: config.provider,
      enabled: config.enabled ?? false,
      domain: config.domain,
      client_id: config.clientId,
      client_secret: config.clientSecret, // Should be encrypted before storing
      entity_id: config.entityId,
      sso_url: config.ssoUrl,
      slo_url: config.sloUrl,
      certificate: config.certificate,
      enforce_sso: config.enforceSSO ?? false,
      auto_provision: config.autoProvision ?? true,
      default_role: config.defaultRole ?? 'member',
      allowed_domains: config.allowedDomains ?? [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id' })
    .select()
    .single()
  
  if (error) {
    console.error('Failed to upsert SSO config:', error)
    return null
  }
  
  return getSSOConfig(workspaceId)
}

/**
 * Delete SSO configuration
 */
export async function deleteSSOConfig(workspaceId: string): Promise<boolean> {
  const supabase = createServiceClient()
  
  const { error } = await supabase
    .from('sso_configs')
    .delete()
    .eq('workspace_id', workspaceId)
  
  if (error) {
    console.error('Failed to delete SSO config:', error)
    return false
  }
  
  return true
}

// ============================================================================
// SSO Authentication
// ============================================================================

/**
 * Initiate SSO login flow
 */
export async function initiateSSOLogin(
  workspaceId: string,
  returnUrl?: string
): Promise<{ redirectUrl: string } | { error: string }> {
  const config = await getSSOConfig(workspaceId)
  
  if (!config || !config.enabled) {
    return { error: 'SSO is not configured for this workspace' }
  }
  
  // Generate SAML AuthnRequest
  const relayState = Buffer.from(JSON.stringify({
    workspaceId,
    returnUrl,
    timestamp: Date.now(),
  })).toString('base64')
  
  // Build redirect URL based on provider
  let redirectUrl: string
  
  switch (config.provider) {
    case 'okta':
      redirectUrl = `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(generateSAMLRequest(config))}&RelayState=${relayState}`
      break
    case 'auth0':
      redirectUrl = `https://${config.domain}/samlp/${config.clientId}?RelayState=${relayState}`
      break
    case 'azure_ad':
      redirectUrl = `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(generateSAMLRequest(config))}&RelayState=${relayState}`
      break
    case 'google_workspace':
      redirectUrl = `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(generateSAMLRequest(config))}&RelayState=${relayState}`
      break
    case 'custom_saml':
      redirectUrl = `${config.ssoUrl}?SAMLRequest=${encodeURIComponent(generateSAMLRequest(config))}&RelayState=${relayState}`
      break
    default:
      return { error: 'Unknown SSO provider' }
  }
  
  return { redirectUrl }
}

/**
 * Handle SSO callback
 */
export async function handleSSOCallback(
  samlResponse: string,
  relayState: string
): Promise<{ userId: string; sessionId: string } | { error: string }> {
  try {
    // Decode relay state
    const state = JSON.parse(Buffer.from(relayState, 'base64').toString())
    const { workspaceId } = state
    
    // Get SSO config
    const config = await getSSOConfig(workspaceId)
    if (!config || !config.enabled) {
      return { error: 'SSO is not configured' }
    }
    
    // Validate and parse SAML response
    const samlData = await validateSAMLResponse(samlResponse, config)
    if ('error' in samlData) {
      return { error: samlData.error }
    }
    
    const { email, attributes, nameId } = samlData
    
    // Validate email domain
    if (config.allowedDomains.length > 0) {
      const domain = email.split('@')[1]
      if (!config.allowedDomains.includes(domain)) {
        return { error: `Email domain ${domain} is not allowed` }
      }
    }
    
    // Find or create user
    const supabase = createServiceClient()
    
    let { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()
    
    if (!user && config.autoProvision) {
      // Create new user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          sso_provider: config.provider,
          sso_workspace: workspaceId,
          ...attributes,
        },
      })
      
      if (createError || !newUser.user) {
        return { error: 'Failed to create user' }
      }
      
      // Add to workspace
      await supabase.from('workspace_members').insert({
        workspace_id: workspaceId,
        user_id: newUser.user.id,
        role: config.defaultRole,
        joined_via: 'sso',
      })
      
      user = { id: newUser.user.id }
    }
    
    if (!user) {
      return { error: 'User not found and auto-provisioning is disabled' }
    }
    
    // Create SSO session
    const { data: session, error: sessionError } = await supabase
      .from('sso_sessions')
      .insert({
        user_id: user.id,
        workspace_id: workspaceId,
        provider: config.provider,
        provider_user_id: nameId,
        attributes,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select()
      .single()
    
    if (sessionError || !session) {
      return { error: 'Failed to create session' }
    }
    
    // Update last used timestamp
    await supabase
      .from('sso_configs')
      .update({ last_used_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
    
    return {
      userId: user.id,
      sessionId: session.id,
    }
  } catch (err) {
    console.error('SSO callback error:', err)
    return { error: 'SSO authentication failed' }
  }
}

// ============================================================================
// SAML Helpers
// ============================================================================

/**
 * Generate SAML AuthnRequest
 */
function generateSAMLRequest(config: SSOConfig): string {
  const id = `_${crypto.randomUUID()}`
  const issueInstant = new Date().toISOString()
  
  const request = `
    <samlp:AuthnRequest 
      xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="${id}"
      Version="2.0"
      IssueInstant="${issueInstant}"
      AssertionConsumerServiceURL="${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/callback"
      ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
      <saml:Issuer>${config.entityId || process.env.NEXT_PUBLIC_APP_URL}</saml:Issuer>
      <samlp:NameIDPolicy 
        Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
        AllowCreate="true"/>
    </samlp:AuthnRequest>
  `.trim()
  
  // In production, this would be deflated and base64 encoded
  return Buffer.from(request).toString('base64')
}

/**
 * Validate SAML response
 */
async function validateSAMLResponse(
  response: string,
  config: SSOConfig
): Promise<{ email: string; nameId: string; attributes: Record<string, unknown> } | { error: string }> {
  // In production, this would:
  // 1. Decode and decompress the response
  // 2. Validate the signature using config.certificate
  // 3. Check timestamps and conditions
  // 4. Extract assertions
  
  // Placeholder - in production use a SAML library like saml2-js or passport-saml
  try {
    const decoded = Buffer.from(response, 'base64').toString()
    
    // Extract email from NameID (simplified)
    const emailMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/i)
    const email = emailMatch?.[1]
    
    if (!email) {
      return { error: 'Could not extract email from SAML response' }
    }
    
    return {
      email,
      nameId: email,
      attributes: {},
    }
  } catch (err) {
    return { error: 'Invalid SAML response' }
  }
}

// ============================================================================
// Domain Verification
// ============================================================================

/**
 * Generate domain verification token
 */
export function generateDomainVerificationToken(workspaceId: string, domain: string): string {
  const data = `${workspaceId}:${domain}:${Date.now()}`
  return `sako-verify=${Buffer.from(data).toString('base64').substring(0, 32)}`
}

/**
 * Verify domain ownership via DNS TXT record
 */
export async function verifyDomain(domain: string, expectedToken: string): Promise<boolean> {
  try {
    const response = await fetch(`https://dns.google/resolve?name=_sako-verify.${domain}&type=TXT`)
    const data = await response.json()
    
    if (data.Answer) {
      for (const record of data.Answer) {
        if (record.data?.includes(expectedToken)) {
          return true
        }
      }
    }
    
    return false
  } catch (err) {
    console.error('Domain verification failed:', err)
    return false
  }
}

// ============================================================================
// SSO Status Check
// ============================================================================

/**
 * Check if SSO is required for a user
 */
export async function isSSORequired(email: string): Promise<{
  required: boolean
  workspaceId?: string
  provider?: SSOProvider
}> {
  const domain = email.split('@')[1]
  const supabase = createServiceClient()
  
  // Check if any workspace enforces SSO for this domain
  const { data } = await supabase
    .from('sso_configs')
    .select('workspace_id, provider')
    .eq('enabled', true)
    .eq('enforce_sso', true)
    .contains('allowed_domains', [domain])
    .single()
  
  if (data) {
    return {
      required: true,
      workspaceId: data.workspace_id,
      provider: data.provider,
    }
  }
  
  return { required: false }
}
