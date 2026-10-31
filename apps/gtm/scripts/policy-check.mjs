#!/usr/bin/env node
/**
 * Policy Check Script (Jan 2026)
 * 
 * Scans codebase for policy violations per policy-repo.mdc and latest-models-only.mdc.
 * Fails with exit code 1 if violations are found.
 * 
 * Usage:
 *   node scripts/policy-check.mjs
 *   bun scripts/policy-check.mjs
 * 
 * Checks:
 *   1. Package.json versions (Next.js 16.x, AI SDK 6.x)
 *   2. Legacy model IDs in source files
 *   3. Non-allowlisted provider strings
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

// ============================================================================
// Configuration
// ============================================================================

// Allowlisted model IDs (Feb 2026 - Latest OpenRouter models)
const ALLOWED_MODELS = new Set([
  // OpenAI GPT-5 family (LATEST!)
  'openai/gpt-5.3-codex',
  'openai/gpt-5.2',
  'openai/gpt-5.2-chat',
  'openai/gpt-5.2-pro',
  'openai/gpt-5.2-codex',
  'gpt-5.3-codex',
  'gpt-5.2',
  'gpt-5.2-chat',
  'gpt-5.2-pro',
  'gpt-5.2-codex',
  
  // Anthropic Claude 4.6 family (LATEST!)
  'anthropic/claude-opus-4.6',
  'anthropic/claude-sonnet-4.6',
  'claude-opus-4.6',
  'claude-sonnet-4.6',
  
  // Google Gemini 3 family
  'google/gemini-3.1-pro-preview',
  'google/gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  
  // Embeddings
  'openai/text-embedding-3-large',
  'openai/text-embedding-3-small',
  'text-embedding-3-large',
  'text-embedding-3-small',
]);

// Legacy model patterns to detect (banned)
const LEGACY_PATTERNS = [
  // OpenAI legacy - ALL GPT-4 variants are now DEAD
  /gpt-4o(?![\w-])/gi,
  /gpt-4(?![\w-]|\.5|\.1|\.2)/gi,  // Allow gpt-5.2, gpt-5.3
  /gpt-3\.5/gi,
  /gpt-5\.0/gi,
  /gpt-5\.1/gi,
  /gpt-4\.1(?!\-)/gi,  // gpt-4.1 is DEAD (retired Feb 13, 2026)
  /gpt-4\.1-mini/gi,   // DEAD
  /gpt-5-mini/gi,
  /gpt-5-nano/gi,
  
  // Anthropic legacy (Claude 3.x, 4.5)
  /claude-3[-.]/gi,
  /claude-3-haiku/gi,
  /claude-3-sonnet/gi,
  /claude-3-opus/gi,
  /claude-instant/gi,
  /claude-2/gi,
  /claude-opus-4\.5/gi,  // Superseded by 4.6
  /claude-sonnet-4\.5/gi, // Superseded by 4.6
  /claude-haiku-4\.5/gi,  // Superseded
  
  // Google legacy (Gemini 1.x, 2.x)
  /gemini-1[-.]/gi,
  /gemini-2[-.]/gi,
  /gemini-pro(?!-preview|-image)/gi,
  /gemini-flash(?![\w-])/gi,
  
  // DeepSeek legacy
  /deepseek-v3\.0/gi,
  /deepseek-v3\.1/gi,
  /deepseek-coder/gi,
  
  // Other deprecated
  /grok-2/gi,
  /grok-3/gi,
  /grok-4\.0/gi,
  /llama-3/gi,
  /llama-2/gi,
];

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '.turbo',
  '.vercel',
  'coverage',
  '__snapshots__',
  '.worktrees',
]);

// File extensions to scan
const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
]);

// Files to skip (these are documentation or intentionally contain legacy references)
const SKIP_FILES = new Set([
  'policy-check.mjs', // This file
  'CHANGELOG.md',
  'MIGRATION.md',
  'openrouter.ts', // DEPRECATED_MODELS list - must contain legacy IDs for rejection
  'openrouter-model-catalog.ts', // Capability detection uses gpt-4/gpt-5 patterns
  'model-preferences.test.ts', // Tests deprecated model handling
]);

// ============================================================================
// Utility Functions
// ============================================================================

function getAllFiles(dir, files = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    
    if (SKIP_DIRS.has(item)) continue;
    if (SKIP_FILES.has(item)) continue;
    
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (SCAN_EXTENSIONS.has(extname(item))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

// ============================================================================
// Check Functions
// ============================================================================

function checkPackageJson(rootDir) {
  const violations = [];
  const pkgPath = join(rootDir, 'package.json');
  
  if (!existsSync(pkgPath)) {
    violations.push({
      file: 'package.json',
      line: 0,
      message: 'package.json not found',
      severity: 'error',
    });
    return violations;
  }
  
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  
  // Check Next.js version
  const nextVersion = deps['next'];
  if (nextVersion) {
    const majorMatch = nextVersion.match(/(\d+)/);
    if (majorMatch && parseInt(majorMatch[1]) < 16) {
      violations.push({
        file: 'package.json',
        line: 0,
        message: `Next.js version ${nextVersion} is below required 16.x`,
        severity: 'error',
      });
    }
  }
  
  // Check AI SDK version
  const aiVersion = deps['ai'];
  if (aiVersion) {
    const majorMatch = aiVersion.match(/(\d+)/);
    if (majorMatch && parseInt(majorMatch[1]) < 6) {
      violations.push({
        file: 'package.json',
        line: 0,
        message: `AI SDK version ${aiVersion} is below required 6.x`,
        severity: 'error',
      });
    }
  }
  
  // Check for deprecated packages
  const deprecatedPackages = [
    '@vercel/ai', // Old package name
    '@ai-sdk/openai', // Deprecated - use OpenRouter instead
    '@ai-sdk/anthropic', // Deprecated - use OpenRouter instead
  ];
  
  for (const pkg of deprecatedPackages) {
    if (deps[pkg]) {
      violations.push({
        file: 'package.json',
        line: 0,
        message: `Package ${pkg} detected - use @openrouter/ai-sdk-provider instead`,
        severity: 'error',
      });
    }
  }
  
  return violations;
}

function checkFileForLegacyModels(filePath, content) {
  const violations = [];
  
  // Check for legacy model patterns
  for (const pattern of LEGACY_PATTERNS) {
    let match;
    // Reset regex state
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      const matchText = match[0];
      
      // Check if this is inside a comment (basic check)
      const lineStart = content.lastIndexOf('\n', match.index) + 1;
      const lineContent = content.substring(lineStart, content.indexOf('\n', match.index));
      
      // Skip if in a single-line comment
      if (lineContent.includes('//') && lineContent.indexOf('//') < (match.index - lineStart)) {
        continue;
      }
      
      violations.push({
        file: filePath,
        line,
        message: `Legacy model ID "${matchText}" detected - use allowlisted 2026 models`,
        severity: 'error',
      });
    }
  }
  
  return violations;
}

function checkFileForDirectProviderCalls(filePath, content) {
  const violations = [];
  
  // Check for direct provider SDK imports that should go through OpenRouter
  const directProviderPatterns = [
    {
      pattern: /from ['"]@ai-sdk\/openai['"]/g,
      message: 'Direct @ai-sdk/openai import - use OpenRouter provider from lib/ai/openrouter.ts',
      severity: 'error',
      allowedPaths: [],
    },
    {
      pattern: /from ['"]@ai-sdk\/anthropic['"]/g,
      message: 'Direct @ai-sdk/anthropic import - use OpenRouter provider from lib/ai/openrouter.ts',
      severity: 'error',
      allowedPaths: [],
    },
    {
      pattern: /from ['"]openai['"]/g,
      message: 'Direct OpenAI SDK import - prefer OpenRouter routing',
      severity: 'warn',
      // Allow in certain files (LangChain, MCP)
      allowedPaths: ['langchain', 'mcp', 'langchain-client'],
    },
    {
      pattern: /from ['"]@anthropic-ai\/sdk['"]/g,
      message: 'Direct Anthropic SDK import - prefer OpenRouter routing',
      severity: 'error',
      allowedPaths: [],
    },
  ];
  
  for (const { pattern, message, severity, allowedPaths } of directProviderPatterns) {
    // Skip if file is in an allowed path
    if (allowedPaths.some(p => filePath.includes(p))) continue;
    
    let match;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(content)) !== null) {
      const line = getLineNumber(content, match.index);
      
      violations.push({
        file: filePath,
        line,
        message,
        severity,
      });
    }
  }
  
  return violations;
}

// ============================================================================
// Main Execution
// ============================================================================

function main() {
  console.log('🔍 Running policy checks...\n');
  
  const rootDir = process.cwd();
  const allViolations = [];
  
  // Check package.json
  console.log('📦 Checking package.json...');
  const pkgViolations = checkPackageJson(rootDir);
  allViolations.push(...pkgViolations);
  
  // Get all source files
  console.log('📄 Scanning source files...');
  const files = getAllFiles(rootDir);
  console.log(`   Found ${files.length} files to scan\n`);
  
  // Check each file
  for (const filePath of files) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const relativePath = filePath.replace(rootDir + '/', '');

      // Check for legacy models
      const modelViolations = checkFileForLegacyModels(relativePath, content);
      allViolations.push(...modelViolations);
      
      // Check for direct provider calls
      const providerViolations = checkFileForDirectProviderCalls(relativePath, content);
      allViolations.push(...providerViolations);
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  // Report results
  const errors = allViolations.filter(v => v.severity === 'error');
  const warnings = allViolations.filter(v => v.severity === 'warn');
  
  if (errors.length > 0) {
    console.log('❌ ERRORS:\n');
    for (const v of errors) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}\n`);
    }
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    for (const v of warnings) {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`    ${v.message}\n`);
    }
  }
  
  // Summary
  console.log('─'.repeat(50));
  console.log(`\n📊 Summary: ${errors.length} errors, ${warnings.length} warnings\n`);
  
  if (errors.length > 0) {
    console.log('❌ Policy check FAILED - fix errors before merging\n');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('⚠️  Policy check PASSED with warnings\n');
    process.exit(0);
  } else {
    console.log('✅ Policy check PASSED\n');
    process.exit(0);
  }
}

main();
