'use client';

/**
 * Campaign Preview Component (Jan 2026)
 * 
 * Preview the generated campaign with tabs for different asset types.
 * 
 * @see PRD Part 5.1: Campaign Preview Component
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Monitor,
    Smartphone,
    Tablet,
    Mail,
    Share2,
    CheckCircle,
    Shield,
    FileText,
    Edit3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================================================
// Types
// ============================================================================

export interface CampaignOutput {
    landingPage: {
        html: string;
        sections: Array<{ type: string; content: string }>;
    };
    emails: Array<{
        subject: string;
        body: string;
        timing?: string;
    }>;
    socialPosts: Array<{
        platform: string;
        text: string;
        media?: string;
    }>;
    quality: {
        complianceScore: number;
        evidenceCount: number;
        templateMatch: string;
    };
    deploymentReady: boolean;
}

export interface CampaignPreviewProps {
    campaign: CampaignOutput;
    sessionId: string;
    onEdit?: () => void;
    className?: string;
}

// ============================================================================
// Device Preview Sizes
// ============================================================================

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const DEVICE_SIZES: Record<DeviceType, { width: string; icon: typeof Monitor }> = {
    desktop: { width: '100%', icon: Monitor },
    tablet: { width: '768px', icon: Tablet },
    mobile: { width: '375px', icon: Smartphone },
};

// ============================================================================
// Quality Signals
// ============================================================================

function QualitySignals({ quality }: { quality: CampaignOutput['quality'] }) {
    return (
        <div className="flex flex-wrap gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
                <Shield className={cn(
                    'h-4 w-4',
                    quality.complianceScore >= 90 ? 'text-green-500' :
                        quality.complianceScore >= 70 ? 'text-yellow-500' : 'text-red-500'
                )} />
                <span className="text-sm">
                    {quality.complianceScore}% Compliance
                </span>
            </div>
            <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm">
                    {quality.evidenceCount} Evidence Items
                </span>
            </div>
            <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-purple-500" />
                <span className="text-sm">
                    {quality.templateMatch}
                </span>
            </div>
        </div>
    );
}

// ============================================================================
// Landing Page Preview
// ============================================================================

function LandingPagePreview({
    html,
    onEdit,
}: {
    html: string;
    onEdit?: () => void;
}) {
    const [device, setDevice] = useState<DeviceType>('desktop');

    return (
        <div className="space-y-4">
            {/* Device Toggles */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 bg-muted p-1 rounded-lg">
                    {(Object.entries(DEVICE_SIZES) as [DeviceType, typeof DEVICE_SIZES[DeviceType]][]).map(
                        ([key, { icon: Icon }]) => (
                            <Button
                                key={key}
                                variant={device === key ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setDevice(key)}
                                className="h-8 w-8 p-0"
                            >
                                <Icon className="h-4 w-4" />
                            </Button>
                        )
                    )}
                </div>

                {onEdit && (
                    <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
                        <Edit3 className="h-4 w-4" />
                        Edit in editor
                    </Button>
                )}
            </div>

            {/* Preview Frame */}
            <motion.div
                layout
                className="mx-auto border rounded-lg overflow-hidden bg-card shadow-sm"
                style={{
                    width: DEVICE_SIZES[device].width,
                    maxWidth: '100%',
                }}
            >
                <iframe
                    srcDoc={html}
                    className="w-full h-[500px] border-0"
                    title="Landing page preview"
                    sandbox="allow-same-origin"
                />
            </motion.div>
        </div>
    );
}

// ============================================================================
// Email Preview
// ============================================================================

function EmailPreview({ emails }: { emails: CampaignOutput['emails'] }) {
    const [selectedEmail, setSelectedEmail] = useState(0);

    if (emails.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No emails generated
            </div>
        );
    }

    const email = emails[selectedEmail];

    return (
        <div className="grid md:grid-cols-3 gap-4">
            {/* Email List */}
            <div className="space-y-2">
                {emails.map((e, index) => (
                    <button
                        key={index}
                        onClick={() => setSelectedEmail(index)}
                        className={cn(
                            'w-full text-left p-3 rounded-lg border transition-colors',
                            selectedEmail === index
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:bg-muted/50'
                        )}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-muted-foreground">
                                Email {index + 1}
                            </span>
                            {e.timing && (
                                <span className="text-xs text-muted-foreground">
                                    {e.timing}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-medium truncate">{e.subject}</p>
                    </button>
                ))}
            </div>

            {/* Email Preview */}
            <div className="md:col-span-2">
                <Card>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-base">{email.subject}</CardTitle>
                        </div>
                        {email.timing && (
                            <p className="text-xs text-muted-foreground">
                                Scheduled: {email.timing}
                            </p>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div
                            className="prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: email.body }}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ============================================================================
// Social Posts Preview
// ============================================================================

function SocialPostsPreview({ posts }: { posts: CampaignOutput['socialPosts'] }) {
    if (posts.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                No social posts generated
            </div>
        );
    }

    const getPlatformIcon = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'linkedin':
                return '💼';
            case 'twitter':
            case 'x':
                return '🐦';
            case 'facebook':
                return '📘';
            case 'instagram':
                return '📸';
            default:
                return '📱';
        }
    };

    return (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post, index) => (
                <Card key={index}>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">{getPlatformIcon(post.platform)}</span>
                            <CardTitle className="text-sm capitalize">{post.platform}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{post.text}</p>
                        {post.media && (
                            <div className="mt-3 p-2 bg-muted rounded text-xs text-muted-foreground">
                                📎 Media attached
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export function CampaignPreview({
    campaign,
    sessionId,
    onEdit,
    className,
}: CampaignPreviewProps) {
    return (
        <div className={cn('space-y-6', className)}>
            {/* Quality Signals */}
            <QualitySignals quality={campaign.quality} />

            {/* Asset Tabs */}
            <Tabs defaultValue="landing-page" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="landing-page" className="gap-2">
                        <Monitor className="h-4 w-4" />
                        Landing Page
                    </TabsTrigger>
                    <TabsTrigger value="emails" className="gap-2">
                        <Mail className="h-4 w-4" />
                        Emails ({campaign.emails.length})
                    </TabsTrigger>
                    <TabsTrigger value="social" className="gap-2">
                        <Share2 className="h-4 w-4" />
                        Social ({campaign.socialPosts.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="landing-page" className="mt-4">
                    <LandingPagePreview
                        html={campaign.landingPage.html}
                        onEdit={onEdit}
                    />
                </TabsContent>

                <TabsContent value="emails" className="mt-4">
                    <EmailPreview emails={campaign.emails} />
                </TabsContent>

                <TabsContent value="social" className="mt-4">
                    <SocialPostsPreview posts={campaign.socialPosts} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
