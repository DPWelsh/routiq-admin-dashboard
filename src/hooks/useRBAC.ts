'use client'

/**
 * React Hooks for Role-Based Access Control
 * Task #7: Create Role-Based Access Control - Frontend Integration
 */

import { useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { 
  Permission, 
  hasPermission, 
  hasAllPermissions, 
  hasAnyPermission,
  getRolePermissions,
  getRoleDisplayName,
  getRoleDescription,
  getPermissionDescription,
  PERMISSION_GROUPS
} from '@/lib/rbac/permissions'
import { UserRole } from '@/types/organization'
import { useOrganizationContext } from '@/hooks/useOrganizationContext'

// =====================================================
// TYPES
// =====================================================

export interface RBACHookResult {
  userRole: UserRole | null
  permissions: Permission[]
  
  // Permission checking functions
  can: (permission: Permission) => boolean
  canAny: (permissions: Permission[]) => boolean
  canAll: (permissions: Permission[]) => boolean
  
  // Role checking functions
  isViewer: boolean
  isStaff: boolean
  isAdmin: boolean
  isOwner: boolean
  
  // UI helpers
  roleDisplayName: string
  roleDescription: string
  permissionGroups: typeof PERMISSION_GROUPS
  
  // Loading states
  isLoading: boolean
  hasRole: boolean
}

export interface PermissionCheckOptions {
  fallback?: boolean
  showLoading?: boolean
}

// =====================================================
// MAIN RBAC HOOK
// =====================================================

/**
 * Main hook for role-based access control
 * Now integrated with real organization context from useOrganizationContext
 */
export function useRBAC(): RBACHookResult {
  const { user, isLoaded: isUserLoaded } = useUser()
  const { 
    userRole: orgUserRole, 
    isLoading: isOrgLoading, 
    error: orgError 
  } = useOrganizationContext()
  
  // Use organization context for user role instead of simulation
  const userRole = useMemo(() => {
    if (!isUserLoaded || !user) return null
    if (isOrgLoading || orgError) return null
    
    // Use real organization context role
    return orgUserRole
  }, [isUserLoaded, user, isOrgLoading, orgError, orgUserRole])

  const permissions = useMemo(() => {
    if (!userRole) return []
    return getRolePermissions(userRole)
  }, [userRole])

  const rbacContext = useMemo<RBACHookResult>(() => {
    const hasRole = userRole !== null
    const isLoading = !isUserLoaded || isOrgLoading
    
    return {
      userRole,
      permissions,
      
      // Permission checking functions
      can: (permission: Permission) => userRole ? hasPermission(userRole, permission) : false,
      canAny: (permissions: Permission[]) => userRole ? hasAnyPermission(userRole, permissions) : false,
      canAll: (permissions: Permission[]) => userRole ? hasAllPermissions(userRole, permissions) : false,
      
      // Role checking functions
      isViewer: userRole === UserRole.VIEWER,
      isStaff: userRole === UserRole.STAFF,
      isAdmin: userRole === UserRole.ADMIN,
      isOwner: userRole === UserRole.OWNER,
      
      // UI helpers
      roleDisplayName: userRole ? getRoleDisplayName(userRole) : 'Unknown',
      roleDescription: userRole ? getRoleDescription(userRole) : 'No role assigned',
      permissionGroups: PERMISSION_GROUPS,
      
      // Loading states - now includes organization context loading
      isLoading,
      hasRole,
    }
  }, [userRole, permissions, isUserLoaded, isOrgLoading])

  return rbacContext
}

// =====================================================
// SPECIALIZED HOOKS
// =====================================================

/**
 * Hook for checking specific permissions
 */
export function usePermission(
  permission: Permission, 
  options: PermissionCheckOptions = {}
): boolean {
  const { can, isLoading } = useRBAC()
  const { fallback = false, showLoading = false } = options
  
  if (isLoading && showLoading) {
    return fallback
  }
  
  return can(permission)
}

/**
 * Hook for checking multiple permissions (ANY)
 */
export function useAnyPermission(
  permissions: Permission[], 
  options: PermissionCheckOptions = {}
): boolean {
  const { canAny, isLoading } = useRBAC()
  const { fallback = false, showLoading = false } = options
  
  if (isLoading && showLoading) {
    return fallback
  }
  
  return canAny(permissions)
}

/**
 * Hook for checking multiple permissions (ALL)
 */
export function useAllPermissions(
  permissions: Permission[], 
  options: PermissionCheckOptions = {}
): boolean {
  const { canAll, isLoading } = useRBAC()
  const { fallback = false, showLoading = false } = options
  
  if (isLoading && showLoading) {
    return fallback
  }
  
  return canAll(permissions)
}

/**
 * Hook for role-specific checks
 */
export function useRole(role: UserRole): boolean {
  const { userRole } = useRBAC()
  return userRole === role
}

/**
 * Hook for checking if user has role or higher
 */
export function useRoleOrHigher(minRole: UserRole): boolean {
  const { userRole } = useRBAC()
  
  if (!userRole) return false
  
  const roleHierarchy: Record<UserRole, number> = {
    [UserRole.VIEWER]: 1,
    [UserRole.STAFF]: 2,
    [UserRole.ADMIN]: 3,
    [UserRole.OWNER]: 4,
  }
  
  return roleHierarchy[userRole] >= roleHierarchy[minRole]
}

// =====================================================
// FEATURE-SPECIFIC HOOKS
// =====================================================

/**
 * Hook for patient management permissions
 */
export function usePatientPermissions() {
  const rbac = useRBAC()
  
  return {
    canView: rbac.can(Permission.PATIENTS_VIEW),
    canCreate: rbac.can(Permission.PATIENTS_CREATE),
    canEdit: rbac.can(Permission.PATIENTS_EDIT),
    canDelete: rbac.can(Permission.PATIENTS_DELETE),
    canExport: rbac.can(Permission.PATIENTS_EXPORT),
  }
}

/**
 * Hook for conversation management permissions
 */
export function useConversationPermissions() {
  const rbac = useRBAC()
  
  return {
    canView: rbac.can(Permission.CONVERSATIONS_VIEW),
    canCreate: rbac.can(Permission.CONVERSATIONS_CREATE),
    canEdit: rbac.can(Permission.CONVERSATIONS_EDIT),
    canDelete: rbac.can(Permission.CONVERSATIONS_DELETE),
    canExport: rbac.can(Permission.CONVERSATIONS_EXPORT),
  }
}

/**
 * Hook for user management permissions
 */
export function useUserManagementPermissions() {
  const rbac = useRBAC()
  
  return {
    canView: rbac.can(Permission.USERS_VIEW),
    canInvite: rbac.can(Permission.USERS_INVITE),
    canEdit: rbac.can(Permission.USERS_EDIT),
    canDelete: rbac.can(Permission.USERS_DELETE),
    canManageRoles: rbac.can(Permission.USERS_MANAGE_ROLES),
  }
}

/**
 * Hook for organization management permissions
 */
export function useOrganizationPermissions() {
  const rbac = useRBAC()
  
  return {
    canView: rbac.can(Permission.ORGANIZATION_VIEW),
    canEdit: rbac.can(Permission.ORGANIZATION_EDIT),
    canManageSettings: rbac.can(Permission.ORGANIZATION_SETTINGS),
    canManageBilling: rbac.can(Permission.ORGANIZATION_BILLING),
    canDelete: rbac.can(Permission.ORGANIZATION_DELETE),
  }
}

/**
 * Hook for analytics permissions
 */
export function useAnalyticsPermissions() {
  const rbac = useRBAC()
  
  return {
    canView: rbac.can(Permission.ANALYTICS_VIEW),
    canExport: rbac.can(Permission.ANALYTICS_EXPORT),
    canAccessAdvanced: rbac.can(Permission.ANALYTICS_ADVANCED),
  }
}

// =====================================================
// NAVIGATION HELPERS
// =====================================================

/**
 * Hook for determining available navigation items based on permissions
 */
export interface NavigationItem {
  label: string
  href: string
  permission?: Permission
  requiredRole?: UserRole
  visible: boolean
}

export function useNavigationPermissions(): NavigationItem[] {
  const rbac = useRBAC()
  
  const navigationItems: Omit<NavigationItem, 'visible'>[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Patients', href: '/dashboard/patients', permission: Permission.PATIENTS_VIEW },
    { label: 'Conversations', href: '/dashboard/conversations', permission: Permission.CONVERSATIONS_VIEW },
    { label: 'Analytics', href: '/dashboard/analytics', permission: Permission.ANALYTICS_VIEW },
    { label: 'Users', href: '/dashboard/users', permission: Permission.USERS_VIEW },
    { label: 'Organization', href: '/dashboard/organization', permission: Permission.ORGANIZATION_VIEW },
    { label: 'Billing', href: '/dashboard/billing', permission: Permission.ORGANIZATION_BILLING },
    { label: 'Integrations', href: '/dashboard/integrations', permission: Permission.INTEGRATIONS_VIEW },
  ]
  
  return navigationItems.map(item => ({
    ...item,
    visible: !item.permission || rbac.can(item.permission)
  }))
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Get permission description for UI display
 */
export function usePermissionDescription(permission: Permission): string {
  return getPermissionDescription(permission)
}

/**
 * Check if current user can assign a specific role
 */
export function useCanAssignRole(targetRole: UserRole): boolean {
  const { userRole, can } = useRBAC()
  
  if (!userRole || !can(Permission.USERS_MANAGE_ROLES)) {
    return false
  }
  
  // Admins can assign viewer/staff roles, owners can assign any role
  if (userRole === UserRole.ADMIN) {
    return targetRole === UserRole.VIEWER || targetRole === UserRole.STAFF
  }
  
  if (userRole === UserRole.OWNER) {
    return true
  }
  
  return false
} 