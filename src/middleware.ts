import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sign-out(.*)',
  '/api/health',
])

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl
  
  console.log(`🔍 Middleware: ${req.method} ${pathname}`)
  
  // Allow public routes
  if (isPublicRoute(req)) {
    console.log(`✅ Public route: ${pathname}`)
    return NextResponse.next()
  }

  try {
    // Get Clerk auth with organization context
    const { userId, orgId, orgRole, orgSlug } = await auth()
    
    console.log(`🔐 Auth result: ${userId ? 'authenticated' : 'not authenticated'} for ${pathname}`)
    console.log(`🏢 Org context: ${orgId ? 'present' : 'missing'} for ${pathname}`)
    
    // Require authentication
    if (!userId) {
      console.log(`❌ No user ID for ${pathname}`)
      
      if (pathname.startsWith('/api/')) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        )
      }
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }

    // For API routes, set auth headers including organization context
    if (pathname.startsWith('/api/')) {
      console.log(`🔄 Setting auth headers for API route: ${pathname}`)
      console.log(`📋 Headers: userId=${!!userId}, orgId=${!!orgId}, role=${orgRole}`)
      
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-clerk-user-id', userId)
      
      // Set organization headers if available
      if (orgId) {
        requestHeaders.set('x-clerk-org-id', orgId)
        requestHeaders.set('x-clerk-org-role', orgRole || '')
        requestHeaders.set('x-clerk-org-slug', orgSlug || '')
      }
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    }

    console.log(`✅ Request processed: ${pathname}`)
    return NextResponse.next()
    
  } catch (error) {
    console.error(`🔴 Middleware error for ${pathname}:`, error)
    
    // Return a proper error response instead of throwing
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        code: 'MIDDLEWARE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
} 