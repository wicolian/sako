#!/usr/bin/env node
/**
 * Fix all workflow JSON files to use correct Google Sheets format for n8n v4
 * - Changes sheetId -> documentId with proper structure
 * - Changes sheet name strings to numeric gids
 * - Adds cachedResultName and cachedResultUrl for UI
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, relative } from 'path';

const SPREADSHEET_ID = '1kuvMIZS5a7GYnHDlByL4LfkQf1kHbVxSmL8LogIjMgQ';
const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?usp=drivesdk`;

// Sheet name to gid mapping (from user's actual spreadsheet)
// Verified gids from working n8n workflows
const SHEET_GIDS = {
  // VERIFIED - these exist in the spreadsheet
  qualified_leads: 492604584,
  content_backlog: 1620036434,
  call_tracker: 31482936,
  pr_backlog: 888766463,
  warm_opens: 1096236767,
  hiring_signals: 339358735,
  
  // NEEDS CREATION - create these tabs in Google Sheets, then update gids
  // After creating tabs, get gid from URL: ...#gid=XXXXXXXXX
  apollo_import: 0,               // First tab (Sheet1 renamed)
  disqualified_leads: 1000000001,
  suppression_list: 1000000002,
  idempotency_log: 1000000003,
  inmail_outreach: 1000000004,
  media_targets: 1000000005,
  coverage: 1000000006,
  campaign_links: 1000000007,
  workflow_metrics: 1000000008,
  content_monitor_targets: 1000000009,
  candidate_pipeline: 1000000010,
  sales_objections: 1000000011,
  case_studies: 1000000012,
  industry_news: 1000000013,
  journalist_profiles: 1000000014,
};

// Credential mapping - actual credential IDs from the user's n8n instance
const CREDENTIAL_MAP = {
  // Google Sheets
  googleSheetsOAuth2Api: {
    id: 'DmISg5P6tbWAXQv6',
    name: 'Google Sheets account'
  },
  googleApi: {
    id: 'HfXCVP2mvYBjgu2b',
    name: 'Google Service Account account'
  },
  // Slack
  slackOAuth2Api: {
    id: 'Hypoe71bz8A0qpQ3',
    name: 'Slack account'
  },
  slackApi: {
    id: 'JvkKOazWhqYULrEJ',
    name: 'Slack account 2'
  },
  // AI
  openAiApi: {
    id: 'VJQjLnLDwAkI2PxY',
    name: 'OpenAi account'
  },
  anthropicApi: {
    id: 'kQoDzPRRczsAu6MG',
    name: 'Anthropic account'
  },
  googlePalmApi: {
    id: 'Ti5AW3P20tySO28w',
    name: 'Google Gemini(PaLM) Api account'
  },
  // HTTP Header Auth (for APIs)
  httpHeaderAuth: {
    // Will be mapped by name
    'Brevo': { id: 'bAJ8LsgwGI2XHllf', name: 'Brevo account' },
    'Brevo account': { id: 'bAJ8LsgwGI2XHllf', name: 'Brevo account' },
    'Apollo': { id: 'XsUtKQ6O9aPU0HyZ', name: 'Apollo' },
    'Apify': { id: 'yXZ48IzawNKxCcC1', name: 'Apify' },
    'Quo': { id: 'dY5wdmUFkS4TErzh', name: 'Quo' },
    'Cal': { id: 'njqdVkv7E92adNQL', name: 'Cal API' },
  }
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

function fixSheetNode(node) {
  const params = node.parameters;
  if (!params) return false;
  
  let modified = false;
  
  // Fix sheetId -> documentId
  if (params.sheetId && !params.documentId) {
    params.documentId = {
      __rl: true,
      mode: 'list',
      value: SPREADSHEET_ID,
      cachedResultName: 'Sako Marketing Automations',
      cachedResultUrl: SPREADSHEET_URL
    };
    delete params.sheetId;
    modified = true;
  }
  
  // Fix documentId structure
  if (params.documentId && typeof params.documentId === 'object') {
    if (!params.documentId.cachedResultName) {
      params.documentId.cachedResultName = 'Sako Marketing Automations';
      modified = true;
    }
    if (!params.documentId.cachedResultUrl) {
      params.documentId.cachedResultUrl = SPREADSHEET_URL;
      modified = true;
    }
  }
  
  // Fix sheetName - convert string to gid
  if (params.sheetName && typeof params.sheetName === 'object') {
    const sheetName = params.sheetName.value;
    if (typeof sheetName === 'string' && SHEET_GIDS[sheetName] !== undefined) {
      const gid = SHEET_GIDS[sheetName];
      params.sheetName = {
        __rl: true,
        mode: 'list',
        value: gid,
        cachedResultName: sheetName,
        cachedResultUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${gid}`
      };
      modified = true;
    }
  }
  
  return modified;
}

function fixCredentials(node) {
  if (!node.credentials) return false;
  
  let modified = false;
  
  for (const [credType, credValue] of Object.entries(node.credentials)) {
    // Handle httpHeaderAuth specially - map by name
    if (credType === 'httpHeaderAuth') {
      const mapping = CREDENTIAL_MAP.httpHeaderAuth[credValue.name];
      if (mapping && credValue.id !== mapping.id) {
        node.credentials[credType] = { ...mapping };
        modified = true;
      }
    } 
    // Handle other credential types
    else if (CREDENTIAL_MAP[credType]) {
      const mapping = CREDENTIAL_MAP[credType];
      if (credValue.id !== mapping.id) {
        node.credentials[credType] = { ...mapping };
        modified = true;
      }
    }
  }
  
  return modified;
}

async function fixWorkflowFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  let workflow;
  
  try {
    workflow = JSON.parse(content);
  } catch (e) {
    console.error(`  Error parsing ${filePath}: ${e.message}`);
    return false;
  }
  
  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    return false;
  }
  
  let modified = false;
  
  for (const node of workflow.nodes) {
    // Fix Google Sheets nodes
    if (node.type === 'n8n-nodes-base.googleSheets') {
      if (fixSheetNode(node)) {
        modified = true;
      }
    }
    
    // Fix credentials on all nodes
    if (fixCredentials(node)) {
      modified = true;
    }
  }
  
  if (modified) {
    await writeFile(filePath, JSON.stringify(workflow, null, 2) + '\n');
    return true;
  }
  
  return false;
}

async function main() {
  const workflowsDir = join(process.cwd(), 'workflows');
  
  console.log('Finding workflow files...');
  const files = await findWorkflowFiles(workflowsDir);
  console.log(`Found ${files.length} workflow files\n`);
  
  let fixedCount = 0;
  
  for (const file of files) {
    const relPath = relative(process.cwd(), file);
    const fixed = await fixWorkflowFile(file);
    if (fixed) {
      console.log(`✓ Fixed: ${relPath}`);
      fixedCount++;
    }
  }
  
  console.log(`\n${fixedCount} files updated.`);
  console.log('\nNOTE: Some sheet gids are placeholders. After importing, you may need to:');
  console.log('1. Create missing sheet tabs in your Google Sheet');
  console.log('2. Update the sheet references in n8n UI if gids don\'t match');
}

main().catch(console.error);
