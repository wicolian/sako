/**
 * Social Content Calendar Generator
 * 
 * Generates 3-month content calendars with:
 * - Platform-specific optimization
 * - Posting time suggestions
 * - Hashtag research
 * - Content themes and pillars
 */

import { generateText, generateObject } from '@/lib/ai/langsmith-ai'
import { getModel } from '@/lib/ai/model-router'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { getBrandContext } from '@/lib/ai/brand-context'

// ============================================================================
// Types
// ============================================================================

export type SocialPlatform = 'instagram' | 'tiktok' | 'linkedin' | 'twitter' | 'facebook'

export interface SocialPost {
  id: string
  date: string // ISO date
  time: string // HH:MM format
  platform: SocialPlatform
  contentType: 'image' | 'video' | 'carousel' | 'story' | 'reel' | 'text'
  theme: string
  caption: string
  hashtags: string[]
  callToAction?: string
  visualDirection?: string
  status: 'draft' | 'scheduled' | 'published'
}

export interface ContentPillar {
  id: string
  name: string
  description: string
  percentage: number // % of content dedicated to this pillar
  examples: string[]
}

export interface SocialCalendar {
  id: string
  workspace_id: string
  brand_id: string
  name: string
  start_date: string
  end_date: string
  platforms: SocialPlatform[]
  content_pillars: ContentPillar[]
  posts: SocialPost[]
  posting_frequency: Record<SocialPlatform, number> // posts per week
  optimal_times: Record<SocialPlatform, string[]>
  created_at: string
  updated_at: string
}

export interface GenerateCalendarOptions {
  brandId: string
  platforms: SocialPlatform[]
  duration: 1 | 2 | 3 // months
  postsPerWeek: Record<SocialPlatform, number>
  contentPillars?: ContentPillar[]
  audience?: string
  goals?: string[]
}

// ============================================================================
// Calendar Generator
// ============================================================================

/**
 * Generate a content calendar
 */
export async function generateSocialCalendar(
  workspaceId: string,
  options: GenerateCalendarOptions
): Promise<SocialCalendar> {
  const {
    brandId,
    platforms,
    duration,
    postsPerWeek,
    contentPillars,
    audience,
    goals,
  } = options

  // Get brand context
  const brandContext = await getBrandContext(workspaceId, brandId)

  // Generate or use provided content pillars
  const brandContextString = brandContext ? JSON.stringify(brandContext) : null
  const pillars = contentPillars || await generateContentPillars(brandContextString, audience)

  // Get optimal posting times
  const optimalTimes = getOptimalPostingTimes(platforms)

  // Calculate date range
  const startDate = new Date()
  const endDate = new Date()
  endDate.setMonth(endDate.getMonth() + duration)

  // Generate posts
  const posts = await generatePosts({
    brandContext: brandContextString,
    platforms,
    pillars,
    postsPerWeek,
    optimalTimes,
    startDate,
    endDate,
    audience,
    goals,
  })

  // Create calendar object
  const calendar: SocialCalendar = {
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    brand_id: brandId,
    name: `${duration}-Month Content Calendar`,
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    platforms,
    content_pillars: pillars,
    posts,
    posting_frequency: postsPerWeek,
    optimal_times: optimalTimes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  // Save to database
  await saveCalendar(calendar)

  return calendar
}

/**
 * Generate content pillars for a brand
 */
async function generateContentPillars(
  brandContext: string | null,
  audience?: string
): Promise<ContentPillar[]> {
  const model = await getModel('anthropic/claude-sonnet-4.6')

  const PillarSchema = z.object({
    pillars: z.array(z.object({
      name: z.string(),
      description: z.string(),
      percentage: z.number(),
      examples: z.array(z.string()),
    })),
  })

  const { object } = await generateObject({
    model,
    schema: PillarSchema,
    prompt: `Create 4-5 content pillars for a social media strategy.

Brand Context:
${brandContext || 'No brand context provided'}

Target Audience: ${audience || 'General'}

Content pillars should:
- Cover different aspects of the brand's value proposition
- Include a mix of educational, entertaining, and promotional content
- Add up to 100% total
- Have clear, actionable examples

Return content pillars with name, description, percentage allocation, and 3-5 example post topics.`,
  })

  const result = object as { pillars: Array<{ name: string; description: string; percentage: number; examples: string[] }> }
  return result.pillars.map((p, index) => ({
    id: `pillar-${index}`,
    ...p,
  }))
}

/**
 * Generate posts for the calendar
 */
async function generatePosts(options: {
  brandContext: string | null
  platforms: SocialPlatform[]
  pillars: ContentPillar[]
  postsPerWeek: Record<SocialPlatform, number>
  optimalTimes: Record<SocialPlatform, string[]>
  startDate: Date
  endDate: Date
  audience?: string
  goals?: string[]
}): Promise<SocialPost[]> {
  const {
    brandContext,
    platforms,
    pillars,
    postsPerWeek,
    optimalTimes,
    startDate,
    endDate,
    audience,
    goals,
  } = options

  const posts: SocialPost[] = []
  const model = await getModel('anthropic/claude-sonnet-4.6')

  // Calculate total weeks
  const weeks = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
  )

  // Generate posts week by week for each platform
  for (const platform of platforms) {
    const weeklyPosts = postsPerWeek[platform] || 3
    const platformTimes = optimalTimes[platform] || ['12:00']

    for (let week = 0; week < weeks; week++) {
      // Distribute posts across pillars based on percentage
      const pillarDistribution = distributePosts(pillars, weeklyPosts)

      const weekStart = new Date(startDate)
      weekStart.setDate(weekStart.getDate() + week * 7)

      // Generate posts for this week
      const weekPosts = await generateWeekPosts({
        model,
        brandContext,
        platform,
        pillars,
        pillarDistribution,
        weekStart,
        times: platformTimes,
        audience,
        goals,
      })

      posts.push(...weekPosts)
    }
  }

  return posts.sort((a, b) => 
    new Date(`${a.date}T${a.time}`).getTime() - 
    new Date(`${b.date}T${b.time}`).getTime()
  )
}

/**
 * Generate posts for a single week
 */
async function generateWeekPosts(options: {
  model: Awaited<ReturnType<typeof getModel>>
  brandContext: string | null
  platform: SocialPlatform
  pillars: ContentPillar[]
  pillarDistribution: Record<string, number>
  weekStart: Date
  times: string[]
  audience?: string
  goals?: string[]
}): Promise<SocialPost[]> {
  const {
    model,
    brandContext,
    platform,
    pillars,
    pillarDistribution,
    weekStart,
    times,
    audience,
    goals,
  } = options

  const PostSchema = z.object({
    posts: z.array(z.object({
      dayOffset: z.number(), // 0-6 (Monday-Sunday)
      contentType: z.enum(['image', 'video', 'carousel', 'story', 'reel', 'text']),
      theme: z.string(),
      caption: z.string(),
      hashtags: z.array(z.string()),
      callToAction: z.string().optional(),
      visualDirection: z.string().optional(),
    })),
  })

  const pillarDetails = Object.entries(pillarDistribution)
    .map(([pillarId, count]) => {
      const pillar = pillars.find(p => p.id === pillarId)
      return pillar ? `- ${pillar.name} (${count} posts): ${pillar.description}` : ''
    })
    .filter(Boolean)
    .join('\n')

  const { object } = await generateObject({
    model,
    schema: PostSchema,
    prompt: `Generate ${Object.values(pillarDistribution).reduce((a, b) => a + b, 0)} social media posts for ${platform}.

Brand Context:
${brandContext || 'No brand context provided'}

Target Audience: ${audience || 'General'}
Goals: ${goals?.join(', ') || 'Engagement and brand awareness'}

Content Pillars to use:
${pillarDetails}

Platform: ${platform}
Week starting: ${weekStart.toLocaleDateString()}

Requirements:
- Optimize for ${platform}'s best practices
- Include trending hashtags relevant to the industry
- Vary content types appropriately for the platform
- Include clear calls to action
- Provide visual direction for imagery
- Space posts evenly across the week (dayOffset 0-6)

${getPlatformGuidelines(platform)}`,
  })

  const result = object as { posts: Array<{ dayOffset: number; contentType: 'image' | 'video' | 'carousel' | 'story' | 'reel' | 'text'; theme: string; caption: string; hashtags: string[]; callToAction?: string; visualDirection?: string }> }
  return result.posts.map((post, index) => {
    const postDate = new Date(weekStart)
    postDate.setDate(postDate.getDate() + post.dayOffset)
    const time = times[index % times.length]

    return {
      id: crypto.randomUUID(),
      date: postDate.toISOString().split('T')[0],
      time,
      platform,
      contentType: post.contentType,
      theme: post.theme,
      caption: post.caption,
      hashtags: post.hashtags,
      callToAction: post.callToAction,
      visualDirection: post.visualDirection,
      status: 'draft' as const,
    }
  })
}

/**
 * Distribute posts across content pillars
 */
function distributePosts(
  pillars: ContentPillar[],
  totalPosts: number
): Record<string, number> {
  const distribution: Record<string, number> = {}
  let remaining = totalPosts

  for (let i = 0; i < pillars.length; i++) {
    const pillar = pillars[i]
    if (i === pillars.length - 1) {
      distribution[pillar.id] = remaining
    } else {
      const count = Math.round((pillar.percentage / 100) * totalPosts)
      distribution[pillar.id] = Math.min(count, remaining)
      remaining -= distribution[pillar.id]
    }
  }

  return distribution
}

/**
 * Get optimal posting times for each platform
 */
function getOptimalPostingTimes(
  platforms: SocialPlatform[]
): Record<SocialPlatform, string[]> {
  const times: Record<SocialPlatform, string[]> = {
    instagram: ['08:00', '12:00', '17:00', '20:00'],
    tiktok: ['07:00', '12:00', '15:00', '19:00', '22:00'],
    linkedin: ['07:30', '10:00', '12:00', '17:30'],
    twitter: ['08:00', '12:00', '15:00', '18:00', '21:00'],
    facebook: ['09:00', '12:00', '15:00', '18:00'],
  }

  return Object.fromEntries(
    platforms.map(p => [p, times[p] || ['12:00']])
  ) as Record<SocialPlatform, string[]>
}

/**
 * Get platform-specific content guidelines
 */
function getPlatformGuidelines(platform: SocialPlatform): string {
  const guidelines: Record<SocialPlatform, string> = {
    instagram: `Instagram best practices:
- Captions can be longer (2200 chars) but front-load key message
- Use 3-5 strategic hashtags in caption, more in first comment
- Include line breaks for readability
- Reels and carousels get more reach than static images
- Stories for behind-the-scenes and timely content`,

    tiktok: `TikTok best practices:
- Hook viewers in first 1-2 seconds
- Captions should be punchy and hook-driven
- Use trending sounds and effects references
- 3-5 relevant hashtags
- Focus on entertainment value first`,

    linkedin: `LinkedIn best practices:
- Professional but personable tone
- Start with a strong hook statement
- Use line breaks and emojis sparingly for readability
- 3-5 industry-relevant hashtags
- Include thought leadership angle
- Ask questions to encourage comments`,

    twitter: `Twitter/X best practices:
- 280 character limit - be concise
- Thread format for longer content
- 2-3 relevant hashtags max
- Include media when possible
- Encourage retweets and replies`,

    facebook: `Facebook best practices:
- Can be longer but front-load value
- Native video performs well
- Ask questions for engagement
- Minimal hashtags (1-2 max)
- Include clear calls to action`,
  }

  return guidelines[platform] || ''
}

/**
 * Save calendar to database
 */
async function saveCalendar(calendar: SocialCalendar): Promise<void> {
  const supabase = createServiceClient()

  const { error } = await supabase
    .from('social_calendars')
    .upsert({
      id: calendar.id,
      workspace_id: calendar.workspace_id,
      brand_id: calendar.brand_id,
      name: calendar.name,
      start_date: calendar.start_date,
      end_date: calendar.end_date,
      platforms: calendar.platforms,
      content_pillars: calendar.content_pillars,
      posts: calendar.posts,
      posting_frequency: calendar.posting_frequency,
      optimal_times: calendar.optimal_times,
      created_at: calendar.created_at,
      updated_at: calendar.updated_at,
    })

  if (error) {
    console.error('Failed to save calendar:', error)
  }
}

/**
 * Generate hashtag suggestions
 */
export async function generateHashtags(
  topic: string,
  platform: SocialPlatform,
  count: number = 10
): Promise<string[]> {
  const model = await getModel('openai/gpt-5.3-chat')

  const HashtagSchema = z.object({
    hashtags: z.array(z.string()),
  })

  const { object } = await generateObject({
    model,
    schema: HashtagSchema,
    prompt: `Generate ${count} relevant hashtags for a ${platform} post about: ${topic}

Include a mix of:
- High-volume hashtags (100k+ posts)
- Medium-volume hashtags (10k-100k posts)  
- Niche hashtags (1k-10k posts)

Return just the hashtag text without the # symbol.`,
  })

  const result = object as { hashtags: string[] }
  return result.hashtags.map(h => h.startsWith('#') ? h : `#${h}`)
}
