/**
 * Role-Based Access Control (RBAC) System
 * Task #7: Create Role-Based Access Control
 */

import { UserRole } from '@/types/organization'

// =====================================================
// PERMISSION DEFINITIONS
// =====================================================

export enum Permission {
  // Patient Management
  PATIENTS_VIEW = 'patients:view',
  PATIENTS_CREATE = 'patients:create',
  PATIENTS_EDIT = 'patients:edit',
  PATIENTS_DELETE = 'patients:delete',
  PATIENTS_EXPORT = 'patients:export',

  // Conversation Management
  CONVERSATIONS_VIEW = 'conversations:view',
  CONVERSATIONS_CREATE = 'conversations:create',
  CONVERSATIONS_EDIT = 'conversations:edit',
  CONVERSATIONS_DELETE = 'conversations:delete',
  CONVERSATIONS_EXPORT = 'conversations:export',

  // Message Management
  MESSAGES_VIEW = 'messages:view',
  MESSAGES_CREATE = 'messages:create',
  MESSAGES_EDIT = 'messages:edit',
  MESSAGES_DELETE = 'messages:delete',

  // Analytics & Reporting
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',
  ANALYTICS_ADVANCED = 'analytics:advanced',

  // User Management
  USERS_VIEW = 'users:view',
  USERS_INVITE = 'users:invite',
  USERS_EDIT = 'users:edit',
  USERS_DELETE = 'users:delete',
  USERS_MANAGE_ROLES = 'users:manage_roles',

  // Organization Management
  ORGANIZATION_VIEW = 'organization:view',
  ORGANIZATION_EDIT = 'organization:edit',
  ORGANIZATION_SETTINGS = 'organization:settings',
  ORGANIZATION_BILLING = 'organization:billing',
  ORGANIZATION_DELETE = 'organization:delete',

  // Integration Management
  INTEGRATIONS_VIEW = 'integrations:view',
  INTEGRATIONS_CONFIGURE = 'integrations:configure',
  INTEGRATIONS_DELETE = 'integrations:delete',

  // System Administration
  SYSTEM_LOGS = 'system:logs',
  SYSTEM_MAINTENANCE = 'system:maintenance',
  SYSTEM_BACKUP = 'system:backup',

  // Data Management
  DATA_IMPORT = 'data:import',
  DATA_EXPORT = 'data:export',
  DATA_DELETE = 'data:delete',
}

// =====================================================
// ROLE PERMISSION MAPPINGS
// =====================================================

// Define base permissions for each role
const VIEWER_PERMISSIONS: Permission[] = [
  // Read-only access to basic data
  Permission.PATIENTS_VIEW,
  Permission.CONVERSATIONS_VIEW,
  Permission.MESSAGES_VIEW,
  Permission.ANALYTICS_VIEW,
]

const STAFF_PERMISSIONS: Permission[] = [
  // Viewer permissions plus basic CRUD operations
  ...VIEWER_PERMISSIONS,
  Permission.PATIENTS_CREATE,
  Permission.PATIENTS_EDIT,
  Permission.CONVERSATIONS_CREATE,
  Permission.CONVERSATIONS_EDIT,
  Permission.MESSAGES_CREATE,
  Permission.MESSAGES_EDIT,
  Permission.ANALYTICS_EXPORT,
]

const ADMIN_PERMISSIONS: Permission[] = [
  // Staff permissions plus user and organization management
  ...STAFF_PERMISSIONS,
  Permission.PATIENTS_DELETE,
  Permission.PATIENTS_EXPORT,
  Permission.CONVERSATIONS_DELETE,
  Permission.CONVERSATIONS_EXPORT,
  Permission.MESSAGES_DELETE,
  Permission.ANALYTICS_ADVANCED,
  Permission.USERS_VIEW,
  Permission.USERS_INVITE,
  Permission.USERS_EDIT,
  Permission.USERS_MANAGE_ROLES,
  Permission.ORGANIZATION_VIEW,
  Permission.ORGANIZATION_EDIT,
  Permission.ORGANIZATION_SETTINGS,
  Permission.INTEGRATIONS_VIEW,
  Permission.INTEGRATIONS_CONFIGURE,
  Permission.DATA_IMPORT,
  Permission.DATA_EXPORT,
]

const OWNER_PERMISSIONS: Permission[] = [
  // Admin permissions plus organization billing and deletion
  ...ADMIN_PERMISSIONS,
  Permission.USERS_DELETE,
  Permission.ORGANIZATION_BILLING,
  Permission.ORGANIZATION_DELETE,
  Permission.INTEGRATIONS_DELETE,
  Permission.SYSTEM_LOGS,
  Permission.SYSTEM_MAINTENANCE,
  Permission.SYSTEM_BACKUP,
  Permission.DATA_DELETE,
]

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.VIEWER]: VIEWER_PERMISSIONS,
  [UserRole.STAFF]: STAFF_PERMISSIONS,
  [UserRole.ADMIN]: ADMIN_PERMISSIONS,
  [UserRole.OWNER]: OWNER_PERMISSIONS,
}

// =====================================================
// PERMISSION GROUPS FOR UI ORGANIZATION
// =====================================================

export const PERMISSION_GROUPS = {
  patient_management: {
    label: 'Patient Management',
    permissions: [
      Permission.PATIENTS_VIEW,
      Permission.PATIENTS_CREATE,
      Permission.PATIENTS_EDIT,
      Permission.PATIENTS_DELETE,
      Permission.PATIENTS_EXPORT,
    ],
  },
  communication: {
    label: 'Communication',
    permissions: [
      Permission.CONVERSATIONS_VIEW,
      Permission.CONVERSATIONS_CREATE,
      Permission.CONVERSATIONS_EDIT,
      Permission.CONVERSATIONS_DELETE,
      Permission.CONVERSATIONS_EXPORT,
      Permission.MESSAGES_VIEW,
      Permission.MESSAGES_CREATE,
      Permission.MESSAGES_EDIT,
      Permission.MESSAGES_DELETE,
    ],
  },
  analytics: {
    label: 'Analytics & Reporting',
    permissions: [
      Permission.ANALYTICS_VIEW,
      Permission.ANALYTICS_EXPORT,
      Permission.ANALYTICS_ADVANCED,
    ],
  },
  user_management: {
    label: 'User Management',
    permissions: [
      Permission.USERS_VIEW,
      Permission.USERS_INVITE,
      Permission.USERS_EDIT,
      Permission.USERS_DELETE,
      Permission.USERS_MANAGE_ROLES,
    ],
  },
  organization: {
    label: 'Organization',
    permissions: [
      Permission.ORGANIZATION_VIEW,
      Permission.ORGANIZATION_EDIT,
      Permission.ORGANIZATION_SETTINGS,
      Permission.ORGANIZATION_BILLING,
      Permission.ORGANIZATION_DELETE,
    ],
  },
  integrations: {
    label: 'Integrations',
    permissions: [
      Permission.INTEGRATIONS_VIEW,
      Permission.INTEGRATIONS_CONFIGURE,
      Permission.INTEGRATIONS_DELETE,
    ],
  },
  data_management: {
    label: 'Data Management',
    permissions: [
      Permission.DATA_IMPORT,
      Permission.DATA_EXPORT,
      Permission.DATA_DELETE,
    ],
  },
  system: {
    label: 'System Administration',
    permissions: [
      Permission.SYSTEM_LOGS,
      Permission.SYSTEM_MAINTENANCE,
      Permission.SYSTEM_BACKUP,
    ],
  },
} as const

// =====================================================
// CORE PERMISSION FUNCTIONS
// =====================================================

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || []
  return rolePermissions.includes(permission)
}

/**
 * Check if a user role has all of the specified permissions
 */
export function hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission))
}

/**
 * Check if a user role has any of the specified permissions
 */
export function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission))
}

/**
 * Get all permissions for a user role
 */
export function getRolePermissions(userRole: UserRole): Permission[] {
  return ROLE_PERMISSIONS[userRole] || []
}

/**
 * Check if one role can perform actions of another role
 */
export function canAssumeRole(currentRole: UserRole, targetRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    [UserRole.VIEWER]: 1,
    [UserRole.STAFF]: 2,
    [UserRole.ADMIN]: 3,
    [UserRole.OWNER]: 4,
  }

  return roleHierarchy[currentRole] >= roleHierarchy[targetRole]
}

/**
 * Get permissions difference between roles (what permissions are gained)
 */
export function getPermissionDifference(fromRole: UserRole, toRole: UserRole): Permission[] {
  const fromPermissions = new Set(getRolePermissions(fromRole))
  const toPermissions = getRolePermissions(toRole)
  
  return toPermissions.filter(permission => !fromPermissions.has(permission))
}

/**
 * Validate if a role assignment is allowed
 */
export function canAssignRole(assignerRole: UserRole, targetRole: UserRole): boolean {
  // Only admins and owners can assign roles
  if (!hasPermission(assignerRole, Permission.USERS_MANAGE_ROLES)) {
    return false
  }

  // Admins can assign viewer/staff roles, owners can assign any role
  if (assignerRole === UserRole.ADMIN) {
    return targetRole === UserRole.VIEWER || targetRole === UserRole.STAFF
  }

  if (assignerRole === UserRole.OWNER) {
    return true // Owners can assign any role
  }

  return false
}

// =====================================================
// PERMISSION UTILITIES FOR FRONTEND
// =====================================================

/**
 * Get user-friendly permission description
 */
export function getPermissionDescription(permission: Permission): string {
  const descriptions: Record<Permission, string> = {
    [Permission.PATIENTS_VIEW]: 'View patient information',
    [Permission.PATIENTS_CREATE]: 'Create new patients',
    [Permission.PATIENTS_EDIT]: 'Edit patient information',
    [Permission.PATIENTS_DELETE]: 'Delete patients',
    [Permission.PATIENTS_EXPORT]: 'Export patient data',

    [Permission.CONVERSATIONS_VIEW]: 'View conversations',
    [Permission.CONVERSATIONS_CREATE]: 'Start new conversations',
    [Permission.CONVERSATIONS_EDIT]: 'Edit conversations',
    [Permission.CONVERSATIONS_DELETE]: 'Delete conversations',
    [Permission.CONVERSATIONS_EXPORT]: 'Export conversation data',

    [Permission.MESSAGES_VIEW]: 'View messages',
    [Permission.MESSAGES_CREATE]: 'Send messages',
    [Permission.MESSAGES_EDIT]: 'Edit messages',
    [Permission.MESSAGES_DELETE]: 'Delete messages',

    [Permission.ANALYTICS_VIEW]: 'View basic analytics',
    [Permission.ANALYTICS_EXPORT]: 'Export analytics data',
    [Permission.ANALYTICS_ADVANCED]: 'Access advanced analytics',

    [Permission.USERS_VIEW]: 'View organization users',
    [Permission.USERS_INVITE]: 'Invite new users',
    [Permission.USERS_EDIT]: 'Edit user information',
    [Permission.USERS_DELETE]: 'Remove users',
    [Permission.USERS_MANAGE_ROLES]: 'Manage user roles',

    [Permission.ORGANIZATION_VIEW]: 'View organization information',
    [Permission.ORGANIZATION_EDIT]: 'Edit organization settings',
    [Permission.ORGANIZATION_SETTINGS]: 'Manage organization settings',
    [Permission.ORGANIZATION_BILLING]: 'Manage billing and subscriptions',
    [Permission.ORGANIZATION_DELETE]: 'Delete organization',

    [Permission.INTEGRATIONS_VIEW]: 'View integrations',
    [Permission.INTEGRATIONS_CONFIGURE]: 'Configure integrations',
    [Permission.INTEGRATIONS_DELETE]: 'Remove integrations',

    [Permission.SYSTEM_LOGS]: 'Access system logs',
    [Permission.SYSTEM_MAINTENANCE]: 'Perform system maintenance',
    [Permission.SYSTEM_BACKUP]: 'Manage system backups',

    [Permission.DATA_IMPORT]: 'Import data',
    [Permission.DATA_EXPORT]: 'Export organization data',
    [Permission.DATA_DELETE]: 'Permanently delete data',
  }

  return descriptions[permission] || permission
}

/**
 * Get role-friendly display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    [UserRole.VIEWER]: 'Viewer',
    [UserRole.STAFF]: 'Staff Member',
    [UserRole.ADMIN]: 'Administrator',
    [UserRole.OWNER]: 'Organization Owner',
  }

  return displayNames[role] || role
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    [UserRole.VIEWER]: 'Can view patients, conversations, and basic analytics. Read-only access.',
    [UserRole.STAFF]: 'Can view and edit patients, conversations, and messages. Can export data.',
    [UserRole.ADMIN]: 'Can manage users, organization settings, and access advanced features.',
    [UserRole.OWNER]: 'Full access to all features including billing, user management, and organization settings.',
  }

  return descriptions[role] || 'Unknown role'
} 