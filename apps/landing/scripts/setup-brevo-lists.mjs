#!/usr/bin/env node
/**
 * Creates Sako newsletter and demo lists in Brevo via API.
 * Run: pnpm run setup:brevo (or node scripts/setup-brevo-lists.mjs with BREVO_API_KEY in env)
 * Outputs list IDs to add to .env.local
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const paths = ['.env.local', '.env'];
  for (const p of paths) {
    const file = resolve(process.cwd(), p);
    if (existsSync(file)) {
      const content = readFileSync(file, 'utf-8');
      for (const line of content.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) {
          const key = m[1].trim();
          const val = m[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = val;
        }
      }
      break;
    }
  }
}

loadEnv();

const API_KEY = process.env.BREVO_API_KEY;

if (!API_KEY) {
  console.error('Missing BREVO_API_KEY. Add it to .env.local or run: BREVO_API_KEY=your_key node scripts/setup-brevo-lists.mjs');
  process.exit(1);
}

const BASE = 'https://api.brevo.com/v3';

async function fetchApi(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'api-key': API_KEY,
      'Content-Type': 'application/json',
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.code || `HTTP ${res.status}`);
  }
  return data;
}

async function main() {
  console.log('Fetching Brevo folders...');
  const { folders } = await fetchApi('GET', '/contacts/folders?limit=50');
  const folderId = folders?.[0]?.id ?? 1;
  console.log(`Using folder ID: ${folderId}`);

  const lists = [
    { name: 'Sako Newsletter' },
    { name: 'Sako Demo Requests' },
    { name: 'Sako Leadfeeder Visitors' },
  ];

  const ids = {};
  for (const { name } of lists) {
    console.log(`Creating list: ${name}`);
    const created = await fetchApi('POST', '/contacts/lists', { folderId, name });
    ids[name.replace(/ /g, '_').toLowerCase()] = created.id;
    console.log(`  Created with ID: ${created.id}`);
  }

  console.log('\n--- Add these to .env.local ---\n');
  console.log(`BREVO_NEWSLETTER_LIST_ID=${ids.sako_newsletter}`);
  console.log(`BREVO_DEMO_LIST_ID=${ids.sako_demo_requests}`);
  console.log(`BREVO_LEADFEEDER_LIST_ID=${ids.sako_leadfeeder_visitors}`);
  console.log('\n--- End ---\n');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
