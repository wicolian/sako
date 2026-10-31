/**
 * Evidence Freshness Checker (Jan 2026)
 * 
 * Validates import { Database } from '@/lib/supabase/types'

type EvidenceRow = Database['public']['Tables']['evidence']['Row']
type MessageEvidenceRow = Database['public']['Tables']['message_evidence']['Row']
evidence links and tracks age/currency of evidence.
 * Runs as a background job or on-demand.
 */

import { createServiceClient } from '@/lib/supabase/service';

// Freshness thresholds in days
const FRESHNESS_THRESHOLDS = {
  fresh: 30,
  stale: 90,
  expired: 180,
};

// Link check timeout in ms
const LINK_CHECK_TIMEOUT = 10000;

export interface EvidenceFreshnessResult {
  evidenceId: string;
  url?: string;
  linkStatus: 'valid' | 'broken' | 'redirect' | 'timeout' | 'unknown';
  httpStatus?: number;
  redirectUrl?: string;
  ageInDays: number;
  freshnessStatus: 'fresh' | 'stale' | 'expired';
  lastChecked: string;
  contentChanged?: boolean;
  contentHash?: string;
}

export interface FreshnessCheckSummary {
  totalChecked: number;
  validLinks: number;
  brokenLinks: number;
  redirects: number;
  timeouts: number;
  freshEvidence: number;
  staleEvidence: number;
  expiredEvidence: number;
  results: EvidenceFreshnessResult[];
  checkDuration: number;
}

/**
 * Check freshness of all evidence for a workspace
 */
export async function checkWorkspaceEvidenceFreshness(
  workspaceId: string
): Promise<FreshnessCheckSummary> {
  const startTime = Date.now();
  const supabase = createServiceClient();
  
  // Fetch all evidence with URLs
  const { data: evidenceList, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('workspace_id', workspaceId)
    .not('url', 'is', null);
  
  if (error || !evidenceList) {
    throw new Error(`Failed to fetch evidence: ${error?.message}`);
  }
  
  // Check each evidence item
  const results: EvidenceFreshnessResult[] = [];
  const batchSize = 10; // Concurrent checks
  
  for (let i = 0; i < evidenceList.length; i += batchSize) {
    const batch = evidenceList.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((ev) => checkSingleEvidence(ev))
    );
    results.push(...batchResults);
    
    // Update database with results
    await updateEvidenceRecords(supabase, batchResults);
  }
  
  // Calculate summary
  const summary: FreshnessCheckSummary = {
    totalChecked: results.length,
    validLinks: results.filter(r => r.linkStatus === 'valid').length,
    brokenLinks: results.filter(r => r.linkStatus === 'broken').length,
    redirects: results.filter(r => r.linkStatus === 'redirect').length,
    timeouts: results.filter(r => r.linkStatus === 'timeout').length,
    freshEvidence: results.filter(r => r.freshnessStatus === 'fresh').length,
    staleEvidence: results.filter(r => r.freshnessStatus === 'stale').length,
    expiredEvidence: results.filter(r => r.freshnessStatus === 'expired').length,
    results,
    checkDuration: Date.now() - startTime,
  };
  
  return summary;
}

/**
 * Check freshness of evidence for a specific campaign
 */
export async function checkCampaignEvidenceFreshness(
  campaignId: string,
  workspaceId: string
): Promise<FreshnessCheckSummary> {
  const startTime = Date.now();
  const supabase = createServiceClient();
  
  // Fetch evidence linked to campaign claims
  const { data: linkedEvidence, error } = await supabase
    .from('message_evidence')
    .select(`
      evidence:evidence_id (
        id,
        url,
        created_at,
        last_validated,
        link_status,
        content_hash
      )
    `)
    .eq('workspace_id', workspaceId);
  
  if (error) {
    throw new Error(`Failed to fetch campaign evidence: ${error.message}`);
  }
  
  // Extract unique evidence items
  const evidenceMap = new Map<string, any>();
  for (const item of linkedEvidence || []) {
    // Cast to handle Supabase's nested relation structure
    const evidence = (item as any).evidence;
    if (evidence && !evidenceMap.has(evidence.id)) {
      evidenceMap.set(evidence.id, evidence);
    }
  }
  
  const evidenceList = Array.from(evidenceMap.values());
  
  // Check each evidence item
  const results: EvidenceFreshnessResult[] = [];
  const batchSize = 10;
  
  for (let i = 0; i < evidenceList.length; i += batchSize) {
    const batch = evidenceList.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((ev) => checkSingleEvidence(ev))
    );
    results.push(...batchResults);
    
    await updateEvidenceRecords(supabase, batchResults);
  }
  
  return {
    totalChecked: results.length,
    validLinks: results.filter(r => r.linkStatus === 'valid').length,
    brokenLinks: results.filter(r => r.linkStatus === 'broken').length,
    redirects: results.filter(r => r.linkStatus === 'redirect').length,
    timeouts: results.filter(r => r.linkStatus === 'timeout').length,
    freshEvidence: results.filter(r => r.freshnessStatus === 'fresh').length,
    staleEvidence: results.filter(r => r.freshnessStatus === 'stale').length,
    expiredEvidence: results.filter(r => r.freshnessStatus === 'expired').length,
    results,
    checkDuration: Date.now() - startTime,
  };
}

/**
 * Check a single evidence item
 */
async function checkSingleEvidence(evidence: any): Promise<EvidenceFreshnessResult> {
  const now = new Date();
  const createdAt = new Date(evidence.created_at);
  const ageInDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  
  // Determine freshness status
  let freshnessStatus: 'fresh' | 'stale' | 'expired';
  if (ageInDays <= FRESHNESS_THRESHOLDS.fresh) {
    freshnessStatus = 'fresh';
  } else if (ageInDays <= FRESHNESS_THRESHOLDS.stale) {
    freshnessStatus = 'stale';
  } else {
    freshnessStatus = 'expired';
  }
  
  // Check link if URL exists
  let linkStatus: EvidenceFreshnessResult['linkStatus'] = 'unknown';
  let httpStatus: number | undefined;
  let redirectUrl: string | undefined;
  let contentHash: string | undefined;
  let contentChanged = false;
  
  if (evidence.url) {
    try {
      const linkResult = await checkLink(evidence.url);
      linkStatus = linkResult.status;
      httpStatus = linkResult.httpStatus;
      redirectUrl = linkResult.redirectUrl;
      contentHash = linkResult.contentHash;
      
      // Check if content changed
      if (evidence.content_hash && contentHash && evidence.content_hash !== contentHash) {
        contentChanged = true;
      }
    } catch (error) {
      console.error(`Link check failed for ${evidence.url}:`, error);
      linkStatus = 'unknown';
    }
  }
  
  return {
    evidenceId: evidence.id,
    url: evidence.url,
    linkStatus,
    httpStatus,
    redirectUrl,
    ageInDays,
    freshnessStatus,
    lastChecked: now.toISOString(),
    contentChanged,
    contentHash,
  };
}

/**
 * Check if a URL is valid and accessible
 */
async function checkLink(url: string): Promise<{
  status: EvidenceFreshnessResult['linkStatus'];
  httpStatus?: number;
  redirectUrl?: string;
  contentHash?: string;
}> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to avoid downloading full content
      signal: controller.signal,
      redirect: 'manual', // Don't follow redirects automatically
      headers: {
        'User-Agent': 'Sako-Freshness-Checker/1.0',
      },
    });
    
    clearTimeout(timeoutId);
    
    // Check for redirects
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get('location') || undefined;
      return {
        status: 'redirect',
        httpStatus: response.status,
        redirectUrl,
      };
    }
    
    // Check for success
    if (response.ok) {
      // For content hash, we'd need to do a GET request
      // This is a simplified version
      return {
        status: 'valid',
        httpStatus: response.status,
      };
    }
    
    // Check for client/server errors
    if (response.status >= 400) {
      return {
        status: 'broken',
        httpStatus: response.status,
      };
    }
    
    return {
      status: 'unknown',
      httpStatus: response.status,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      return { status: 'timeout' };
    }
    
    return { status: 'broken' };
  }
}

/**
 * Update evidence records with freshness check results
 */
async function updateEvidenceRecords(
  supabase: ReturnType<typeof createServiceClient>,
  results: EvidenceFreshnessResult[]
): Promise<void> {
  for (const result of results) {
    await supabase
      .from('evidence')
      .update({
        link_status: result.linkStatus,
        last_validated: result.lastChecked,
        content_hash: result.contentHash,
        freshness_status: result.freshnessStatus,
        age_days: result.ageInDays,
      })
      .eq('id', result.evidenceId);
  }
}

/**
 * Get evidence that needs refreshing
 */
export async function getStaleEvidence(
  workspaceId: string,
  options: {
    includeExpired?: boolean;
    limit?: number;
  } = {}
): Promise<any[]> {
  const supabase = createServiceClient();
  const { includeExpired = true, limit = 100 } = options;
  
  const statuses = includeExpired ? ['stale', 'expired'] : ['stale'];
  
  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('freshness_status', statuses)
    .order('age_days', { ascending: false })
    .limit(limit);
  
  if (error) {
    throw new Error(`Failed to fetch stale evidence: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Get evidence with broken links
 */
export async function getBrokenLinkEvidence(
  workspaceId: string,
  limit = 100
): Promise<any[]> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('evidence')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('link_status', 'broken')
    .order('last_validated', { ascending: true })
    .limit(limit);
  
  if (error) {
    throw new Error(`Failed to fetch broken link evidence: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Schedule freshness check for a workspace (for cron jobs)
 */
export async function scheduleFreshnessCheck(
  workspaceId: string
): Promise<{ jobId: string; scheduledAt: string }> {
  const supabase = createServiceClient();
  
  // Create a job record
  const { data, error } = await supabase
    .from('freshness_check_jobs')
    .insert({
      workspace_id: workspaceId,
      status: 'pending',
      scheduled_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  
  if (error) {
    throw new Error(`Failed to schedule freshness check: ${error.message}`);
  }
  
  return {
    jobId: data.id,
    scheduledAt: data.scheduled_at,
  };
}

/**
 * Get freshness check history for a workspace
 */
export async function getFreshnessCheckHistory(
  workspaceId: string,
  limit = 10
): Promise<any[]> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from('freshness_check_jobs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    throw new Error(`Failed to fetch freshness check history: ${error.message}`);
  }
  
  return data || [];
}
