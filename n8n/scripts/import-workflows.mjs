import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = '/home/node/.n8n/workflows';

const walk = (dir) => {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (st.isFile() && entry.endsWith('.json')) out.push(p);
  }
  return out;
};

const looksLikeDuplicate = (text) => {
  const t = String(text || '').toLowerCase();
  return (
    t.includes('duplicate key value violates unique constraint') ||
    t.includes('already exists') ||
    t.includes('unique constraint')
  );
};

if (!existsSync(ROOT)) {
  console.log(`[import] No workflows directory at ${ROOT}`);
  process.exit(0);
}

const files = walk(ROOT).sort();
if (files.length === 0) {
  console.log('[import] No workflow JSON files found');
  process.exit(0);
}

console.log(`[import] Found ${files.length} workflow files`);

let imported = 0;
let skipped = 0;
let failed = 0;

for (const file of files) {
  const res = spawnSync('/usr/local/bin/n8n', ['import:workflow', `--input=${file}`], {
    env: {
      ...process.env,
      // Prevent CLI from trying to bind the same port as the running server
      N8N_PORT: '0',
      PORT: '0',
    },
    encoding: 'utf8',
  });

  if (res.status === 0) {
    imported += 1;
    continue;
  }

  const combined = `${res.stdout || ''}\n${res.stderr || ''}`.trim();
  if (looksLikeDuplicate(combined)) {
    skipped += 1;
    continue;
  }

  failed += 1;
  console.log(`[import] Failed importing ${file}`);
  console.log(combined.slice(0, 4000));
}

console.log(`[import] Done. imported=${imported} skipped=${skipped} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);

