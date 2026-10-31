/**
 * Team Session Continuation Endpoint (Jan 2026)
 * 
 * Resume a paused orchestration after human review decisions.
 * 
 * @see PRD Part 2.7: Approval Continuation Endpoint
 */

import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
    runStreamingOrchestrator,
    type StreamEvent,
    type BrandContext,
    type ApprovalDecision,
} from '@/lib/agents/multi-agent-stream';
import { processApprovalDecision, getApprovalRequest } from '@/lib/agents/hitl';

export const runtime = 'nodejs';
export const maxDuration = 180; // 3 minutes for continuation

// ============================================================================
// Types
// ============================================================================

interface ContinueRequest {
    decisions: ApprovalDecision[];
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const encoder = new TextEncoder();
    const { sessionId } = await params;

    // Parse request
    let body: ContinueRequest;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const { decisions } = body;
    if (!decisions || !Array.isArray(decisions)) {
        return new Response(JSON.stringify({ error: 'Decisions array is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Load session
    const { data: session, error: sessionError } = await supabase
        .from('team_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

    if (sessionError || !session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Verify session is in waiting for approval state
    if (session.current_phase !== 'review') {
        return new Response(JSON.stringify({
            error: 'Session is not waiting for approval',
            currentPhase: session.current_phase,
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Process approval decisions if there's an approval request
    if (session.approval_request_id) {
        try {
            // For each decision, update the approval
            for (const decision of decisions) {
                // Map decision to approval format
                const decisionType = decision.decision === 'use_suggestion' ? 'approve' : 'approve';

                await processApprovalDecision(
                    session.approval_request_id,
                    user.id,
                    user.email || '',
                    decisionType,
                    decision.editedText || undefined
                );
            }
        } catch (error) {
            console.error('Error processing approval decisions:', error);
            // Continue anyway - decisions are stored in session context
        }
    }

    // Create SSE stream for continuation
    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: StreamEvent | { type: string;[key: string]: unknown }) => {
                const data = JSON.stringify({
                    ...event,
                    timestamp: event.timestamp || new Date().toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            };

            try {
                // Update session phase
                await supabase
                    .from('team_sessions')
                    .update({
                        current_phase: 'creator',
                        agent_states: {
                            ...session.agent_states,
                            approval_decisions: decisions,
                        },
                    })
                    .eq('id', sessionId);

                // Resume orchestrator from Creator agent
                const brandContext = session.brand_data as BrandContext;

                const orchestratorInput = {
                    task: `Continue marketing campaign for ${brandContext?.name || 'company'}`,
                    workspaceId: session.workspace_id,
                    brandContext: brandContext || { name: 'Unknown' },
                    sessionId,
                    resumeFromAgent: 'creator' as const,
                    approvalDecisions: decisions,
                };

                // Send continuation start event
                send({
                    type: 'phase_start',
                    phase: 'orchestration',
                    message: 'Continuing your campaign with approved claims...',
                });

                // Stream remaining events
                for await (const event of runStreamingOrchestrator(orchestratorInput)) {
                    // Update session state
                    if (event.type === 'agent_complete') {
                        await supabase
                            .from('team_sessions')
                            .update({
                                agent_states: {
                                    ...session.agent_states,
                                    [`${event.agent}_complete`]: true,
                                    [`${event.agent}_summary`]: event.summary,
                                },
                                current_phase: event.agent,
                            })
                            .eq('id', sessionId);
                    }

                    // Handle campaign ready
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

                    // Forward event
                    send(event);

                    if (event.type === 'stream_complete') {
                        break;
                    }
                }

            } catch (error) {
                console.error('Continuation error:', error);

                await supabase
                    .from('team_sessions')
                    .update({
                        current_phase: 'error',
                        error_message: error instanceof Error ? error.message : 'Unknown error',
                    })
                    .eq('id', sessionId);

                send({
                    type: 'error',
                    message: 'Something went wrong while continuing. Please try again.',
                    recoverable: true,
                });
                send({ type: 'stream_complete' });
            }

            controller.close();
        },
    });

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
// GET handler to check session status
// ============================================================================

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const { sessionId } = await params;

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

    // Load flagged claims from the HITL approval request if session is awaiting review
    let flaggedClaims: Array<{ text: string; risk: string; reason?: string; suggestion?: string }> = [];
    if (session.approval_request_id && session.current_phase === 'review') {
        const approvalRequest = await getApprovalRequest(session.approval_request_id);
        if (approvalRequest?.context?.claims) {
            flaggedClaims = approvalRequest.context.claims.map(c => ({
                text: c.text,
                risk: c.risk,
                reason: `Flagged as ${c.risk} risk by Guardian`,
                suggestion: c.suggestion,
            }));
        }
    }

    return new Response(JSON.stringify({
        id: session.id,
        phase: session.current_phase,
        needsApproval: session.current_phase === 'review',
        approvalRequestId: session.approval_request_id,
        flaggedClaims,
        brandData: session.brand_data,
        agentStates: session.agent_states,
        outputData: session.output_data,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        error: session.error_message,
    }), {
        headers: { 'Content-Type': 'application/json' },
    });
}
