/**
 * k6 Load Test for Sako API
 * 
 * Purpose: Test API under sustained load to find breaking points
 * Run: k6 run tests/load/k6-load.js
 * 
 * Environment variables:
 * - API_URL: Base URL of the API (default: http://localhost:3001)
 * - AUTH_TOKEN: Bearer token for authenticated requests
 * - WORKSPACE_ID: Workspace ID for testing (required for workspace endpoints)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';

const API_URL = __ENV.API_URL || 'http://localhost:3001';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';
const WORKSPACE_ID = __ENV.WORKSPACE_ID || '';

const headers = AUTH_TOKEN ? {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
  'X-Workspace-Id': WORKSPACE_ID,
} : {
  'Content-Type': 'application/json',
};

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 10 },   // Stay at 10 users
    { duration: '2m', target: 25 },   // Ramp up to 25 users
    { duration: '5m', target: 25 },   // Stay at 25 users
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    'group_duration{group:::Health Check}': ['avg<200'],
    'group_duration{group:::Authenticated Endpoints}': ['avg<500'],
  },
};

export default function () {
  group('Health Check', () => {
    const res = http.get(`${API_URL}/api/v1/health`);
    check(res, {
      'health status 200': (r) => r.status === 200,
    });
  });

  if (AUTH_TOKEN && WORKSPACE_ID) {
    group('Authenticated Endpoints', () => {
      // Get workspace details
      const workspaceRes = http.get(
        `${API_URL}/api/v1/workspace/me`,
        { headers }
      );
      check(workspaceRes, {
        'workspace me status 200': (r) => r.status === 200,
      });

      // List tasks
      const tasksRes = http.get(
        `${API_URL}/api/v1/tasks`,
        { headers }
      );
      check(tasksRes, {
        'tasks list status 200': (r) => r.status === 200,
      });

      // List brands
      const brandsRes = http.get(
        `${API_URL}/api/v1/brands`,
        { headers }
      );
      check(brandsRes, {
        'brands list status 200': (r) => r.status === 200,
      });
    });
  }

  sleep(1);
}

