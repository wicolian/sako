/**
 * Force-reseed posts that contain tables (previously seeded with broken pipe-text rendering).
 * Run with:
 *   SANITY_API_TOKEN=<token> NEXT_PUBLIC_SANITY_PROJECT_ID=6kk8tx3u NEXT_PUBLIC_SANITY_DATASET=production \
 *   npx tsx scripts/force-reseed-tables.ts
 */
import { createClient } from '@sanity/client'
import { agencyComparisonPosts } from './blog-posts/agency-comparison'
import { designOpsPosts } from './blog-posts/design-ops'
import { informationalPosts } from './blog-posts/informational'
import { markdownToBlocks } from './seed-blog'

const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '6kk8tx3u',
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_API_TOKEN,
    useCdn: false,
})

// All posts from the 3 files that contained markdown tables
const TABLE_POSTS = [
    ...agencyComparisonPosts,
    ...designOpsPosts,
    ...informationalPosts,
]

async function forceReseed() {
    console.log(`\n🔄  Force-reseeding ${TABLE_POSTS.length} posts with table content…\n`)

    let updated = 0
    let errors = 0

    for (const post of TABLE_POSTS) {
        const docId = `blog-${post.slug}`
        try {
            await client.createOrReplace({
                _id: docId,
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
            })
            console.log(`  ✅  Updated: ${post.slug}`)
            updated++
        } catch (err) {
            console.error(`  ❌  Failed: ${post.slug}`, err)
            errors++
        }
    }

    console.log(`\n──────────────────────────────────`)
    console.log(`  Updated : ${updated}`)
    console.log(`  Errors  : ${errors}`)
    console.log(`──────────────────────────────────\n`)

    if (errors > 0) process.exit(1)
}

forceReseed().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})
