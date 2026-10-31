#!/usr/bin/env node
/**
 * Lists all sheet tabs referenced in workflows
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const VERIFIED_GIDS = {
  qualified_leads: 492604584,
  content_backlog: 1620036434,
  call_tracker: 31482936,
  pr_backlog: 888766463,
  warm_opens: 1096236767,
  hiring_signals: 339358735,
};

async function findWorkflowFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findWorkflowFiles(fullPath));
    } else if (entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const workflowsDir = join(process.cwd(), 'workflows');
  const files = await findWorkflowFiles(workflowsDir);
  
  const sheetNames = new Set();
  
  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    // Find all cachedResultName values for sheets
    const matches = content.matchAll(/"cachedResultName":\s*"([a-z_]+)"/g);
    for (const match of matches) {
      sheetNames.add(match[1]);
    }
  }
  
  console.log('=== SHEET TABS STATUS ===\n');
  
  console.log('✅ VERIFIED (exist in spreadsheet):');
  for (const [name, gid] of Object.entries(VERIFIED_GIDS)) {
    console.log(`   ${name}: gid=${gid}`);
  }
  
  console.log('\n⚠️  NEED TO CREATE (placeholder gids):');
  for (const name of [...sheetNames].sort()) {
    if (!VERIFIED_GIDS[name]) {
      console.log(`   ${name}`);
    }
  }
  
  console.log('\n📋 To create missing sheets:');
  console.log('1. Open your Google Sheet');
  console.log('2. Click "+" at bottom to add each tab');
  console.log('3. Name it exactly as shown above');
  console.log('4. Note the gid from URL after #gid=');
  console.log('5. Update scripts/fix-workflow-sheets.mjs with real gids');
  console.log('6. Run: node scripts/fix-workflow-sheets.mjs');
}

main().catch(console.error);
