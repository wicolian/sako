/**
 * AI Traces API
 * 
 * GET /api/traces - Get trace statistics for the current workspace
 * 
 * Query params:
 * - days: Number of days to look back (default: 30)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTraceStatistics } from '@/lib/ai/tracing';
import { isExternalTracingEnabled } from '@/lib/ai/external-tracing';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const workspaceId = membership.workspace_id;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get statistics
    const stats = await getTraceStatistics(workspaceId, startDate, endDate);

    // Check if external tracing is enabled
    const externalTracingEnabled = isExternalTracingEnabled();
    const langsmithProject = process.env.LANGSMITH_PROJECT || 'sako-composer';

    return NextResponse.json({
      ...stats,
      config: {
        externalTracingEnabled,
        langsmithProject: externalTracingEnabled ? langsmithProject : null,
        langsmithDashboardUrl: externalTracingEnabled 
          ? `https://smith.langchain.com/o/default/projects/p/${langsmithProject}`
          : null,
      },
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days,
      },
    });
  } catch (error) {
    console.error('Error fetching trace statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trace statistics' },
      { status: 500 }
    );
  }
}
