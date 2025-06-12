import { prisma } from '@/lib/prisma'
import { UserRole, UserStatus, OrganizationStatus } from '@/types/organization'

export interface OrganizationContext {
  organizationId: string
  organizationName: string
  organizationSlug: string | null
  userRole: UserRole
  userStatus: UserStatus
  permissions: Record<string, unknown>
  organizationStatus: OrganizationStatus
}

/**
 * Get organization context for a Clerk user ID
 * Returns the user's organization membership details and permissions
 */
export async function getOrganizationContext(
  clerkUserId: string
): Promise<OrganizationContext | null> {
  try {
    // Query the organization_users table to find active membership
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        clerkUserId: clerkUserId,
        status: 'active', // Only active users
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          }
        }
      },
      orderBy: {
        lastActivityAt: 'desc' // Get most recently active organization if multiple
      }
    })

    if (!orgUser || !orgUser.organization) {
      return null
    }

    // Ensure organization is active
    if (orgUser.organization.status !== 'active') {
      return null
    }

    return {
      organizationId: orgUser.organizationId,
      organizationName: orgUser.organization.name,
      organizationSlug: orgUser.organization.slug,
      userRole: orgUser.role as UserRole,
      userStatus: orgUser.status as UserStatus,
      permissions: orgUser.permissions as Record<string, unknown>,
      organizationStatus: orgUser.organization.status as OrganizationStatus,
    }
  } catch (error) {
    console.error('Error fetching organization context:', error)
    return null
  }
}

/**
 * Validate if a user has access to a specific organization
 */
export async function validateOrganizationAccess(
  clerkUserId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        clerkUserId: clerkUserId,
        organizationId: organizationId,
        status: 'active',
      },
      include: {
        organization: {
          select: {
            status: true,
          }
        }
      }
    })

    return !!(orgUser && orgUser.organization?.status === 'active')
  } catch (error) {
    console.error('Error validating organization access:', error)
    return false
  }
}

/**
 * Check if user has specific role or higher in organization
 */
export function hasRoleOrHigher(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    [UserRole.VIEWER]: 1,
    [UserRole.STAFF]: 2,
    [UserRole.ADMIN]: 3,
    [UserRole.OWNER]: 4,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

/**
 * Update user's last activity timestamp
 */
export async function updateUserActivity(
  clerkUserId: string,
  organizationId: string
): Promise<void> {
  try {
    await prisma.organizationUser.updateMany({
      where: {
        clerkUserId: clerkUserId,
        organizationId: organizationId,
      },
      data: {
        lastActivityAt: new Date(),
      }
    })
  } catch (error) {
    console.error('Error updating user activity:', error)
  }
}

/**
 * Get all organizations for a user (for user switching functionality)
 */
export async function getUserOrganizations(
  clerkUserId: string
): Promise<Array<{
  organizationId: string
  organizationName: string
  organizationSlug: string | null
  userRole: UserRole
  userStatus: UserStatus
}>> {
  try {
    const orgUsers = await prisma.organizationUser.findMany({
      where: {
        clerkUserId: clerkUserId,
        status: 'active',
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          }
        }
      },
      orderBy: {
        lastActivityAt: 'desc'
      }
    })

    return orgUsers
      .filter(orgUser => orgUser.organization?.status === 'active')
      .map(orgUser => ({
        organizationId: orgUser.organizationId,
        organizationName: orgUser.organization!.name,
        organizationSlug: orgUser.organization!.slug,
        userRole: orgUser.role as UserRole,
        userStatus: orgUser.status as UserStatus,
      }))
  } catch (error) {
    console.error('Error fetching user organizations:', error)
    return []
  }
} 