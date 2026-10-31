/**
 * Deploy Tool for Ops Agent (Jan 2026)
 * 
 * Enables the Ops agent to deploy campaigns to connected providers.
 * Supports dry-run mode for validation without actual deployment.
 * 
 * @see PRD Part 2.5: Deploy Tool Addition
 */

import {
    getProvider,
    getConnectedProviders,
    batchDeploy,
} from '@/lib/providers/registry';
import type { DeployResult, FormField, ProviderType, EmailContent } from '@/lib/providers/types';

// ============================================================================
// Types
// ============================================================================

export interface DeployToolInput {
    workspaceId: string;
    providerName: ProviderType;
    campaignContent: CampaignContent;
    assetTypes: AssetType[];
    dryRun?: boolean;
}

export interface CampaignContent {
    html?: string;
    metadata: {
        name: string;
        slug?: string;
        description?: string;
        campaignId?: string;
        workspaceId: string;
    };
    emails?: Array<{
        subject: string;
        body: string;
        timing?: string;
    }>;
    socialPosts?: Array<{
        platform: string;
        text: string;
        media?: string;
    }>;
    formFields?: FormField[];
}

export type AssetType = 'landing_page' | 'emails' | 'social_posts' | 'form';

export interface DeployToolResult {
    success: boolean;
    providerName: ProviderType;
    deployedAssets: DeployedAsset[];
    errors: string[];
    warnings: string[];
    dryRun: boolean;
}

export interface DeployedAsset {
    assetType: AssetType;
    externalId: string;
    externalUrl?: string;
    status: 'deployed' | 'pending' | 'failed';
    error?: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a provider is connected for a workspace
 */
export async function checkProviderConnection(
    workspaceId: string,
    providerName: ProviderType
): Promise<{ connected: boolean; error?: string }> {
    try {
        const connectedProviders = await getConnectedProviders(workspaceId);
        const isConnected = connectedProviders.includes(providerName);

        if (!isConnected) {
            return {
                connected: false,
                error: `${providerName} is not connected. Please connect it in Settings > Integrations.`,
            };
        }

        return { connected: true };
    } catch (error) {
        return {
            connected: false,
            error: `Failed to check provider connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

/**
 * Validate campaign content before deployment
 */
export function validateCampaignContent(
    content: CampaignContent,
    assetTypes: AssetType[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (assetTypes.includes('landing_page')) {
        if (!content.html || content.html.trim().length === 0) {
            errors.push('Landing page HTML is required but missing.');
        }
        if (!content.metadata?.name) {
            errors.push('Campaign name is required for landing page deployment.');
        }
    }

    if (assetTypes.includes('emails')) {
        if (!content.emails || content.emails.length === 0) {
            errors.push('Email content is required but missing.');
        } else {
            content.emails.forEach((email, index) => {
                if (!email.subject) errors.push(`Email ${index + 1} is missing a subject line.`);
                if (!email.body) errors.push(`Email ${index + 1} is missing body content.`);
            });
        }
    }

    if (assetTypes.includes('form')) {
        if (!content.formFields || content.formFields.length === 0) {
            errors.push('Form fields are required but missing.');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// ============================================================================
// Main Deploy Function
// ============================================================================

/**
 * Deploy campaign to a provider
 * 
 * @param input - Deployment configuration
 * @returns Deployment result with success/failure status per asset
 */
export async function deployToProvider(input: DeployToolInput): Promise<DeployToolResult> {
    const { workspaceId, providerName, campaignContent, assetTypes, dryRun = false } = input;

    const result: DeployToolResult = {
        success: false,
        providerName,
        deployedAssets: [],
        errors: [],
        warnings: [],
        dryRun,
    };

    // Step 1: Check provider connection
    const connectionCheck = await checkProviderConnection(workspaceId, providerName);
    if (!connectionCheck.connected) {
        result.errors.push(connectionCheck.error || 'Provider not connected');
        return result;
    }

    // Step 2: Validate content
    const validation = validateCampaignContent(campaignContent, assetTypes);
    if (!validation.valid) {
        result.errors.push(...validation.errors);
        return result;
    }

    // Step 3: If dry run, return validation success
    if (dryRun) {
        result.success = true;
        result.warnings.push('Dry run completed. No actual deployment performed.');

        // Return placeholder results for what would be deployed
        for (const assetType of assetTypes) {
            result.deployedAssets.push({
                assetType,
                externalId: `dry-run-${assetType}`,
                status: 'pending',
            });
        }

        return result;
    }

    // Step 4: Get provider and deploy
    try {
        const provider = getProvider(providerName);

        // Deploy landing page
        if (assetTypes.includes('landing_page') && campaignContent.html) {
            if (provider.capabilities.deployPage && provider.deployPage) {
                try {
                    const pageMetadata = {
                        name: campaignContent.metadata.name,
                        slug: campaignContent.metadata.slug || campaignContent.metadata.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                        workspaceId: campaignContent.metadata.workspaceId,
                        campaignId: campaignContent.metadata.campaignId || '',
                        seoDescription: campaignContent.metadata.description,
                    };
                    const deployResult = await provider.deployPage(campaignContent.html, pageMetadata);
                    result.deployedAssets.push({
                        assetType: 'landing_page',
                        externalId: deployResult.externalId,
                        externalUrl: deployResult.url,
                        status: deployResult.success ? 'deployed' : 'failed',
                        error: deployResult.error,
                    });
                } catch (error) {
                    result.deployedAssets.push({
                        assetType: 'landing_page',
                        externalId: '',
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            } else {
                result.warnings.push(`${providerName} does not support landing page deployment.`);
            }
        }

        // Deploy emails
        if (assetTypes.includes('emails') && campaignContent.emails) {
            if (provider.capabilities.deployEmail && provider.deployEmail) {
                for (const email of campaignContent.emails) {
                    try {
                        const emailContent: EmailContent = {
                            subject: email.subject,
                            bodyHtml: email.body,
                            metadata: {
                                timing: email.timing,
                                campaignId: campaignContent.metadata.campaignId,
                            },
                        };
                        const deployResult = await provider.deployEmail(emailContent);
                        result.deployedAssets.push({
                            assetType: 'emails',
                            externalId: deployResult.externalId,
                            externalUrl: deployResult.url,
                            status: deployResult.success ? 'deployed' : 'failed',
                            error: deployResult.error,
                        });
                    } catch (error) {
                        result.deployedAssets.push({
                            assetType: 'emails',
                            externalId: '',
                            status: 'failed',
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }
            } else {
                result.warnings.push(`${providerName} does not support email deployment.`);
            }
        }

        // Deploy form
        if (assetTypes.includes('form') && campaignContent.formFields) {
            if (provider.capabilities.deployForm && provider.deployForm) {
                try {
                    const deployResult = await provider.deployForm(campaignContent.formFields, {
                        name: `${campaignContent.metadata.name} - Lead Capture`,
                        campaignId: campaignContent.metadata.campaignId || '',
                        workspaceId,
                    });
                    result.deployedAssets.push({
                        assetType: 'form',
                        externalId: deployResult.externalId,
                        externalUrl: deployResult.url,
                        status: deployResult.success ? 'deployed' : 'failed',
                        error: deployResult.error,
                    });
                } catch (error) {
                    result.deployedAssets.push({
                        assetType: 'form',
                        externalId: '',
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            } else {
                result.warnings.push(`${providerName} does not support form deployment.`);
            }
        }

        // Calculate overall success
        const failedAssets = result.deployedAssets.filter(a => a.status === 'failed');
        result.success = failedAssets.length === 0 && result.deployedAssets.length > 0;

        if (failedAssets.length > 0) {
            result.errors.push(`${failedAssets.length} asset(s) failed to deploy.`);
        }

    } catch (error) {
        result.errors.push(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
}

// ============================================================================
// Batch Deployment
// ============================================================================

/**
 * Deploy to multiple providers at once
 */
export async function deployToMultipleProviders(
    workspaceId: string,
    providers: ProviderType[],
    campaignContent: CampaignContent,
    assetTypes: AssetType[]
): Promise<Record<ProviderType, DeployToolResult>> {
    const results: Record<ProviderType, DeployToolResult> = {} as Record<ProviderType, DeployToolResult>;

    // Deploy to each provider in parallel
    const deployPromises = providers.map(async (providerName) => {
        const result = await deployToProvider({
            workspaceId,
            providerName,
            campaignContent,
            assetTypes,
        });
        results[providerName] = result;
    });

    await Promise.all(deployPromises);

    return results;
}

// ============================================================================
// Download/Export Functions
// ============================================================================

export interface ExportResult {
    zipBuffer?: Buffer;
    files: Array<{
        name: string;
        content: string;
        type: 'html' | 'txt' | 'json';
    }>;
}

/**
 * Export campaign as downloadable files
 * This always works regardless of provider connections
 */
export function exportCampaign(campaignContent: CampaignContent): ExportResult {
    const files: ExportResult['files'] = [];

    // Export landing page
    if (campaignContent.html) {
        files.push({
            name: 'landing-page.html',
            content: campaignContent.html,
            type: 'html',
        });
    }

    // Export emails
    if (campaignContent.emails) {
        campaignContent.emails.forEach((email, index) => {
            files.push({
                name: `email-${index + 1}.html`,
                content: `<html><head><title>${email.subject}</title></head><body>${email.body}</body></html>`,
                type: 'html',
            });
            files.push({
                name: `email-${index + 1}-subject.txt`,
                content: email.subject,
                type: 'txt',
            });
        });
    }

    // Export social posts
    if (campaignContent.socialPosts) {
        const socialContent = campaignContent.socialPosts.map((post, index) => ({
            platform: post.platform,
            text: post.text,
            media: post.media,
        }));
        files.push({
            name: 'social-posts.json',
            content: JSON.stringify(socialContent, null, 2),
            type: 'json',
        });

        // Also as plain text for easy copying
        const socialText = campaignContent.socialPosts
            .map((post, index) => `--- ${post.platform.toUpperCase()} ---\n${post.text}`)
            .join('\n\n');
        files.push({
            name: 'social-posts.txt',
            content: socialText,
            type: 'txt',
        });
    }

    // Export campaign metadata
    files.push({
        name: 'campaign-metadata.json',
        content: JSON.stringify(campaignContent.metadata, null, 2),
        type: 'json',
    });

    return { files };
}

