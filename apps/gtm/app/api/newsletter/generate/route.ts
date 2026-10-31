import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  generateNewsletter,
  generateSubjectLineVariations,
  exportNewsletterToHtml,
  exportToKlaviyo,
  exportToMailchimp,
} from '@/lib/assets/newsletter-generator'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const workspaceId = membership.workspace_id
    const body = await request.json()

    const {
      topic,
      audience,
      tone,
      goal,
      includeDesigns = true,
      designCount = 3,
      ctaUrl,
      brandId,
      exportFormat,
      exportDesignIndex,
    } = body

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      )
    }

    // Generate the newsletter
    const newsletter = await generateNewsletter(workspaceId, {
      topic,
      audience,
      tone,
      goal,
      includeDesigns,
      designCount,
      ctaUrl,
      brandId,
    })

    // Handle export if requested
    let exportResult = null
    if (exportFormat) {
      const designIndex = exportDesignIndex || 0

      switch (exportFormat) {
        case 'html':
          exportResult = {
            format: 'html',
            data: exportNewsletterToHtml(newsletter, designIndex),
          }
          break
        case 'klaviyo':
          exportResult = {
            format: 'klaviyo',
            data: exportToKlaviyo(newsletter, designIndex),
          }
          break
        case 'mailchimp':
          exportResult = {
            format: 'mailchimp',
            data: exportToMailchimp(newsletter, designIndex),
          }
          break
      }
    }

    // Save to database
    const { error: saveError } = await supabase
      .from('newsletters')
      .insert({
        workspace_id: workspaceId,
        topic: newsletter.topic,
        audience: newsletter.audience,
        tone: newsletter.tone,
        subject_lines: newsletter.subjectLines,
        preheaders: newsletter.preheaders,
        content: newsletter.content,
        designs: newsletter.designs,
        claims: newsletter.claims,
      })

    if (saveError) {
      console.error('Failed to save newsletter:', saveError)
      // Continue without saving - generation succeeded
    }

    return NextResponse.json({
      newsletter,
      export: exportResult,
    })
  } catch (error) {
    console.error('Newsletter generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate newsletter' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const workspaceId = membership.workspace_id
    const { searchParams } = new URL(request.url)
    
    const action = searchParams.get('action')

    // Generate subject line variations
    if (action === 'subject-lines') {
      const topic = searchParams.get('topic')
      const tone = searchParams.get('tone') || 'professional'
      const count = parseInt(searchParams.get('count') || '5', 10)

      if (!topic) {
        return NextResponse.json(
          { error: 'Topic is required for subject lines' },
          { status: 400 }
        )
      }

      const subjectLines = await generateSubjectLineVariations(topic, tone, count)
      return NextResponse.json({ subjectLines })
    }

    // List newsletters
    const { data: newsletters, error } = await supabase
      .from('newsletters')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch newsletters' },
        { status: 500 }
      )
    }

    return NextResponse.json({ newsletters })
  } catch (error) {
    console.error('Newsletter fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch newsletters' },
      { status: 500 }
    )
  }
}
