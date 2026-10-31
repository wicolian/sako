/**
 * Provider Registry
 * 
 * Central registry for all deployment providers.
 * Handles provider discovery, initialization, and batch deployments.
 */

import type {
  DeploymentProvider,
  ProviderType,
  ProviderRegistryEntry,
  BatchDeployRequest,
  BatchDeployResult,
  FormField,
  FormMetadata,
  DeployResult,
} from './types'

// Marketing Automation Providers
import { HubSpotProvider } from './hubspot'
import { SalesforceProvider } from './salesforce'
import { MarketoProvider } from './marketo'
import { ActiveCampaignProvider } from './activecampaign'
import { MailchimpProvider } from './mailchimp'
import { KlaviyoProvider } from './klaviyo'

// Website/CMS Providers
import { WebflowProvider } from './webflow'
import { FigmaProvider } from './figma'
import { FramerProvider } from './framer'
import { WordPressProvider } from './wordpress'
import { ShopifyProvider } from './shopify'

// Advertising Providers
import { GoogleAdsProvider } from './google-ads'
import { MetaAdsProvider } from './meta-ads'
import { LinkedInAdsProvider } from './linkedin-ads'
import { TwitterProvider } from './twitter'

// Analytics Providers
import { GA4Provider, AmplitudeProvider, MixpanelProvider, SegmentProvider } from './analytics'

// Notification Providers
import { SlackProvider } from './slack'
import { NotionProvider } from './notion'

// Provider instances (lazy initialized)
let providerInstances: Map<ProviderType, DeploymentProvider> | null = null

/**
 * Get the provider registry
 */
function getRegistry(): Map<ProviderType, DeploymentProvider> {
  if (!providerInstances) {
    providerInstances = new Map()
    
    // Marketing Automation
    providerInstances.set('hubspot', new HubSpotProvider())
    providerInstances.set('salesforce', new SalesforceProvider())
    providerInstances.set('marketo', new MarketoProvider())
    providerInstances.set('activecampaign', new ActiveCampaignProvider())
    providerInstances.set('mailchimp', new MailchimpProvider())
    providerInstances.set('klaviyo', new KlaviyoProvider())
    
    // Website/CMS
    providerInstances.set('webflow', new WebflowProvider())
    providerInstances.set('figma', new FigmaProvider())
    providerInstances.set('framer', new FramerProvider())
    providerInstances.set('wordpress', new WordPressProvider())
    providerInstances.set('shopify', new ShopifyProvider())
    
    // Advertising
    providerInstances.set('google-ads', new GoogleAdsProvider())
    providerInstances.set('meta-ads', new MetaAdsProvider())
    providerInstances.set('linkedin-ads', new LinkedInAdsProvider())
    providerInstances.set('twitter', new TwitterProvider())
    
    // Analytics
    providerInstances.set('ga4', new GA4Provider())
    providerInstances.set('amplitude', new AmplitudeProvider())
    providerInstances.set('mixpanel', new MixpanelProvider())
    providerInstances.set('segment', new SegmentProvider())
    
    // Notifications
    providerInstances.set('slack', new SlackProvider())
    providerInstances.set('notion', new NotionProvider())
  }
  return providerInstances
}

/**
 * Get a specific provider by type
 */
export function getProvider(type: ProviderType): DeploymentProvider {
  const registry = getRegistry()
  const provider = registry.get(type)
  
  if (!provider) {
    throw new Error(`Unknown provider type: ${type}`)
  }
  
  return provider
}

export type ProviderCapabilityTier = 'direct_deploy' | 'export_only'

/**
 * Truthful provider capability label for UI and API messaging.
 * "direct_deploy" means provider can receive deployPage calls.
 * "export_only" means users must export/hand off manually.
 */
export function getProviderCapabilityTier(type: ProviderType): ProviderCapabilityTier {
  const provider = getProvider(type)
  return provider.capabilities.deployPage ? 'direct_deploy' : 'export_only'
}

/**
 * Get all available providers
 */
export function getAllProviders(): ProviderRegistryEntry[] {
  const registry = getRegistry()
  const entries: ProviderRegistryEntry[] = []
  
  for (const [type, provider] of registry) {
    entries.push({
      type,
      provider,
      enabled: true, // TODO: Check workspace settings for enabled providers
    })
  }
  
  return entries
}

/**
 * Get providers by capability
 */
export function getProvidersByCapability(
  capability: 'deployPage' | 'deployForm' | 'deployEmail' | 'deploySequence' | 'getPerformance' | 'biDirectionalSync'
): DeploymentProvider[] {
  const registry = getRegistry()
  const providers: DeploymentProvider[] = []
  
  for (const provider of registry.values()) {
    if (provider.capabilities[capability]) {
      providers.push(provider)
    }
  }
  
  return providers
}

/**
 * Check which providers are connected for a workspace
 */
export async function getConnectedProviders(workspaceId: string): Promise<ProviderType[]> {
  const registry = getRegistry()
  const connected: ProviderType[] = []
  
  await Promise.all(
    Array.from(registry.entries()).map(async ([type, provider]) => {
      const isConnected = await provider.isConnected(workspaceId)
      if (isConnected) {
        connected.push(type)
      }
    })
  )
  
  return connected
}

/**
 * Deploy to multiple destinations at once
 */
export async function batchDeploy(request: BatchDeployRequest): Promise<BatchDeployResult> {
  const results: Record<ProviderType, DeployResult> = {} as Record<ProviderType, DeployResult>
  const errors: string[] = []
  
  // Deploy to each destination in parallel
  await Promise.all(
    request.destinations.map(async (destination) => {
      try {
        const provider = getProvider(destination)
        
        // Check if connected
        const isConnected = await provider.isConnected(request.workspaceId)
        if (!isConnected) {
          results[destination] = {
            success: false,
            externalId: '',
            error: `${provider.name} is not connected`,
          }
          errors.push(`${provider.name}: Not connected`)
          return
        }
        
        // Deploy page if supported
        if (provider.capabilities.deployPage && provider.deployPage) {
          results[destination] = await provider.deployPage(request.html, request.metadata)
        }
        
        // Deploy form if supported and fields provided
        if (provider.capabilities.deployForm && provider.deployForm && request.formFields) {
          const formMetadata: FormMetadata = {
            name: `${request.metadata.name} - Lead Capture`,
            campaignId: request.campaignId,
            workspaceId: request.workspaceId,
          }
          const formResult = await provider.deployForm(request.formFields, formMetadata)
          
          // Merge form result into existing result
          if (results[destination]) {
            results[destination] = {
              ...results[destination],
              metadata: {
                ...results[destination].metadata,
                formId: formResult.externalId,
                formUrl: formResult.url,
              },
            }
          } else {
            results[destination] = formResult
          }
        }
        
        if (!results[destination]) {
          results[destination] = {
            success: false,
            externalId: '',
            error: `No supported deployment action for ${provider.name}`,
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results[destination] = {
          success: false,
          externalId: '',
          error: errorMessage,
        }
        errors.push(`${destination}: ${errorMessage}`)
      }
    })
  )
  
  // Determine overall success with proper tri-state semantics:
  // allSuccess = every requested destination succeeded
  // anySuccess = at least one succeeded (partial)
  // neither = total failure
  const resultValues = Object.values(results)
  const allSuccess = resultValues.length > 0 && resultValues.every(r => r.success)
  const anySuccess = resultValues.some(r => r.success)

  return {
    success: allSuccess,
    partial: anySuccess && !allSuccess,
    results,
    errors,
  }
}

/**
 * Get default form fields for lead capture
 */
export function getDefaultFormFields(campaignId: string): FormField[] {
  return [
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'firstname', label: 'First Name', type: 'text', required: true },
    { name: 'lastname', label: 'Last Name', type: 'text', required: false },
    { name: 'company', label: 'Company', type: 'text', required: false },
    { 
      name: 'sako_campaign_id', 
      label: 'Campaign ID', 
      type: 'hidden', 
      required: false, 
      defaultValue: campaignId 
    },
  ]
}
