/**
 * Unsplash Curated Photos API
 */

import { NextResponse } from 'next/server'
import { getCuratedPhotos } from '@/lib/assets/unsplash-client'

export async function GET() {
  try {
    const photos = await getCuratedPhotos({
      perPage: 30,
      orderBy: 'popular',
    })

    return NextResponse.json(photos)
  } catch (error) {
    console.error('Unsplash curated error:', error)
    return NextResponse.json(
      { error: 'Failed to get curated photos' },
      { status: 500 }
    )
  }
}
