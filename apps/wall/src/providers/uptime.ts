import { UPTIME_MONITORS } from '@/config/metrics';
import { updateSourceStatus } from '@/lib/cache';

export interface UptimeResult {
  label: string;
  url: string;
  status: 'UP' | 'DOWN';
  latencyMs: number;
  statusCode?: number;
  error?: string;
}

export async function fetchUptimeMetrics(): Promise<UptimeResult[]> {
  const results: UptimeResult[] = [];
  let allHealthy = true;
  let lastError = '';

  for (const monitor of UPTIME_MONITORS) {
    const startTime = Date.now();
    try {
      const response = await fetch(monitor.url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      const latency = Date.now() - startTime;
      const isUp = response.ok;

      results.push({
        label: monitor.label,
        url: monitor.url,
        status: isUp ? 'UP' : 'DOWN',
        latencyMs: latency,
        statusCode: response.status,
      });

      if (!isUp) {
        allHealthy = false;
        lastError = `Monitor ${monitor.label} returned ${response.status}`;
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      results.push({
        label: monitor.label,
        url: monitor.url,
        status: 'DOWN',
        latencyMs: latency,
        error: errorMessage,
      });
      
      allHealthy = false;
      lastError = `Monitor ${monitor.label} failed: ${errorMessage}`;
    }
  }

  // Update overall 'ping' source status
  await updateSourceStatus('ping', allHealthy, lastError);

  return results;
}
