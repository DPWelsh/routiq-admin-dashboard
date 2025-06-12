import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sign-out(.*)',
  '/api/health',
])

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl
  const startTime = Date.now()
  
  logger.middleware('Processing request', {
    pathname,
    method: req.method,
    userAgent: req.headers.get('user-agent'),
    origin: req.headers.get('origin')
  })
  
  // Allow public routes
  if (isPublicRoute(req)) {
    logger.middleware('Public route - allowing access', { pathname })
    return NextResponse.next()
  }

  try {
    // Get basic Clerk auth (without complex org logic)
    const { userId } = await auth()
    
    logger.auth('Clerk auth result', {
      userId: userId ? 'present' : 'missing',
      pathname
    })
    
    // Require authentication
    if (!userId) {
      logger.auth('Authentication required - no user ID', { pathname })
      
      if (pathname.startsWith('/api/')) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        )
      }
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }

    // For API routes, just pass the user ID (let routes handle org context)
    if (pathname.startsWith('/api/')) {
      logger.middleware('API route - setting auth headers', {
        pathname,
        hasUserId: !!userId
      })
      
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-clerk-user-id', userId)
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    }

    const duration = Date.now() - startTime
    logger.middleware('Request processed successfully', {
      pathname,
      duration_ms: duration
    })

    return NextResponse.next()
    
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Middleware error', error, {
      pathname,
      method: req.method,
      duration_ms: duration
    })
    
    // Return a proper error response instead of throwing
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        code: 'MIDDLEWARE_ERROR'
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