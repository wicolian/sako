#!/usr/bin/env npx ts-node
/**
 * Cleanup Script: Fix corrupted imports from migration script
 * 
 * This script finds and fixes files where the Database import was 
 * incorrectly inserted in the middle of another import statement.
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DRY_RUN = process.argv.includes('--dry-run')

// Pattern to find corrupted imports like:
// "import { something import { Database }" or "impimport { Database }"
const CORRUPTED_PATTERNS = [
    // Pattern: text followed by "import { Database }" in the middle of a line
    /^(import\s*{\s*\w+)import\s*{\s*Database\s*}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n\s*\n(\w)/gm,
    // Pattern: "impimport { Database }"
    /impimport\s*{\s*Database\s*}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n\s*/g,
    // Pattern: "iimport { Database }"  
    /iimport\s*{\s*Database\s*}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n\s*/g,
    // Pattern: word + "import { Database }" mid-statement
    /(\w+)\s*import\s*{\s*Database\s*}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n\s*\n\s*/g,
]

function findCorruptedFiles(dir: string): string[] {
    const files: string[] = []

    function walk(currentDir: string) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true })

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name)

            if (entry.isDirectory()) {
                if (!['node_modules', '.next', '.git', 'dist', 'build', 'scripts'].includes(entry.name)) {
                    walk(fullPath)
                }
            } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
                const content = fs.readFileSync(fullPath, 'utf-8')
                // Check for any pattern of corrupted Database import
                if (
                    content.includes('impimport') ||
                    content.includes('iimport') ||
                    /\w+import\s*{\s*Database/.test(content) ||
                    /import\s*{\s*\w+import/.test(content)
                ) {
                    files.push(fullPath)
                }
            }
        }
    }

    walk(dir)
    return files
}

function fixFile(filePath: string): boolean {
    let content = fs.readFileSync(filePath, 'utf-8')
    const original = content

    // Fix: "import { creatimport { Database } from..." -> separate properly
    content = content.replace(
        /import\s*{\s*(\w+)import\s*{\s*Database\s*}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n+\s*(\w+)\s*/g,
        (match, prefix, suffix) => {
            return `import { ${prefix}${suffix}`
        }
    )

    // Fix: "impimport { Database }" -> "import { Database }"
    content = content.replace(
        /impimport\s*{\s*Database\s*}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n+\s*/g,
        ''
    )

    // Fix: "iimport { Database }" -> remove duplicate
    content = content.replace(
        /iimport\s*{\s*Database\s*}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n+\s*/g,
        ''
    )

    // Fix: "import { something import { Database }...type X = Database..."
    // This needs to be handled more carefully - restore original import and add Database at top
    content = content.replace(
        /import\s*{\s*(\w+)\s*import\s*{\s*Database\s*}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n+\s*type\s+(\w+Row)\s*=\s*Database\['public'\]\['Tables'\]\['(\w+)'\]\['Row'\]\s*(\w+)/gm,
        (match, prefix, typeName, tableName, suffix) => {
            return `import { ${prefix}${suffix}`
        }
    )

    // Fix generic pattern: word + import { Database } + newlines + starting letter
    content = content.replace(
        /(\w+)\s*import\s*{\s*Database\s*}\s*from\s*['"]@\/lib\/supabase\/types['"]\s*\n+\s*\n*type\s+\w+Row\s*=\s*Database\['public'\]\['Tables'\]\['\w+'\]\['Row'\]\s*\n*(\w+)/g,
        (match, prefix, suffix) => {
            return `${prefix}${suffix}`
        }
    )

    // Fix any remaining "word + import { Database }" patterns
    content = content.replace(
        /(\w+)import\s*{\s*Database\s*}\s*from\s*['"]@\/lib\/supabase\/types['"]/g,
        (match, prefix) => {
            return prefix
        }
    )

    // Remove orphaned type definitions that were inserted after the corrupted import
    content = content.replace(
        /\n+type\s+\w+Row\s*=\s*Database\['public'\]\['Tables'\]\['\w+'\]\['Row'\]\s*\n+(\w+}\s*from)/g,
        (match, suffix) => {
            return `\n${suffix}`
        }
    )

    if (content !== original) {
        if (!DRY_RUN) {
            fs.writeFileSync(filePath, content, 'utf-8')
        }
        console.log(`${DRY_RUN ? '[DRY-RUN] ' : ''}Fixed: ${filePath}`)
        return true
    }

    return false
}

async function main() {
    console.log('🔧 Cleanup Script: Fixing Corrupted Imports')
    console.log('==========================================')
    if (DRY_RUN) {
        console.log('⚠️  DRY RUN MODE - No files will be modified\n')
    }

    const rootDir = path.join(__dirname, '..')
    const targetDirs = [
        path.join(rootDir, 'app'),
        path.join(rootDir, 'lib'),
    ]

    const corruptedFiles: string[] = []
    for (const dir of targetDirs) {
        if (fs.existsSync(dir)) {
            corruptedFiles.push(...findCorruptedFiles(dir))
        }
    }

    console.log(`Found ${corruptedFiles.length} corrupted files\n`)

    let fixed = 0
    for (const file of corruptedFiles) {
        if (fixFile(file)) {
            fixed++
        }
    }

    console.log(`\n✅ Fixed ${fixed} files`)

    if (DRY_RUN) {
        console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.')
    }
}

main().catch(console.error)
