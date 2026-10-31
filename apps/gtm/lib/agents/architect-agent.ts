/**
 * Architect Agent (Jan 2026)
 * 
 * Selects and configures templates based on creative output and brand context.
 * Does NOT generate HTML - only selects design patterns from the template library.
 * 
 * @see PRD Part 2.4: Architect Agent
 */

import { searchTemplates, getTemplatesForIndustry, type TemplateSearchResult } from '@/lib/templates/retriever';

// ============================================================================
// Types
// ============================================================================

export interface ArchitectInput {
    brandContext: {
        name: string;
        industry?: string;
        colors?: { primary: string; secondary?: string; accent?: string };
        voice?: string;
    };
    creativeContent: {
        summary?: string;
        headlines?: string[];
        sections?: Array<{ type: string; content: string }>;
    } | undefined;
    sectionTypes: SectionType[];
}

export type SectionType =
    | 'hero'
    | 'features'
    | 'testimonials'
    | 'pricing'
    | 'cta'
    | 'faq'
    | 'team'
    | 'contact'
    | 'header'
    | 'footer';

export interface TemplateSelection {
    sectionType: SectionType;
    templateId: string;
    templateName: string;
    confidence: number;
    configuration: TemplateConfiguration;
    alternatives: Array<{ templateId: string; templateName: string; score: number }>;
}

export interface TemplateConfiguration {
    layout?: 'single-column' | 'two-column' | 'three-column' | 'grid';
    theme?: 'light' | 'dark' | 'gradient';
    density?: 'compact' | 'normal' | 'spacious';
    emphasis?: 'headline' | 'visual' | 'cta' | 'balanced';
    notes?: string;
}

export interface ArchitectOutput {
    templateMapping: Record<SectionType, TemplateSelection>;
    overallStyle: {
        theme: string;
        layout: string;
        consistency: number;
    };
    recommendations: string[];
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Score a template for content fit
 * How well does the template structure match the content we have?
 */
function scoreContentFit(
    template: TemplateSearchResult,
    sectionType: SectionType,
    creativeContent: ArchitectInput['creativeContent']
): number {
    let score = 0.5; // Base score

    // Check if template category matches section type
    const categoryMatch = template.category.toLowerCase().includes(sectionType.toLowerCase());
    if (categoryMatch) score += 0.3;

    // Check components for content fit
    const components = template.components || [];

    if (sectionType === 'hero') {
        if (components.includes('headline')) score += 0.1;
        if (components.includes('cta-button')) score += 0.1;
        if (components.includes('hero-image') || components.includes('background-image')) score += 0.1;
    }

    if (sectionType === 'features') {
        if (components.includes('feature-grid') || components.includes('icon-box')) score += 0.2;
        if (components.includes('feature-card')) score += 0.1;
    }

    if (sectionType === 'testimonials') {
        if (components.includes('quote') || components.includes('testimonial-card')) score += 0.2;
        if (components.includes('avatar') || components.includes('profile')) score += 0.1;
    }

    if (sectionType === 'pricing') {
        if (components.includes('pricing-table') || components.includes('pricing-card')) score += 0.3;
    }

    if (sectionType === 'cta') {
        if (components.includes('cta-button') || components.includes('form')) score += 0.2;
        if (components.includes('headline')) score += 0.1;
    }

    return Math.min(score, 1.0);
}

/**
 * Score a template for brand fit
 * How well does the template style match the brand?
 */
function scoreBrandFit(
    template: TemplateSearchResult,
    brandContext: ArchitectInput['brandContext']
): number {
    let score = 0.5; // Base score

    // Theme preference based on brand voice
    const voice = brandContext.voice?.toLowerCase() || '';
    const templateTheme = template.visualStyle?.theme?.toLowerCase() || '';

    if (voice.includes('professional') || voice.includes('corporate')) {
        if (templateTheme === 'light' || templateTheme === 'minimal') score += 0.2;
    }

    if (voice.includes('bold') || voice.includes('innovative')) {
        if (templateTheme === 'dark' || templateTheme === 'gradient') score += 0.2;
    }

    if (voice.includes('friendly') || voice.includes('approachable')) {
        if (templateTheme === 'light' || templateTheme === 'glass') score += 0.2;
    }

    // Check aesthetic tags for brand alignment
    const aestheticTags = template.aestheticTags || [];
    if (voice.includes('modern') && aestheticTags.includes('modern')) score += 0.1;
    if (voice.includes('minimal') && aestheticTags.includes('minimal')) score += 0.1;
    if (voice.includes('bold') && aestheticTags.includes('bold')) score += 0.1;

    return Math.min(score, 1.0);
}

/**
 * Score a template for industry fit
 */
function scoreIndustryFit(
    template: TemplateSearchResult,
    industry: string | undefined
): number {
    if (!industry) return 0.5; // Neutral if no industry specified

    const templateIndustries = template.industry || [];
    const industryLower = industry.toLowerCase();

    // Direct match
    if (templateIndustries.some(i => i.toLowerCase() === industryLower)) {
        return 1.0;
    }

    // Partial match
    if (templateIndustries.some(i => i.toLowerCase().includes(industryLower) || industryLower.includes(i.toLowerCase()))) {
        return 0.8;
    }

    // Check for related industries
    const industryGroups: Record<string, string[]> = {
        'tech': ['saas', 'software', 'technology', 'startup', 'ai', 'fintech'],
        'finance': ['fintech', 'banking', 'insurance', 'investment'],
        'health': ['healthcare', 'medical', 'wellness', 'fitness'],
        'ecommerce': ['retail', 'shopping', 'marketplace', 'consumer'],
    };

    for (const [group, related] of Object.entries(industryGroups)) {
        if (related.includes(industryLower)) {
            if (templateIndustries.some(i => related.includes(i.toLowerCase()))) {
                return 0.7;
            }
        }
    }

    return 0.5; // Neutral score for no match
}

/**
 * Calculate overall score for a template
 */
function calculateTemplateScore(
    template: TemplateSearchResult,
    sectionType: SectionType,
    input: ArchitectInput
): number {
    const contentScore = scoreContentFit(template, sectionType, input.creativeContent);
    const brandScore = scoreBrandFit(template, input.brandContext);
    const industryScore = scoreIndustryFit(template, input.brandContext.industry);

    // Use similarity score from search as quality indicator
    const qualityScore = template.similarity || 0.5;

    // Weighted average
    return (
        contentScore * 0.35 +
        brandScore * 0.25 +
        industryScore * 0.20 +
        qualityScore * 0.20
    );
}

// ============================================================================
// Main Architect Function
// ============================================================================

/**
 * Run the Architect Agent to select templates for each section
 */
export async function runArchitectAgent(input: ArchitectInput): Promise<ArchitectOutput> {
    const { brandContext, creativeContent, sectionTypes } = input;

    const templateMapping: Record<SectionType, TemplateSelection> = {} as Record<SectionType, TemplateSelection>;
    const recommendations: string[] = [];

    // Search for templates for each section type
    for (const sectionType of sectionTypes) {
        try {
            // Build search query
            const searchQuery = {
                prompt: `${sectionType} section for ${brandContext.industry || 'technology'} ${brandContext.voice || 'professional'} brand`,
                category: sectionType,
                industry: brandContext.industry ? [brandContext.industry] : undefined,
                topK: 5,
            };

            // Search templates
            let templates = await searchTemplates(searchQuery);

            // Fall back to industry search if no results
            if (templates.length === 0 && brandContext.industry) {
                templates = await getTemplatesForIndustry(brandContext.industry, 5);
            }

            // Score and rank templates
            const scoredTemplates = templates.map(template => ({
                template,
                score: calculateTemplateScore(template, sectionType, input),
            })).sort((a, b) => b.score - a.score);

            if (scoredTemplates.length > 0) {
                const best = scoredTemplates[0];
                const alternatives = scoredTemplates.slice(1, 4);

                // Determine configuration based on template and brand
                const configuration = determineConfiguration(best.template, sectionType, brandContext);

                templateMapping[sectionType] = {
                    sectionType,
                    templateId: best.template.id,
                    templateName: best.template.templateName,
                    confidence: best.score,
                    configuration,
                    alternatives: alternatives.map(a => ({
                        templateId: a.template.id,
                        templateName: a.template.templateName,
                        score: a.score,
                    })),
                };
            } else {
                // No templates found - use default configuration
                templateMapping[sectionType] = {
                    sectionType,
                    templateId: `default-${sectionType}`,
                    templateName: `Default ${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}`,
                    confidence: 0.5,
                    configuration: determineConfiguration(null, sectionType, brandContext),
                    alternatives: [],
                };

                recommendations.push(`No templates found for ${sectionType}. Using default layout.`);
            }
        } catch (error) {
            console.error(`Error searching templates for ${sectionType}:`, error);

            // Use default on error
            templateMapping[sectionType] = {
                sectionType,
                templateId: `default-${sectionType}`,
                templateName: `Default ${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}`,
                confidence: 0.3,
                configuration: determineConfiguration(null, sectionType, brandContext),
                alternatives: [],
            };
        }
    }

    // Calculate overall style consistency
    const selections = Object.values(templateMapping);
    const themes = new Set(selections.map(s => s.configuration.theme));
    const layouts = new Set(selections.map(s => s.configuration.layout));

    const consistency = 1 - (themes.size - 1) * 0.1 - (layouts.size - 1) * 0.05;

    // Generate recommendations
    if (themes.size > 2) {
        recommendations.push('Consider using a more consistent theme across sections for visual cohesion.');
    }

    const avgConfidence = selections.reduce((sum, s) => sum + s.confidence, 0) / selections.length;
    if (avgConfidence < 0.6) {
        recommendations.push('Template matches have lower confidence. Consider refining brand or industry settings.');
    }

    return {
        templateMapping,
        overallStyle: {
            theme: selections[0]?.configuration.theme || 'light',
            layout: 'single-page',
            consistency: Math.max(0.5, consistency),
        },
        recommendations,
    };
}

/**
 * Determine optimal configuration for a template and section
 */
function determineConfiguration(
    template: TemplateSearchResult | null,
    sectionType: SectionType,
    brandContext: ArchitectInput['brandContext']
): TemplateConfiguration {
    // Default configuration
    const config: TemplateConfiguration = {
        layout: 'single-column',
        theme: 'light',
        density: 'normal',
        emphasis: 'balanced',
    };

    // Use template's visual style if available
    if (template?.visualStyle) {
        config.theme = (template.visualStyle.theme as TemplateConfiguration['theme']) || 'light';
        config.density = (template.visualStyle.density as TemplateConfiguration['density']) || 'normal';
    }

    // Section-specific defaults
    switch (sectionType) {
        case 'hero':
            config.layout = 'single-column';
            config.emphasis = 'headline';
            config.density = 'spacious';
            break;
        case 'features':
            config.layout = 'three-column';
            config.emphasis = 'balanced';
            break;
        case 'testimonials':
            config.layout = 'grid';
            config.emphasis = 'visual';
            break;
        case 'pricing':
            config.layout = 'three-column';
            config.emphasis = 'cta';
            break;
        case 'cta':
            config.layout = 'single-column';
            config.emphasis = 'cta';
            config.density = 'compact';
            break;
        case 'faq':
            config.layout = 'single-column';
            config.emphasis = 'balanced';
            break;
    }

    // Brand voice adjustments
    const voice = brandContext.voice?.toLowerCase() || '';
    if (voice.includes('bold') || voice.includes('modern')) {
        config.theme = 'dark';
    }
    if (voice.includes('minimal') || voice.includes('clean')) {
        config.density = 'spacious';
    }

    return config;
}

// ============================================================================
// Exports
// ============================================================================

export {
    scoreContentFit,
    scoreBrandFit,
    scoreIndustryFit,
    calculateTemplateScore,
    determineConfiguration,
};
