/**
 * k6 Smoke Test for Sako API
 * 
 * Purpose: Verify the API is responding and basic endpoints work
 * Run: k6 run tests/load/k6-smoke.js
 * 
 * Environment variables:
 * - API_URL: Base URL of the API (default: http://localhost:3001)
 * - AUTH_TOKEN: Bearer token for authenticated requests (optional)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const API_URL = __ENV.API_URL || 'http://localhost:3001';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% failures
  },
};

export default function () {
  // Health check
  const healthRes = http.get(`${API_URL}/api/v1/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check has ok status': (r) => JSON.parse(r.body).status === 'ok',
  });

  sleep(1);
}

