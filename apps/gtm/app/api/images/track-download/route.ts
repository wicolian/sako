/**
 * Track Unsplash Download API
 * 
 * Required by Unsplash API guidelines to track downloads.
 */

import { NextResponse } from 'next/server'
import { trackDownload } from '@/lib/assets/unsplash-client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    await trackDownload(url)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Track download error:', error)
    // Don't fail the request even if tracking fails
    return NextResponse.json({ success: true })
  }
}
