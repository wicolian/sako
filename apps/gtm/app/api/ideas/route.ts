/**
 * Content Ideas API
 * 
 * POST /api/ideas - Generate new ideas
 * GET /api/ideas - Get existing ideas
 * PATCH /api/ideas/[id] - Update idea status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  generateContentIdeas,
  generateIdeaVariations,
  saveIdea,
  skipIdea,
  getSavedIdeas,
  getFreshIdeas,
  getFreshIdeasCount,
} from '@/lib/ai/content-ideas-generator';
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

    const workspaceId = membership.workspace_id;

    // Check budget
    const budgetCheck = await enforceBudget(workspaceId, 20); // ~$0.20 per batch
    if (!budgetCheck.allowed) {
      return NextResponse.json(
        { error: budgetCheck.error || 'Budget exceeded' },
        { status: 402 }
      );
    }

    const body = await request.json();
    const { action, campaignId, brandContext, count = 10, idea } = body;

    if (action === 'variations' && idea) {
      // Generate variations of an existing idea
      const variations = await generateIdeaVariations(idea, count);
      return NextResponse.json({
        success: true,
        ideas: variations,
        count: variations.length,
      });
    }

    // Generate new ideas
    const ideas = await generateContentIdeas({
      workspaceId,
      campaignId,
      brandContext,
    }, count);

    return NextResponse.json({
      success: true,
      ideas,
      count: ideas.length,
    });
  } catch (error) {
    console.error('Ideas generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

    const workspaceId = membership.workspace_id;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'fresh'; // 'fresh' | 'saved'
    const campaignId = searchParams.get('campaignId') || undefined;

    if (type === 'saved') {
      const ideas = await getSavedIdeas(workspaceId, campaignId);
      return NextResponse.json({
        success: true,
        ideas,
        count: ideas.length,
      });
    }

    // Get fresh ideas
    const ideas = await getFreshIdeas(workspaceId);
    const freshCount = await getFreshIdeasCount(workspaceId);

    return NextResponse.json({
      success: true,
      ideas,
      count: ideas.length,
      freshCount,
    });
  } catch (error) {
    console.error('Error fetching ideas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ideas' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ideaId, idea, action, campaignId } = body;

    if (!ideaId && !idea) {
      return NextResponse.json(
        { error: 'ideaId or idea object is required' },
        { status: 400 }
      );
    }

    if (action === 'save' && idea) {
      await saveIdea(idea, campaignId);
      return NextResponse.json({ success: true, status: 'saved' });
    }

    if (action === 'skip' && (ideaId || idea?.id)) {
      await skipIdea(ideaId || idea.id);
      return NextResponse.json({ success: true, status: 'skipped' });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "save" or "skip"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating idea:', error);
    return NextResponse.json(
      { error: 'Failed to update idea' },
      { status: 500 }
    );
  }
}
