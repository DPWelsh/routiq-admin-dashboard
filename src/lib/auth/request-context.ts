import { NextRequest } from 'next/server'
import { UserRole, UserStatus, OrganizationStatus } from '@/types/organization'

export interface RequestOrganizationContext {
  organizationId: string
  organizationName: string
  userRole: UserRole
  userStatus: UserStatus
  organizationStatus: OrganizationStatus
  clerkUserId: string
}

/**
 * Extract organization context from request headers
 * This assumes the middleware has already validated and injected the headers
 */
export function getRequestOrganizationContext(
  request: NextRequest
): RequestOrganizationContext | null {
  const organizationId = request.headers.get('x-organization-id')
  const organizationName = request.headers.get('x-organization-name')
  const userRole = request.headers.get('x-user-role')
  const userStatus = request.headers.get('x-user-status')
  const organizationStatus = request.headers.get('x-organization-status')
  const clerkUserId = request.headers.get('x-clerk-user-id')

  if (!organizationId || !organizationName || !userRole || !userStatus || !organizationStatus || !clerkUserId) {
    return null
  }

  return {
    organizationId,
    organizationName,
    userRole: userRole as UserRole,
    userStatus: userStatus as UserStatus,
    organizationStatus: organizationStatus as OrganizationStatus,
    clerkUserId,
  }
}

/**
 * Validate if user has required role or higher
 */
export function validateUserRole(
  context: RequestOrganizationContext,
  requiredRole: UserRole
): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    [UserRole.VIEWER]: 1,
    [UserRole.STAFF]: 2,
    [UserRole.ADMIN]: 3,
    [UserRole.OWNER]: 4,
  }

  return roleHierarchy[context.userRole] >= roleHierarchy[requiredRole]
}

/**
 * Create a database filter for organization-scoped queries
 */
export function createOrganizationFilter(context: RequestOrganizationContext) {
  return {
    organizationId: context.organizationId,
  }
}

/**
 * Higher-order function to wrap API handlers with organization context validation
 */
export function withOrganizationContext<T extends unknown[]>(
  handler: (context: RequestOrganizationContext, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    const context = getRequestOrganizationContext(request)
    
    if (!context) {
      return new Response(
        JSON.stringify({ 
          error: 'Organization context missing',
          code: 'MISSING_ORGANIZATION_CONTEXT'
        }),
        { 
          status: 401, 
          headers: { 'content-type': 'application/json' } 
        }
      )
    }

    // Validate organization and user status
    if (context.organizationStatus !== 'active') {
      return new Response(
        JSON.stringify({ 
          error: 'Organization is not active',
          code: 'ORGANIZATION_INACTIVE'
        }),
        { 
          status: 403, 
          headers: { 'content-type': 'application/json' } 
        }
      )
    }

    if (context.userStatus !== 'active') {
      return new Response(
        JSON.stringify({ 
          error: 'User is not active in organization',
          code: 'USER_INACTIVE'
        }),
        { 
          status: 403, 
          headers: { 'content-type': 'application/json' } 
        }
      )
    }

    return handler(context, ...args)
  }
}

/**
 * Higher-order function for admin-only API endpoints
 */
export function withAdminContext<T extends unknown[]>(
  handler: (context: RequestOrganizationContext, ...args: T) => Promise<Response>
) {
  return withOrganizationContext(async (context: RequestOrganizationContext, ...args: T) => {
    if (!validateUserRole(context, UserRole.ADMIN)) {
      return new Response(
        JSON.stringify({ 
          error: 'Admin access required',
          code: 'INSUFFICIENT_PERMISSIONS'
        }),
        { 
          status: 403, 
          headers: { 'content-type': 'application/json' } 
        }
      )
    }

    return handler(context, ...args)
  })
} 