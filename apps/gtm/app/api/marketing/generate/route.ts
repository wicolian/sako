/**
 * Marketing Framework Generation API
 * 
 * POST /api/marketing/generate - Generate copy using a framework
 * POST /api/marketing/suggest - Suggest best frameworks for context
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { 
  generateWithFramework, 
  suggestFrameworks, 
  getFramework,
  AD_FRAMEWORKS,
} from '@/lib/marketing/ad-frameworks';
import { enforceBudget } from '@/lib/enterprise/budget-enforcement';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Check budget
    const budgetCheck = await enforceBudget(membership.workspace_id, 25);
    if (!budgetCheck.allowed) {
      return NextResponse.json(
        { error: budgetCheck.error || 'Budget exceeded' },
        { status: 402 }
      );
    }

    const body = await request.json();
    const { action, frameworkId, product, targetAudience, goal, tone, additionalContext } = body;

    // Suggest frameworks
    if (action === 'suggest') {
      if (!product || !goal || !targetAudience) {
        return NextResponse.json(
          { error: 'product, goal, and targetAudience are required for suggestions' },
          { status: 400 }
        );
      }

      const suggestions = await suggestFrameworks({
        product,
        goal,
        audience: targetAudience,
        contentType: body.contentType || 'ad',
      });

      return NextResponse.json({
        success: true,
        frameworks: suggestions.frameworks,
        reasoning: suggestions.reasoning,
      });
    }

    // Generate content with framework
    if (!frameworkId) {
      return NextResponse.json(
        { error: 'frameworkId is required' },
        { status: 400 }
      );
    }

    const framework = getFramework(frameworkId);
    if (!framework) {
      return NextResponse.json(
        { error: `Unknown framework: ${frameworkId}. Available: ${AD_FRAMEWORKS.map(f => f.id).join(', ')}` },
        { status: 400 }
      );
    }

    if (!product || !targetAudience || !goal) {
      return NextResponse.json(
        { error: 'product, targetAudience, and goal are required' },
        { status: 400 }
      );
    }

    const content = await generateWithFramework(frameworkId, {
      product,
      targetAudience,
      goal,
      tone,
      additionalContext,
    });

    // Log usage for analytics
    await supabase.from('framework_usage').insert({
      workspace_id: membership.workspace_id,
      user_id: user.id,
      framework_id: frameworkId,
      framework_name: framework.name,
      context: { product, targetAudience, goal, tone },
    }).select().single();

    return NextResponse.json({
      success: true,
      framework: {
        id: framework.id,
        name: framework.name,
        acronym: framework.acronym,
      },
      content,
    });
  } catch (error) {
    console.error('Marketing generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return all available frameworks
  const frameworks = AD_FRAMEWORKS.map(f => ({
    id: f.id,
    name: f.name,
    acronym: f.acronym,
    description: f.description,
    stages: f.stages.map(s => s.name),
    bestFor: f.bestFor,
    difficulty: f.difficulty,
    effectivenessScore: f.effectivenessScore,
  }));

  return NextResponse.json({
    success: true,
    frameworks,
    count: frameworks.length,
  });
}
