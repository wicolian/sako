/**
 * Competitor Tracker (Jan 2026)
 * 
 * Track public metrics for competitors using G2, Capterra,
 * LinkedIn, and other public data sources. NO content scraping.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

export interface Competitor {
  id: string;
  workspaceId: string;
  domain: string;
  name: string;
  metrics: CompetitorMetrics;
  lastUpdated: Date;
  createdAt: Date;
}

export interface CompetitorMetrics {
  g2Rating?: number;
  g2Reviews?: number;
  g2Url?: string;
  capterraRating?: number;
  capterraReviews?: number;
  capterraUrl?: string;
  trustRadiusRating?: number;
  linkedinFollowers?: number;
  linkedinEmployees?: number;
  linkedinUrl?: string;
  fundingTotal?: number;
  fundingStage?: string;
  employeeCount?: { min: number; max: number };
  trafficEstimate?: number;
  trafficTrend?: 'up' | 'down' | 'stable';
}

export interface MetricSource {
  name: string;
  fetchFn: (domain: string, name: string) => Promise<Partial<CompetitorMetrics>>;
}

/**
 * Add a competitor to track
 */
export async function trackCompetitor(
  workspaceId: string,
  domain: string
): Promise<Competitor> {
  const supabase = await createServerSupabaseClient();
  
  // Normalize domain
  const normalizedDomain = normalizeDomain(domain);
  
  // Check if already tracking
  const { data: existing } = await supabase
    .from('competitors')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('domain', normalizedDomain)
    .single();
  
  if (existing) {
    return formatCompetitor(existing);
  }
  
  // Try to get company name from domain
  const companyName = await guessCompanyName(normalizedDomain);
  
  // Fetch initial metrics
  const metrics = await fetchAllMetrics(normalizedDomain, companyName);
  
  // Save to database
  const competitor: Competitor = {
    id: uuidv4(),
    workspaceId,
    domain: normalizedDomain,
    name: companyName,
    metrics,
    lastUpdated: new Date(),
    createdAt: new Date(),
  };
  
  const { error } = await supabase
    .from('competitors')
    .insert({
      id: competitor.id,
      workspace_id: workspaceId,
      domain: normalizedDomain,
      name: companyName,
      metrics,
      last_updated: competitor.lastUpdated.toISOString(),
      created_at: competitor.createdAt.toISOString(),
    });
  
  if (error) {
    throw new Error(`Failed to save competitor: ${error.message}`);
  }
  
  return competitor;
}

/**
 * Get all tracked competitors
 */
export async function getCompetitors(workspaceId: string): Promise<Competitor[]> {
  const supabase = await createServerSupabaseClient();
  
  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch competitors: ${error.message}`);
  }
  
  return (data || []).map(formatCompetitor);
}

/**
 * Refresh competitor metrics
 */
export async function refreshCompetitorData(competitorId: string): Promise<Competitor> {
  const supabase = await createServerSupabaseClient();
  
  const { data: existing, error: fetchError } = await supabase
    .from('competitors')
    .select('*')
    .eq('id', competitorId)
    .single();
  
  if (fetchError || !existing) {
    throw new Error('Competitor not found');
  }
  
  // Fetch fresh metrics
  const metrics = await fetchAllMetrics(existing.domain, existing.name);
  
  // Update database
  const { error: updateError } = await supabase
    .from('competitors')
    .update({
      metrics,
      last_updated: new Date().toISOString(),
    })
    .eq('id', competitorId);
  
  if (updateError) {
    throw new Error(`Failed to update competitor: ${updateError.message}`);
  }
  
  return formatCompetitor({ ...existing, metrics, last_updated: new Date().toISOString() });
}

/**
 * Delete a competitor
 */
export async function deleteCompetitor(competitorId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  
  const { error } = await supabase
    .from('competitors')
    .delete()
    .eq('id', competitorId);
  
  if (error) {
    throw new Error(`Failed to delete competitor: ${error.message}`);
  }
}

/**
 * Normalize domain
 */
function normalizeDomain(domain: string): string {
  let normalized = domain.toLowerCase().trim();
  
  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '');
  
  // Remove www
  normalized = normalized.replace(/^www\./, '');
  
  // Remove path
  normalized = normalized.split('/')[0];
  
  return normalized;
}

/**
 * Guess company name from domain
 */
async function guessCompanyName(domain: string): Promise<string> {
  // Extract name from domain
  const parts = domain.split('.');
  const name = parts[0];
  
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Fetch all available metrics
 */
async function fetchAllMetrics(domain: string, name: string): Promise<CompetitorMetrics> {
  const metrics: CompetitorMetrics = {};
  
  // Fetch from each source in parallel
  const [g2, capterra, linkedin] = await Promise.all([
    fetchG2Metrics(domain, name).catch(() => ({})),
    fetchCapterraMetrics(domain, name).catch(() => ({})),
    fetchLinkedInMetrics(domain, name).catch(() => ({})),
  ]);
  
  return {
    ...metrics,
    ...g2,
    ...capterra,
    ...linkedin,
  };
}

/**
 * Fetch G2 metrics (public data)
 */
async function fetchG2Metrics(domain: string, name: string): Promise<Partial<CompetitorMetrics>> {
  // G2 API or scraping would go here
  // For now, return mock structure
  
  // In production, you would:
  // 1. Use G2's API if you have access
  // 2. Or make a request to g2.com/products/[name] and parse public data
  
  const g2Url = `https://www.g2.com/products/${name.toLowerCase().replace(/\s+/g, '-')}/reviews`;
  
  return {
    g2Url,
    // g2Rating and g2Reviews would be fetched from G2
  };
}

/**
 * Fetch Capterra metrics (public data)
 */
async function fetchCapterraMetrics(domain: string, name: string): Promise<Partial<CompetitorMetrics>> {
  const capterraUrl = `https://www.capterra.com/p/${name.toLowerCase().replace(/\s+/g, '-')}`;
  
  return {
    capterraUrl,
    // capterraRating and capterraReviews would be fetched
  };
}

/**
 * Fetch LinkedIn metrics (public data)
 */
async function fetchLinkedInMetrics(domain: string, name: string): Promise<Partial<CompetitorMetrics>> {
  // LinkedIn API or public profile data
  const linkedinUrl = `https://www.linkedin.com/company/${name.toLowerCase().replace(/\s+/g, '-')}`;
  
  return {
    linkedinUrl,
    // linkedinFollowers and linkedinEmployees would be fetched
  };
}

/**
 * Format database row to Competitor type
 */
function formatCompetitor(row: Record<string, unknown>): Competitor {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    domain: row.domain as string,
    name: row.name as string,
    metrics: (row.metrics || {}) as CompetitorMetrics,
    lastUpdated: new Date(row.last_updated as string),
    createdAt: new Date(row.created_at as string),
  };
}

/**
 * Compare your metrics vs competitors
 */
export function compareMetrics(
  yourMetrics: CompetitorMetrics,
  competitors: Competitor[]
): {
  leader: { category: string; competitor: string }[];
  gaps: { category: string; yourValue: number; avgCompetitor: number }[];
  strengths: { category: string; yourValue: number; avgCompetitor: number }[];
} {
  const leader: { category: string; competitor: string }[] = [];
  const gaps: { category: string; yourValue: number; avgCompetitor: number }[] = [];
  const strengths: { category: string; yourValue: number; avgCompetitor: number }[] = [];
  
  // G2 Rating comparison
  if (yourMetrics.g2Rating) {
    const competitorRatings = competitors
      .filter(c => c.metrics.g2Rating)
      .map(c => ({ name: c.name, rating: c.metrics.g2Rating! }));
    
    if (competitorRatings.length > 0) {
      const avgRating = competitorRatings.reduce((sum, c) => sum + c.rating, 0) / competitorRatings.length;
      const maxRating = Math.max(...competitorRatings.map(c => c.rating));
      const leaderComp = competitorRatings.find(c => c.rating === maxRating);
      
      if (leaderComp && leaderComp.rating > yourMetrics.g2Rating) {
        leader.push({ category: 'G2 Rating', competitor: leaderComp.name });
      }
      
      if (yourMetrics.g2Rating < avgRating - 0.2) {
        gaps.push({ category: 'G2 Rating', yourValue: yourMetrics.g2Rating, avgCompetitor: avgRating });
      } else if (yourMetrics.g2Rating > avgRating + 0.2) {
        strengths.push({ category: 'G2 Rating', yourValue: yourMetrics.g2Rating, avgCompetitor: avgRating });
      }
    }
  }
  
  // Add more comparison categories as needed
  
  return { leader, gaps, strengths };
}
