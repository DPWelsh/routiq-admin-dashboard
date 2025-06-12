/**
 * RBAC Middleware Integration
 * Task #7: Create Role-Based Access Control - Middleware Integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { Permission, hasPermission, hasAllPermissions, hasAnyPermission, getRolePermissions } from './permissions'
import { RequestOrganizationContext, getRequestOrganizationContext } from '@/lib/auth/request-context'

// =====================================================
// RBAC DECORATORS FOR API ROUTES
// =====================================================

/**
 * Higher-order function to require specific permissions for API endpoints
 */
export function requirePermissions(
  permissions: Permission | Permission[],
  options: {
    requireAll?: boolean // If true, user must have ALL permissions, otherwise ANY
    message?: string
  } = {}
) {
  const { requireAll = true, message } = options
  const permissionList = Array.isArray(permissions) ? permissions : [permissions]

  return function decorator(
    handler: (context: RequestOrganizationContext, request: NextRequest) => Promise<Response>
  ) {
    return async (request: NextRequest): Promise<Response> => {
      const context = getRequestOrganizationContext(request)
      
      if (!context) {
        return new Response(
          JSON.stringify({ 
            error: 'Authentication required',
            code: 'MISSING_AUTHENTICATION'
          }),
          { 
            status: 401, 
            headers: { 'content-type': 'application/json' } 
          }
        )
      }

      // Check permissions
      const hasRequiredPermissions = requireAll 
        ? hasAllPermissions(context.userRole, permissionList)
        : hasAnyPermission(context.userRole, permissionList)

      if (!hasRequiredPermissions) {
        return new Response(
          JSON.stringify({ 
            error: message || `Insufficient permissions. Required: ${permissionList.join(', ')}`,
            code: 'INSUFFICIENT_PERMISSIONS',
            required_permissions: permissionList,
            user_role: context.userRole
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
}

/**
 * Decorator for patient management endpoints
 */
export function requirePatientAccess(
  action: 'view' | 'create' | 'edit' | 'delete' | 'export'
) {
  const permissionMap = {
    view: Permission.PATIENTS_VIEW,
    create: Permission.PATIENTS_CREATE,
    edit: Permission.PATIENTS_EDIT,
    delete: Permission.PATIENTS_DELETE,
    export: Permission.PATIENTS_EXPORT,
  }

  return requirePermissions(permissionMap[action], {
    message: `Patient ${action} access denied`
  })
}

/**
 * Decorator for conversation management endpoints
 */
export function requireConversationAccess(
  action: 'view' | 'create' | 'edit' | 'delete' | 'export'
) {
  const permissionMap = {
    view: Permission.CONVERSATIONS_VIEW,
    create: Permission.CONVERSATIONS_CREATE,
    edit: Permission.CONVERSATIONS_EDIT,
    delete: Permission.CONVERSATIONS_DELETE,
    export: Permission.CONVERSATIONS_EXPORT,
  }

  return requirePermissions(permissionMap[action], {
    message: `Conversation ${action} access denied`
  })
}

/**
 * Decorator for user management endpoints
 */
export function requireUserManagement(
  action: 'view' | 'invite' | 'edit' | 'delete' | 'manage_roles'
) {
  const permissionMap = {
    view: Permission.USERS_VIEW,
    invite: Permission.USERS_INVITE,
    edit: Permission.USERS_EDIT,
    delete: Permission.USERS_DELETE,
    manage_roles: Permission.USERS_MANAGE_ROLES,
  }

  return requirePermissions(permissionMap[action], {
    message: `User management ${action} access denied`
  })
}

/**
 * Decorator for organization management endpoints
 */
export function requireOrganizationAccess(
  action: 'view' | 'edit' | 'settings' | 'billing' | 'delete'
) {
  const permissionMap = {
    view: Permission.ORGANIZATION_VIEW,
    edit: Permission.ORGANIZATION_EDIT,
    settings: Permission.ORGANIZATION_SETTINGS,
    billing: Permission.ORGANIZATION_BILLING,
    delete: Permission.ORGANIZATION_DELETE,
  }

  return requirePermissions(permissionMap[action], {
    message: `Organization ${action} access denied`
  })
}

/**
 * Decorator for analytics endpoints
 */
export function requireAnalyticsAccess(
  level: 'basic' | 'export' | 'advanced'
) {
  const permissionMap = {
    basic: Permission.ANALYTICS_VIEW,
    export: Permission.ANALYTICS_EXPORT,
    advanced: Permission.ANALYTICS_ADVANCED,
  }

  return requirePermissions(permissionMap[level], {
    message: `Analytics ${level} access denied`
  })
}

// =====================================================
// RBAC UTILITIES FOR FRONTEND
// =====================================================

/**
 * Get permissions context for frontend components
 */
export interface RBACContext {
  userRole: string
  permissions: Permission[]
  can: (permission: Permission) => boolean
  canAny: (permissions: Permission[]) => boolean
  canAll: (permissions: Permission[]) => boolean
}

/**
 * Create RBAC context from request headers (for use in frontend)
 */
export function createRBACContext(request: NextRequest): RBACContext | null {
  const orgContext = getRequestOrganizationContext(request)
  
  if (!orgContext) {
    return null
  }

  const userRole = orgContext.userRole
  const permissions = getRolePermissions(userRole)

  return {
    userRole,
    permissions,
    can: (permission: Permission) => hasPermission(userRole, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(userRole, permissions),
    canAll: (permissions: Permission[]) => hasAllPermissions(userRole, permissions),
  }
}

// =====================================================
// RBAC ERROR HANDLERS
// =====================================================

export interface RBACError {
  code: string
  message: string
  requiredPermissions?: Permission[]
  userRole?: string
}

/**
 * Create standardized permission error response
 */
export function createPermissionError(
  message: string,
  requiredPermissions?: Permission[],
  userRole?: string
): Response {
  const error: RBACError = {
    code: 'INSUFFICIENT_PERMISSIONS',
    message,
    requiredPermissions,
    userRole,
  }

  return new Response(
    JSON.stringify({ error }),
    { 
      status: 403, 
      headers: { 'content-type': 'application/json' } 
    }
  )
}

/**
 * Create authentication required error
 */
export function createAuthError(message: string = 'Authentication required'): Response {
  const error: RBACError = {
    code: 'AUTHENTICATION_REQUIRED',
    message,
  }

  return new Response(
    JSON.stringify({ error }),
    { 
      status: 401, 
      headers: { 'content-type': 'application/json' } 
    }
  )
}

// =====================================================
// RBAC VALIDATION HELPERS
// =====================================================

/**
 * Validate if user can perform action on resource
 */
export function validateResourceAccess(
  context: RequestOrganizationContext,
  resourceType: string,
  action: string,
  resourceOwnerId?: string
): { allowed: boolean; reason?: string } {
  // Check if user has permission for the action
  const permission = `${resourceType}:${action}` as Permission
  
  if (!hasPermission(context.userRole, permission)) {
    return {
      allowed: false,
      reason: `User does not have permission: ${permission}`
    }
  }

  // Additional checks for resource ownership (if applicable)
  if (resourceOwnerId && resourceOwnerId !== context.clerkUserId) {
    // Only allow if user has elevated permissions
    const canManageOthers = hasPermission(context.userRole, Permission.USERS_MANAGE_ROLES)
    if (!canManageOthers) {
      return {
        allowed: false,
        reason: 'Cannot modify resources owned by other users'
      }
    }
  }

  return { allowed: true }
}

/**
 * Check if user can access specific organization data
 */
export function validateOrganizationDataAccess(
  context: RequestOrganizationContext,
  dataOrganizationId: string
): { allowed: boolean; reason?: string } {
  if (context.organizationId !== dataOrganizationId) {
    return {
      allowed: false,
      reason: 'Cross-organization data access denied'
    }
  }

  return { allowed: true }
} 