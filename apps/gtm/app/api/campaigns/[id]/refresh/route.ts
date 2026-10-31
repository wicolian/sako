/**
 * Campaign Refresh API (Jan 2026)
 * 
 * GET /api/campaigns/[id]/refresh - Get refresh history
 * POST /api/campaigns/[id]/refresh - Start a new refresh
 * PUT /api/campaigns/[id]/refresh - Apply approved changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getWorkspaceIdWithFallback } from '@/lib/workspace';
import {
  startCampaignRefresh,
  applyRefreshChanges,
  getRefreshHistory,
} from '@/lib/refresh/campaign-refresh';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const { searchParams } = new URL(request.url);
  const refreshId = searchParams.get('refreshId');
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    if (refreshId) {
      // Get specific refresh
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('campaign_refreshes')
        .select('*')
        .eq('id', refreshId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: 'Refresh not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(data);
    }

    // Get refresh history
    const history = await getRefreshHistory(campaignId, limit);
    return NextResponse.json({ history });
  } catch (error: any) {
    console.error('Failed to get refresh data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get refresh data' },
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
  const body = await request.json().catch(() => ({}));

  const {
    refreshEvidence = true,
    refreshClaims = true,
    refreshCopy = false,
    refreshAssets = false,
    autoApprove = false,
  } = body;

  try {
    // Check if campaign exists
    const supabase = createServiceClient();
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, workspace_id')
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

    // Start refresh
    const result = await startCampaignRefresh(campaignId, workspaceId, {
      refreshEvidence,
      refreshClaims,
      refreshCopy,
      refreshAssets,
      autoApprove,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to start refresh:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start refresh' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const workspaceId = getWorkspaceIdWithFallback(request);
  const body = await request.json();

  const { refreshId, approvedChanges } = body;

  if (!refreshId || !approvedChanges) {
    return NextResponse.json(
      { error: 'Missing refreshId or approvedChanges' },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceClient();

    // Get the refresh record
    const { data: refresh, error: refreshError } = await supabase
      .from('campaign_refreshes')
      .select('*')
      .eq('id', refreshId)
      .eq('campaign_id', campaignId)
      .single();

    if (refreshError || !refresh) {
      return NextResponse.json(
        { error: 'Refresh not found' },
        { status: 404 }
      );
    }

    // Update approved status for changes
    const changes = refresh.changes || [];
    for (const change of changes) {
      change.approved = approvedChanges.includes(change.id);
    }

    // Apply the changes
    await applyRefreshChanges(
      {
        ...refresh,
        changes,
        summary: refresh.summary || {
          evidenceUpdated: 0,
          evidenceAdded: 0,
          evidenceRemoved: 0,
          claimsRevalidated: 0,
          claimsStatusChanged: 0,
          copyUpdated: 0,
          assetsRegenerated: 0,
          totalChanges: 0,
        },
      },
      workspaceId
    );

    return NextResponse.json({
      success: true,
      appliedChanges: approvedChanges.length,
    });
  } catch (error: any) {
    console.error('Failed to apply changes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to apply changes' },
      { status: 500 }
    );
  }
}
