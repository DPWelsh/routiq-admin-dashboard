/**
 * Simplified Organization Context
 * Auto-associates users with organizations without complexity
 */

import { prisma } from '@/lib/prisma'

export async function getSimpleOrganizationContext(clerkUserId: string) {
  try {
    // Try to find existing association
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        clerkUserId: clerkUserId,
        status: 'active',
      },
      include: {
        organization: true
      }
    })

    // If found, return it
    if (orgUser?.organization?.status === 'active') {
      return {
        organizationId: orgUser.organizationId,
        organizationName: orgUser.organization.name,
        userRole: orgUser.role,
        userStatus: orgUser.status,
        organizationStatus: orgUser.organization.status,
      }
    }

    // No association found - auto-create one
    console.log(`Auto-creating organization association for ${clerkUserId}`)

    // Find first active organization
    const org = await prisma.organization.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' }
    })

    if (!org) {
      console.log('No active organization found')
      return null
    }

    // Create the association
    const newOrgUser = await prisma.organizationUser.create({
      data: {
        clerkUserId: clerkUserId,
        organizationId: org.id,
        role: 'staff', // Default role for auto-created users
        status: 'active',
        permissions: {},
        preferences: {},
      }
    })

    console.log(`✅ Auto-created association: ${clerkUserId} → ${org.name}`)

    return {
      organizationId: org.id,
      organizationName: org.name,
      userRole: newOrgUser.role,
      userStatus: 'active',
      organizationStatus: 'active',
    }

  } catch (error) {
    console.error('Organization context error:', error)
    return null
  }
} 