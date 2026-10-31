#!/usr/bin/env node
/**
 * Sync workflow JSON files from repo to n8n instance via REST API.
 * Upserts by workflow name: update if exists, create if not. No duplicates.
 *
 * Requires: N8N_BASE_URL, N8N_API_KEY
 *   N8N_BASE_URL = https://n8n.sako.agency (no trailing slash)
 *   N8N_API_KEY = from n8n Settings → n8n API → Create API key
 *
 * Usage:
 *   node scripts/sync-workflows.mjs
 *   N8N_BASE_URL=https://n8n.sako.agency N8N_API_KEY=xxx node scripts/sync-workflows.mjs
 *   railway run node scripts/sync-workflows.mjs   # uses Railway env
 *
 * Optional: N8N_ACTIVATE_DEPS=1 — after sync, activate Error Handler, Apify Runner, Webhook Auth, UTM Link Generator
 *   so Slack Approval Handler can be published (n8n 2 "references workflow which is not published").
 *
 * Optional: N8N_SYNC_ONLY=path1,path2 — sync only these workflow files (e.g. content/trends-social-poster.json,pr/pr-hook-generator.json).
 *   Other workflows on the instance are left unchanged.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WORKFLOWS_DIR = join(ROOT, 'workflows');

// Publish order: dependencies first (see docs/PUBLISH_ORDER.md)
const PUBLISH_ORDER = [
  '_shared/error-handler.json',
  '_shared/apify-runner.json',
  '_shared/webhook-auth.json',
  'content/utm-link-generator.json',
  'content/slack-approval-handler.json',
  'content/content-performance.json',
  'content/claims-safety-checker.json',
  'content/content-generator.json',
  'content/trends-social-poster.json',
  'content/linkedin-agent.json',
  'content/video-avatar-publisher.json',
  'infra/competitor-content-monitor.json',
  'infra/backup-workflows.json',
  'infra/metrics-reporter.json',
  'leads/lead-intake-router.json',
  'leads/company-enrichment.json',
  'leads/linkedin-contact-discovery.json',
  'leads/linkedin-profile-enricher.json',
  'leads/linkedin-hiring-signal-monitor.json',
  'leads/linkedin-inmail-generator.json',
  'leads/linkedin-inmail-approval.json',
  'leads/apollo-icp-qualifier.json',
  'leads/brevo-warm-opens.json',
  'leads/calcom-booking-handler.json',
  'leads/call-prep-brief.json',
  'leads/handle-email-events.json',
  'leads/mark-called-handler.json',
  'leads/quo-call-logger.json',
  'pr/earned-media-outreach.json',
  'pr/pr-hook-generator.json',
  'pr/reddit-monitor.json',
  'pr/coverage-tracker.json',
  'pr/media-target-discovery.json',
  'pr/journalist-monitor.json',
  'pr/media-kit-generator.json',
  'pr/newsroom-publisher.json',
  'recruiting/designer-sourcing.json',
  'recruiting/designer-screening.json',
  'recruiting/designer-outreach.json',
  '_shared/slack-command-handler.json',
  '_shared/slack-app-home.json',
  'analytics/morning-briefing.json',
  'analytics/eod-summary.json',
  'analytics/weekly-growth-report.json',
];

function getEnv() {
  if (!process.env.N8N_BASE_URL || !process.env.N8N_API_KEY) {
    const envPath = join(ROOT, '.env');
    if (existsSync(envPath)) {
      const raw = readFileSync(envPath, 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m && !(m[1] in process.env)) {
          const val = m[2].replace(/^["']|["']$/g, '').trim();
          process.env[m[1]] = val;
        }
      }
    }
  }
  const base = (process.env.N8N_BASE_URL || '').replace(/\/$/, '');
  const key = process.env.N8N_API_KEY;
  const apiPath = (process.env.N8N_API_PATH || '/api/v1').replace(/\/$/, '');
  if (!base || !key) {
    console.error('Set N8N_BASE_URL and N8N_API_KEY (or add to .env).');
    console.error('  N8N_BASE_URL = https://n8n.sako.agency');
    console.error('  N8N_API_KEY  = from n8n Settings → n8n API → Create API key');
    process.exit(1);
  }
  return { base, key, apiPath };
}

async function listWorkflows(base, key, apiPath) {
  const url = `${base}${apiPath}/workflows?limit=250`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'X-N8N-API-KEY': key },
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404) {
      console.error('Tip: 404 usually means (1) Public API is off — enable in n8n Settings → n8n API, or (2) wrong N8N_BASE_URL / N8N_API_PATH.');
    }
    throw new Error(`List workflows failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  const list = data.data ?? data;
  return Array.isArray(list) ? list : [];
}

async function createWorkflow(base, key, apiPath, body) {
  const url = `${base}${apiPath}/workflows`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Create failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function updateWorkflow(base, key, apiPath, id, body) {
  const url = `${base}${apiPath}/workflows/${id}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': key,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Update failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function activateWorkflow(base, key, apiPath, id) {
  const url = `${base}${apiPath}/workflows/${id}/activate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'X-N8N-API-KEY': key },
  });
  if (!res.ok) {
    throw new Error(`Activate failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// n8n Public API workflow schema allows only: name, nodes, connections, settings, staticData (no meta, no extra keys)
function buildPayload(wf, existing = null) {
  const payload = {
    name: wf.name,
    nodes: wf.nodes ?? [],
    connections: wf.connections ?? {},
    settings: wf.settings ?? { executionOrder: 'v1' },
  };
  if (wf.staticData != null) payload.staticData = wf.staticData;
  return payload;
}

async function main() {
  const { base, key, apiPath } = getEnv();
  console.log('Syncing workflows to', base, '\n');

  const existingList = await listWorkflows(base, key, apiPath);
  const byName = new Map();
  for (const w of existingList) {
    const name = w.name;
    if (name && !byName.has(name)) {
      byName.set(name, { id: w.id, active: w.active ?? false });
    }
  }

  const syncOnlyRaw = process.env.N8N_SYNC_ONLY || '';
  const syncOnly = syncOnlyRaw ? new Set(syncOnlyRaw.split(',').map((s) => s.trim()).filter(Boolean)) : null;
  if (syncOnly) {
    console.log('N8N_SYNC_ONLY: syncing only', [...syncOnly], '\n');
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const order = syncOnly ? PUBLISH_ORDER.filter((relPath) => syncOnly.has(relPath)) : PUBLISH_ORDER;
  for (const relPath of order) {
    const file = join(WORKFLOWS_DIR, relPath);
    if (!existsSync(file)) {
      skipped++;
      continue;
    }
    try {
      const raw = readFileSync(file, 'utf8');
      const wf = JSON.parse(raw);
      const name = wf.name;
      if (!name) {
        console.log('  ⚠', relPath, '— no name, skip');
        skipped++;
        continue;
      }
      const existing = byName.get(name);
      const payload = buildPayload(wf, existing);

      if (existing) {
        await updateWorkflow(base, key, apiPath, existing.id, payload);
        updated++;
        console.log('  ✓', relPath, '→ updated');
      } else {
        const createdWf = await createWorkflow(base, key, apiPath, payload);
        byName.set(name, { id: createdWf.id, active: createdWf.active ?? false });
        created++;
        console.log('  +', relPath, '→ created');
      }
    } catch (err) {
      failed++;
      console.error('  ✗', relPath, err.message);
    }
  }

  // Optional: activate dependency workflows so "references workflow X which is not published" is resolved
  const activateDeps = process.env.N8N_ACTIVATE_DEPS === '1' || process.env.N8N_ACTIVATE_DEPS === 'true';
  const DEP_NAMES = ['Error Handler (Shared)', 'Apify Runner', 'Webhook Auth (Shared)', 'UTM Link Generator'];
  if (activateDeps && failed === 0) {
    console.log('\nActivating dependency workflows (N8N_ACTIVATE_DEPS=1)...');
    for (const name of DEP_NAMES) {
      const entry = byName.get(name);
      if (entry) {
        try {
          await activateWorkflow(base, key, apiPath, entry.id);
          console.log('  ✓', name, '→ activated');
        } catch (err) {
          console.error('  ✗', name, err.message);
        }
      } else {
        console.log('  ⚠', name, '— not found, skip');
      }
    }
  }

  console.log('\nDone.', 'created=', created, 'updated=', updated, 'skipped=', skipped, 'failed=', failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
