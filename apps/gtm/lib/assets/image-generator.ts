/**
 * AI Image Generation (Phase 2.1)
 * 
 * Generate brand-consistent images using Replicate API.
 */

import Replicate from 'replicate'
import { createServiceClient } from '@/lib/supabase/service'
import { getBrandContext } from '@/lib/ai/brand-context'

export interface ImageGenerationParams {
  prompt: string
  workspaceId: string
  brandId?: string
  campaignId?: string
  style?: 'photography' | 'illustration' | '3d' | 'flat_design' | 'abstract'
  dimensions?: '1200x628' | '1080x1080' | '1920x1080' | '1080x1920' | '800x800' | 'custom'
  customWidth?: number
  customHeight?: number
  negativePrompt?: string
  tags?: string[]
}

export interface GeneratedImage {
  id: string
  url: string
  thumbnailUrl?: string
  prompt: string
  enhancedPrompt: string
  style: string
  dimensions: string
  storagePath: string
}

// Replicate client initialization
const replicate = process.env.REPLICATE_API_TOKEN
  ? new Replicate({ auth: process.env.REPLICATE_API_TOKEN })
  : null

// Replicate model for image generation (FLUX.1 [dev] - high quality, fast)
const REPLICATE_MODEL = 'black-forest-labs/flux-dev'

/**
 * Generate an AI image with brand styling
 */
export async function generateImage(params: ImageGenerationParams): Promise<GeneratedImage> {
  const {
    prompt,
    workspaceId,
    brandId,
    campaignId,
    style = 'photography',
    dimensions = '1200x628',
    negativePrompt,
    tags = [],
  } = params

  const supabase = createServiceClient()

  // Get brand context for styling
  const brand = await getBrandContext(workspaceId, brandId)

  // Build enhanced prompt with brand context
  const enhancedPromptParts: string[] = [
    'Create a professional marketing image.',
    '',
    prompt,
    '',
    `Style: ${style}`,
    `Dimensions: ${dimensions}`,
  ]

  if (brand) {
    enhancedPromptParts.push('')
    enhancedPromptParts.push('Brand Guidelines:')
    enhancedPromptParts.push(`- Primary color: ${brand.colors.primary}`)
    if (brand.colors.secondary) {
      enhancedPromptParts.push(`- Secondary color: ${brand.colors.secondary}`)
    }
    if (brand.visualStyle?.theme) {
      enhancedPromptParts.push(`- Visual theme: ${brand.visualStyle.theme}`)
    }
    if (brand.visualStyle?.imageStyle) {
      enhancedPromptParts.push(`- Image style: ${brand.visualStyle.imageStyle}`)
    }
  }

  enhancedPromptParts.push('')
  enhancedPromptParts.push('Requirements:')
  enhancedPromptParts.push('- Suitable for commercial marketing use')
  enhancedPromptParts.push('- High quality, professional appearance')
  enhancedPromptParts.push('- Clean composition with clear focal point')
  enhancedPromptParts.push('- Modern, contemporary aesthetic')

  if (negativePrompt) {
    enhancedPromptParts.push('')
    enhancedPromptParts.push(`Avoid: ${negativePrompt}`)
  }

  const enhancedPrompt = enhancedPromptParts.join('\n')

  // Parse dimensions
  const [width, height] = dimensions.split('x').map(Number)

  // Generate unique filename
  const timestamp = Date.now()
  const filename = `image_${timestamp}_${style}.png`
  const storagePath = `workspaces/${workspaceId}/images/${filename}`

  // Generate the image using Replicate
  if (!replicate) {
    throw new Error(
      'Image generation not configured. Set REPLICATE_API_TOKEN in environment variables.'
    )
  }

  // Build negative prompt for better quality
  const fullNegativePrompt = [
    'blurry',
    'low quality',
    'distorted',
    'watermark',
    'text overlay',
    'ugly',
    'deformed',
    negativePrompt,
  ]
    .filter(Boolean)
    .join(', ')

  // Generate image via Replicate
  const output = await replicate.run(REPLICATE_MODEL, {
    input: {
      prompt: enhancedPrompt,
      negative_prompt: fullNegativePrompt,
      width,
      height,
      num_outputs: 1,
      guidance_scale: 7.5,
      num_inference_steps: 28,
    },
  }) as string[]

  if (!output || output.length === 0 || !output[0]) {
    throw new Error('Image generation failed: No output received from Replicate')
  }

  const imageUrl = Array.isArray(output) ? output[0] : output

  // Download the generated image
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.statusText}`)
  }

  const imageBuffer = await imageResponse.arrayBuffer()
  const imageBytes = Buffer.from(imageBuffer)

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('campaign-assets')
    .upload(storagePath, imageBytes, {
      contentType: 'image/png',
      upsert: false,
    })

  if (uploadError) {
    console.error('Failed to upload image to storage:', uploadError)
    throw new Error('Failed to upload generated image to storage')
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('campaign-assets')
    .getPublicUrl(storagePath)

  const publicUrl = urlData.publicUrl

  // Generate thumbnail (for now, use same URL - could resize in future)
  const thumbnailUrl = publicUrl

  // Save to database
  const { data: savedImage, error } = await supabase
    .from('generated_images')
    .insert({
      workspace_id: workspaceId,
      campaign_id: campaignId || null,
      brand_id: brandId || null,
      prompt: prompt,
      enhanced_prompt: enhancedPrompt,
      negative_prompt: negativePrompt,
      style: style,
      dimensions: dimensions,
      model: REPLICATE_MODEL,
      storage_path: storagePath,
      public_url: publicUrl,
      thumbnail_url: thumbnailUrl,
      generation_params: {
        width,
        height,
        style,
      },
      brand_colors_used: brand ? [brand.colors.primary, brand.colors.secondary].filter(Boolean) : [],
      tags: tags,
      status: 'completed',
    })
    .select()
    .maybeSingle()

  if (error) {
    console.error('Failed to save generated image:', error)
    throw new Error('Failed to save generated image')
  }

  return {
    id: savedImage.id,
    url: publicUrl,
    thumbnailUrl: thumbnailUrl,
    prompt: prompt,
    enhancedPrompt: enhancedPrompt,
    style: style,
    dimensions: dimensions,
    storagePath: storagePath,
  }
}

/**
 * Get images for a workspace
 */
export async function getWorkspaceImages(
  workspaceId: string,
  options?: {
    campaignId?: string
    style?: string
    limit?: number
    offset?: number
  }
): Promise<GeneratedImage[]> {
  const supabase = createServiceClient()

  let query = supabase
    .from('generated_images')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (options?.campaignId) {
    query = query.eq('campaign_id', options.campaignId)
  }

  if (options?.style) {
    query = query.eq('style', options.style)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options?.limit || 20) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch images:', error)
    return []
  }

  return (data || []).map(img => ({
    id: img.id,
    url: img.public_url,
    thumbnailUrl: img.thumbnail_url,
    prompt: img.prompt,
    enhancedPrompt: img.enhanced_prompt,
    style: img.style,
    dimensions: img.dimensions,
    storagePath: img.storage_path,
  }))
}

/**
 * Delete an image
 */
export async function deleteImage(imageId: string): Promise<boolean> {
  const supabase = createServiceClient()

  // Get image details first
  const { data: image } = await supabase
    .from('generated_images')
    .select('storage_path')
    .eq('id', imageId)
    .maybeSingle()

  if (!image) {
    return false
  }

  // Delete from storage
  await supabase.storage
    .from('campaign-assets')
    .remove([image.storage_path])

  // Delete from database
  const { error } = await supabase
    .from('generated_images')
    .delete()
    .eq('id', imageId)

  return !error
}

/**
 * Get suggested dimensions for a content type
 */
export function getSuggestedDimensions(contentType: string): Array<{
  name: string
  dimensions: string
  aspectRatio: string
}> {
  const dimensionSuggestions: Record<string, Array<{ name: string; dimensions: string; aspectRatio: string }>> = {
    social: [
      { name: 'Instagram Post', dimensions: '1080x1080', aspectRatio: '1:1' },
      { name: 'Instagram Story', dimensions: '1080x1920', aspectRatio: '9:16' },
      { name: 'LinkedIn Post', dimensions: '1200x628', aspectRatio: '1.91:1' },
      { name: 'Twitter Post', dimensions: '1200x675', aspectRatio: '16:9' },
      { name: 'Facebook Post', dimensions: '1200x630', aspectRatio: '1.91:1' },
    ],
    ad: [
      { name: 'Google Display', dimensions: '1200x628', aspectRatio: '1.91:1' },
      { name: 'Facebook/Instagram Ad', dimensions: '1080x1080', aspectRatio: '1:1' },
      { name: 'Story Ad', dimensions: '1080x1920', aspectRatio: '9:16' },
      { name: 'Banner', dimensions: '728x90', aspectRatio: '8.1:1' },
    ],
    landing_page: [
      { name: 'Hero Image', dimensions: '1920x1080', aspectRatio: '16:9' },
      { name: 'Feature Image', dimensions: '800x600', aspectRatio: '4:3' },
      { name: 'Thumbnail', dimensions: '400x300', aspectRatio: '4:3' },
    ],
    email: [
      { name: 'Email Header', dimensions: '600x200', aspectRatio: '3:1' },
      { name: 'Email Hero', dimensions: '600x300', aspectRatio: '2:1' },
      { name: 'Product Image', dimensions: '300x300', aspectRatio: '1:1' },
    ],
  }

  return dimensionSuggestions[contentType] || dimensionSuggestions.ad
}

/**
 * Get available image styles
 */
export function getImageStyles(): Array<{
  id: string
  name: string
  description: string
}> {
  return [
    { id: 'photography', name: 'Photography', description: 'Realistic photographic style' },
    { id: 'illustration', name: 'Illustration', description: 'Hand-drawn or digital illustration' },
    { id: '3d', name: '3D Render', description: 'Three-dimensional rendered graphics' },
    { id: 'flat_design', name: 'Flat Design', description: 'Minimalist flat design aesthetic' },
    { id: 'abstract', name: 'Abstract', description: 'Abstract and artistic visuals' },
  ]
}
