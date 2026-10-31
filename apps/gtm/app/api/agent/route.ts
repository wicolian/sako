/**
 * Agentic Campaign API (Feb 2026)
 *
 * Provides ACTUAL agentic capabilities:
 * - Tool use / function calling via OpenRouter
 * - Autonomous task execution with user approval
 * - Campaign workflow automation
 *
 * All AI calls are wrapped with withAIContext so workspace-level settings
 * (global system prompt, routing, plugins) from /api/settings/openrouter
 * apply automatically — including to nested tool execute() calls.
 */

import { NextRequest } from 'next/server';
import { streamText } from '@/lib/ai/langsmith-ai';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { getBrandContext, formatBrandPrompt } from '@/lib/ai/brand-context';
import { MODELS, generateLandingPageContent, generateMarketingAngles, quickClaimCheck } from '@/lib/ai/ai-sdk-client';
import { searchTemplates } from '@/lib/templates/retriever';
import { withAIContextSync, type WorkspaceOpenRouterSettings } from '@/lib/ai/context';

export const maxDuration = 60;

// ============================================================================
// Workspace AI Settings
// ============================================================================

/**
 * Load OpenRouter settings for a workspace from the database.
 * Used to populate withAIContext so every AI call in this request — including
 * nested tool execute() callbacks — inherits the workspace global system
 * prompt, routing preferences, and plugin toggles.
 *
 * Non-critical: returns undefined on error so defaults apply.
 */
async function loadWorkspaceAISettings(
  workspaceId: string,
): Promise<WorkspaceOpenRouterSettings | undefined> {
  try {
    const serviceClient = createServiceClient();
    const { data: workspace } = await serviceClient
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single();
    return (
      workspace?.settings as { openrouter?: WorkspaceOpenRouterSettings } | null
    )?.openrouter;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

// Define tools with AI SDK 6 format (inputSchema instead of parameters)
function createTools(workspaceId: string) {
  return {
    // === CONTENT GENERATION TOOLS ===
    generateLandingPage: {
      description: 'Generate complete landing page content with headline, subheadline, benefits, and CTA.',
      inputSchema: z.object({
        brief: z.string().describe('Brief description of the product/service and target audience'),
        industry: z.string().describe('Industry context (saas, fintech, healthcare, etc.) - use "general" if unknown'),
      }),
      execute: async ({ brief, industry }: { brief: string; industry: string }) => {
        try {
          const content = await generateLandingPageContent(brief, industry !== 'general' ? `Industry: ${industry}` : undefined);
          return { success: true, content, message: 'Landing page content generated successfully' };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to generate landing page' };
        }
      },
    },
    generateAngles: {
      description: 'Generate 3 distinctive marketing angles for a campaign.',
      inputSchema: z.object({
        name: z.string().describe('Campaign name'),
        audience: z.string().describe('Target audience description'),
        goal: z.string().describe('Campaign goal (leads, signups, sales)'),
        offer: z.string().describe('What you are offering - use empty string if not specified'),
      }),
      execute: async ({ name, audience, goal, offer }: { name: string; audience: string; goal: string; offer: string }) => {
        try {
          const angles = await generateMarketingAngles({ name, audience, goal, offer: offer || undefined });
          return { success: true, angles: angles.angles, message: `Generated ${angles.angles.length} marketing angles` };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to generate angles' };
        }
      },
    },
    validateClaim: {
      description: 'Check if a marketing claim is compliant and suggest improvements.',
      inputSchema: z.object({
        claim: z.string().describe('The marketing claim to validate'),
      }),
      execute: async ({ claim }: { claim: string }) => {
        try {
          const validation = await quickClaimCheck(claim);
          return { success: true, ...validation };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to validate claim' };
        }
      },
    },
    searchTemplates: {
      description: 'Search for design templates based on a description.',
      inputSchema: z.object({
        prompt: z.string().describe('Description of what kind of template to find'),
        category: z.string().describe('Section category: hero, features, pricing, testimonials, faq, cta, or empty for all'),
      }),
      execute: async ({ prompt, category }: { prompt: string; category: string }) => {
        try {
          const templates = await searchTemplates({ prompt, category: category || undefined, topK: 3 });
          return {
            success: true,
            templates: templates.map(t => ({ name: t.templateName, category: t.category, style: t.visualStyle, description: t.description })),
            message: `Found ${templates.length} matching templates`,
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to search templates' };
        }
      },
    },

    // === DATA CREATION TOOLS ===
    createCampaign: {
      description: 'Create a new campaign in the database.',
      inputSchema: z.object({
        name: z.string().describe('Campaign name'),
        audience: z.string().describe('Target audience'),
        goal: z.string().describe('Campaign goal'),
        offer: z.string().describe('Offer description - use empty string if not specified'),
      }),
      execute: async ({ name, audience, goal, offer }: { name: string; audience: string; goal: string; offer: string }) => {
        try {
          const supabase = createServiceClient();
          const { data: campaign, error } = await supabase
            .from('campaigns')
            .insert({ name, audience, goal, offer: offer || null, workspace_id: workspaceId, status: 'draft' })
            .select()
            .single();
          if (error) return { success: false, error: error.message };
          return { success: true, campaignId: campaign.id, message: `Campaign "${name}" created successfully` };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to create campaign' };
        }
      },
    },

    // === DATA RETRIEVAL TOOLS ===
    listCampaigns: {
      description: 'Get a list of campaigns from the workspace. Use this when user asks about their campaigns, wants to see campaign status, or needs campaign data.',
      inputSchema: z.object({
        status: z.string().describe('Filter by status: draft, ready, published, running, archived, or empty for all'),
        limit: z.number().describe('Number of campaigns to return (default 10, max 50)'),
      }),
      execute: async ({ status, limit }: { status: string; limit: number }) => {
        try {
          const supabase = createServiceClient();
          let query = supabase
            .from('campaigns')
            .select('id, name, status, goal, audience, created_at, updated_at')
            .eq('workspace_id', workspaceId)
            .order('updated_at', { ascending: false })
            .limit(Math.min(limit || 10, 50));

          if (status && status !== '') {
            query = query.eq('status', status);
          }

          const { data: campaigns, error } = await query;
          if (error) return { success: false, error: error.message };

          return {
            success: true,
            campaigns: campaigns || [],
            count: campaigns?.length || 0,
            message: `Found ${campaigns?.length || 0} campaign(s)`,
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to list campaigns' };
        }
      },
    },
    listClaims: {
      description: 'Get marketing claims from the workspace. Use this when user wants to see their claims, review compliance status, or check which claims need proof.',
      inputSchema: z.object({
        status: z.string().describe('Filter by status: draft, needs_proof, blocked, ready_review, approved, rejected, or empty for all'),
        limit: z.number().describe('Number of claims to return (default 10, max 50)'),
      }),
      execute: async ({ status, limit }: { status: string; limit: number }) => {
        try {
          const supabase = createServiceClient();
          let query = supabase
            .from('claims')
            .select('id, text, claim_type, status, risk_score, category, created_at')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit || 10, 50));

          if (status && status !== '') {
            query = query.eq('status', status);
          }

          const { data: claims, error } = await query;
          if (error) return { success: false, error: error.message };

          const statusCounts: Record<string, number> = {};
          claims?.forEach(c => {
            statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
          });

          return {
            success: true,
            claims: claims || [],
            count: claims?.length || 0,
            statusSummary: statusCounts,
            message: `Found ${claims?.length || 0} claim(s)`,
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to list claims' };
        }
      },
    },
    listEvidence: {
      description: 'Get evidence from the workspace library. Use when user wants to see available proof, check evidence tiers, or find evidence to link to claims.',
      inputSchema: z.object({
        tier: z.string().describe('Filter by tier: A (strongest), B (moderate), C (weak), or empty for all'),
        sourceType: z.string().describe('Filter by source: research, testimonial, certification, internal, other, or empty for all'),
        limit: z.number().describe('Number of evidence items to return (default 10, max 50)'),
      }),
      execute: async ({ tier, sourceType, limit }: { tier: string; sourceType: string; limit: number }) => {
        try {
          const supabase = createServiceClient();
          let query = supabase
            .from('evidence')
            .select('id, title, type, tier, source_type, url, content, created_at')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false })
            .limit(Math.min(limit || 10, 50));

          if (tier && tier !== '') {
            query = query.eq('tier', tier);
          }
          if (sourceType && sourceType !== '') {
            query = query.eq('source_type', sourceType);
          }

          const { data: evidence, error } = await query;
          if (error) return { success: false, error: error.message };

          const tierCounts: Record<string, number> = {};
          evidence?.forEach(e => {
            tierCounts[e.tier || 'unknown'] = (tierCounts[e.tier || 'unknown'] || 0) + 1;
          });

          return {
            success: true,
            evidence: evidence || [],
            count: evidence?.length || 0,
            tierSummary: tierCounts,
            message: `Found ${evidence?.length || 0} evidence item(s)`,
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to list evidence' };
        }
      },
    },
    getBrandInfo: {
      description: 'Get the current brand settings including colors, voice, and audience info. Use when user asks about their brand, wants to see brand settings, or needs brand context.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const supabase = createServiceClient();
          const { data: brand, error } = await supabase
            .from('brands')
            .select('*')
            .eq('workspace_id', workspaceId)
            .eq('is_default', true)
            .single();

          if (error) {
            if (error.code === 'PGRST116') {
              return { success: true, brand: null, message: 'No brand configured yet. Import a website to extract brand DNA.' };
            }
            return { success: false, error: error.message };
          }

          return {
            success: true,
            brand: {
              name: brand.name,
              website: brand.website_url,
              colors: {
                primary: brand.primary_color,
                secondary: brand.secondary_color,
                accent: brand.accent_color,
                background: brand.background_color,
                text: brand.text_color,
              },
              typography: {
                fontFamily: brand.font_family,
                headingFont: brand.heading_font,
              },
              voice: brand.voice,
              toneKeywords: brand.tone_keywords,
              tagline: brand.tagline,
              industry: brand.industry,
            },
            message: `Brand: ${brand.name}`,
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to get brand info' };
        }
      },
    },
    updateBrand: {
      description: 'Update brand settings like colors, voice, or tagline. Use when user wants to change brand settings.',
      inputSchema: z.object({
        primaryColor: z.string().describe('Primary brand color in hex format (e.g., #FF5733) - empty to keep current'),
        secondaryColor: z.string().describe('Secondary brand color in hex format - empty to keep current'),
        accentColor: z.string().describe('Accent brand color in hex format - empty to keep current'),
        voice: z.array(z.string()).describe('Brand voice keywords (e.g., ["professional", "friendly"]) - empty array to keep current'),
        tagline: z.string().describe('Brand tagline - empty to keep current'),
      }),
      execute: async ({ primaryColor, secondaryColor, accentColor, voice, tagline }: {
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
        voice: string[];
        tagline: string;
      }) => {
        try {
          const supabase = createServiceClient();
          const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (primaryColor) updates.primary_color = primaryColor;
          if (secondaryColor) updates.secondary_color = secondaryColor;
          if (accentColor) updates.accent_color = accentColor;
          if (voice && voice.length > 0) updates.voice = voice;
          if (tagline) updates.tagline = tagline;

          const { error } = await supabase
            .from('brands')
            .update(updates)
            .eq('workspace_id', workspaceId)
            .eq('is_default', true);

          if (error) return { success: false, error: error.message };

          return {
            success: true,
            message: 'Brand settings updated successfully',
            updatedFields: Object.keys(updates).filter(k => k !== 'updated_at'),
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to update brand' };
        }
      },
    },

    // === NAVIGATION TOOL ===
    navigateTo: {
      description: 'Direct the user to a specific page in the app. Use this when the user needs to access a feature that requires manual interaction, or when you want to show them where something is.',
      inputSchema: z.object({
        page: z.enum([
          'dashboard',
          'campaigns',
          'claims',
          'evidence',
          'brand-dna',
          'import',
          'studio',
          'analytics',
          'settings',
          'integrations',
        ]).describe('The page to navigate to'),
        reason: z.string().describe('Why you are suggesting this navigation'),
      }),
      execute: async ({ page, reason }: { page: string; reason: string }) => {
        const routes: Record<string, string> = {
          'dashboard': '/dashboard',
          'campaigns': '/campaigns',
          'claims': '/claims',
          'evidence': '/evidence',
          'brand-dna': '/brand-dna',
          'import': '/import',
          'studio': '/studio',
          'analytics': '/analytics',
          'settings': '/settings',
          'integrations': '/settings/integrations',
        };

        return {
          success: true,
          action: 'navigate',
          route: routes[page] || '/dashboard',
          page,
          reason,
          message: `Navigate to ${page}: ${reason}`,
        };
      },
    },

    // === IMPORT TOOL ===
    importWebsite: {
      description: 'Analyze a website URL to extract brand identity, marketing claims, and find supporting evidence. Use when user wants to import their website or analyze a landing page.',
      inputSchema: z.object({
        url: z.string().describe('The full website URL to analyze (e.g., https://example.com)'),
      }),
      execute: async ({ url }: { url: string }) => {
        try {
          let normalizedUrl = url;
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            normalizedUrl = `https://${url}`;
          }

          try {
            new URL(normalizedUrl);
          } catch {
            return { success: false, error: 'Invalid URL format. Please provide a valid website URL.' };
          }

          return {
            success: true,
            action: 'startImport',
            url: normalizedUrl,
            message: `Ready to import ${normalizedUrl}. This will extract brand colors, voice, marketing claims, and research evidence.`,
            instructions: 'The import process takes 1-2 minutes. It will: 1) Fetch and parse the page, 2) Extract brand DNA (colors, fonts, voice), 3) Detect marketing claims, 4) Research evidence for each claim.',
            navigateTo: '/import',
          };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to start import' };
        }
      },
    },
  };
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { messages, workspaceId, brandId } = body;

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'workspaceId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Load workspace AI settings — populates the global system prompt,
    // routing prefs, and plugin config for this request. Done before brand
    // context so both are ready before the streamText call.
    const aiSettings = await loadWorkspaceAISettings(workspaceId);

    // Get brand context
    let brandPrompt = '';
    const brand = await getBrandContext(workspaceId, brandId);
    if (brand) {
      brandPrompt = formatBrandPrompt(brand);
    }

    const systemPrompt = `You are Sako, an AGENTIC AI assistant for B2B marketing campaigns.

You are the PRIMARY interface for users to interact with the platform. Instead of navigating through menus, they talk to you and you handle everything.

## YOUR TOOLS

### Content Generation
- generateLandingPage: Generate complete landing page content
- generateAngles: Create marketing angles for campaigns
- validateClaim: Check if marketing claims are compliant
- searchTemplates: Find design templates

### Data Management
- createCampaign: Create new campaigns
- listCampaigns: Get campaigns (filter by status: draft, ready, published, running, archived)
- listClaims: Get claims (filter by status: draft, needs_proof, blocked, ready_review, approved, rejected)
- listEvidence: Get evidence library (filter by tier: A, B, C)
- getBrandInfo: Get current brand settings (colors, voice, etc.)
- updateBrand: Update brand settings

### Navigation & Import
- navigateTo: Direct user to a specific page when manual interaction is needed
- importWebsite: Analyze a website URL to extract brand DNA and claims

When a user asks you to do something, USE YOUR TOOLS to actually do it - don't just describe what you would do.

${brandPrompt}

## BEHAVIORS

1. **Be Proactive**: When a user asks about something, fetch the relevant data first, then answer
2. **Take Action**: When asked to create/update something, do it immediately with tools
3. **Summarize Clearly**: After tools return, present results in a readable format
4. **Suggest Next Steps**: After completing a task, suggest logical next actions
5. **Handle Errors Gracefully**: If something fails, explain why and offer alternatives
6. **Ask for Confirmation**: Only for destructive actions (delete, deploy to production)

## RESPONSE FORMAT

When showing data (campaigns, claims, evidence):
- Present as a clean list with status badges
- Highlight items that need attention
- Include counts and summaries

When navigation is needed:
- Explain what the user will find there
- Offer to help with related tasks

## EXAMPLE INTERACTIONS

User: "Show me my claims"
→ Call listClaims tool, present results with status breakdown

User: "Create a campaign for our Q1 product launch"
→ Call createCampaign tool, then offer to generate angles

User: "Import my website example.com"
→ Call importWebsite tool, guide them to the import page

User: "What's my brand color?"
→ Call getBrandInfo tool, show the color palette
`;

    // Create tools with workspace context
    const tools = createTools(workspaceId);

    // Wrap streamText with workspace AI context so:
    // - Workspace global system prompt is prepended (configured in /settings → OpenRouter)
    // - Provider routing prefs apply (fallbacks, ZDR, sort, max_price)
    // - Plugin config applies (response-healing for structured calls)
    // - AsyncLocalStorage propagates to ALL tool execute() callbacks and any
    //   nested AI calls they make (generateLandingPageContent, quickClaimCheck, etc.)
    const result = withAIContextSync(
      { workspaceId, settings: aiSettings },
      () => streamText({
        model: MODELS.REASONING,
        system: systemPrompt,
        messages,
        tools,
        onFinish: ({ toolCalls, toolResults }: {
          toolCalls?: Array<{ toolName: string }>;
          toolResults?: unknown[];
        }) => {
          if (toolCalls && toolCalls.length > 0) {
            console.log('Tool calls:', toolCalls.map(tc => tc.toolName));
          }
          if (toolResults && toolResults.length > 0) {
            console.log('Tool results count:', toolResults.length);
          }
        },
      }),
    );

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Agent API error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Agent failed to process request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
