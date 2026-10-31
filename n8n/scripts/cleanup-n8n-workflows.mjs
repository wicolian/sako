#!/usr/bin/env node
/**
 * One-off: delete all n8n workflows (and their executions) from Railway Postgres.
 * Run without psql — uses Node + pg.
 *
 * Usage:
 *   railway run node scripts/cleanup-n8n-workflows.mjs
 * or with explicit URL:
 *   DATABASE_URL="postgresql://user:pass@host:port/db" node scripts/cleanup-n8n-workflows.mjs
 *
 * Builds URL from DB_POSTGRESDB_* if DATABASE_URL is not set (Railway style).
 */

import pg from 'pg';
const { Client } = pg;

function getConnectionConfig() {
  // Prefer public URL for local runs (Railway private host *.railway.internal only resolves inside Railway)
  const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  if (url) {
    return { connectionString: url };
  }
  const host = process.env.DB_POSTGRESDB_HOST;
  const port = process.env.DB_POSTGRESDB_PORT || '5432';
  const database = process.env.DB_POSTGRESDB_DATABASE;
  const user = process.env.DB_POSTGRESDB_USER;
  const password = process.env.DB_POSTGRESDB_PASSWORD;
  if (!host || !database || !user || !password) {
    console.error('Set DATABASE_PUBLIC_URL or DATABASE_URL (public URL from Railway → Postgres → Connect).');
    process.exit(1);
  }
  return { host, port, database, user, password };
}

async function main() {
  const client = new Client(getConnectionConfig());
  await client.connect();

  try {
    const countW = await client.query('SELECT COUNT(*)::int AS c FROM workflow_entity');
    const countE = await client.query('SELECT COUNT(*)::int AS c FROM execution_entity');
    const workflows = countW.rows[0].c;
    const executions = countE.rows[0].c;
    console.log(`Current: ${workflows} workflows, ${executions} executions.`);

    if (workflows === 0) {
      console.log('Nothing to delete.');
      return;
    }

    console.log('Deleting executions first (FK), then workflows...');
    await client.query('DELETE FROM execution_entity');
    await client.query('DELETE FROM workflow_entity');
    console.log('Done. All workflows and executions removed.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  if (err.code === 'ENOTFOUND' && err.hostname && err.hostname.endsWith('.railway.internal')) {
    console.error('That host only works inside Railway. From your Mac, use the public URL:');
    console.error('  Railway → Postgres-64Kg → Connect (Public) → copy the URL, then:');
    console.error('  DATABASE_URL=\'postgresql://postgres:YOUR_PASSWORD@HOST:PORT/railway\' node scripts/cleanup-n8n-workflows.mjs');
  } else {
    console.error(err);
  }
  process.exit(1);
});
