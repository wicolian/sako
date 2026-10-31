#!/usr/bin/env node
/**
 * Leadfeeder → Brevo sync
 *
 * Creates Brevo contacts for high-intent Leadfeeder companies.
 * Uses contact@domain.com as placeholder (Leadfeeder doesn't provide emails).
 *
 * Usage:
 *   node scripts/leadfeeder-sync-brevo.mjs              # Dry run (default)
 *   node scripts/leadfeeder-sync-brevo.mjs --sync       # Actually create Brevo contacts
 *   node scripts/leadfeeder-sync-brevo.mjs --days 14    # Last 14 days
 *   node scripts/leadfeeder-sync-brevo.mjs --min-quality 6  # Only quality >= 6
 *
 * Requires: LEADFEEDER_API_TOKEN, BREVO_API_KEY, BREVO_LEADFEEDER_LIST_ID
 * Create list "Leadfeeder Visitors" in Brevo first, or run setup:brevo then add the list.
 *
 * IMPORTANT: These contacts have placeholder emails. Do NOT add them to marketing
 * automations. Use for CRM tracking only. Filter by attribute LEADFEEDER_SYNC=true.
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

const LEADFEEDER_TOKEN = process.env.LEADFEEDER_API_TOKEN;
const BREVO_KEY = process.env.BREVO_API_KEY;
const BREVO_LIST_ID = process.env.BREVO_LEADFEEDER_LIST_ID
  ? parseInt(process.env.BREVO_LEADFEEDER_LIST_ID, 10)
  : null;

const API_BASE = 'https://api.leadfeeder.com';
const BREVO_API = 'https://api.brevo.com/v3';

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Extract domain from URL for contact@domain placeholder */
function domainFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = url.startsWith('http') ? url : `https://${url}`;
    const host = new URL(u).hostname.replace(/^www\./, '');
    return host || null;
  } catch {
    return null;
  }
}

async function fetchLeadfeeder(path, params = {}) {
  const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${API_BASE}${path}${qs}`, {
    headers: {
      Authorization: `Token token=${LEADFEEDER_TOKEN}`,
      'User-Agent': 'Sako-Marketing/1.0',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.errors?.[0]?.title || `Leadfeeder ${res.status}`);
  return data;
}

async function createBrevoContact(email, attributes, listId) {
  const res = await fetch(`${BREVO_API}/contacts`, {
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      attributes,
      listIds: [listId],
      updateEnabled: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && data?.code !== 'duplicate_parameter') {
    throw new Error(data?.message || `Brevo ${res.status}`);
  }
  return data;
}

async function main() {
  const args = process.argv.slice(2);
  const doSync = args.includes('--sync');
  const days = parseInt(args.find((a, i) => args[i - 1] === '--days') || '7', 10) || 7;
  const minQuality = parseInt(args.find((a, i) => args[i - 1] === '--min-quality') || '5', 10) || 5;

  if (!LEADFEEDER_TOKEN) {
    console.error('Missing LEADFEEDER_API_TOKEN');
    process.exit(1);
  }
  if (doSync && (!BREVO_KEY || !BREVO_LIST_ID)) {
    console.error('For --sync, set BREVO_API_KEY and BREVO_LEADFEEDER_LIST_ID');
    process.exit(1);
  }

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = formatDate(start);
  const endDate = formatDate(end);

  console.log(doSync ? 'SYNC MODE' : 'DRY RUN (use --sync to create Brevo contacts)');
  console.log(`Period: ${startDate} to ${endDate}`);
  console.log(`Min quality: ${minQuality}\n`);

  const { data: accounts } = await fetchLeadfeeder('/accounts');
  const accountId = accounts?.[0]?.id;
  if (!accountId) {
    console.error('No Leadfeeder account found');
    process.exit(1);
  }

  const { data: leads, included } = await fetchLeadfeeder(`/accounts/${accountId}/leads`, {
    start_date: startDate,
    end_date: endDate,
    'page[size]': '100',
  });

  const locs = (included || []).reduce((m, l) => {
    m[l.id] = l.attributes || l;
    return m;
  }, {});

  const highIntent = (leads || []).filter((l) => {
    const a = l.attributes || l;
    return (a.quality ?? 0) >= minQuality;
  });

  console.log(`Total leads: ${leads?.length || 0}`);
  console.log(`High-intent (quality >= ${minQuality}): ${highIntent.length}\n`);

  let created = 0;
  let skipped = 0;

  for (const lead of highIntent) {
    const a = lead.attributes || lead;
    const domain = domainFromUrl(a.website_url);
    if (!domain) {
      console.log(`  Skip ${a.name}: no valid domain`);
      skipped++;
      continue;
    }
    const email = `contact@${domain}`;
    const loc = lead.relationships?.location?.data ? locs[lead.relationships.location.data.id] : null;

    const attributes = {
      LEADFEEDER_SYNC: 'true',
      LEADFEEDER_COMPANY: a.name,
      LEADFEEDER_INDUSTRY: a.industry || '',
      LEADFEEDER_VISITS: String(a.visits || 0),
      LEADFEEDER_QUALITY: String(a.quality ?? 0),
      LEADFEEDER_WEBSITE: a.website_url || '',
      LEADFEEDER_LAST_VISIT: a.last_visit_date || '',
      COMPANY: a.name,
      ...(loc?.country && { LEADFEEDER_COUNTRY: loc.country }),
    };

    if (doSync) {
      try {
        await createBrevoContact(email, attributes, BREVO_LIST_ID);
        console.log(`  + ${a.name} (${email})`);
        created++;
      } catch (e) {
        console.error(`  ! ${a.name}: ${e.message}`);
      }
    } else {
      console.log(`  [dry] ${a.name} → ${email} (q:${a.quality}, v:${a.visits})`);
    }
  }

  console.log(`\n${doSync ? `Created: ${created}, Skipped: ${skipped}` : 'Dry run complete. Use --sync to create contacts.'}`);
  if (doSync && created > 0) {
    console.log('\n⚠️  These contacts have placeholder emails. Do NOT add to marketing automations.');
    console.log('   Filter by LEADFEEDER_SYNC=true in Brevo for CRM tracking only.');
  }
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
