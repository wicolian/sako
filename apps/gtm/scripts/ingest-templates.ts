#!/usr/bin/env npx tsx

/**
 * Template Ingestion Script v2
 * 
 * Run with: npx tsx scripts/ingest-templates.ts [directory] [options]
 * 
 * Options:
 *   --skip-existing   Skip sections that already exist in database
 *   --force          Re-process all sections (update existing)
 *   --dry-run        Show what would be processed without making changes
 * 
 * This script processes HTML templates, sanitizes them, generates embeddings,
 * and stores them in the design_templates table with cost tracking.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually BEFORE any other imports
const envPath = resolve(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && value) {
      process.env[key] = value;
    }
  });
  console.log('✓ Loaded .env.local');
} catch (e) {
  console.log('⚠ No .env.local found, using existing env vars');
}

// Debug: show what we have
console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ set' : '✗ missing'}`);
console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ set' : '✗ missing (will use anon key)'}`);
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✓ set' : '✗ missing'}`);
console.log('');

// Default template directory - change this or pass as argument
const DEFAULT_TEMPLATE_DIR = '/Users/kelashik/Downloads/designmax/aura_html_templates/html';

// Parse arguments
const args = process.argv.slice(2);
const TEMPLATE_DIR = args.find(a => !a.startsWith('--')) || DEFAULT_TEMPLATE_DIR;
const SKIP_EXISTING = args.includes('--skip-existing');
const FORCE = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Template Ingestion Script v2
============================

Usage:
  npx tsx scripts/ingest-templates.ts [directory] [options]

Options:
  --skip-existing   Skip sections that already exist (saves cost!)
  --force          Re-process all sections (update existing)
  --dry-run        Preview what would be processed

Examples:
  npx tsx scripts/ingest-templates.ts                              # Use default directory
  npx tsx scripts/ingest-templates.ts /path/to/templates           # Custom directory
  npx tsx scripts/ingest-templates.ts --skip-existing              # Skip already ingested
  npx tsx scripts/ingest-templates.ts /path --skip-existing        # Custom + skip

Cost Estimates:
  Per section: ~$0.003-0.005 (metadata) + ~$0.00002 (embedding)
  206 templates × 8 sections = ~1,650 sections ≈ $5-10 total

The script will:
  1. Read all .html files from the directory
  2. Sanitize templates (remove vendor branding: Aura, DesignMax, etc.)
  3. Extract sections (hero, features, pricing, etc.)
  4. Generate AI metadata for each section (GPT-5.2)
  5. Create 1536-dim embeddings for similarity search
  6. Store in Supabase design_templates table
  7. Show running cost estimate
`);
  process.exit(0);
}

// Format cost with color
function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

async function main() {
  // Dynamic import after env vars are loaded
  const { ingestTemplatesFromDirectory, getTemplateStats } = await import('../lib/templates/ingestion');
  
  console.log('🚀 Template Ingestion Script v2');
  console.log('================================\n');
  
  // Check for required env vars
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL');
    process.exit(1);
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY for embeddings');
    process.exit(1);
  }
  
  // Note: Service role key is preferred for bypassing RLS, but anon key works if RLS allows
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('⚠️  No service role key - using anon key (may have RLS restrictions)');
  }

  console.log(`📁 Template directory: ${TEMPLATE_DIR}`);
  console.log(`⚙️  Options:`);
  console.log(`   Skip existing: ${SKIP_EXISTING ? '✓ Yes (saves cost!)' : '✗ No (will update)'}`);
  console.log(`   Force regenerate: ${FORCE ? '✓ Yes' : '✗ No'}`);
  if (DRY_RUN) {
    console.log(`   🔍 DRY RUN MODE - no changes will be made`);
  }
  
  // Get initial stats
  console.log('\n📊 Current stats before ingestion:');
  const beforeStats = await getTemplateStats();
  console.log(`   Templates: ${beforeStats.totalTemplates}`);
  console.log(`   Sections: ${beforeStats.totalSections}`);
  
  if (DRY_RUN) {
    console.log('\n🔍 Dry run complete - no changes made');
    process.exit(0);
  }
  
  console.log('\n⏳ Starting ingestion (this may take a while)...');
  console.log('   💡 Tip: Use --skip-existing on re-runs to save costs\n');
  
  // Track progress with cost display
  let lastProcessed = 0;
  let lastCostDisplay = 0;
  
  const result = await ingestTemplatesFromDirectory(
    TEMPLATE_DIR,
    (progress) => {
      if (progress.processed !== lastProcessed) {
        lastProcessed = progress.processed;
        const pct = Math.round((progress.processed / progress.total) * 100);
        
        // Update cost display every 5 files
        let costStr = '';
        if (progress.processed - lastCostDisplay >= 5 || progress.processed === progress.total) {
          lastCostDisplay = progress.processed;
          costStr = ` | Cost: ${formatCost(progress.costs.estimatedCostUsd)}`;
        }
        
        let skipStr = progress.skipped > 0 ? ` | Skipped: ${progress.skipped}` : '';
        
        process.stdout.write(`\r   Processing: ${progress.processed}/${progress.total} (${pct}%) - ${progress.current}${skipStr}${costStr}      `);
      }
    },
    {
      skipExisting: SKIP_EXISTING,
      updateExisting: !SKIP_EXISTING,
      forceRegenerate: FORCE,
    }
  );
  
  console.log('\n\n✅ Ingestion complete!');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Results summary
  console.log('📈 Results:');
  console.log(`   Templates processed: ${result.templatesProcessed}`);
  console.log(`   Sections created:    ${result.sectionsCreated}`);
  console.log(`   Sections updated:    ${result.sectionsUpdated}`);
  console.log(`   Sections skipped:    ${result.sectionsSkipped}`);
  console.log(`   Duration:            ${(result.duration / 1000).toFixed(1)}s`);
  
  // Cost breakdown
  console.log('\n💰 Cost Breakdown:');
  console.log(`   Metadata calls:      ${result.costs.metadataCalls}`);
  console.log(`   Embedding calls:     ${result.costs.embeddingCalls}`);
  console.log(`   ─────────────────────────────────────`);
  console.log(`   Metadata tokens:     ${result.costs.metadataTokensIn.toLocaleString()} in / ${result.costs.metadataTokensOut.toLocaleString()} out`);
  console.log(`   Embedding tokens:    ${result.costs.embeddingTokens.toLocaleString()}`);
  console.log(`   ─────────────────────────────────────`);
  console.log(`   ESTIMATED TOTAL:     ${formatCost(result.costs.estimatedCostUsd)}`);
  
  if (result.errors.length > 0) {
    console.log(`\n⚠️  Errors (${result.errors.length}):`);
    result.errors.slice(0, 10).forEach(e => console.log(`   - ${e}`));
    if (result.errors.length > 10) {
      console.log(`   ... and ${result.errors.length - 10} more`);
    }
  }
  
  // Get final stats
  console.log('\n📊 Final stats after ingestion:');
  const afterStats = await getTemplateStats();
  console.log(`   Templates: ${afterStats.totalTemplates} (+${afterStats.totalTemplates - beforeStats.totalTemplates})`);
  console.log(`   Sections:  ${afterStats.totalSections} (+${afterStats.totalSections - beforeStats.totalSections})`);
  
  console.log('\n   By category:');
  Object.entries(afterStats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`     ${cat.padEnd(15)} ${count}`);
    });
  
  console.log('\n   By theme:');
  Object.entries(afterStats.byTheme)
    .sort((a, b) => b[1] - a[1])
    .forEach(([theme, count]) => {
      console.log(`     ${theme.padEnd(15)} ${count}`);
    });
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('💡 Next steps:');
  console.log('   - Check Vercel AI Gateway usage: https://vercel.com → AI → Usage');
  console.log('   - Run with --skip-existing on future runs to save costs');
  console.log('   - Verify templates in Supabase: design_templates table');
}

main().catch(console.error);
