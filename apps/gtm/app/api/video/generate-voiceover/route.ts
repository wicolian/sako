/**
 * Video Voiceover Generation API (Jan 2026)
 * 
 * Generate voiceovers using ElevenLabs API.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getWorkspaceIdWithFallback } from '@/lib/workspace'
import { 
  generateSpeech, 
  getVoices, 
  estimateCost,
  selectVoiceForBrand,
  RECOMMENDED_VOICES,
  type VoiceSettings,
} from '@/lib/video/elevenlabs'
import { getBrandContext } from '@/lib/ai/brand-context'

export async function POST(request: NextRequest) {
  const supabase = createServiceClient()
  const workspaceId = getWorkspaceIdWithFallback(request)
  
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  
  const { 
    text, 
    scriptId,
    assetId,
    voiceId,
    voiceSettings,
    autoSelectVoice = true,
  } = body
  
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }
  
  try {
    // Determine voice to use
    let selectedVoiceId = voiceId
    
    if (!selectedVoiceId && autoSelectVoice) {
      // Get brand context to select appropriate voice
      const brandContext = await getBrandContext(workspaceId)
      selectedVoiceId = selectVoiceForBrand({
        voice: brandContext?.voice,
        // Use brand name as a hint for audience type
        audience: brandContext?.name ? { type: brandContext.name } : undefined,
      })
    }
    
    // Fallback to default professional voice
    if (!selectedVoiceId) {
      selectedVoiceId = RECOMMENDED_VOICES.professional_male.voiceId
    }
    
    // Estimate cost
    const estimatedCost = estimateCost(text)
    
    // Generate speech
    const audioBuffer = await generateSpeech({
      voiceId: selectedVoiceId,
      text,
      voiceSettings: voiceSettings as VoiceSettings,
    })
    
    // Upload to Supabase storage
    const fileName = `voiceovers/${workspaceId}/${Date.now()}.mp3`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
      })
    
    if (uploadError) {
      throw new Error(`Failed to upload audio: ${uploadError.message}`)
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(fileName)
    
    const audioUrl = urlData.publicUrl
    
    // Calculate duration (rough estimate: 150 words per minute)
    const words = text.split(/\s+/).length
    const duration = Math.round((words / 150) * 60)
    
    // Update asset if provided
    if (assetId) {
      await supabase
        .from('campaign_assets')
        .update({
          media_url: audioUrl,
        })
        .eq('id', assetId)
        .eq('workspace_id', workspaceId)
    }
    
    return NextResponse.json({
      voiceover: {
        id: `vo-${Date.now()}`,
        scriptId,
        assetId,
        voiceId: selectedVoiceId,
        audioUrl,
        duration,
        characterCount: text.length,
        cost: estimatedCost,
      },
    }, { status: 201 })
    
  } catch (error) {
    console.error('Voiceover generation failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Voiceover generation failed' },
      { status: 500 }
    )
  }
}

// GET endpoint to list available voices
export async function GET() {
  try {
    const voices = await getVoices()
    
    return NextResponse.json({
      voices,
      recommended: RECOMMENDED_VOICES,
    })
    
  } catch (error) {
    console.error('Failed to fetch voices:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch voices' },
      { status: 500 }
    )
  }
}
