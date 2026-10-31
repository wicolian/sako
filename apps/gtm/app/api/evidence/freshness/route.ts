/**
 * Evidence Freshness API (Jan 2026)
 * 
 * GET /api/evidence/freshness - Get freshness summary for workspace
 * POST /api/evidence/freshness - Run freshness check
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceIdWithFallback } from '@/lib/workspace';
import {
  checkWorkspaceEvidenceFreshness,
  getStaleEvidence,
  getBrokenLinkEvidence,
  getFreshnessCheckHistory,
} from '@/lib/health/freshness-checker';

export async function GET(request: NextRequest) {
  const workspaceId = getWorkspaceIdWithFallback(request);
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'summary';

  try {
    switch (type) {
      case 'stale':
        const staleEvidence = await getStaleEvidence(workspaceId, {
          includeExpired: searchParams.get('includeExpired') === 'true',
          limit: parseInt(searchParams.get('limit') || '100'),
        });
        return NextResponse.json({ evidence: staleEvidence });

      case 'broken':
        const brokenEvidence = await getBrokenLinkEvidence(
          workspaceId,
          parseInt(searchParams.get('limit') || '100')
        );
        return NextResponse.json({ evidence: brokenEvidence });

      case 'history':
        const history = await getFreshnessCheckHistory(
          workspaceId,
          parseInt(searchParams.get('limit') || '10')
        );
        return NextResponse.json({ history });

      case 'summary':
      default:
        // Get quick summary without running full check
        const [stale, broken, checkHistory] = await Promise.all([
          getStaleEvidence(workspaceId, { limit: 1000 }),
          getBrokenLinkEvidence(workspaceId, 1000),
          getFreshnessCheckHistory(workspaceId, 1),
        ]);

        return NextResponse.json({
          summary: {
            staleCount: stale.length,
            brokenCount: broken.length,
            lastCheck: checkHistory[0]?.created_at || null,
            lastCheckStatus: checkHistory[0]?.status || null,
          },
        });
    }
  } catch (error: any) {
    console.error('Freshness API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get freshness data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const workspaceId = getWorkspaceIdWithFallback(request);
  const body = await request.json().catch(() => ({}));
  const { campaignId } = body;

  try {
    // Run full freshness check
    const result = await checkWorkspaceEvidenceFreshness(workspaceId);

    return NextResponse.json({
      success: true,
      summary: {
        totalChecked: result.totalChecked,
        validLinks: result.validLinks,
        brokenLinks: result.brokenLinks,
        redirects: result.redirects,
        timeouts: result.timeouts,
        freshEvidence: result.freshEvidence,
        staleEvidence: result.staleEvidence,
        expiredEvidence: result.expiredEvidence,
        checkDuration: result.checkDuration,
      },
      // Include detailed results if requested
      results: body.includeDetails ? result.results : undefined,
    });
  } catch (error: any) {
    console.error('Freshness check failed:', error);
    return NextResponse.json(
      { error: error.message || 'Freshness check failed' },
      { status: 500 }
    );
  }
}
