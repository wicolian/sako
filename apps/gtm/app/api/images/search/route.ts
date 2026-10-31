/**
 * Unsplash Search API
 */

import { NextResponse } from 'next/server'
import { searchPhotos } from '@/lib/assets/unsplash-client'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  
  const query = searchParams.get('query')
  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  const page = parseInt(searchParams.get('page') || '1')
  const perPage = parseInt(searchParams.get('per_page') || '20')
  const orientation = searchParams.get('orientation') as 'landscape' | 'portrait' | 'squarish' | undefined
  const color = searchParams.get('color') || undefined

  try {
    const results = await searchPhotos({
      query,
      page,
      perPage: Math.min(perPage, 30),
      orientation,
      color,
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error('Unsplash search error:', error)
    return NextResponse.json(
      { error: 'Failed to search photos' },
      { status: 500 }
    )
  }
}
