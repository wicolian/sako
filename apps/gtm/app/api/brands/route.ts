import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient as createClient } from '@/lib/supabase/server'
import { getWorkspaceContext } from '@/lib/workspace'
import { z } from 'zod'

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

const CreateBrandSchema = z.object({
  name: z.string().min(1).max(100),
  tagline: z.string().optional(),
  description: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  
  // Colors (primary required for direct create; optional when using onboarding payload)
  primary_color: z.string().regex(HEX_COLOR).optional(),
  secondary_color: z.string().regex(HEX_COLOR).optional(),
  accent_color: z.string().regex(HEX_COLOR).optional(),
  background_color: z.string().optional(),
  text_color: z.string().optional(),
  color_palette: z.array(z.object({
    name: z.string(),
    hex: z.string(),
    usage: z.string().optional(),
  })).optional(),
  gradients: z.array(z.object({
    name: z.string(),
    css: z.string(),
  })).optional(),

  // Typography
  font_family: z.string().default('Inter'),
  font_heading: z.string().optional(),
  font_mono: z.string().optional(),
  font_cdn_url: z.string().url().optional(),
  
  // Voice & Messaging
  voice: z.string().optional(),
  tone_attributes: z.array(z.string()).optional(),
  key_messages: z.array(z.string()).optional(),
  value_propositions: z.array(z.string()).optional(),
  boilerplate: z.string().optional(),
  
  // Visual Style
  visual_style: z.object({
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    corners: z.enum(['sharp', 'rounded', 'pill']).optional(),
    shadows: z.enum(['none', 'subtle', 'medium', 'bold']).optional(),
    animations: z.enum(['none', 'subtle', 'playful']).optional(),
  }).optional(),
  icon_style: z.string().optional(),
  image_style: z.string().optional(),
  
  // Guidelines
  guidelines_url: z.string().url().optional(),
  dos: z.array(z.string()).optional(),
  donts: z.array(z.string()).optional(),
  
  // Social
  social_links: z.record(z.string()).optional(),
  
  // Logos
  logo_primary_url: z.string().url().optional(),
  logo_primary_dark_url: z.string().url().optional(),
  logo_icon_url: z.string().url().optional(),
  favicon_url: z.string().url().optional(),
  
  is_default: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { workspaceId } = await getWorkspaceContext(request)

    const { data: brands, error } = await supabase
      .from('brands')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch brands:', error)
      return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 })
    }

    return NextResponse.json({ brands })
  } catch (error) {
    console.error('Brands error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** Map onboarding import payload to brand create shape with safe defaults */
function mapOnboardingToBrand(body: {
  name?: string
  imported_from_url?: string
  brand_data?: { name?: string; tagline?: string; voice?: { tone?: string }; valuePropositions?: string[]; logoUrl?: string }
  design_tokens?: {
    colors?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string }
    typography?: { fontFamily?: string; fontHeading?: string }
  }
}): z.infer<typeof CreateBrandSchema> {
  const brand = body.brand_data
  const tokens = body.design_tokens
  const safeHex = (v: string | undefined): string =>
    v && HEX_COLOR.test(v) ? v : '#000000'
  return {
    name: brand?.name || body.name || 'Imported Brand',
    tagline: brand?.tagline,
    website_url: body.imported_from_url || '',
    primary_color: safeHex(tokens?.colors?.primary),
    secondary_color: safeHex(tokens?.colors?.secondary) || undefined,
    accent_color: safeHex(tokens?.colors?.accent) || undefined,
    background_color: tokens?.colors?.background && HEX_COLOR.test(tokens.colors.background) ? tokens.colors.background : undefined,
    text_color: tokens?.colors?.text && HEX_COLOR.test(tokens.colors.text) ? tokens.colors.text : undefined,
    font_family: tokens?.typography?.fontFamily && tokens.typography.fontFamily !== 'Not detected' ? tokens.typography.fontFamily : 'Inter',
    font_heading: tokens?.typography?.fontHeading && tokens.typography.fontHeading !== 'Not detected' ? tokens.typography.fontHeading : undefined,
    voice: brand?.voice?.tone,
    value_propositions: brand?.valuePropositions,
    logo_primary_url: brand?.logoUrl && (brand.logoUrl.startsWith('http') ? brand.logoUrl : undefined),
    is_default: true,
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { workspaceId } = await getWorkspaceContext(request)

    const body = await request.json()

    // Onboarding payload: { name, imported_from_url, brand_data, design_tokens }
    const isOnboarding =
      body != null &&
      typeof body === 'object' &&
      (body.design_tokens != null || body.brand_data != null) &&
      body.primary_color == null

    const validatedData = isOnboarding
      ? CreateBrandSchema.parse(mapOnboardingToBrand(body))
      : CreateBrandSchema.parse({ ...body, primary_color: body.primary_color ?? body.design_tokens?.colors?.primary ?? '#000000' })

    // Ensure required primary_color for DB
    const primary_color = validatedData.primary_color && HEX_COLOR.test(validatedData.primary_color)
      ? validatedData.primary_color
      : '#000000'

    // If this is set as default, unset other defaults first
    if (validatedData.is_default) {
      await supabase
        .from('brands')
        .update({ is_default: false })
        .eq('workspace_id', workspaceId)
        .eq('is_default', true)
    }

    const { data: brand, error } = await supabase
      .from('brands')
      .insert({
        workspace_id: workspaceId,
        ...validatedData,
        primary_color,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create brand:', error)
      return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 })
    }

    return NextResponse.json({ brand }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 })
    }
    console.error('Brand creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
