/**
 * Battle Card API (Jan 2026)
 * 
 * GET /api/competitors/[id]/battle-card - Get or generate battle card
 * POST /api/competitors/[id]/battle-card - Regenerate battle card
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getWorkspaceIdWithFallback } from '@/lib/workspace';
import { generateBattleCard, CompetitorProfile } from '@/lib/competitor/intelligence';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: competitorId } = await params;
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);

  try {
    // Get competitor
    const { data: competitor, error: compError } = await supabase
      .from('competitors')
      .select('*')
      .eq('id', competitorId)
      .eq('workspace_id', workspaceId)
      .single();

    if (compError || !competitor) {
      return NextResponse.json(
        { error: 'Competitor not found' },
        { status: 404 }
      );
    }

    // Check for existing battle card
    const { data: existingCard } = await supabase
      .from('battle_cards')
      .select('*')
      .eq('competitor_id', competitorId)
      .eq('workspace_id', workspaceId)
      .single();

    if (existingCard) {
      return NextResponse.json(existingCard);
    }

    // Generate new battle card
    const competitorProfile: CompetitorProfile = {
      id: competitor.id,
      name: competitor.name,
      domain: competitor.domain,
      description: competitor.description,
      category: competitor.category,
      metrics: competitor.metrics || {},
      reviews: competitor.reviews || {
        overallSentiment: undefined,
        topStrengths: [],
        topWeaknesses: [],
        commonThemes: [],
        recentTrend: 'unknown',
      },
      positioning: competitor.positioning || {
        keyDifferentiators: [],
        marketPosition: 'unknown',
      },
      lastUpdated: competitor.last_updated,
      sources: competitor.sources || [],
      metricProvenance: competitor.metric_provenance || {},
    };

    // Get our product info from workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, settings')
      .eq('id', workspaceId)
      .single();

    const ourProduct = {
      name: workspace?.name || 'Our Product',
      strengths: workspace?.settings?.strengths || [
        'AI-native compliance',
        'Automated evidence linking',
        'Multi-asset generation',
      ],
      valueProps: workspace?.settings?.valueProps || [
        'Reduce compliance risk',
        'Save time on campaign creation',
        'Ensure marketing claims are defensible',
      ],
    };

    const battleCard = await generateBattleCard(competitorProfile, ourProduct);

    // Save battle card
    const { data: savedCard, error: saveError } = await supabase
      .from('battle_cards')
      .insert({
        competitor_id: competitorId,
        workspace_id: workspaceId,
        competitor_name: battleCard.competitorName,
        our_strengths: battleCard.ourStrengths,
        their_strengths: battleCard.theirStrengths,
        our_weaknesses: battleCard.ourWeaknesses,
        their_weaknesses: battleCard.theirWeaknesses,
        winning_talking_points: battleCard.winningTalkingPoints,
        objections_and_responses: battleCard.objectionsAndResponses,
        ideal_customer_profile: battleCard.idealCustomerProfile,
        generated_at: battleCard.generatedAt,
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save battle card:', saveError);
    }

    return NextResponse.json(savedCard || battleCard);
  } catch (error: any) {
    console.error('Failed to get battle card:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get battle card' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: competitorId } = await params;
  const supabase = createServiceClient();
  const workspaceId = getWorkspaceIdWithFallback(request);

  try {
    // Delete existing battle card
    await supabase
      .from('battle_cards')
      .delete()
      .eq('competitor_id', competitorId)
      .eq('workspace_id', workspaceId);

    // Get competitor
    const { data: competitor, error: compError } = await supabase
      .from('competitors')
      .select('*')
      .eq('id', competitorId)
      .eq('workspace_id', workspaceId)
      .single();

    if (compError || !competitor) {
      return NextResponse.json(
        { error: 'Competitor not found' },
        { status: 404 }
      );
    }

    // Generate new battle card
    const competitorProfile: CompetitorProfile = {
      id: competitor.id,
      name: competitor.name,
      domain: competitor.domain,
      description: competitor.description,
      category: competitor.category,
      metrics: competitor.metrics || {},
      reviews: competitor.reviews || {
        overallSentiment: undefined,
        topStrengths: [],
        topWeaknesses: [],
        commonThemes: [],
        recentTrend: 'unknown',
      },
      positioning: competitor.positioning || {
        keyDifferentiators: [],
        marketPosition: 'unknown',
      },
      lastUpdated: competitor.last_updated,
      sources: competitor.sources || [],
      metricProvenance: competitor.metric_provenance || {},
    };

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, settings')
      .eq('id', workspaceId)
      .single();

    const ourProduct = {
      name: workspace?.name || 'Our Product',
      strengths: workspace?.settings?.strengths || [],
      valueProps: workspace?.settings?.valueProps || [],
    };

    const battleCard = await generateBattleCard(competitorProfile, ourProduct);

    // Save new battle card
    const { data: savedCard } = await supabase
      .from('battle_cards')
      .insert({
        competitor_id: competitorId,
        workspace_id: workspaceId,
        competitor_name: battleCard.competitorName,
        our_strengths: battleCard.ourStrengths,
        their_strengths: battleCard.theirStrengths,
        our_weaknesses: battleCard.ourWeaknesses,
        their_weaknesses: battleCard.theirWeaknesses,
        winning_talking_points: battleCard.winningTalkingPoints,
        objections_and_responses: battleCard.objectionsAndResponses,
        ideal_customer_profile: battleCard.idealCustomerProfile,
        generated_at: battleCard.generatedAt,
      })
      .select()
      .single();

    return NextResponse.json(savedCard || battleCard);
  } catch (error: any) {
    console.error('Failed to regenerate battle card:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to regenerate battle card' },
      { status: 500 }
    );
  }
}
