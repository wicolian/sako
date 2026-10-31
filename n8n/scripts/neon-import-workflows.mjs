#!/usr/bin/env node
/**
 * Import all local workflow JSON files directly into Neon Postgres.
 * Cleans duplicates first, then inserts fresh.
 *
 * IMPORTANT: Also creates shared_workflow entries so n8n knows
 * who owns each workflow (links them to the user's personal project).
 *
 * Usage:
 *   node scripts/neon-import-workflows.mjs
 *
 * Reads DB config from .env (DB_POSTGRESDB_* vars).
 */

import pg from 'pg';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';

const { Client } = pg;

// Load .env from project root if DB vars not set
if (!process.env.DATABASE_URL && !process.env.DB_POSTGRESDB_HOST) {
  const envPath = join(import.meta.dirname, '..', '.env');
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const key = m[1];
        const val = m[2].replace(/^["']|["']$/g, '').trim();
        if (!(key in process.env)) process.env[key] = val;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WORKFLOWS_DIR = join(import.meta.dirname, '..', 'workflows');

function getConnectionConfig() {
  const url = process.env.DATABASE_URL;
  if (url) return { connectionString: url, ssl: { rejectUnauthorized: false } };

  const host = process.env.DB_POSTGRESDB_HOST;
  const port = process.env.DB_POSTGRESDB_PORT || '5432';
  const database = process.env.DB_POSTGRESDB_DATABASE;
  const user = process.env.DB_POSTGRESDB_USER;
  const password = process.env.DB_POSTGRESDB_PASSWORD;
  if (!host || !database || !user || !password) {
    console.error('Set DATABASE_URL or DB_POSTGRESDB_* env vars (or run with dotenv).');
    process.exit(1);
  }
  return { host, port: Number(port), database, user, password, ssl: { rejectUnauthorized: false } };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Walk a directory recursively and collect .json file paths */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (st.isFile() && entry.endsWith('.json')) out.push(p);
  }
  return out.sort();
}

/** Generate a short random ID similar to n8n's nanoid (10 chars, alphanumeric) */
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(10);
  let id = '';
  for (let i = 0; i < 10; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

/** Count trigger nodes in a workflow */
function countTriggers(nodes) {
  if (!Array.isArray(nodes)) return 0;
  return nodes.filter(
    (n) =>
      n.type?.toLowerCase().includes('trigger') ||
      n.type?.toLowerCase().includes('webhook'),
  ).length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Collect workflow files
  const files = walk(WORKFLOWS_DIR);
  if (files.length === 0) {
    console.log('No workflow JSON files found in', WORKFLOWS_DIR);
    process.exit(0);
  }
  console.log(`Found ${files.length} workflow files\n`);

  // Connect
  const client = new Client(getConnectionConfig());
  await client.connect();
  console.log('Connected to Neon\n');

  try {
    // --- Step 0: Find the personal project to assign workflows to ---
    const projectResult = await client.query(
      `SELECT id, name FROM project WHERE type = 'personal' ORDER BY "createdAt" ASC LIMIT 1`,
    );
    if (projectResult.rows.length === 0) {
      console.error(
        'ERROR: No personal project found in the "project" table.\n' +
          'This means no user has signed into n8n yet.\n' +
          'Please sign into https://n8n.sako.agency first, then re-run this script.',
      );
      process.exit(1);
    }
    const personalProjectId = projectResult.rows[0].id;
    const projectName = projectResult.rows[0].name;
    console.log(`Using personal project: "${projectName}" (id: ${personalProjectId})\n`);

    // --- Step 1: Wipe existing data ---
    const countW = await client.query('SELECT COUNT(*)::int AS c FROM workflow_entity');
    const countE = await client.query('SELECT COUNT(*)::int AS c FROM execution_entity');
    console.log(`Existing: ${countW.rows[0].c} workflows, ${countE.rows[0].c} executions`);

    if (countW.rows[0].c > 0 || countE.rows[0].c > 0) {
      console.log('Wiping executions, shared_workflow, and workflows...');
      // Clean up in FK-safe order
      await client.query('DELETE FROM execution_entity').catch(() => {});
      await client.query('DELETE FROM workflow_statistics').catch(() => {});
      await client.query('DELETE FROM webhook_entity').catch(() => {});
      await client.query('DELETE FROM workflows_tags').catch(() => {});
      await client.query('DELETE FROM shared_workflow').catch(() => {});
      await client.query('DELETE FROM tag_entity').catch(() => {});
      await client.query('DELETE FROM workflow_entity');
      console.log('Wiped.\n');
    }

    // --- Step 2: Discover shared_workflow columns ---
    // n8n versions may have slightly different column sets; detect them.
    const colResult = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'shared_workflow'
      ORDER BY ordinal_position
    `);
    const swCols = colResult.rows.map((r) => r.column_name);
    console.log('shared_workflow columns:', swCols.join(', '), '\n');

    // --- Step 3: Insert workflows + shared_workflow ---
    const now = new Date().toISOString();
    let imported = 0;
    let failed = 0;

    for (const file of files) {
      const relPath = file.replace(WORKFLOWS_DIR + '/', '');
      try {
        const raw = readFileSync(file, 'utf8');
        const wf = JSON.parse(raw);

        const id = generateId();
        const name = wf.name || basename(file, '.json');
        const active = false; // import as inactive — user activates what they need
        const nodes = JSON.stringify(wf.nodes || []);
        const connections = JSON.stringify(wf.connections || {});
        const settings = JSON.stringify(wf.settings || { executionOrder: 'v1' });
        const staticData = wf.staticData ? JSON.stringify(wf.staticData) : null;
        const pinData = wf.pinData ? JSON.stringify(wf.pinData) : null;
        const versionId = randomUUID().replace(/-/g, '').slice(0, 36);
        const triggerCount = countTriggers(wf.nodes);
        const meta = JSON.stringify(wf.meta || null);
        const isArchived = false;
        const versionCounter = 1;

        // Insert workflow
        await client.query(
          `INSERT INTO workflow_entity
            (id, name, active, nodes, connections, settings, "staticData", "pinData",
             "versionId", "triggerCount", meta, "isArchived", "versionCounter",
             "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4::json,$5::json,$6::json,$7::json,$8::json,
                   $9,$10,$11::json,$12,$13,$14,$15)`,
          [
            id, name, active, nodes, connections, settings, staticData, pinData,
            versionId, triggerCount, meta, isArchived, versionCounter,
            now, now,
          ],
        );

        // Insert shared_workflow — link this workflow to the personal project
        // The role 'workflow:owner' gives full access.
        if (swCols.includes('createdAt')) {
          await client.query(
            `INSERT INTO shared_workflow ("workflowId", "projectId", role, "createdAt")
             VALUES ($1, $2, $3, $4)`,
            [id, personalProjectId, 'workflow:owner', now],
          );
        } else {
          await client.query(
            `INSERT INTO shared_workflow ("workflowId", "projectId", role)
             VALUES ($1, $2, $3)`,
            [id, personalProjectId, 'workflow:owner'],
          );
        }

        imported++;
        console.log(`  ✓ ${relPath}  →  id=${id}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ ${relPath}: ${err.message}`);
      }
    }

    console.log(`\nDone. imported=${imported}  failed=${failed}`);

    // Verify
    const finalW = await client.query('SELECT COUNT(*)::int AS c FROM workflow_entity');
    const finalS = await client.query('SELECT COUNT(*)::int AS c FROM shared_workflow');
    console.log(`Workflows in DB: ${finalW.rows[0].c}`);
    console.log(`shared_workflow entries: ${finalS.rows[0].c}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
