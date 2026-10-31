#!/usr/bin/env npx ts-node
/**
 * Remove Type Annotations Script
 * 
 * Removes the type annotations from .from<TypeName>() calls since
 * the db client doesn't actually use them and they cause TypeScript errors.
 * 
 * Usage: npx tsx scripts/remove-type-annotations.ts [--dry-run]
 */

import * as fs from 'fs'
import * as path from 'path'

const DRY_RUN = process.argv.includes('--dry-run')

interface FixResult {
  file: string
  fixed: boolean
  changes: number
}

/**
 * Fix a single file
 */
function fixFile(filePath: string): FixResult {
  const result: FixResult = {
    file: filePath,
    fixed: false,
    changes: 0,
  }

  try {
    let content = fs.readFileSync(filePath, 'utf-8')
    const original = content

    // Pattern: .from<TypeName>('table') -> .from('table')
    const pattern = /\.from<[A-Za-z_]+>\(/g
    const matches = content.match(pattern)
    
    if (matches) {
      result.changes = matches.length
      content = content.replace(pattern, '.from(')
    }

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
 * Find all TypeScript files with type annotations
 */
function findFilesWithAnnotations(dir: string): string[] {
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
        // Check for type annotation pattern
        if (/\.from<[A-Za-z_]+>\(/.test(content)) {
          files.push(fullPath)
        }
      }
    }
  }

  walk(dir)
  return files
}

async function main() {
  console.log('🔧 Remove Type Annotations Script')
  console.log('==================================')
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No files will be modified\n')
  }

  const rootDir = path.join(__dirname, '..')
  const targetDirs = [
    path.join(rootDir, 'app'),
    path.join(rootDir, 'lib'),
    path.join(rootDir, 'components'),
  ]

  const filesToFix: string[] = []
  for (const dir of targetDirs) {
    if (fs.existsSync(dir)) {
      filesToFix.push(...findFilesWithAnnotations(dir))
    }
  }

  console.log(`Found ${filesToFix.length} files with type annotations\n`)

  const results: FixResult[] = []
  let totalChanges = 0
  for (const file of filesToFix) {
    const result = fixFile(file)
    results.push(result)
    if (result.fixed) {
      totalChanges += result.changes
      console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}✅ Fixed: ${file} (${result.changes} changes)`)
    }
  }

  const fixed = results.filter(r => r.fixed).length
  console.log(`\n📊 Summary: Fixed ${fixed} files with ${totalChanges} total changes`)

  if (DRY_RUN) {
    console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.')
  }
}

main().catch(console.error)
