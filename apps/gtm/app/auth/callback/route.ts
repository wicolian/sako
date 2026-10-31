import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth Callback Route
 * 
 * MIGRATED: Clerk handles auth callbacks internally via its middleware.
 * This route now just redirects to the appropriate page.
 * 
 * For OAuth callbacks (Google, GitHub, etc.), Clerk handles them automatically.
 * This route is kept for compatibility with any old links.
 */

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const next = requestUrl.searchParams.get('next') || '/dashboard'
  const type = requestUrl.searchParams.get('type')

  // Handle password recovery redirect
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
  }
  
  // Default redirect to next page or dashboard
  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
