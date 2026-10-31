/**
 * Competitors API (Jan 2026)
 * 
 * GET /api/competitors - List tracked competitors
 * POST /api/competitors - Add a new competitor to track
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getWorkspaceIdWithFallback } from '@/lib/workspace';
import { isTavilyConfigured } from '@/lib/competitor/evidence';

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);

  try {
    const { data: competitors, error } = await supabase
      .from('competitors')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ competitors: competitors || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch competitors';
    console.error('Failed to fetch competitors:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);
  
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { domain, name } = body;

  if (!domain) {
    return NextResponse.json(
      { error: 'Domain is required' },
      { status: 400 }
    );
  }

  // Normalize domain
  const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

  try {
    // Check if competitor already exists
    const { data: existing } = await supabase
      .from('competitors')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('domain', normalizedDomain)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Competitor already tracked' },
        { status: 409 }
      );
    }

    // Check if Tavily is configured
    if (!isTavilyConfigured()) {
      // Create basic competitor record without AI-powered analysis
      const { data: competitor, error } = await supabase
        .from('competitors')
        .insert({
          workspace_id: workspaceId,
          domain: normalizedDomain,
          name: name || normalizedDomain.split('.')[0].charAt(0).toUpperCase() + normalizedDomain.split('.')[0].slice(1),
          description: null,
          category: null,
          metrics: {},
          reviews: { topStrengths: [], topWeaknesses: [], commonThemes: [], recentTrend: 'unknown' },
          positioning: { keyDifferentiators: [], marketPosition: 'unknown' },
          sources: [],
          metric_provenance: {},
          last_updated: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        ...competitor,
        warning: 'TAVILY_API_KEY not configured. Competitor added without AI-powered intelligence. Set TAVILY_API_KEY in .env.local for full features.',
      });
    }

    // Fetch competitor data with Tavily
    const { fetchCompetitorData: fetchData } = await import('@/lib/competitor/intelligence');
    const competitorData = await fetchData(normalizedDomain);

    // Save to database (including evidence sources and provenance)
    const { data: competitor, error } = await supabase
      .from('competitors')
      .insert({
        workspace_id: workspaceId,
        domain: normalizedDomain,
        name: name || competitorData.name,
        description: competitorData.description,
        category: competitorData.category,
        metrics: competitorData.metrics,
        reviews: competitorData.reviews,
        positioning: competitorData.positioning,
        sources: competitorData.sources,
        metric_provenance: competitorData.metricProvenance,
        last_updated: competitorData.lastUpdated,
      })
      .select()
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(competitor);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add competitor';
    console.error('Failed to add competitor:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
