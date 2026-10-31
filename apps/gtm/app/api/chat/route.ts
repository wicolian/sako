/**
 * Chat API Route (Feb 2026)
 *
 * Streaming chat endpoint via OpenRouter with workspace-level AI context.
 * All AI calls are wrapped with withAIContext so the workspace global system
 * prompt, routing preferences, and plugin settings from /api/settings/openrouter
 * are applied automatically to every streaming request.
 */

import { streamText } from '@/lib/ai/langsmith-ai';
import { NextRequest } from 'next/server';
import { createServerSupabaseClient as createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getBrandContext, formatBrandPrompt } from '@/lib/ai/brand-context';
import { MODELS } from '@/lib/ai/ai-sdk-client';
import { withAIContextSync, type WorkspaceOpenRouterSettings } from '@/lib/ai/context';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Model selection based on user preference (Feb 2026 OpenRouter IDs)
const MODEL_MAP = {
  'speed':    MODELS.FAST,      // openai/gpt-4.1-mini  — fast & cost-efficient
  'balanced': MODELS.BALANCED,  // openai/gpt-4.1       — best cost/quality ratio
  'quality':  MODELS.CREATIVE,  // anthropic/claude-sonnet-4.6 — highest quality
} as const;

// ============================================================================
// Workspace AI Settings
// ============================================================================

/**
 * Load OpenRouter settings for a workspace from the database.
 * Used to populate withAIContext so every AI call in this request inherits
 * the workspace global system prompt, routing prefs, and plugin toggles.
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const {
      messages,
      sessionId,
      model: modelPreference = 'balanced',
      workspaceId,
      brandId,
    } = body;

    // Get or create session
    let session = sessionId;
    if (!sessionId && messages.length === 1) {
      const { data: newSession } = await supabase
        .from('chat_sessions')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          model: MODEL_MAP[modelPreference as keyof typeof MODEL_MAP] || MODELS.FAST,
        })
        .select('id')
        .single();

      session = newSession?.id;
    }

    // Save user message to database
    if (session && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        await supabase.from('chat_messages').insert({
          session_id: session,
          role: 'user',
          content: lastMessage.content,
        });
      }
    }

    // Load workspace AI settings — populates the global system prompt,
    // routing prefs, and plugin config for this request.
    const aiSettings = workspaceId
      ? await loadWorkspaceAISettings(workspaceId)
      : undefined;

    // Get brand context for system prompt
    let brandPrompt = '';
    if (workspaceId) {
      const brand = await getBrandContext(workspaceId, brandId);
      if (brand) {
        brandPrompt = formatBrandPrompt(brand);
      }
    }

    const systemPrompt = `You are Sako, an expert AI assistant for B2B marketing and GTM (Go-To-Market) campaigns.

Your capabilities:
1. Generate compelling marketing copy (headlines, CTAs, supporting points)
2. Create landing page content and structure
3. Suggest campaign strategies based on ICP and goals
4. Validate marketing claims for compliance
5. Recommend evidence needed for claims
6. Generate email sequences and ad copy

${brandPrompt}

Guidelines:
- Be concise and actionable
- Focus on conversion and trust-building
- Suggest evidence-based claims when possible
- Flag potential compliance issues proactively
- Use the brand voice and guidelines if provided

When generating content, structure it clearly. For landing pages, provide:
- Headline
- Subheadline
- Key benefits (3-4)
- Social proof suggestion
- CTA

For claims that need evidence, note: "⚠️ This claim needs supporting evidence"`;

    // Select model (Feb 2026 OpenRouter IDs via MODELS constant)
    const modelId = MODEL_MAP[modelPreference as keyof typeof MODEL_MAP] || MODELS.FAST;

    // Wrap streamText with workspace AI context so:
    // - Workspace global system prompt is prepended (if set in /settings → OpenRouter)
    // - Provider routing preferences apply (fallbacks, ZDR, sort)
    // - Plugin config applies (response-healing for structured, etc.)
    // withAIContextSync is correct here: streamText() resolves model + merges
    // prompts synchronously. AsyncLocalStorage propagates through all async
    // callbacks (onFinish) initiated within this call.
    const result = withAIContextSync(
      { workspaceId: workspaceId ?? '', settings: aiSettings },
      () => streamText({
        model: modelId,
        system: systemPrompt,
        messages,
        onFinish: async ({ text, usage }: { text: string; usage?: { totalTokens?: number } }) => {
          if (session) {
            await supabase.from('chat_messages').insert({
              session_id: session,
              role: 'assistant',
              content: text,
              model: modelId,
              tokens_used: usage?.totalTokens,
            });
          }
        },
      }),
    );

    // Return streaming response with session ID in header
    const response = result.toTextStreamResponse();

    if (session) {
      response.headers.set('X-Session-Id', session);
    }

    return response;
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/chat - Get chat sessions for current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const archived = request.nextUrl.searchParams.get('archived') === 'true';

    if (sessionId) {
      const { data: session } = await supabase
        .from('chat_sessions')
        .select('*, chat_messages(*)')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      return Response.json({ session });
    }

    const { data: sessions } = await supabase
      .from('chat_sessions')
      .select('id, title, model, is_archived, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_archived', archived)
      .order('updated_at', { ascending: false })
      .limit(50);

    return Response.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

/**
 * PATCH /api/chat - Update session (archive, rename)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { sessionId, title, is_archived } = await request.json();

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (is_archived !== undefined) updates.is_archived = is_archived;

    const { data: session, error } = await supabase
      .from('chat_sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return new Response('Failed to update session', { status: 500 });
    }

    return Response.json({ session });
  } catch (error) {
    console.error('Update session error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

/**
 * DELETE /api/chat - Delete session
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }

    await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    return new Response('Internal error', { status: 500 });
  }
}
