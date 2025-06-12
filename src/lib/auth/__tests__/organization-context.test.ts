/**
 * Test utilities for organization context validation
 * This file provides utilities to test the authentication middleware and organization boundaries
 */

import { UserRole, UserStatus, OrganizationStatus } from '@/types/organization'
import type { OrganizationContext } from '@/lib/auth/organization-context'
import type { RequestOrganizationContext } from '@/lib/auth/request-context'

// Mock organization contexts for testing
export const mockOrganizationContexts = {
  // Active staff member in Surf Rehab
  activeSurfRehab: {
    organizationId: 'org-surf-rehab-uuid',
    organizationName: 'Surf Rehab Clinic',
    organizationSlug: 'surf-rehab',
    userRole: UserRole.STAFF,
    userStatus: UserStatus.ACTIVE,
    permissions: { canViewPatients: true, canEditConversations: true },
    organizationStatus: OrganizationStatus.ACTIVE,
  } as OrganizationContext,

  // Admin member in Another Clinic
  adminAnotherClinic: {
    organizationId: 'org-another-clinic-uuid',
    organizationName: 'Another Clinic',
    organizationSlug: 'another-clinic',
    userRole: UserRole.ADMIN,
    userStatus: UserStatus.ACTIVE,
    permissions: { canViewPatients: true, canEditConversations: true, canManageUsers: true },
    organizationStatus: OrganizationStatus.ACTIVE,
  } as OrganizationContext,

  // Inactive user
  inactiveUser: {
    organizationId: 'org-surf-rehab-uuid',
    organizationName: 'Surf Rehab Clinic',
    organizationSlug: 'surf-rehab',
    userRole: UserRole.STAFF,
    userStatus: UserStatus.INACTIVE,
    permissions: {},
    organizationStatus: OrganizationStatus.ACTIVE,
  } as OrganizationContext,

  // User in suspended organization
  suspendedOrg: {
    organizationId: 'org-suspended-uuid',
    organizationName: 'Suspended Clinic',
    organizationSlug: 'suspended-clinic',
    userRole: UserRole.STAFF,
    userStatus: UserStatus.ACTIVE,
    permissions: {},
    organizationStatus: OrganizationStatus.SUSPENDED,
  } as OrganizationContext,
}

// Mock request contexts for testing API endpoints
export const mockRequestContexts = {
  activeSurfRehabStaff: {
    organizationId: 'org-surf-rehab-uuid',
    organizationName: 'Surf Rehab Clinic',
    userRole: UserRole.STAFF,
    userStatus: UserStatus.ACTIVE,
    organizationStatus: OrganizationStatus.ACTIVE,
    clerkUserId: 'user_staff123',
  } as RequestOrganizationContext,

  activeSurfRehabAdmin: {
    organizationId: 'org-surf-rehab-uuid',
    organizationName: 'Surf Rehab Clinic',
    userRole: UserRole.ADMIN,
    userStatus: UserStatus.ACTIVE,
    organizationStatus: OrganizationStatus.ACTIVE,
    clerkUserId: 'user_admin123',
  } as RequestOrganizationContext,

  anotherClinicStaff: {
    organizationId: 'org-another-clinic-uuid',
    organizationName: 'Another Clinic',
    userRole: UserRole.STAFF,
    userStatus: UserStatus.ACTIVE,
    organizationStatus: OrganizationStatus.ACTIVE,
    clerkUserId: 'user_staff456',
  } as RequestOrganizationContext,
}

/**
 * Test cases for organization boundary enforcement
 */
export const organizationBoundaryTests = [
  {
    name: 'Staff can access own organization data',
    context: mockRequestContexts.activeSurfRehabStaff,
    targetOrganizationId: 'org-surf-rehab-uuid',
    expectedAccess: true,
    description: 'Staff member should be able to access their own organization data'
  },
  {
    name: 'Staff cannot access other organization data',
    context: mockRequestContexts.activeSurfRehabStaff,
    targetOrganizationId: 'org-another-clinic-uuid',
    expectedAccess: false,
    description: 'Staff member should not be able to access another organization data'
  },
  {
    name: 'Admin can access own organization data',
    context: mockRequestContexts.activeSurfRehabAdmin,
    targetOrganizationId: 'org-surf-rehab-uuid',
    expectedAccess: true,
    description: 'Admin should be able to access their own organization data'
  },
  {
    name: 'Admin cannot access other organization data',
    context: mockRequestContexts.activeSurfRehabAdmin,
    targetOrganizationId: 'org-another-clinic-uuid',
    expectedAccess: false,
    description: 'Admin should not be able to access another organization data'
  },
]

/**
 * Test role-based access control
 */
export const roleBasedAccessTests = [
  {
    name: 'Viewer can view but not edit',
    userRole: UserRole.VIEWER,
    requiredRoles: {
      view: UserRole.VIEWER,
      edit: UserRole.STAFF,
      admin: UserRole.ADMIN,
    },
    expectedAccess: {
      view: true,
      edit: false,
      admin: false,
    }
  },
  {
    name: 'Staff can view and edit but not admin',
    userRole: UserRole.STAFF,
    requiredRoles: {
      view: UserRole.VIEWER,
      edit: UserRole.STAFF,
      admin: UserRole.ADMIN,
    },
    expectedAccess: {
      view: true,
      edit: true,
      admin: false,
    }
  },
  {
    name: 'Admin can do everything',
    userRole: UserRole.ADMIN,
    requiredRoles: {
      view: UserRole.VIEWER,
      edit: UserRole.STAFF,
      admin: UserRole.ADMIN,
    },
    expectedAccess: {
      view: true,
      edit: true,
      admin: true,
    }
  },
]

/**
 * Utility to create mock headers for testing middleware
 */
export function createMockHeaders(context: RequestOrganizationContext): Headers {
  const headers = new Headers()
  headers.set('x-organization-id', context.organizationId)
  headers.set('x-organization-name', context.organizationName)
  headers.set('x-user-role', context.userRole)
  headers.set('x-user-status', context.userStatus)
  headers.set('x-organization-status', context.organizationStatus)
  headers.set('x-clerk-user-id', context.clerkUserId)
  return headers
}

/**
 * Utility to validate organization data isolation
 */
export function validateDataIsolation(
  organizationId: string,
  data: Array<{ organizationId: string }>
): boolean {
  return data.every(item => item.organizationId === organizationId)
}

/**
 * Mock database queries for testing
 */
export const mockDatabaseQueries = {
  // Query patients for organization
  async getPatients(organizationId: string) {
    return [
      { id: 'patient1', organizationId, name: 'John Doe' },
      { id: 'patient2', organizationId, name: 'Jane Smith' },
    ]
  },

  // Query conversations for organization
  async getConversations(organizationId: string) {
    return [
      { id: 'conv1', organizationId, patientId: 'patient1' },
      { id: 'conv2', organizationId, patientId: 'patient2' },
    ]
  },

  // Query messages for organization
  async getMessages(organizationId: string) {
    return [
      { id: 'msg1', organizationId, conversationId: 'conv1' },
      { id: 'msg2', organizationId, conversationId: 'conv2' },
    ]
  },
}

/**
 * Integration test scenarios
 */
export const integrationTestScenarios = [
  {
    name: 'Complete authentication flow',
    steps: [
      'User signs in with Clerk',
      'Middleware validates organization membership',
      'Headers are injected with organization context',
      'API endpoint receives organization context',
      'Database query is scoped to organization',
      'Response contains only organization data',
    ]
  },
  {
    name: 'Cross-organization access blocked',
    steps: [
      'User from Organization A attempts to access Organization B data',
      'Middleware validates user belongs to Organization A',
      'Headers contain Organization A context',
      'API endpoint rejects request for Organization B data',
      'No data leakage occurs',
    ]
  },
  {
    name: 'Role-based permission enforcement',
    steps: [
      'Viewer user attempts admin operation',
      'Middleware validates organization membership',
      'API endpoint checks role requirements',
      'Request is rejected due to insufficient permissions',
      'User gets proper error message',
    ]
  },
] 