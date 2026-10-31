/**
 * Single A/B Test API (Jan 2026)
 * 
 * GET /api/campaigns/[id]/ab-tests/[testId] - Get test details
 * PATCH /api/campaigns/[id]/ab-tests/[testId] - Update test
 * DELETE /api/campaigns/[id]/ab-tests/[testId] - Delete test
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getWorkspaceIdWithFallback } from '@/lib/workspace';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; testId: string }> }
) {
  const { id: campaignId, testId } = await params;
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);

  try {
    const { data: test, error } = await supabase
      .from('ab_tests')
      .select(`
        *,
        ab_test_variants (*)
      `)
      .eq('id', testId)
      .eq('campaign_id', campaignId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !test) {
      return NextResponse.json(
        { error: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: test.id,
      name: test.name,
      status: test.status,
      assetType: test.asset_type,
      startDate: test.start_date,
      endDate: test.end_date,
      winnerVariantId: test.winner_variant_id,
      confidenceLevel: test.confidence_level,
      minimumSampleSize: test.minimum_sample_size,
      currentSampleSize: test.ab_test_variants?.reduce(
        (sum: number, v: any) => sum + (v.impressions || 0), 0
      ) || 0,
      variants: (test.ab_test_variants || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        assetId: v.asset_id,
        trafficPercent: v.traffic_percent,
        impressions: v.impressions || 0,
        clicks: v.clicks || 0,
        conversions: v.conversions || 0,
        ctr: v.impressions > 0 ? Math.round((v.clicks / v.impressions) * 10000) / 100 : 0,
        conversionRate: v.clicks > 0 ? Math.round((v.conversions / v.clicks) * 10000) / 100 : 0,
        isControl: v.is_control,
        isWinner: v.id === test.winner_variant_id,
      })),
    });
  } catch (error: any) {
    console.error('Failed to fetch A/B test:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch test' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; testId: string }> }
) {
  const { id: campaignId, testId } = await params;
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);
  const body = await request.json();

  const { status, name, confidenceLevel, minimumSampleSize, variants } = body;

  try {
    // Update test
    const updateData: any = {};
    if (status) updateData.status = status;
    if (name) updateData.name = name;
    if (confidenceLevel) updateData.confidence_level = confidenceLevel;
    if (minimumSampleSize) updateData.minimum_sample_size = minimumSampleSize;

    // Handle status changes
    if (status === 'running' && !updateData.start_date) {
      updateData.start_date = new Date().toISOString();
    }
    if (status === 'completed' && !updateData.end_date) {
      updateData.end_date = new Date().toISOString();
    }

    const { data: test, error: testError } = await supabase
      .from('ab_tests')
      .update(updateData)
      .eq('id', testId)
      .eq('campaign_id', campaignId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (testError) {
      throw new Error(testError.message);
    }

    // Update variants if provided
    if (variants && Array.isArray(variants)) {
      for (const variant of variants) {
        await supabase
          .from('ab_test_variants')
          .update({
            traffic_percent: variant.trafficPercent,
            asset_id: variant.assetId,
          })
          .eq('id', variant.id)
          .eq('ab_test_id', testId);
      }
    }

    return NextResponse.json({ success: true, test });
  } catch (error: any) {
    console.error('Failed to update A/B test:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update test' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; testId: string }> }
) {
  const { id: campaignId, testId } = await params;
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);

  try {
    // Delete variants first
    await supabase
      .from('ab_test_variants')
      .delete()
      .eq('ab_test_id', testId);

    // Delete test
    const { error } = await supabase
      .from('ab_tests')
      .delete()
      .eq('id', testId)
      .eq('campaign_id', campaignId)
      .eq('workspace_id', workspaceId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete A/B test:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete test' },
      { status: 500 }
    );
  }
}
