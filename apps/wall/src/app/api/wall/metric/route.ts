import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { METRIC_CONTRACT } from '@/config/metrics';
import type { ChartDataPoint, BreakdownItem } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    const segment = searchParams.get('segment') || 'all';
    const range = searchParams.get('range') || '14d';

    if (!key) {
      return NextResponse.json({ error: 'Missing metric key' }, { status: 400 });
    }

    const metric = METRIC_CONTRACT[key];
    if (!metric) {
      return NextResponse.json({ error: 'Unknown metric' }, { status: 404 });
    }

    // Calculate date range
    const days = parseInt(range.replace('d', ''), 10) || 14;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Fetch snapshots for history
    const snapshots = await db.wallSnapshot.findMany({
      where: {
        metricKey: key,
        segment,
        ts: { gte: startDate },
      },
      orderBy: { ts: 'asc' },
      take: days * 4, // Up to 4 snapshots per day (every 15 min limited)
    });

    // Convert to chart data points
    const history: ChartDataPoint[] = snapshots.map((s) => ({
      date: s.ts.toISOString().split('T')[0],
      value: s.valueNumeric || 0,
    }));

    // If no snapshots, return empty history
    if (history.length === 0) {
      // Generate placeholder data for the requested range
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        history.push({
          date: date.toISOString().split('T')[0],
          value: 0,
        });
      }
    }

    // Generate breakdown (this would be source-specific in production)
    const breakdown: BreakdownItem[] = generateBreakdown(key, segment);

    return NextResponse.json({
      metric: {
        key,
        label: metric.label,
        source: metric.source,
      },
      history,
      breakdown,
    });
  } catch (error) {
    console.error('Metric API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metric details' },
      { status: 500 }
    );
  }
}

function generateBreakdown(key: string, segment: string): BreakdownItem[] {
  // This would be implemented per-metric based on source capabilities
  // For now, return mock breakdown
  switch (key) {
    case 'revenue-today':
    case 'revenue-mtd':
      return [
        { id: '1', source: 'Subscriptions', value: '65%', share: 65 },
        { id: '2', source: 'One-time', value: '25%', share: 25 },
        { id: '3', source: 'Add-ons', value: '10%', share: 10 },
      ];
    case 'visits':
      return [
        { id: '1', source: 'Direct', value: '42%', share: 42 },
        { id: '2', source: 'Organic', value: '33%', share: 33 },
        { id: '3', source: 'Paid', value: '15%', share: 15 },
        { id: '4', source: 'Referral', value: '10%', share: 10 },
      ];
    case 'signups':
      return [
        { id: '1', source: 'Website', value: '60%', share: 60 },
        { id: '2', source: 'App', value: '25%', share: 25 },
        { id: '3', source: 'API', value: '15%', share: 15 },
      ];
    default:
      return [
        { id: '1', source: 'Primary', value: '70%', share: 70 },
        { id: '2', source: 'Secondary', value: '30%', share: 30 },
      ];
  }
}
