/**
 * A/B Test Winner API (Jan 2026)
 * 
 * POST /api/campaigns/[id]/ab-tests/[testId]/winner - Declare a winner
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getWorkspaceIdWithFallback } from '@/lib/workspace';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; testId: string }> }
) {
  const { id: campaignId, testId } = await params;
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);
  const body = await request.json();

  const { variantId } = body;

  if (!variantId) {
    return NextResponse.json(
      { error: 'variantId is required' },
      { status: 400 }
    );
  }

  try {
    // Verify variant belongs to this test
    const { data: variant, error: variantError } = await supabase
      .from('ab_test_variants')
      .select('*')
      .eq('id', variantId)
      .eq('ab_test_id', testId)
      .single();

    if (variantError || !variant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      );
    }

    // Update test with winner
    const { data: test, error: testError } = await supabase
      .from('ab_tests')
      .update({
        status: 'completed',
        winner_variant_id: variantId,
        end_date: new Date().toISOString(),
      })
      .eq('id', testId)
      .eq('campaign_id', campaignId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (testError) {
      throw new Error(testError.message);
    }

    // Optionally: Apply winning variant to campaign
    // This would update the campaign's primary asset with the winning variant
    if (variant.asset_id) {
      await supabase
        .from('campaign_assets')
        .update({
          is_primary: true,
          ab_test_winner: true,
        })
        .eq('id', variant.asset_id);
    }

    return NextResponse.json({
      success: true,
      test: {
        id: test.id,
        status: test.status,
        winnerVariantId: test.winner_variant_id,
        endDate: test.end_date,
      },
      winner: {
        id: variant.id,
        name: variant.name,
        assetId: variant.asset_id,
      },
    });
  } catch (error: any) {
    console.error('Failed to declare winner:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to declare winner' },
      { status: 500 }
    );
  }
}
