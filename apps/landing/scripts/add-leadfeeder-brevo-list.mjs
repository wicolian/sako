#!/usr/bin/env node
/**
 * Creates "Sako Leadfeeder Visitors" list in Brevo for the sync script.
 * Run if you already have newsletter/demo lists and need the Leadfeeder list.
 *
 * node scripts/add-leadfeeder-brevo-list.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  for (const p of ['.env.local', '.env']) {
    const file = resolve(process.cwd(), p);
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf-8').split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) {
          const k = m[1].trim();
          const v = m[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[k]) process.env[k] = v;
        }
      }
      break;
    }
  }
}
loadEnv();

const API_KEY = process.env.BREVO_API_KEY;
if (!API_KEY) {
  console.error('Missing BREVO_API_KEY');
  process.exit(1);
}

(async () => {
const res = await fetch('https://api.brevo.com/v3/contacts/folders?limit=50', {
  headers: { 'api-key': API_KEY },
});
const { folders } = await res.json().catch(() => ({}));
const folderId = folders?.[0]?.id ?? 1;

const create = await fetch('https://api.brevo.com/v3/contacts/lists', {
  method: 'POST',
  headers: { 'api-key': API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ folderId, name: 'Sako Leadfeeder Visitors' }),
});
const data = await create.json().catch(() => ({}));
if (!create.ok) {
  console.error(data?.message || create.status);
  process.exit(1);
}
console.log('Created list: Sako Leadfeeder Visitors');
console.log('Add to .env.local:');
console.log(`BREVO_LEADFEEDER_LIST_ID=${data.id}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
