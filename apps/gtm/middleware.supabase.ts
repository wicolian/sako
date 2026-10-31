import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  WORKSPACE_ID_HEADER,
  USER_ID_HEADER,
  USER_ROLE_HEADER,
} from '@/lib/workspace'

/**
 * Default workspace for new users during transition period.
 * This ensures users without explicit workspace membership can still use the app.
 * Once org management UI is built, new users will create their own workspaces.
 */
const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: CookieOptions }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run auth check on these paths
  const publicPaths = ['/login', '/signup', '/auth/callback', '/api/share', '/share', '/api/v1/validate', '/api/features']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))
  
  // Paths that should be accessible without workspace setup
  const onboardingPaths = ['/onboarding', '/api/workspace', '/api/import', '/api/brands']
  const isOnboardingPath = onboardingPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (isPublicPath) {
    return supabaseResponse
  }

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If no user and trying to access protected route, redirect to login
  if (!user && !request.nextUrl.pathname.startsWith('/api')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // For API routes, return 401 if not authenticated
  if (!user && request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // =========================================================================
  // Workspace Resolution: Attach workspace context to request headers
  // =========================================================================
  if (user) {
    // Try to get workspace membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    // Create new headers with workspace context
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set(USER_ID_HEADER, user.id)

    if (membership) {
      requestHeaders.set(WORKSPACE_ID_HEADER, membership.workspace_id)
      requestHeaders.set(USER_ROLE_HEADER, membership.role)
    } else if (!isOnboardingPath) {
      // No workspace membership - redirect to onboarding
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    } else {
      // On onboarding path without workspace - allow access with default workspace
      // This enables the onboarding flow to work before workspace is created
      requestHeaders.set(WORKSPACE_ID_HEADER, DEFAULT_WORKSPACE_ID)
      requestHeaders.set(USER_ROLE_HEADER, 'member')
    }

    // Return response with updated headers
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
