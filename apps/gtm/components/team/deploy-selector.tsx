'use client';

/**
 * Deploy Selector Component (Jan 2026)
 * 
 * Grid of deployment options for the completed campaign.
 * 
 * @see PRD Part 5.2: Deploy Selector Component
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Download,
    Copy,
    ExternalLink,
    CheckCircle,
    Loader2,
    Link2,
    AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface Provider {
    id: string;
    name: string;
    type: 'crm' | 'cms' | 'email' | 'social';
    logo?: string;
    connected: boolean;
    capabilities: string[];
}

export interface DeployResult {
    success: boolean;
    provider: string;
    url?: string;
    error?: string;
}

export interface DeploySelectorProps {
    sessionId: string;
    providers: Provider[];
    campaignHtml: string;
    onDeploy: (providerId: string) => Promise<DeployResult>;
    onDownload: () => Promise<void>;
    className?: string;
}

// ============================================================================
// Provider Card
// ============================================================================

interface ProviderCardProps {
    provider: Provider;
    isDeploying: boolean;
    deployResult?: DeployResult;
    onDeploy: () => void;
}

function ProviderCard({
    provider,
    isDeploying,
    deployResult,
    onDeploy,
}: ProviderCardProps) {
    const isSuccess = deployResult?.success;
    const isError = deployResult && !deployResult.success;

    const getProviderEmoji = (type: string) => {
        switch (type) {
            case 'crm':
                return '📊';
            case 'cms':
                return '🌐';
            case 'email':
                return '📧';
            case 'social':
                return '📱';
            default:
                return '🔗';
        }
    };

    return (
        <Card className={cn(
            'transition-all',
            !provider.connected && 'opacity-60',
            isSuccess && 'border-green-500',
            isError && 'border-red-500'
        )}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{getProviderEmoji(provider.type)}</span>
                        <CardTitle className="text-base">{provider.name}</CardTitle>
                    </div>
                    {isSuccess && <CheckCircle className="h-5 w-5 text-green-500" />}
                    {isError && <AlertCircle className="h-5 w-5 text-red-500" />}
                </div>
                <CardDescription className="text-xs">
                    {provider.capabilities.join(', ')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isSuccess && deployResult.url ? (
                    <a
                        href={deployResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                        View deployed content
                        <ExternalLink className="h-3 w-3" />
                    </a>
                ) : isError ? (
                    <p className="text-sm text-red-500">{deployResult.error}</p>
                ) : provider.connected ? (
                    <Button
                        size="sm"
                        onClick={onDeploy}
                        disabled={isDeploying}
                        className="w-full gap-2"
                    >
                        {isDeploying ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Deploying...
                            </>
                        ) : (
                            <>
                                Deploy
                                <ExternalLink className="h-3 w-3" />
                            </>
                        )}
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2"
                        asChild
                    >
                        <a href="/settings/integrations">
                            <Link2 className="h-4 w-4" />
                            Connect
                        </a>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function DeploySelector({
    sessionId,
    providers,
    campaignHtml,
    onDeploy,
    onDownload,
    className,
}: DeploySelectorProps) {
    const [deployingProvider, setDeployingProvider] = useState<string | null>(null);
    const [deployResults, setDeployResults] = useState<Map<string, DeployResult>>(new Map());
    const [isDownloading, setIsDownloading] = useState(false);
    const [isCopying, setIsCopying] = useState(false);

    const handleDeploy = async (providerId: string) => {
        setDeployingProvider(providerId);
        try {
            const result = await onDeploy(providerId);
            setDeployResults(prev => {
                const next = new Map(prev);
                next.set(providerId, result);
                return next;
            });

            if (result.success) {
                toast.success(`Deployed to ${providers.find(p => p.id === providerId)?.name}!`);
            } else {
                toast.error(`Deployment failed: ${result.error}`);
            }
        } catch (error) {
            toast.error('Deployment failed');
        } finally {
            setDeployingProvider(null);
        }
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            await onDownload();
            toast.success('Campaign downloaded!');
        } catch (error) {
            toast.error('Download failed');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleCopyHtml = async () => {
        setIsCopying(true);
        try {
            await navigator.clipboard.writeText(campaignHtml);
            toast.success('HTML copied to clipboard!');
        } catch (error) {
            toast.error('Failed to copy');
        } finally {
            setIsCopying(false);
        }
    };

    // Group providers by type
    const connectedProviders = providers.filter(p => p.connected);
    const disconnectedProviders = providers.filter(p => !p.connected);

    return (
        <div className={cn('space-y-6', className)}>
            {/* Always Available Options */}
            <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Quick Export
                </h3>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="gap-2"
                    >
                        {isDownloading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        Download ZIP
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleCopyHtml}
                        disabled={isCopying}
                        className="gap-2"
                    >
                        {isCopying ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Copy className="h-4 w-4" />
                        )}
                        Copy HTML
                    </Button>
                </div>
            </div>

            {/* Connected Providers */}
            {connectedProviders.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Connected Providers
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {connectedProviders.map(provider => (
                            <motion.div
                                key={provider.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <ProviderCard
                                    provider={provider}
                                    isDeploying={deployingProvider === provider.id}
                                    deployResult={deployResults.get(provider.id)}
                                    onDeploy={() => handleDeploy(provider.id)}
                                />
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Disconnected Providers */}
            {disconnectedProviders.length > 0 && (
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Available Integrations
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {disconnectedProviders.slice(0, 4).map(provider => (
                            <motion.div
                                key={provider.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <ProviderCard
                                    provider={provider}
                                    isDeploying={false}
                                    onDeploy={() => { }}
                                />
                            </motion.div>
                        ))}
                    </div>
                    {disconnectedProviders.length > 4 && (
                        <Button variant="link" asChild className="mt-2">
                            <a href="/settings/integrations">
                                View all {disconnectedProviders.length} integrations →
                            </a>
                        </Button>
                    )}
                </div>
            )}

            {/* No Providers Message */}
            {providers.length === 0 && (
                <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                        No providers configured. You can still download your campaign.
                    </p>
                    <Button variant="outline" asChild>
                        <a href="/settings/integrations">
                            Set up integrations
                        </a>
                    </Button>
                </div>
            )}
        </div>
    );
}
