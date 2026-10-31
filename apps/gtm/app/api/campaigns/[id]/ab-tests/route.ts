/**
 * A/B Tests API (Jan 2026)
 * 
 * GET /api/campaigns/[id]/ab-tests - List all tests for a campaign
 * POST /api/campaigns/[id]/ab-tests - Create a new A/B test
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getWorkspaceIdWithFallback } from '@/lib/workspace';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);

  try {
    const { data: tests, error } = await supabase
      .from('ab_tests')
      .select(`
        *,
        ab_test_variants (*)
      `)
      .eq('campaign_id', campaignId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Transform to expected format
    const formattedTests = (tests || []).map((test: any) => ({
      id: test.id,
      name: test.name,
      status: test.status,
      assetType: test.asset_type,
      startDate: test.start_date,
      endDate: test.end_date,
      winnerVariantId: test.winner_variant_id,
      confidenceLevel: test.confidence_level || 95,
      minimumSampleSize: test.minimum_sample_size || 1000,
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
    }));

    return NextResponse.json({ tests: formattedTests });
  } catch (error: any) {
    console.error('Failed to fetch A/B tests:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tests' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);
  const body = await request.json();

  const { name, assetType } = body;

  if (!name || !assetType) {
    return NextResponse.json(
      { error: 'Name and assetType are required' },
      { status: 400 }
    );
  }

  try {
    // Create the test
    const { data: test, error: testError } = await supabase
      .from('ab_tests')
      .insert({
        campaign_id: campaignId,
        workspace_id: workspaceId,
        name,
        asset_type: assetType,
        status: 'draft',
        confidence_level: 95,
        minimum_sample_size: 1000,
      })
      .select()
      .single();

    if (testError) {
      throw new Error(testError.message);
    }

    // Create default variants (A and B)
    const variants = [
      { name: 'A', is_control: true, traffic_percent: 50 },
      { name: 'B', is_control: false, traffic_percent: 50 },
    ];

    const { data: createdVariants, error: variantsError } = await supabase
      .from('ab_test_variants')
      .insert(
        variants.map(v => ({
          ab_test_id: test.id,
          workspace_id: workspaceId,
          name: v.name,
          is_control: v.is_control,
          traffic_percent: v.traffic_percent,
          impressions: 0,
          clicks: 0,
          conversions: 0,
        }))
      )
      .select();

    if (variantsError) {
      throw new Error(variantsError.message);
    }

    return NextResponse.json({
      id: test.id,
      name: test.name,
      status: test.status,
      assetType: test.asset_type,
      confidenceLevel: test.confidence_level,
      minimumSampleSize: test.minimum_sample_size,
      currentSampleSize: 0,
      variants: (createdVariants || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        assetId: v.asset_id,
        trafficPercent: v.traffic_percent,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        conversionRate: 0,
        isControl: v.is_control,
      })),
    });
  } catch (error: any) {
    console.error('Failed to create A/B test:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create test' },
      { status: 500 }
    );
  }
}
