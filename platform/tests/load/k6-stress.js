/**
 * k6 Stress Test for Sako API
 * 
 * Purpose: Find the breaking point of the system
 * Run: k6 run tests/load/k6-stress.js
 * 
 * WARNING: This test pushes the system to its limits. 
 * Only run against staging or dedicated load test environments.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const API_URL = __ENV.API_URL || 'http://localhost:3001';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp to 50
    { duration: '3m', target: 50 },   // Hold 50
    { duration: '2m', target: 100 },  // Ramp to 100
    { duration: '3m', target: 100 },  // Hold 100
    { duration: '2m', target: 200 },  // Ramp to 200
    { duration: '3m', target: 200 },  // Hold 200
    { duration: '2m', target: 300 },  // Ramp to 300 (stress point)
    { duration: '3m', target: 300 },  // Hold 300
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<3000'], // 99% under 3s even under stress
    http_req_failed: ['rate<0.10'],    // Allow up to 10% failure under stress
  },
};

export default function () {
  const res = http.get(`${API_URL}/api/v1/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(0.5);
}

