import { NextRequest } from 'next/server'
import { verifyToken } from '@clerk/backend'
import { getOrganizationContext } from './organization-context'
import { RequestOrganizationContext } from './request-context'

/**
 * Temporary authentication helper for API routes
 * This bypasses the broken middleware and uses Clerk's lower-level token verification
 * Until Next.js 15 + Clerk middleware compatibility is fixed
 */
export async function getApiAuth(request: NextRequest): Promise<{
  success: boolean
  context?: RequestOrganizationContext
  error?: string
  status?: number
}> {
  try {
    console.log('🔧 API AUTH: Starting low-level authentication bypass...')
    console.log('🔧 API AUTH: Environment check:', {
      hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
      nodeEnv: process.env.NODE_ENV,
      url: request.url
    })
    
    // Get the session token from cookies OR authorization header
    let sessionToken: string | undefined
    
    // First try Authorization header (for client-side requests)
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7)
      console.log('🔧 API AUTH: Found session token in Authorization header')
    }
    
    // Fallback to cookies (for SSR/server-side requests)
    if (!sessionToken) {
      sessionToken = request.cookies.get('__session')?.value || 
                     request.cookies.get('__clerk_session')?.value ||
                     request.cookies.get('clerk-token')?.value
      
      if (sessionToken) {
        console.log('🔧 API AUTH: Found session token in cookies')
      }
    }
    
    if (!sessionToken) {
      console.log('🔧 API AUTH ERROR: No session token found in headers or cookies')
      console.log('🔧 API AUTH: Available cookies:', request.cookies.getAll().map(cookie => cookie.name))
      console.log('🔧 API AUTH: Authorization header:', authHeader)
      return {
        success: false,
        error: 'No session token found',
        status: 401
      }
    }
    
    console.log('🔧 API AUTH: Found session token, verifying...')
    console.log('🔧 API AUTH: Token preview:', sessionToken.substring(0, 20) + '...')
    
    const secretKey = process.env.CLERK_SECRET_KEY
    if (!secretKey) {
      console.log('🔧 API AUTH ERROR: CLERK_SECRET_KEY not found in environment')
      return {
        success: false,
        error: 'Clerk secret key not configured',
        status: 500
      }
    }
    
    const verificationResult = await verifyToken(sessionToken, {
      secretKey
    })
    
    console.log('🔧 API AUTH: Token verified for user:', verificationResult.sub)
    
    const userId = verificationResult.sub
    
    // Get organization context directly
    const orgContext = await getOrganizationContext(userId)
    console.log('🔧 API AUTH: Organization context:', orgContext)
    
    if (!orgContext) {
      console.log('🔧 API AUTH: No organization context found')
      return {
        success: false,
        error: 'Organization membership required',
        status: 403
      }
    }
    
    // Create the context object that matches what middleware would provide
    const context: RequestOrganizationContext = {
      organizationId: orgContext.organizationId,
      organizationName: orgContext.organizationName,
      userRole: orgContext.userRole,
      userStatus: orgContext.userStatus,
      organizationStatus: orgContext.organizationStatus,
      clerkUserId: userId,
    }
    
    console.log('🔧 API AUTH: Context created successfully')
    return {
      success: true,
      context
    }
    
  } catch (error) {
    console.error('🔧 API AUTH ERROR:', error)
    return {
      success: false,
      error: 'Internal server error during authentication',
      status: 500
    }
  }
}

/**
 * Higher-order function to wrap API handlers with direct authentication
 * This replaces the RBAC middleware temporarily
 */
export function withApiAuth<T extends unknown[]>(
  handler: (context: RequestOrganizationContext, request: NextRequest, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const authResult = await getApiAuth(request)
    
    if (!authResult.success) {
      return new Response(
        JSON.stringify({ 
          error: authResult.error,
          code: authResult.status === 401 ? 'AUTHENTICATION_REQUIRED' : 'ORGANIZATION_ACCESS_REQUIRED'
        }),
        { 
          status: authResult.status || 500, 
          headers: { 'content-type': 'application/json' } 
        }
      )
    }
    
    return handler(authResult.context!, request, ...args)
  }
} 