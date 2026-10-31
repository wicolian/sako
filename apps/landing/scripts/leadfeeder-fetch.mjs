#!/usr/bin/env node
/**
 * Leadfeeder API - Fetch leads and verify setup
 *
 * Usage:
 *   node scripts/leadfeeder-fetch.mjs                    # List accounts, verify tracker
 *   node scripts/leadfeeder-fetch.mjs --leads            # Fetch last 7 days of leads
 *   node scripts/leadfeeder-fetch.mjs --leads --days 14 # Fetch last 14 days
 *   node scripts/leadfeeder-fetch.mjs --feeds            # List custom feeds
 *   node scripts/leadfeeder-fetch.mjs --export [account_id] [feed_id]  # Request export
 *
 * Requires: LEADFEEDER_API_TOKEN in .env.local
 * API needs Trial or Premium - Free plan has NO API access.
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
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

const API_BASE = 'https://api.leadfeeder.com';
const TOKEN = process.env.LEADFEEDER_API_TOKEN;

if (!TOKEN) {
  console.error('Missing LEADFEEDER_API_TOKEN. Add to .env.local');
  process.exit(1);
}

const headers = {
  Authorization: `Token token=${TOKEN}`,
  'User-Agent': 'Sako-Marketing/1.0',
};

async function fetchApi(path, params = {}) {
  const qs = Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '';
  const res = await fetch(`${API_BASE}${path}${qs}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.errors?.[0]?.title || `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const args = process.argv.slice(2);
  const days = parseInt(args.find((a, i) => args[i - 1] === '--days') || '7', 10) || 7;
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startDate = formatDate(start);
  const endDate = formatDate(end);

  // 1. Always fetch accounts
  console.log('Fetching Leadfeeder accounts...\n');
  const { data: accounts } = await fetchApi('/accounts');
  if (!accounts?.length) {
    console.log('No accounts found.');
    return;
  }

  for (const acc of accounts) {
    const attrs = acc.attributes || acc;
    console.log(`Account: ${attrs.name} (ID: ${acc.id})`);
    console.log(`  Subscription: ${attrs.subscription || 'unknown'}`);
    console.log(`  Tracker: ${attrs.website_tracking_status || 'unknown'}`);
    console.log(`  Timezone: ${attrs.timezone || 'unknown'}`);
    console.log('');
  }

  const accountId = accounts[0].id;

  if (args.includes('--feeds')) {
    console.log('Custom feeds:\n');
    const { data: feeds } = await fetchApi(`/accounts/${accountId}/custom-feeds`);
    for (const f of feeds || []) {
      const attrs = f.attributes || f;
      console.log(`  ${f.id}: ${attrs.name}`);
    }
    return;
  }

  if (args.includes('--leads')) {
    console.log(`Fetching leads (${startDate} to ${endDate})...\n`);
    const { data: leads, included } = await fetchApi(`/accounts/${accountId}/leads`, {
      start_date: startDate,
      end_date: endDate,
      'page[size]': '50',
    });

    const locs = (included || []).reduce((m, l) => {
      m[l.id] = l.attributes || l;
      return m;
    }, {});

    if (!leads?.length) {
      console.log('No leads in this period.');
      return;
    }

    console.log(`Found ${leads.length} leads:\n`);
    for (const lead of leads) {
      const a = lead.attributes || lead;
      const loc = lead.relationships?.location?.data
        ? locs[lead.relationships.location.data.id]
        : null;
      const country = loc?.country_code || loc?.country || '-';
      console.log(`  ${a.name}`);
      console.log(`    Industry: ${a.industry || '-'} | Visits: ${a.visits || 0} | Quality: ${a.quality ?? '-'}`);
      console.log(`    Website: ${a.website_url || '-'}`);
      console.log(`    Location: ${country} | Last visit: ${a.last_visit_date || '-'}`);
      console.log('');
    }

    // Optionally write to file
    const outFile = `leadfeeder-leads-${startDate}-${endDate}.json`;
    writeFileSync(outFile, JSON.stringify({ leads, included }, null, 2));
    console.log(`\nExported to ${outFile}`);
    return;
  }

  if (args.includes('--export')) {
    const feedId = args[args.indexOf('--export') + 2] || 'all_leads';
    const accId = args[args.indexOf('--export') + 1] || accountId;
    console.log(`Requesting export for account ${accId}, feed ${feedId}...`);
    const body = new URLSearchParams({
      account_id: accId,
      custom_feed_id: feedId,
      start_date: startDate,
      end_date: endDate,
    });
    const res = await fetch(`${API_BASE}/export-requests`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(json?.errors?.[0]?.title || res.status);
      process.exit(1);
    }
    const d = json.data?.attributes || json.data;
    console.log('Export requested. Status:', d?.status);
    console.log('Poll status:', d?.status_url || `GET /export-requests/${json.data?.id}`);
    return;
  }

  console.log('Commands: --leads | --feeds | --export [account_id] [feed_id]');
  console.log('Example: node scripts/leadfeeder-fetch.mjs --leads --days 14');
}

main().catch((e) => {
  console.error('Error:', e.message);
  if (e.message?.includes('402')) {
    console.error('\nAPI requires Trial or Premium. Free plan has no API access.');
  }
  process.exit(1);
});
