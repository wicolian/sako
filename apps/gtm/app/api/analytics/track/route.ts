/**
 * Analytics Tracking API (Jan 2026)
 * 
 * POST /api/analytics/track - Receive tracking events from tracking.js
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

// CORS headers for cross-origin tracking
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  try {
    const body = await request.json();
    const { events } = body;

    if (!events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: 'Invalid events array' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate and transform events
    const validEvents = events
      .filter((event: any) => {
        return event.workspaceId && event.eventType;
      })
      .map((event: any) => ({
        workspace_id: event.workspaceId,
        event_type: event.eventType,
        campaign_id: event.campaignId || null,
        asset_id: event.assetId || null,
        claim_id: event.claimId || null,
        session_id: event.sessionId || null,
        url: event.url || null,
        referrer: event.referrer || null,
        metadata: {
          action: event.action,
          elementTag: event.elementTag,
          elementText: event.elementText,
          viewportPosition: event.viewportPosition,
          conversionType: event.conversionType,
          formId: event.formId,
          formAction: event.formAction,
          ...event.metadata,
        },
        value: event.value || 1,
        created_at: event.timestamp || new Date().toISOString(),
      }));

    if (validEvents.length === 0) {
      return NextResponse.json(
        { error: 'No valid events' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Batch insert events
    const { error } = await supabase
      .from('analytics_events')
      .insert(validEvents);

    if (error) {
      console.error('Failed to insert analytics events:', error);
      return NextResponse.json(
        { error: 'Failed to record events' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Update aggregates asynchronously (fire and forget)
    updateAggregates(supabase, validEvents).catch(console.error);

    return NextResponse.json(
      { success: true, recorded: validEvents.length },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Analytics track error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Update aggregated metrics (runs asynchronously)
 */
async function updateAggregates(
  supabase: ReturnType<typeof createServiceClient>,
  events: any[]
): Promise<void> {
  // Group events by workspace and campaign
  const aggregates = new Map<string, {
    impressions: number;
    clicks: number;
    conversions: number;
    claimViews: number;
  }>();

  for (const event of events) {
    const key = `${event.workspace_id}:${event.campaign_id || 'none'}`;
    
    if (!aggregates.has(key)) {
      aggregates.set(key, {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        claimViews: 0,
      });
    }

    const agg = aggregates.get(key)!;
    
    switch (event.event_type) {
      case 'impression':
        agg.impressions++;
        break;
      case 'click':
        agg.clicks++;
        break;
      case 'conversion':
        agg.conversions++;
        break;
      case 'claim_view':
        agg.claimViews++;
        break;
    }
  }

  // Update daily aggregates
  const today = new Date().toISOString().split('T')[0];

  for (const [key, metrics] of aggregates) {
    const [workspaceId, campaignId] = key.split(':');

    try {
      await supabase.rpc('upsert_daily_analytics', {
        p_workspace_id: workspaceId,
        p_campaign_id: campaignId === 'none' ? null : campaignId,
        p_date: today,
        p_impressions: metrics.impressions,
        p_clicks: metrics.clicks,
        p_conversions: metrics.conversions,
        p_claim_views: metrics.claimViews,
      });
    } catch {
      // RPC might not exist yet, that's okay
    }
  }
}
