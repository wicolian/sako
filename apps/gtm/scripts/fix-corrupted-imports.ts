#!/usr/bin/env npx ts-node
/**
 * Fix Corrupted Imports Script
 * 
 * This script fixes files that were corrupted by the previous migration script.
 * It handles patterns like:
 * - "impimport { Database }" -> proper import
 * - "import { something import { Database }" -> separate imports
 * - Broken import paths
 * 
 * Usage: npx tsx scripts/fix-corrupted-imports.ts [--dry-run]
 */

import * as fs from 'fs'
import * as path from 'path'

const DRY_RUN = process.argv.includes('--dry-run')

interface FixResult {
  file: string
  fixed: boolean
  changes: string[]
}

/**
 * Fix a single file
 */
function fixFile(filePath: string): FixResult {
  const result: FixResult = {
    file: filePath,
    fixed: false,
    changes: [],
  }

  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    const original = content

    // Pattern 1: "impimport { Database }" -> remove the corrupted part
    if (content.includes('impimport')) {
      content = content.replace(
        /impimport\s*\{\s*Database\s*\}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n*/g,
        ''
      )
      result.changes.push('Removed corrupted "impimport { Database }"')
    }

    // Pattern 2: "iimport { Database }" -> remove
    if (content.includes('iimport')) {
      content = content.replace(
        /iimport\s*\{\s*Database\s*\}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n*/g,
        ''
      )
      result.changes.push('Removed corrupted "iimport { Database }"')
    }

    // Pattern 3: "import { something import { Database }" - fix the split import
    // This pattern appears when the script inserted in the middle of an import
    const splitImportPattern = /import\s*\{\s*(\w+(?:\s*,\s*\w+)*)\s*import\s*\{\s*Database\s*\}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n*\s*type\s+\w+Row\s*=\s*Database\['public'\]\['Tables'\]\['\w+'\]\['Row'\]\s*\n*(\w+(?:\s*,\s*\w+)*)\s*\}\s*from\s*['"]([^'"]+)['"]/g
    if (splitImportPattern.test(content)) {
      content = content.replace(splitImportPattern, (match, prefix, suffix, modulePath) => {
        return `import { ${prefix}${suffix} } from '${modulePath}'`
      })
      result.changes.push('Fixed split import statement')
    }

    // Pattern 4: "import { createimport { Database }" style corruption
    content = content.replace(
      /import\s*\{\s*(\w+)import\s*\{\s*Database\s*\}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n*\s*type\s+\w+Row\s*=\s*Database\['public'\]\['Tables'\]\['\w+'\]\['Row'\]\s*\n*(\w+)/g,
      (match, prefix, suffix) => {
        result.changes.push(`Fixed corrupted import starting with "${prefix}"`)
        return `import { ${prefix}${suffix}`
      }
    )

    // Pattern 5: Import path corruption like '@/import { Database }'
    content = content.replace(
      /'@\/import\s*\{\s*Database\s*\}\s*from\s*['"]@\/lib\/supabase\/types['"]/g,
      "'@/lib/supabase/service'"
    )
    if (content !== original && result.changes.length === 0) {
      result.changes.push('Fixed corrupted import path')
    }

    // Pattern 6: "import { validateClaim, import { Database }" - comma before import
    content = content.replace(
      /,\s*import\s*\{\s*Database\s*\}\s*from\s*['"]@\/lib\/supabase\/types['"]/g,
      ''
    )

    // Pattern 7: "import { something }import { Database }" - no space
    content = content.replace(
      /\}import\s*\{\s*Database\s*\}\s*from\s*['"]@\/lib\/supabase\/types['"]/g,
      '}'
    )

    // Pattern 8: Orphaned type definitions after corrupted imports
    content = content.replace(
      /\n+type\s+\w+Row\s*=\s*Database\['public'\]\['Tables'\]\['\w+'\]\['Row'\]\s*\n+(\w+\}\s*from)/g,
      '\n$1'
    )

    // Pattern 9: "ort { something" - truncated import keyword
    content = content.replace(
      /\n\s*ort\s*\{/g,
      '\nimport {'
    )

    // Pattern 10: Remove standalone type definitions that reference undefined Database
    // Only if Database is not properly imported
    if (!content.includes("from '@/lib/supabase/types'") && !content.includes('from "@/lib/supabase/types"')) {
      content = content.replace(
        /\n*type\s+\w+Row\s*=\s*Database\['public'\]\['Tables'\]\['\w+'\]\['Row'\]\s*\n*/g,
        '\n'
      )
    }

    // Pattern 11: Fix double newlines created by removals
    content = content.replace(/\n{3,}/g, '\n\n')

    // Check if we made changes
    if (content !== original) {
      result.fixed = true
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, content, 'utf-8')
      }
    }

  } catch (error) {
    console.error(`Error processing ${filePath}:`, error)
  }

  return result
}

/**
 * Find all TypeScript files that might be corrupted
 */
function findCorruptedFiles(dir: string): string[] {
  const files: string[] = []

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(entry.name)) {
          walk(fullPath)
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        // Check for corruption patterns
        if (
          content.includes('impimport') ||
          content.includes('iimport') ||
          /\w+import\s*\{\s*Database/.test(content) ||
          /import\s*\{\s*\w+import/.test(content) ||
          /@\/import\s*\{/.test(content) ||
          /,\s*import\s*\{\s*Database/.test(content) ||
          /\}import\s*\{/.test(content) ||
          /\n\s*ort\s*\{/.test(content)
        ) {
          files.push(fullPath)
        }
      }
    }
  }

  walk(dir)
  return files
}

async function main() {
  console.log('🔧 Fix Corrupted Imports Script')
  console.log('================================')
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No files will be modified\n')
  }

  const rootDir = path.join(__dirname, '..')
  const targetDirs = [
    path.join(rootDir, 'app'),
    path.join(rootDir, 'lib'),
    path.join(rootDir, 'components'),
  ]

  const corruptedFiles: string[] = []
  for (const dir of targetDirs) {
    if (fs.existsSync(dir)) {
      corruptedFiles.push(...findCorruptedFiles(dir))
    }
  }

  console.log(`Found ${corruptedFiles.length} potentially corrupted files\n`)

  const results: FixResult[] = []
  for (const file of corruptedFiles) {
    const result = fixFile(file)
    results.push(result)
    if (result.fixed) {
      console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}✅ Fixed: ${file}`)
      result.changes.forEach(c => console.log(`   - ${c}`))
    }
  }

  const fixed = results.filter(r => r.fixed).length
  console.log(`\n📊 Summary: Fixed ${fixed} of ${corruptedFiles.length} files`)

  if (DRY_RUN) {
    console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.')
  }
}

main().catch(console.error)
