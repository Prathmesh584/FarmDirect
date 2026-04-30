import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTES = ['/dashboard', '/cart', '/orders', '/profile']
// Routes only for farmers
const FARMER_ROUTES = ['/dashboard']
// Routes only for consumers
const CONSUMER_ROUTES = ['/cart', '/orders']
// Public auth routes — redirect if already logged in
const AUTH_ROUTES = ['/auth/login', '/auth/register']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session (IMPORTANT: do not add logic between createServerClient and getUser)
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Redirect logged-in users away from auth pages
  if (user && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/marketplace'
    return NextResponse.redirect(url)
  }

  // Unauthenticated users can't access protected routes
  if (!user && PROTECTED_ROUTES.some(r => pathname.startsWith(r))) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Role-based guard (only if authenticated)
  if (user && !userError) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile) {
      // Non-farmers trying to access farmer routes
      if (profile.role !== 'farmer' && FARMER_ROUTES.some(r => pathname.startsWith(r))) {
        const url = request.nextUrl.clone()
        url.pathname = '/marketplace'
        return NextResponse.redirect(url)
      }

      // Non-consumers trying to access consumer routes (farmers redirected to dashboard)
      if (profile.role !== 'consumer' && CONSUMER_ROUTES.some(r => pathname.startsWith(r))) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
