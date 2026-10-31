/**
 * SSO/SAML Configuration and Authentication
 * 
 * Handles enterprise single sign-on with support for:
 * - SAML 2.0
 * - OIDC (OpenID Connect)
 * - Okta
 * - Azure AD
 * - Google Workspace
 */

import { createServiceClient } from '@/lib/supabase/service'
import { encrypt, decrypt } from '@/lib/encryption'
import * as crypto from 'crypto'
import { SignedXml } from 'xml-crypto'
import { DOMParser } from '@xmldom/xmldom'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export type SsoProvider = 'saml' | 'oidc' | 'okta' | 'azure_ad' | 'google_workspace'

export interface SsoConfiguration {
  id: string
  workspaceId: string
  provider: SsoProvider
  enabled: boolean
  entityId?: string
  ssoUrl?: string
  sloUrl?: string
  certificate?: string
  clientId?: string
  clientSecretEncrypted?: string
  discoveryUrl?: string
  allowedDomains: string[]
  autoProvisionUsers: boolean
  defaultRole: string
  metadata?: Record<string, any>
}

export interface SamlResponse {
  nameId: string
  email: string
  firstName?: string
  lastName?: string
  groups?: string[]
  attributes: Record<string, string>
}

class SsoService {
  private _supabase: ReturnType<typeof createServiceClient> | null = null
  
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createServiceClient()
    }
    return this._supabase
  }

  /**
   * Get SSO configuration for a workspace
   */
  async getConfiguration(workspaceId: string): Promise<SsoConfiguration | null> {
    const { data, error } = await this.supabase
      .from('sso_configurations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      workspaceId: data.workspace_id,
      provider: data.provider,
      enabled: data.enabled,
      entityId: data.entity_id,
      ssoUrl: data.sso_url,
      sloUrl: data.slo_url,
      certificate: data.certificate,
      clientId: data.client_id,
      clientSecretEncrypted: data.client_secret_encrypted,
      discoveryUrl: data.discovery_url,
      allowedDomains: data.allowed_domains || [],
      autoProvisionUsers: data.auto_provision_users,
      defaultRole: data.default_role,
      metadata: data.metadata,
    }
  }

  /**
   * Check if email domain is allowed for SSO
   */
  async checkEmailDomain(workspaceId: string, email: string): Promise<boolean> {
    const config = await this.getConfiguration(workspaceId)
    if (!config || !config.enabled) return false

    if (config.allowedDomains.length === 0) return true // No restrictions

    const domain = email.split('@')[1]?.toLowerCase()
    return config.allowedDomains.some(
      (allowed) => allowed.toLowerCase() === domain
    )
  }

  /**
   * Configure SAML SSO
   */
  async configureSaml(
    workspaceId: string,
    config: {
      entityId: string
      ssoUrl: string
      sloUrl?: string
      certificate: string
      allowedDomains?: string[]
      autoProvisionUsers?: boolean
      defaultRole?: string
    }
  ): Promise<SsoConfiguration> {
    const { data, error } = await this.supabase
      .from('sso_configurations')
      .upsert({
        workspace_id: workspaceId,
        provider: 'saml',
        enabled: true,
        entity_id: config.entityId,
        sso_url: config.ssoUrl,
        slo_url: config.sloUrl,
        certificate: config.certificate,
        allowed_domains: config.allowedDomains || [],
        auto_provision_users: config.autoProvisionUsers ?? true,
        default_role: config.defaultRole || 'member',
      }, { onConflict: 'workspace_id' })
      .select()
      .single()

    if (error) throw error

    return this.getConfiguration(workspaceId) as Promise<SsoConfiguration>
  }

  /**
   * Configure OIDC SSO (Okta, Azure AD, etc.)
   */
  async configureOidc(
    workspaceId: string,
    config: {
      provider: 'oidc' | 'okta' | 'azure_ad' | 'google_workspace'
      clientId: string
      clientSecret: string
      discoveryUrl: string
      allowedDomains?: string[]
      autoProvisionUsers?: boolean
      defaultRole?: string
    }
  ): Promise<SsoConfiguration> {
    const { data, error } = await this.supabase
      .from('sso_configurations')
      .upsert({
        workspace_id: workspaceId,
        provider: config.provider,
        enabled: true,
        client_id: config.clientId,
        client_secret_encrypted: encrypt(config.clientSecret),
        discovery_url: config.discoveryUrl,
        allowed_domains: config.allowedDomains || [],
        auto_provision_users: config.autoProvisionUsers ?? true,
        default_role: config.defaultRole || 'member',
      }, { onConflict: 'workspace_id' })
      .select()
      .single()

    if (error) throw error

    return this.getConfiguration(workspaceId) as Promise<SsoConfiguration>
  }

  /**
   * Disable SSO for a workspace
   */
  async disable(workspaceId: string): Promise<void> {
    await this.supabase
      .from('sso_configurations')
      .update({ enabled: false })
      .eq('workspace_id', workspaceId)
  }

  /**
   * Delete SSO configuration
   */
  async deleteConfiguration(workspaceId: string): Promise<void> {
    await this.supabase
      .from('sso_configurations')
      .delete()
      .eq('workspace_id', workspaceId)
  }

  /**
   * Generate SAML request for IdP-initiated flow
   */
  generateSamlRequest(config: SsoConfiguration): {
    url: string
    samlRequest: string
    relayState: string
  } {
    const id = `_${crypto.randomBytes(16).toString('hex')}`
    const issueInstant = new Date().toISOString()
    const spEntityId = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/metadata`
    const acsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/callback`

    const samlRequest = `
      <samlp:AuthnRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${issueInstant}"
        AssertionConsumerServiceURL="${acsUrl}"
        Destination="${config.ssoUrl}"
        ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
        <saml:Issuer>${spEntityId}</saml:Issuer>
        <samlp:NameIDPolicy
          Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
          AllowCreate="true"/>
      </samlp:AuthnRequest>
    `.replace(/\s+/g, ' ').trim()

    const deflated = Buffer.from(samlRequest).toString('base64')
    const relayState = crypto.randomBytes(16).toString('hex')

    // Build redirect URL
    const url = new URL(config.ssoUrl!)
    url.searchParams.set('SAMLRequest', deflated)
    url.searchParams.set('RelayState', relayState)

    return {
      url: url.toString(),
      samlRequest: deflated,
      relayState,
    }
  }

  /**
   * Validate SAML response signature
   */
  private validateSamlSignature(xml: string, certificate: string): boolean {
    if (!certificate) {
      throw new Error('SAML certificate not configured - cannot validate signature')
    }

    try {
      // Clean certificate (ensure proper format)
      let cleanCert = certificate.trim()
      if (!cleanCert.includes('BEGIN CERTIFICATE')) {
        cleanCert = `-----BEGIN CERTIFICATE-----\n${cleanCert}\n-----END CERTIFICATE-----`
      }

      // Create temporary certificate file for xml-crypto
      const tempDir = os.tmpdir()
      const tempCertPath = path.join(tempDir, `saml-cert-${Date.now()}.pem`)
      
      try {
        fs.writeFileSync(tempCertPath, cleanCert, 'utf-8')

        // Parse XML document
        const doc = new DOMParser().parseFromString(xml)
        const signature = doc.getElementsByTagName('Signature')[0]
        
        if (!signature) {
          console.error('SAML response missing Signature element')
          return false
        }

        // Create verifier with custom keyInfoProvider
        const verifier = new SignedXml()
        // Use a custom keyInfoProvider that reads from the temp file
        // Type assertion needed because xml-crypto types are incomplete
        ;(verifier as any).keyInfoProvider = {
          getKeyInfo: () => {
            return `<X509Data><X509Certificate>${cleanCert.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s+/g, '')}</X509Certificate></X509Data>`
          },
          getKey: () => {
            return fs.readFileSync(tempCertPath)
          },
        }

        // Load the signature and verify
        verifier.loadSignature(signature as any)
        const isValid = verifier.checkSignature(xml)

        if (!isValid) {
          const errors = (verifier as any).validationErrors || []
          console.error('SAML signature validation failed:', errors)
          return false
        }

        return true
      } finally {
        // Clean up temporary file
        try {
          fs.unlinkSync(tempCertPath)
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.error('SAML signature validation error:', error)
      return false
    }
  }

  /**
   * Parse SAML response with signature validation
   */
  async parseSamlResponse(
    workspaceId: string,
    samlResponse: string
  ): Promise<SamlResponse> {
    const config = await this.getConfiguration(workspaceId)
    if (!config || !config.enabled) {
      throw new Error('SSO not configured')
    }

    // Decode and parse SAML response
    const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8')

    // Validate signature BEFORE extracting any user data (security critical)
    if (config.certificate) {
      const isValid = this.validateSamlSignature(decoded, config.certificate)
      if (!isValid) {
        throw new Error('SAML response signature validation failed - possible security breach')
      }
    } else {
      // Certificate is required for production
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SAML certificate required in production but not configured')
      }
      console.warn('SAML signature validation skipped - certificate not configured (development mode)')
    }

    // Extract NameID (email)
    const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/)
    if (!nameIdMatch) {
      throw new Error('Invalid SAML response: missing NameID')
    }

    const email = nameIdMatch[1]

    // Extract attributes
    const attributes: Record<string, string> = {}
    const attrRegex = /<saml:Attribute Name="([^"]+)"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/g
    let match
    while ((match = attrRegex.exec(decoded)) !== null) {
      attributes[match[1]] = match[2]
    }

    // Validate domain
    const isAllowed = await this.checkEmailDomain(workspaceId, email)
    if (!isAllowed) {
      throw new Error('Email domain not allowed for this organization')
    }

    return {
      nameId: email,
      email,
      firstName: attributes['firstName'] || attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'],
      lastName: attributes['lastName'] || attributes['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'],
      groups: attributes['groups']?.split(','),
      attributes,
    }
  }

  /**
   * Build OIDC authorization URL
   */
  async buildOidcAuthUrl(workspaceId: string, state: string): Promise<string> {
    const config = await this.getConfiguration(workspaceId)
    if (!config || !config.enabled || !config.discoveryUrl) {
      throw new Error('OIDC not configured')
    }

    // Fetch OIDC discovery document
    const discovery = await fetch(config.discoveryUrl).then((r) => r.json())
    const authorizationEndpoint = discovery.authorization_endpoint

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/callback`
    
    const params = new URLSearchParams({
      client_id: config.clientId!,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    })

    return `${authorizationEndpoint}?${params}`
  }

  /**
   * Exchange OIDC code for tokens and get user info
   */
  async handleOidcCallback(
    workspaceId: string,
    code: string
  ): Promise<{ email: string; name?: string; picture?: string }> {
    const config = await this.getConfiguration(workspaceId)
    if (!config || !config.enabled || !config.discoveryUrl) {
      throw new Error('OIDC not configured')
    }

    // Fetch OIDC discovery document
    const discovery = await fetch(config.discoveryUrl).then((r) => r.json())
    const tokenEndpoint = discovery.token_endpoint
    const userinfoEndpoint = discovery.userinfo_endpoint

    const clientSecret = decrypt(config.clientSecretEncrypted!)
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/sso/callback`

    // Exchange code for tokens
    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: config.clientId!,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange OIDC code')
    }

    const tokens = await tokenResponse.json()

    // Get user info
    const userinfoResponse = await fetch(userinfoEndpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userinfoResponse.ok) {
      throw new Error('Failed to get user info')
    }

    const userinfo = await userinfoResponse.json()

    // Validate domain
    const isAllowed = await this.checkEmailDomain(workspaceId, userinfo.email)
    if (!isAllowed) {
      throw new Error('Email domain not allowed for this organization')
    }

    return {
      email: userinfo.email,
      name: userinfo.name,
      picture: userinfo.picture,
    }
  }

  /**
   * Generate SP metadata for SAML
   */
  generateSpMetadata(): string {
    const spEntityId = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/metadata`
    const acsUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/saml/callback`

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${spEntityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false"
                      WantAssertionsSigned="true"
                      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                 Location="${acsUrl}"
                                 index="0"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`
  }
}

// Singleton
export const ssoService = new SsoService()
