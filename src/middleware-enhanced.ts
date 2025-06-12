import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getOrganizationContext, updateUserActivity } from '@/lib/auth/organization-context'
import { getOrCreateOrganizationContext } from '@/lib/auth/clerk-sync'

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/sign-out(.*)',
  '/api/health',
  '/onboarding(.*)',
])

// Define routes that require organization context
const isOrganizationRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/conversations(.*)',
  '/api/raw-data(.*)',
  '/api/dashboard(.*)',
  '/api/active-patients(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl
  
  console.log('🚀 ===== ENHANCED MIDDLEWARE EXECUTION START =====')
  console.log('🚀 MIDDLEWARE STARTING FOR:', pathname)
  
  // Allow access to public routes
  if (isPublicRoute(req)) {
    console.log('🚀 MIDDLEWARE: Public route, skipping organization context')
    return NextResponse.next()
  }

  // Get authentication result
  const authResult = await auth()
  
  console.log('🔍 MIDDLEWARE DEBUG:', {
    pathname,
    userId: authResult.userId,
    sessionId: authResult.sessionId,
    isOrganizationRoute: isOrganizationRoute(req)
  })
  
  // Require authentication for all protected routes
  if (!authResult.userId) {
    console.log('🔍 MIDDLEWARE: No user ID, redirecting to auth')
    if (pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      )
    } else {
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', pathname)
      return NextResponse.redirect(signInUrl)
    }
  }

  console.log('🚀 MIDDLEWARE: User authenticated, checking organization routes...')

  // For routes that require organization context, validate membership
  if (isOrganizationRoute(req)) {
    try {
      console.log('🔍 MIDDLEWARE: Getting organization context for user:', authResult.userId)
      
      // ENHANCED: Try to get or create organization context
      let orgContext = await getOrganizationContext(authResult.userId)
      
      if (!orgContext) {
        console.log('🔄 MIDDLEWARE: No organization context found, attempting auto-creation...')
        
        // Try to auto-create the organization association
        orgContext = await getOrCreateOrganizationContext(authResult.userId)
        
        if (orgContext) {
          console.log('✅ MIDDLEWARE: Successfully auto-created organization context')
        }
      }
      
      console.log('🔍 MIDDLEWARE: Organization context result:', orgContext)
      
      if (!orgContext) {
        console.log('🔍 MIDDLEWARE: Still no organization context found after auto-creation attempt')
        // User not associated with any active organization
        if (pathname.startsWith('/api/')) {
          return new NextResponse(
            JSON.stringify({ 
              error: 'Organization membership required',
              code: 'NO_ORGANIZATION_ACCESS',
              debug: 'Auto-creation also failed - may need manual intervention'
            }),
            { status: 403, headers: { 'content-type': 'application/json' } }
          )
        } else {
          // Redirect to onboarding/pending page
          return NextResponse.redirect(new URL('/onboarding/pending', req.url))
        }
      }

      console.log('🔍 MIDDLEWARE: Setting organization headers:', {
        organizationId: orgContext.organizationId,
        organizationName: orgContext.organizationName,
        userRole: orgContext.userRole
      })

      // Update user activity for analytics
      await updateUserActivity(authResult.userId, orgContext.organizationId)

      // Create new request headers with organization context
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set('x-organization-id', orgContext.organizationId)
      requestHeaders.set('x-organization-name', orgContext.organizationName)
      requestHeaders.set('x-user-role', orgContext.userRole)
      requestHeaders.set('x-user-status', orgContext.userStatus)
      requestHeaders.set('x-organization-status', orgContext.organizationStatus)
      requestHeaders.set('x-clerk-user-id', authResult.userId)

      console.log('🔍 MIDDLEWARE: Headers set successfully, returning with context')

      // Continue with organization context in headers
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })

    } catch (error) {
      console.error('🔍 MIDDLEWARE ERROR:', error)
      
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ 
            error: 'Internal server error during organization validation',
            code: 'ORGANIZATION_VALIDATION_ERROR'
          }),
          { status: 500, headers: { 'content-type': 'application/json' } }
        )
      } else {
        return NextResponse.redirect(new URL('/error?type=org-validation', req.url))
      }
    }
  }

  console.log('🚀 MIDDLEWARE: Not an organization route, passing through...')
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
} 