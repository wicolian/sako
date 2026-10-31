/**
 * Fixes publishedAt dates — spreads 60 posts weekly, newest first.
 * Run: SANITY_API_TOKEN=... npx tsx scripts/fix-dates.ts
 */
import { createClient } from '@sanity/client'

const client = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '6kk8tx3u',
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
    apiVersion: '2024-01-01',
    token: process.env.SANITY_API_TOKEN,
    useCdn: false,
})

async function fixDates() {
    const posts = await client.fetch(
        `*[_type == "post"] | order(_createdAt asc) { _id, title }`,
        {}
    ) as { _id: string; title: string }[]

    console.log(`Found ${posts.length} posts. Spreading dates weekly…`)

    // Newest post = ~1 week ago, each step = 7 days further back
    const now = new Date()
    // Start from 1 week ago, go backwards
    const transaction = client.transaction()

    posts.forEach((post, i) => {
        const date = new Date(now)
        // Newest first: post 0 = 7 days ago, post 1 = 14 days ago, etc.
        date.setDate(date.getDate() - 7 * (i + 1))
        // Randomize hour so it doesn't look scheduled
        date.setHours(8 + (i % 5) * 2, (i * 13) % 60, 0, 0)
        transaction.patch(post._id, { set: { publishedAt: date.toISOString() } })
    })

    await transaction.commit()
    console.log(`✅ Updated ${posts.length} posts with staggered weekly dates.`)
}

fixDates().catch(err => {
    console.error(err)
    process.exit(1)
})
