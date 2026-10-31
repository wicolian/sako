import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchAllMetrics } from '@/lib/aggregator';
import { cleanupExpiredSessions } from '@/lib/auth';
import { clearExpiredCache } from '@/lib/cache';
import { METRIC_CONTRACT, SEGMENTS } from '@/config/metrics';

// This endpoint is protected by CRON_SECRET in middleware.ts

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();

    // Check idempotency - don't run if snapshot exists in current 15-min window
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);

    const existingSnapshot = await db.wallSnapshot.findFirst({
      where: {
        ts: { gte: windowStart },
      },
    });

    if (existingSnapshot) {
      return NextResponse.json({
        success: true,
        message: 'Snapshot already exists for this window',
        window: windowStart.toISOString(),
        skipped: true,
      });
    }

    // Collect metrics for each segment
    const segments = ['all']; // Can expand to more segments later
    let snapshotsCreated = 0;

    for (const segment of segments) {
      try {
        const metrics = await fetchAllMetrics(segment, false);

        // Create snapshots for each metric
        for (const tile of metrics.tiles) {
          const metricDef = METRIC_CONTRACT[tile.key];
          if (!metricDef) continue;

          await db.wallSnapshot.create({
            data: {
              metricKey: tile.key,
              segment,
              ts: now,
              valueNumeric: tile.value,
              valueJson: {
                value: tile.value,
                formattedValue: tile.formattedValue,
                delta: tile.delta,
                deltaIsPositive: tile.deltaIsPositive,
              },
              source: metricDef.source,
            },
          });

          snapshotsCreated++;
        }
      } catch (error) {
        console.error(`Snapshot collection failed for segment ${segment}:`, error);
      }
    }

    // Cleanup: delete snapshots older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deletedSnapshots = await db.wallSnapshot.deleteMany({
      where: {
        ts: { lt: thirtyDaysAgo },
      },
    });

    // Cleanup: expired sessions
    const expiredSessions = await cleanupExpiredSessions();

    // Cleanup: expired cache entries
    const expiredCache = await clearExpiredCache();

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      window: windowStart.toISOString(),
      snapshotsCreated,
      cleanup: {
        deletedSnapshots: deletedSnapshots.count,
        expiredSessions,
        expiredCache,
      },
      durationMs: duration,
    });
  } catch (error) {
    console.error('Snapshot run error:', error);
    return NextResponse.json(
      { error: 'Snapshot collection failed', details: String(error) },
      { status: 500 }
    );
  }
}
