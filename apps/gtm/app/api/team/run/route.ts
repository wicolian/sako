/**
 * Team Run API Endpoint (Jan 2026)
 * 
 * Main SSE streaming endpoint for the multi-agent team flow.
 * Orchestrates: URL input → Brand extraction → 5 agents → Campaign ready
 * 
 * @see PRD Part 2.6: Unified Pipeline API Route
 */

import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

// Import streaming orchestrator
import {
    runStreamingOrchestrator,
    type StreamEvent,
    type BrandContext,
} from '@/lib/agents/multi-agent-stream';

// Import brand extraction functions
import { analyzeBrand, type BrandAnalysis } from '@/lib/import/brand-extractor';
import { smartFetch } from '@/lib/import/url-fetcher';
import { parseHtml } from '@/lib/import/html-parser';
import { extractClaims } from '@/lib/import/claims-extractor';
import { extractDesignTokens } from '@/lib/import/design-extractor';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for full flow

// ============================================================================
// Types
// ============================================================================

interface TeamRunRequest {
    url: string;
    workspaceId?: string;
    config?: {
        preferredProviders?: string[];
        stylePreferences?: Record<string, unknown>;
        skipAgents?: string[];
    };
}

interface TeamSession {
    id: string;
    workspace_id: string;
    input_url: string;
    brand_data: BrandContext | null;
    agent_states: Record<string, unknown>;
    current_phase: string;
    started_at: string;
    created_by: string;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();

    // Parse request
    let body: TeamRunRequest;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Validate URL
    const { url, config } = body;
    if (!url) {
        return new Response(JSON.stringify({ error: 'URL is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Validate URL format
    try {
        new URL(url);
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid URL format. Please include https://' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Get authenticated user and workspace
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Get workspace ID (from request or user's default)
    let workspaceId = body.workspaceId;
    if (!workspaceId) {
        const { data: membership } = await supabase
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .limit(1)
            .single();

        if (!membership) {
            return new Response(JSON.stringify({ error: 'No workspace found' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        workspaceId = membership.workspace_id;
    }

    // Create session ID
    const sessionId = `team-${uuidv4()}`;

    // Create SSE stream
    const stream = new ReadableStream({
        async start(controller) {
            // Helper to send SSE events
            const send = (event: StreamEvent | { type: string;[key: string]: unknown }) => {
                const data = JSON.stringify({
                    ...event,
                    timestamp: event.timestamp || new Date().toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            };

            try {
                // ================================================================
                // Step 1: Create session record
                // ================================================================
                const session: Omit<TeamSession, 'id'> & { id: string } = {
                    id: sessionId,
                    workspace_id: workspaceId!,
                    input_url: url,
                    brand_data: null,
                    agent_states: {},
                    current_phase: 'import',
                    started_at: new Date().toISOString(),
                    created_by: user.id,
                };

                await supabase.from('team_sessions').insert(session);

                // ================================================================
                // Step 2: Brand Extraction Phase
                // ================================================================
                send({
                    type: 'phase_start',
                    phase: 'import',
                    message: 'Extracting your brand from URL...',
                    sessionId,
                });

                // Fetch and parse URL
                let htmlContent: string;
                let parsedPage: Awaited<ReturnType<typeof parseHtml>>;

                try {
                    const fetchResult = await smartFetch(url);
                    htmlContent = fetchResult.html;
                    parsedPage = parseHtml(htmlContent, url);
                } catch (error) {
                    send({
                        type: 'error',
                        message: 'We couldn\'t access that URL. Make sure it\'s publicly accessible.',
                        phase: 'import',
                        recoverable: false,
                    });
                    send({ type: 'stream_complete' });
                    controller.close();
                    return;
                }

                // Extract design tokens first (needed for brand analysis)
                const designTokens = await extractDesignTokens(htmlContent);

                // Extract brand analysis
                let brandAnalysis: BrandAnalysis;
                try {
                    brandAnalysis = await analyzeBrand(parsedPage, designTokens);
                } catch (error) {
                    send({
                        type: 'error',
                        message: 'Failed to extract brand information.',
                        phase: 'import',
                        recoverable: true,
                    });
                    send({ type: 'stream_complete' });
                    controller.close();
                    return;
                }

                // Extract claims from parsed page
                const claims = await extractClaims(parsedPage);

                // Build brand context for agents
                const brandContext: BrandContext = {
                    name: brandAnalysis.name || parsedPage.title || 'Unknown',
                    industry: brandAnalysis.industry,
                    colors: designTokens?.colors ? {
                        primary: designTokens.colors.primary || '#000000',
                        secondary: designTokens.colors.secondary,
                        accent: designTokens.colors.accent,
                    } : undefined,
                    voice: brandAnalysis.voice.tone,
                    valueProposition: brandAnalysis.valuePropositions[0],
                    targetAudience: brandAnalysis.audience.type,
                    claims: claims.map(c => ({ text: c.text, type: c.category })),
                };

                // Update session with brand data
                await supabase
                    .from('team_sessions')
                    .update({
                        brand_data: brandContext,
                        current_phase: 'orchestration',
                    })
                    .eq('id', sessionId);

                // Send import complete event
                send({
                    type: 'phase_complete',
                    phase: 'import',
                    data: {
                        companyName: brandContext.name,
                        industry: brandContext.industry,
                        claimsCount: claims.length,
                    },
                });

                // ================================================================
                // Step 3: Agent Orchestration Phase
                // ================================================================
                const orchestratorInput = {
                    task: `Create a marketing campaign for ${brandContext.name}`,
                    workspaceId: workspaceId!,
                    brandContext,
                    sessionId,
                };

                // Stream events from orchestrator
                for await (const event of runStreamingOrchestrator(orchestratorInput)) {
                    // Update session state
                    if (event.type === 'agent_complete') {
                        await supabase
                            .from('team_sessions')
                            .update({
                                agent_states: {
                                    [`${event.agent}_complete`]: true,
                                    [`${event.agent}_summary`]: event.summary,
                                },
                                current_phase: event.agent,
                            })
                            .eq('id', sessionId);
                    }

                    // Handle HITL required - pause and wait for approval
                    if (event.type === 'hitl_required') {
                        await supabase
                            .from('team_sessions')
                            .update({
                                current_phase: 'review',
                                approval_request_id: event.approvalId,
                            })
                            .eq('id', sessionId);
                    }

                    // Handle campaign ready - update session
                    if (event.type === 'campaign_ready') {
                        await supabase
                            .from('team_sessions')
                            .update({
                                current_phase: 'ready',
                                output_data: event.data,
                                completed_at: new Date().toISOString(),
                            })
                            .eq('id', sessionId);
                    }

                    // Forward event to stream
                    send(event);

                    // If stream is complete, close
                    if (event.type === 'stream_complete') {
                        break;
                    }
                }

            } catch (error) {
                console.error('Team run error:', error);

                // Update session with error
                await supabase
                    .from('team_sessions')
                    .update({
                        current_phase: 'error',
                        error_message: error instanceof Error ? error.message : 'Unknown error',
                    })
                    .eq('id', sessionId);

                send({
                    type: 'error',
                    message: 'Something went wrong. Our team has been notified.',
                    recoverable: false,
                });
                send({ type: 'stream_complete' });
            }

            controller.close();
        },
    });

    // Return SSE response
    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Session-Id': sessionId,
        },
    });
}

// ============================================================================
// GET handler for session status check
// ============================================================================

export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
        return new Response(JSON.stringify({ error: 'Session ID required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const supabase = await createServerSupabaseClient();

    const { data: session, error } = await supabase
        .from('team_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (error || !session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(session), {
        headers: { 'Content-Type': 'application/json' },
    });
}
