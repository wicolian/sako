/**
 * Analytics API (Jan 2026)
 * 
 * GET /api/analytics - Get performance analytics for workspace
 * POST /api/analytics - Record analytics event
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspaceId = membership.workspace_id;
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId');
    const assetId = searchParams.get('assetId');
    const period = searchParams.get('period') || '30d';
    const metric = searchParams.get('metric') || 'all';

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Build query
    let query = supabase
      .from('analytics_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    if (assetId) {
      query = query.eq('asset_id', assetId);
    }

    const { data: events, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Aggregate metrics
    const metrics = aggregateMetrics(events || [], period);

    // Get claim-level analytics if requested
    let claimAnalytics = null;
    if (metric === 'all' || metric === 'claims') {
      claimAnalytics = await getClaimAnalytics(supabase, workspaceId, campaignId, startDate);
    }

    // Get asset-level analytics
    let assetAnalytics = null;
    if (metric === 'all' || metric === 'assets') {
      assetAnalytics = await getAssetAnalytics(supabase, workspaceId, campaignId, startDate);
    }

    // Get time series data
    const timeSeries = generateTimeSeries(events || [], period);

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      metrics,
      claimAnalytics,
      assetAnalytics,
      timeSeries,
    });
  } catch (error: any) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const workspaceId = membership.workspace_id;
    const body = await request.json();
    const {
      eventType,
      campaignId,
      assetId,
      claimId,
      metadata,
      value,
    } = body;

    if (!eventType) {
      return NextResponse.json(
        { error: 'eventType is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('analytics_events')
      .insert({
        workspace_id: workspaceId,
        event_type: eventType,
        campaign_id: campaignId,
        asset_id: assetId,
        claim_id: claimId,
        metadata,
        value: value || 1,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Failed to record analytics event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record event' },
      { status: 500 }
    );
  }
}

// Helper functions

function aggregateMetrics(events: any[], period: string) {
  const impressions = events.filter(e => e.event_type === 'impression').length;
  const clicks = events.filter(e => e.event_type === 'click').length;
  const conversions = events.filter(e => e.event_type === 'conversion').length;
  const claimViews = events.filter(e => e.event_type === 'claim_view').length;
  
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
  
  // Calculate revenue if available
  const revenue = events
    .filter(e => e.event_type === 'conversion' && e.value)
    .reduce((sum, e) => sum + (e.value || 0), 0);

  return {
    impressions,
    clicks,
    conversions,
    claimViews,
    ctr: Math.round(ctr * 100) / 100,
    conversionRate: Math.round(conversionRate * 100) / 100,
    revenue,
    totalEvents: events.length,
  };
}

async function getClaimAnalytics(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  workspaceId: string,
  campaignId: string | null,
  startDate: Date
) {
  let query = supabase
    .from('analytics_events')
    .select(`
      claim_id,
      event_type,
      value
    `)
    .eq('workspace_id', workspaceId)
    .not('claim_id', 'is', null)
    .gte('created_at', startDate.toISOString());

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data: claimEvents } = await query;

  if (!claimEvents || claimEvents.length === 0) {
    return [];
  }

  // Type the events
  type ClaimEvent = { claim_id: string; event_type: string; value: number | null };
  const typedEvents = claimEvents as ClaimEvent[];

  // Aggregate by claim
  const claimMap = new Map<string, {
    impressions: number;
    clicks: number;
    conversions: number;
  }>();

  for (const event of typedEvents) {
    if (!claimMap.has(event.claim_id)) {
      claimMap.set(event.claim_id, {
        impressions: 0,
        clicks: 0,
        conversions: 0,
      });
    }

    const claim = claimMap.get(event.claim_id)!;
    switch (event.event_type) {
      case 'impression':
      case 'claim_view':
        claim.impressions++;
        break;
      case 'click':
        claim.clicks++;
        break;
      case 'conversion':
        claim.conversions++;
        break;
    }
  }

  // Fetch claim details
  const claimIds = Array.from(claimMap.keys());
  const { data: claims } = await supabase
    .from('claims')
    .select('id, text, status')
    .in('id', claimIds);

  return Array.from(claimMap.entries()).map(([claimId, metrics]) => {
    const claim = claims?.find((c: { id: string }) => c.id === claimId);
    const ctr = metrics.impressions > 0 
      ? (metrics.clicks / metrics.impressions) * 100 
      : 0;

    return {
      claimId,
      text: claim?.text || 'Unknown claim',
      status: claim?.status || 'unknown',
      ...metrics,
      ctr: Math.round(ctr * 100) / 100,
    };
  }).sort((a, b) => b.impressions - a.impressions);
}

async function getAssetAnalytics(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  workspaceId: string,
  campaignId: string | null,
  startDate: Date
) {
  let query = supabase
    .from('analytics_events')
    .select(`
      asset_id,
      event_type,
      value
    `)
    .eq('workspace_id', workspaceId)
    .not('asset_id', 'is', null)
    .gte('created_at', startDate.toISOString());

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data: assetEvents } = await query;

  if (!assetEvents || assetEvents.length === 0) {
    return [];
  }

  // Type the events
  type AssetEvent = { asset_id: string; event_type: string; value: number | null };
  const typedAssetEvents = assetEvents as AssetEvent[];

  // Aggregate by asset
  const assetMap = new Map<string, {
    impressions: number;
    clicks: number;
    conversions: number;
  }>();

  for (const event of typedAssetEvents) {
    if (!assetMap.has(event.asset_id)) {
      assetMap.set(event.asset_id, {
        impressions: 0,
        clicks: 0,
        conversions: 0,
      });
    }

    const asset = assetMap.get(event.asset_id)!;
    switch (event.event_type) {
      case 'impression':
        asset.impressions++;
        break;
      case 'click':
        asset.clicks++;
        break;
      case 'conversion':
        asset.conversions++;
        break;
    }
  }

  // Fetch asset details
  const assetIds = Array.from(assetMap.keys());
  const { data: assets } = await supabase
    .from('campaign_assets')
    .select('id, asset_type, format')
    .in('id', assetIds);

  return Array.from(assetMap.entries()).map(([assetId, metrics]) => {
    const asset = assets?.find((a: { id: string; asset_type?: string; format?: string }) => a.id === assetId);
    const ctr = metrics.impressions > 0 
      ? (metrics.clicks / metrics.impressions) * 100 
      : 0;

    return {
      assetId,
      type: asset?.asset_type || 'unknown',
      format: asset?.format || 'unknown',
      ...metrics,
      ctr: Math.round(ctr * 100) / 100,
    };
  }).sort((a, b) => b.impressions - a.impressions);
}

function generateTimeSeries(events: any[], period: string) {
  const now = new Date();
  const dataPoints: { date: string; impressions: number; clicks: number; conversions: number }[] = [];
  
  // Determine granularity based on period
  let days: number;
  switch (period) {
    case '7d':
      days = 7;
      break;
    case '30d':
      days = 30;
      break;
    case '90d':
      days = 90;
      break;
    default:
      days = 30;
  }

  // Create buckets for each day
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayEvents = events.filter(e => {
      const eventDate = new Date(e.created_at).toISOString().split('T')[0];
      return eventDate === dateStr;
    });

    dataPoints.push({
      date: dateStr,
      impressions: dayEvents.filter(e => e.event_type === 'impression').length,
      clicks: dayEvents.filter(e => e.event_type === 'click').length,
      conversions: dayEvents.filter(e => e.event_type === 'conversion').length,
    });
  }

  return dataPoints;
}
