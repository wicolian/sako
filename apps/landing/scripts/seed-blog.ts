/**
 * Seed Blog Posts Script
 *
 * Run from the sako/ Sanity sub-workspace (where @sanity/client is installed):
 *
 *   cd sako
 *   SANITY_API_TOKEN=<your-write-token> npx tsx ../scripts/seed-blog.ts
 *
 * Or install @sanity/client in the root workspace first:
 *
 *   npm install --save-dev @sanity/client
 *   SANITY_API_TOKEN=<your-write-token> npx tsx scripts/seed-blog.ts
 *
 * Requires SANITY_API_TOKEN with write (editor) access.
 * NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET are read from env
 * (defaults: project id = replace-me, dataset = production).
 *
 * Posts are batched in groups of 10. Existing slugs are skipped (idempotent).
 */

import { createClient } from '@sanity/client'
import { roiRevenuePosts } from './blog-posts/roi-revenue'
import { agencyComparisonPosts } from './blog-posts/agency-comparison'
import { designOpsPosts } from './blog-posts/design-ops'
import { b2bMarketingPosts } from './blog-posts/b2b-marketing'
import { informationalPosts } from './blog-posts/informational'
import { seoKeywordsPosts } from './blog-posts/seo-keywords'
import { processPosts } from './blog-posts/process'
import { growthPosts } from './blog-posts/growth'
import { motionPosts } from './blog-posts/motion'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SanityPost {
    title: string
    slug: string
    excerpt: string
    category: string
    keywords: string[]
    /** Raw Markdown string that will be converted to Sanity Portable Text */
    body: string
}

// ─── Sanity client ────────────────────────────────────────────────────────────

const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'replace-me',
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_API_TOKEN,
    useCdn: false,
})

// ─── Markdown → Sanity Portable Text (minimal, no deps) ──────────────────────

type PTBlock = {
    _type: 'block'
    _key: string
    style: string
    listItem?: string
    level?: number
    markDefs: unknown[]
    children: { _type: 'span'; _key: string; text: string; marks: string[] }[]
}

let _keyCounter = 0
const key = () => `k${_keyCounter++}`

export function markdownToBlocks(md: string): PTBlock[] {
    const lines = md.split('\n')
    const blocks: PTBlock[] = []
    let listBuffer: string[] = []
    let tableBuffer: string[][] = []

    const flushList = () => {
        for (const item of listBuffer) {
            // Strip the bullet/dash prefix, then strip GFM checkbox markers ([ ] or [x])
            const raw = item.replace(/^[-*]\s+/, '').replace(/^\[[ xX]\]\s*/, '')
            blocks.push({
                _type: 'block',
                _key: key(),
                style: 'normal',
                listItem: 'bullet',
                level: 1,
                markDefs: [],
                children: [{ _type: 'span', _key: key(), text: raw, marks: [] }],
            })
        }
        listBuffer = []
    }

    const flushTable = () => {
        if (tableBuffer.length === 0) return
        blocks.push({
            _type: 'tableBlock' as any,
            _key: key(),
            rows: tableBuffer.map(cells => ({ _type: 'tableRow', _key: key(), cells })),
        } as any)
        tableBuffer = []
    }

    for (const rawLine of lines) {
        const line = rawLine.trimEnd()

        // List items
        if (/^[-*]\s+/.test(line)) {
            listBuffer.push(line)
            continue
        }

        if (listBuffer.length) flushList()

        // Table row — accumulate into tableBuffer, skip separator rows
        if (/^[|]/.test(line)) {
            if (/^\|[\s\-|]+\|$/.test(line)) continue
            const cells = line.replace(/^\||\|$/g, '').split('|').map(c => c.trim())
            tableBuffer.push(cells)
            continue
        }

        if (tableBuffer.length) flushTable()

        // Blank line
        if (!line.trim()) continue

        // Heading
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
        if (headingMatch) {
            const level = headingMatch[1].length
            const style = level === 1 ? 'h1' : level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4'
            blocks.push({
                _type: 'block',
                _key: key(),
                style,
                markDefs: [],
                children: [{ _type: 'span', _key: key(), text: headingMatch[2], marks: [] }],
            })
            continue
        }

        // Code block fence — skip
        if (/^```/.test(line)) continue

        // Normal paragraph — strip inline markdown (bold, italic, links, backticks)
        const text = line
            .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
            .replace(/\*(.+?)\*/g, '$1')       // italic
            .replace(/`(.+?)`/g, '$1')         // code
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links → just label

        if (text.trim()) {
            blocks.push({
                _type: 'block',
                _key: key(),
                style: 'normal',
                markDefs: [],
                children: [{ _type: 'span', _key: key(), text, marks: [] }],
            })
        }
    }

    if (listBuffer.length) flushList()
    if (tableBuffer.length) flushTable()
    return blocks
}

// ─── Seed runner ─────────────────────────────────────────────────────────────

const ALL_POSTS: SanityPost[] = [
    ...roiRevenuePosts,
    ...agencyComparisonPosts,
    ...designOpsPosts,
    ...b2bMarketingPosts,
    ...informationalPosts,
    ...seoKeywordsPosts,
    ...processPosts,
    ...growthPosts,
    ...motionPosts,
]

async function seed() {
    console.log(`\n📝  Seeding ${ALL_POSTS.length} blog posts to Sanity…\n`)

    const BATCH_SIZE = 10
    let created = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < ALL_POSTS.length; i += BATCH_SIZE) {
        const batch = ALL_POSTS.slice(i, i + BATCH_SIZE)

        // Check which slugs already exist
        const slugs = batch.map(p => p.slug)
        const existing: { slug: { current: string } }[] = await client.fetch(
            `*[_type == "post" && slug.current in $slugs]{ slug }`,
            { slugs }
        )
        const existingSlugs = new Set(existing.map(e => e.slug.current))

        const transaction = client.transaction()

        for (const post of batch) {
            if (existingSlugs.has(post.slug)) {
                console.log(`  ⏭️  Skip (exists): ${post.slug}`)
                skipped++
                continue
            }

            const doc = {
                _type: 'post',
                title: post.title,
                slug: { _type: 'slug', current: post.slug },
                publishedAt: new Date().toISOString(),
                excerpt: post.excerpt,
                metaDescription: `${post.excerpt.slice(0, 155)}…`,
                keywords: post.keywords,
                category: post.category,
                body: markdownToBlocks(post.body),
                published: true,
            }

            transaction.createIfNotExists({ _id: `blog-${post.slug}`, ...doc })
            created++
        }

        try {
            await transaction.commit()
            console.log(`  ✅  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length - (skipped % BATCH_SIZE)} created`)
        } catch (err) {
            console.error(`  ❌  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err)
            errors += batch.length
        }
    }

    console.log(`\n──────────────────────────────────`)
    console.log(`  Created : ${created}`)
    console.log(`  Skipped : ${skipped}`)
    console.log(`  Errors  : ${errors}`)
    console.log(`  Total   : ${ALL_POSTS.length}`)
    console.log(`──────────────────────────────────\n`)

    if (errors > 0) process.exit(1)
}

seed().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
