/**
 * Background Ideas API
 * 
 * GET /api/jobs/background-ideas - Get status and settings
 * POST /api/jobs/background-ideas - Trigger manual generation
 * PATCH /api/jobs/background-ideas - Update settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { triggerIdeaGeneration } from '@/lib/jobs/background-ideas';
import { getFreshIdeasCount } from '@/lib/ai/content-ideas-generator';

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
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const workspaceId = membership.workspace_id;

    // Get workspace settings
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single();

    const settings = (workspace?.settings || {}) as Record<string, unknown>;
    
    // Get fresh ideas count for badge
    const freshCount = await getFreshIdeasCount(workspaceId);

    // Get last generation time
    const { data: lastGeneration } = await supabase
      .from('notifications')
      .select('created_at, metadata')
      .eq('workspace_id', workspaceId)
      .eq('type', 'new_ideas')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      settings: {
        enabled: settings.background_ideas_enabled !== false,
        ideasPerDay: settings.background_ideas_count || 15,
        schedule: '3:00 AM UTC',
      },
      status: {
        freshIdeasCount: freshCount,
        lastGeneration: lastGeneration?.created_at || null,
        lastGenerationCount: (lastGeneration?.metadata as { count?: number })?.count || 0,
      },
      canManage: membership.role === 'owner' || membership.role === 'admin',
    });
  } catch (error) {
    console.error('Error fetching background ideas status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const { count = 15, brandId } = body;

    // Trigger manual generation
    const result = await triggerIdeaGeneration(membership.workspace_id, {
      brandId,
      count: Math.min(count, 30), // Cap at 30
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to trigger generation' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Ideas generation started',
      runId: result.runId,
    });
  } catch (error) {
    console.error('Error triggering idea generation:', error);
    return NextResponse.json(
      { error: 'Failed to trigger generation' },
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

    // Get workspace and check permissions
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update background job settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { enabled, ideasPerDay } = body;

    // Get current settings
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', membership.workspace_id)
      .single();

    const currentSettings = (workspace?.settings || {}) as Record<string, unknown>;

    // Update settings
    const newSettings = {
      ...currentSettings,
      ...(enabled !== undefined && { background_ideas_enabled: enabled }),
      ...(ideasPerDay !== undefined && { 
        background_ideas_count: Math.max(5, Math.min(ideasPerDay, 30)) // 5-30 range
      }),
    };

    const { error: updateError } = await supabase
      .from('workspaces')
      .update({ settings: newSettings })
      .eq('id', membership.workspace_id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      settings: {
        enabled: newSettings.background_ideas_enabled !== false,
        ideasPerDay: newSettings.background_ideas_count || 15,
      },
    });
  } catch (error) {
    console.error('Error updating background ideas settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
