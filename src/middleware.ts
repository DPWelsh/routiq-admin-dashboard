import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sign-out(.*)',
  '/api/health',
])

// Define routes that require organization membership
const isOrganizationRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/conversations(.*)',
  '/api/raw-data(.*)',
  '/api/dashboard(.*)',
  '/api/active-patients(.*)',
  '/api/patients(.*)',
  '/api/organization(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl
  
  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // Get Clerk auth - includes organization info
  const { userId, orgId, orgRole, orgSlug } = await auth()
  
  console.log('🔍 Middleware - Clerk Auth:', { 
    userId, 
    orgId, 
    orgRole,
    pathname,
    isOrgRoute: isOrganizationRoute(req)
  })
  
  // Require authentication
  if (!userId) {
    if (pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      )
    }
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  // Set Clerk headers for all API routes that need them
  if (pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-clerk-user-id', userId)
    requestHeaders.set('x-clerk-org-id', orgId || '')
    requestHeaders.set('x-clerk-org-role', orgRole || '')
    requestHeaders.set('x-clerk-org-slug', orgSlug || '')
    
    console.log('✅ Middleware - Setting API headers:', {
      userId,
      orgId,
      orgRole,
      orgSlug,
      pathname
    })
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // For organization routes, require org membership
  if (isOrganizationRoute(req)) {
    if (!orgId) {
      console.log('❌ Middleware - No organization selected/joined')
      
      // Redirect to organization selection/creation
      return NextResponse.redirect(new URL('/organization-selection', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
} 