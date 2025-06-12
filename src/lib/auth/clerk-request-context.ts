import { NextRequest } from 'next/server'

export interface ClerkOrganizationContext {
  userId: string
  organizationId: string
  organizationRole: string | null
  organizationSlug: string | null
}

/**
 * Extract Clerk organization context from request headers
 * These headers are set by the middleware
 */
export function getClerkOrganizationContext(
  request: NextRequest
): ClerkOrganizationContext | null {
  const userId = request.headers.get('x-clerk-user-id')
  const organizationId = request.headers.get('x-clerk-org-id')
  const organizationRole = request.headers.get('x-clerk-org-role')
  const organizationSlug = request.headers.get('x-clerk-org-slug')

  if (!userId || !organizationId) {
    return null
  }

  return {
    userId,
    organizationId,
    organizationRole,
    organizationSlug,
  }
}

/**
 * Simple decorator for API routes that require organization context
 */
export function withClerkOrganization(
  handler: (context: ClerkOrganizationContext, request: NextRequest) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    const context = getClerkOrganizationContext(request)
    
    if (!context) {
      return new Response(
        JSON.stringify({ 
          error: 'Organization context required',
          code: 'MISSING_ORGANIZATION'
        }),
        { 
          status: 403, 
          headers: { 'content-type': 'application/json' } 
        }
      )
    }

    return handler(context, request)
  }
}

/**
 * Simple decorator for API routes that only require authentication (no organization)
 */
export function withClerkAuth(
  handler: (userId: string, request: NextRequest) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    const userId = request.headers.get('x-clerk-user-id')
    
    if (!userId) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required',
          code: 'MISSING_AUTH'
        }),
        { 
          status: 401, 
          headers: { 'content-type': 'application/json' } 
        }
      )
    }

    return handler(userId, request)
  }
}

/**
 * Check if user has specific role in organization
 * Clerk roles: 'admin' | 'member'
 */
export function hasOrgRole(context: ClerkOrganizationContext, requiredRole: 'admin' | 'member'): boolean {
  if (!context.organizationRole) return false
  
  // Admin has all permissions
  if (context.organizationRole === 'admin') return true
  
  // Member only has member permissions
  return context.organizationRole === requiredRole
} 