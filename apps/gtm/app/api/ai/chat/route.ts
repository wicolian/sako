/**
 * AI Chat API (Jan 2026)
 * 
 * Playground chat endpoint for quick content generation.
 * Uses Vercel AI Gateway with 2026 model allowlist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceContext } from '@/lib/workspace';
import { generateText } from '@/lib/ai/langsmith-ai';
import { getBrandContext, formatBrandPrompt } from '@/lib/ai/brand-context';
import { MODELS } from '@/lib/ai/ai-sdk-client';

/**
 * POST /api/ai/chat
 * Playground chat endpoint for quick content generation
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await getWorkspaceContext(request);
    const body = await request.json();
    const { context, type = 'headline', brandId } = body;

    if (!context) {
      return NextResponse.json(
        { error: 'Context is required' },
        { status: 400 }
      );
    }

    // Get brand context if available
    let brandPrompt = '';
    if (workspaceId) {
      const brand = await getBrandContext(workspaceId, brandId);
      if (brand) {
        brandPrompt = formatBrandPrompt(brand);
      }
    }

    // Generate based on type
    let systemPrompt = '';
    switch (type) {
      case 'headline':
        systemPrompt = `You are an expert marketing copywriter. Generate a compelling headline based on the user's input.
        
${brandPrompt}

Requirements:
- Create ONE powerful headline (5-10 words)
- Make it attention-grabbing and benefit-focused
- Avoid clichés and generic phrases
- Include a clear value proposition

Respond with ONLY the headline, no quotes or explanation.`;
        break;

      case 'supporting':
        systemPrompt = `You are an expert marketing copywriter. Generate supporting copy points based on the user's input.

${brandPrompt}

Requirements:
- Create 3-4 concise supporting points
- Each point should reinforce the main message
- Focus on benefits and outcomes
- Use clear, persuasive language

Respond with bullet points, one per line starting with "• ".`;
        break;

      case 'cta':
        systemPrompt = `You are an expert marketing copywriter. Generate call-to-action options based on the user's input.

${brandPrompt}

Requirements:
- Create 3 different CTA options
- Make them action-oriented and urgent
- Keep them short (2-5 words)
- Vary the approach (urgency, value, curiosity)

Respond with one CTA per line.`;
        break;

      case 'landing':
        systemPrompt = `You are an expert marketing copywriter. Generate a complete landing page content structure based on the user's input.

${brandPrompt}

Generate:
1. Headline (compelling, benefit-focused)
2. Subheadline (supporting the main message)
3. 3 key benefits with brief descriptions
4. Social proof suggestion
5. Primary CTA

Format as JSON with keys: headline, subheadline, benefits (array), socialProof, cta`;
        break;

      default:
        systemPrompt = `You are an expert marketing copywriter. Help the user with their request.

${brandPrompt}

Be concise, creative, and persuasive.`;
    }

    // Use AI Gateway with 2026 FAST model
    const { text } = await generateText({
      model: MODELS.FAST,
      system: systemPrompt,
      prompt: context,
    });

    // Parse response based on type
    let response: Record<string, unknown> = { text };

    if (type === 'headline') {
      response = { headline: text.trim() };
    } else if (type === 'supporting') {
      const points = text.split('\n').filter((line: string) => line.trim().startsWith('•'));
      response = { 
        headline: 'Supporting Points', 
        supporting: points.map((p: string) => p.replace('• ', '').trim())
      };
    } else if (type === 'cta') {
      const ctas = text.split('\n').filter(Boolean).map((c: string) => c.trim());
      response = { 
        headline: 'Call-to-Action Options',
        ctas 
      };
    } else if (type === 'landing') {
      try {
        const parsed = JSON.parse(text);
        response = parsed;
      } catch {
        response = { text };
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}
