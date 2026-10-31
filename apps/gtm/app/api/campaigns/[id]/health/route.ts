/**
 * Campaign Health API (Jan 2026)
 * 
 * GET /api/campaigns/[id]/health - Get health score for a campaign
 * POST /api/campaigns/[id]/health/refresh - Force recalculate health score
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getWorkspaceIdWithFallback } from '@/lib/workspace';
import { calculateHealthScore } from '@/lib/health/score-calculator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);

  try {
    // Check if campaign exists and belongs to workspace
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, name, workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (campaign.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check for cached health score (valid for 1 hour)
    const { data: cachedScore } = await supabase
      .from('campaign_health_scores')
      .select('*')
      .eq('campaign_id', campaignId)
      .single();

    if (cachedScore) {
      const lastCalculated = new Date(cachedScore.last_calculated);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      if (lastCalculated > hourAgo) {
        return NextResponse.json({
          ...cachedScore.score,
          cached: true,
          cacheAge: Math.round((Date.now() - lastCalculated.getTime()) / 1000 / 60),
        });
      }
    }

    // Calculate fresh health score
    const healthScore = await calculateHealthScore(campaignId, workspaceId);

    // Cache the result
    await supabase
      .from('campaign_health_scores')
      .upsert({
        campaign_id: campaignId,
        workspace_id: workspaceId,
        score: healthScore,
        last_calculated: new Date().toISOString(),
      });

    return NextResponse.json({
      ...healthScore,
      cached: false,
    });
  } catch (error: any) {
    console.error('Failed to calculate health score:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate health score' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const workspaceId = getWorkspaceIdWithFallback(request);

  try {
    // Force recalculate (bypass cache)
    const healthScore = await calculateHealthScore(campaignId, workspaceId);

    // Update cache
    const supabase = createServiceClient();
    await supabase
      .from('campaign_health_scores')
      .upsert({
        campaign_id: campaignId,
        workspace_id: workspaceId,
        score: healthScore,
        last_calculated: new Date().toISOString(),
      });

    return NextResponse.json({
      ...healthScore,
      cached: false,
      refreshed: true,
    });
  } catch (error: any) {
    console.error('Failed to refresh health score:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh health score' },
      { status: 500 }
    );
  }
}
