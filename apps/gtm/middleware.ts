import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  WORKSPACE_ID_HEADER,
  USER_ID_HEADER,
  USER_ROLE_HEADER,
} from '@/lib/workspace'

/**
 * Temporary workspace sentinel used exclusively during onboarding flow
 * (before the user's real workspace is created). API routes on /api/onboarding
 * paths must not perform workspace-scoped writes with this value — they should
 * create the real workspace and redirect.
 *
 * All other code paths use the user's real workspace_id from workspace_members.
 */
const ONBOARDING_WORKSPACE_SENTINEL = '00000000-0000-0000-0000-000000000001'

export async function middleware(request: NextRequest) {
  try {
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
    const publicPaths = [
      '/login',
      '/signup',
      '/forgot-password',
      '/terms',
      '/privacy',
      '/auth/callback',
      '/api/share',
      '/share',
      '/api/v1/validate',
      '/api/features',
      '/api/health',
      '/api/setup/status',
      '/gate',
      '/api/gate',
      '/manifest.webmanifest',
      '/site.webmanifest',
    ]
    const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))
    
    // Paths that should be accessible without workspace setup
    const onboardingPaths = ['/onboarding', '/api/workspace', '/api/import', '/api/brands', '/api/onboarding']
    const isOnboardingPath = onboardingPaths.some(path => request.nextUrl.pathname.startsWith(path))

    if (isPublicPath) {
      return supabaseResponse
    }

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // If no user or auth error and trying to access protected route, redirect to login
    if ((!user || authError) && !request.nextUrl.pathname.startsWith('/api')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirectTo', request.nextUrl.pathname)
      const redirectResponse = NextResponse.redirect(url)
      // Propagate cookies even on redirect
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return redirectResponse
    }

    // For API routes, return 401 if not authenticated
    if (!user && request.nextUrl.pathname.startsWith('/api')) {
      const errorResponse = NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
      // Propagate cookies even on 401
      supabaseResponse.cookies.getAll().forEach(cookie => {
        errorResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return errorResponse
    }

    // =========================================================================
    // Workspace Resolution: Attach workspace context to request headers
    // =========================================================================
    if (user) {
      // Try to get workspace membership
      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user.id)
        .limit(1)
      const membership = memberships?.[0] ?? null

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
        const redirectResponse = NextResponse.redirect(url)
        // Propagate cookies even on redirect
        supabaseResponse.cookies.getAll().forEach(cookie => {
          redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
        })
        return redirectResponse
      } else {
        // On onboarding path without workspace — allow access with sentinel value.
        // Onboarding routes must NOT perform workspace-scoped writes using this value.
        requestHeaders.set(WORKSPACE_ID_HEADER, ONBOARDING_WORKSPACE_SENTINEL)
        requestHeaders.set(USER_ROLE_HEADER, 'member')
      }

      // Return response with updated headers, merged with current supabaseResponse
      const finalResponse = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
      
      // IMPORTANT: Propagate cookies from supabaseResponse to finalResponse
      // This ensures session refreshes in middleware are not lost
      supabaseResponse.cookies.getAll().forEach(cookie => {
        finalResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      
      return finalResponse
    }

    return supabaseResponse
  } catch (error) {
    console.error('[Middleware Error]:', error)
    // Fallback to basic response instead of crashing
    return NextResponse.next({
      request,
    })
  }
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
