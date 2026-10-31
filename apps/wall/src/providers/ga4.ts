import { getPageviews as getPostHogPageviews, isPostHogConfigured } from './posthog';

interface GA4ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface GA4Config {
  propertyId: string;
  serviceAccount: GA4ServiceAccountKey;
}

/**
 * Check if GA4 is configured
 */
export function isGA4Configured(): boolean {
  return !!(process.env.GA4_PROPERTY_ID && process.env.GA4_SERVICE_ACCOUNT_JSON);
}

/**
 * Get GA4 configuration
 */
function getConfig(): GA4Config | null {
  const propertyId = process.env.GA4_PROPERTY_ID;
  const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON;

  if (!propertyId || !serviceAccountJson) {
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson) as GA4ServiceAccountKey;
    // Fix escaped newlines in private key (common issue when storing JSON in env vars)
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    return { propertyId, serviceAccount };
  } catch {
    console.error('Failed to parse GA4_SERVICE_ACCOUNT_JSON');
    return null;
  }
}

/**
 * Get access token for Google APIs using service account
 */
async function getAccessToken(serviceAccount: GA4ServiceAccountKey): Promise<string> {
  // Create JWT for service account authentication
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  // Base64url encode
  const base64url = (obj: object) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  // Sign with private key
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign
    .sign(serviceAccount.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signingInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get GA4 access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

interface GA4RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value: string }>;
    metricValues?: Array<{ value: string }>;
  }>;
}

/**
 * Run a GA4 Data API report
 */
async function runReport(
  propertyId: string,
  accessToken: string,
  request: {
    dateRanges: Array<{ startDate: string; endDate: string }>;
    metrics: Array<{ name: string }>;
    dimensions?: Array<{ name: string }>;
  }
): Promise<GA4RunReportResponse> {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GA4 report failed: ${error}`);
  }

  return response.json();
}

/**
 * Get visits (sessions) for today
 */
export async function getVisits(): Promise<number> {
  const config = getConfig();

  if (!config) {
    // Fallback to PostHog pageviews if GA4 not configured
    if (isPostHogConfigured()) {
      console.log('GA4 not configured, falling back to PostHog pageviews');
      return getPostHogPageviews();
    }
    return 0;
  }

  try {
    const accessToken = await getAccessToken(config.serviceAccount);

    const report = await runReport(config.propertyId, accessToken, {
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [{ name: 'sessions' }],
    });

    if (report.rows && report.rows.length > 0 && report.rows[0].metricValues) {
      return parseInt(report.rows[0].metricValues[0].value, 10) || 0;
    }

    return 0;
  } catch (error) {
    console.error('GA4 visits fetch failed:', error);

    // Fallback to PostHog
    if (isPostHogConfigured()) {
      console.log('GA4 failed, falling back to PostHog pageviews');
      return getPostHogPageviews();
    }

    throw error;
  }
}

/**
 * Get realtime active users
 */
export async function getActiveUsers(): Promise<number> {
  const config = getConfig();

  if (!config) {
    return 0;
  }

  try {
    const accessToken = await getAccessToken(config.serviceAccount);

    // Use realtime API
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runRealtimeReport`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          metrics: [{ name: 'activeUsers' }],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GA4 realtime report failed: ${error}`);
    }

    const report = await response.json();

    if (report.rows && report.rows.length > 0 && report.rows[0].metricValues) {
      return parseInt(report.rows[0].metricValues[0].value, 10) || 0;
    }

    return 0;
  } catch (error) {
    console.error('GA4 active users fetch failed:', error);
    return 0;
  }
}

/**
 * Get conversion rate (can be customized based on goals)
 */
export async function getConversionRate(): Promise<number> {
  const config = getConfig();

  if (!config) {
    return 0;
  }

  try {
    const accessToken = await getAccessToken(config.serviceAccount);

    const report = await runReport(config.propertyId, accessToken, {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'sessions' }, { name: 'conversions' }],
    });

    if (report.rows && report.rows.length > 0 && report.rows[0].metricValues) {
      const sessions = parseInt(report.rows[0].metricValues[0].value, 10) || 0;
      const conversions = parseInt(report.rows[0].metricValues[1].value, 10) || 0;

      if (sessions > 0) {
        return (conversions / sessions) * 100;
      }
    }

    return 0;
  } catch (error) {
    console.error('GA4 conversion rate fetch failed:', error);
    return 0;
  }
}

export interface GA4Metrics {
  visits: number;
  activeUsers: number;
  conversionRate: number;
  source: 'ga4' | 'posthog_fallback';
}

/**
 * Fetch all GA4 metrics with graceful fallback
 */
export async function fetchGA4Metrics(): Promise<GA4Metrics> {
  const isConfigured = isGA4Configured();

  if (!isConfigured) {
    // Use PostHog fallback for visits
    const visits = isPostHogConfigured() ? await getPostHogPageviews() : 0;
    return {
      visits,
      activeUsers: 0,
      conversionRate: 0,
      source: 'posthog_fallback',
    };
  }

  try {
    const [visits, activeUsers, conversionRate] = await Promise.all([
      getVisits(),
      getActiveUsers(),
      getConversionRate(),
    ]);

    return {
      visits,
      activeUsers,
      conversionRate,
      source: 'ga4',
    };
  } catch (error) {
    console.error('GA4 metrics fetch failed, using fallback:', error);

    // Fallback
    const visits = isPostHogConfigured() ? await getPostHogPageviews() : 0;
    return {
      visits,
      activeUsers: 0,
      conversionRate: 0,
      source: 'posthog_fallback',
    };
  }
}
