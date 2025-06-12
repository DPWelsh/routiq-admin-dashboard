/**
 * Clerk Synchronization Service
 * Automatically sync Clerk users with Supabase organization data
 */

import { prisma } from '@/lib/prisma'
import { UserRole, UserStatus } from '@/types/organization'
import { OrganizationContext } from './organization-context'

export interface ClerkUserSync {
  clerkUserId: string
  email?: string
  firstName?: string
  lastName?: string
}

interface ClerkWebhookUserData {
  id: string
  email_addresses?: Array<{
    email_address: string
  }>
}

/**
 * Ensure user exists in organization_users table
 * This should be called during sign-in or when accessing organization-protected routes
 */
export async function ensureUserInOrganization(
  clerkUserId: string,
  organizationId: string,
  defaultRole: UserRole = UserRole.STAFF
): Promise<boolean> {
  try {
    // Check if user already exists
    const existingUser = await prisma.organizationUser.findFirst({
      where: {
        clerkUserId: clerkUserId,
        organizationId: organizationId,
      }
    })

    if (existingUser) {
      // User exists, ensure they're active
      if (existingUser.status !== 'active') {
        await prisma.organizationUser.update({
          where: { id: existingUser.id },
          data: { 
            status: 'active',
            lastActivityAt: new Date(),
            updatedAt: new Date()
          }
        })
      }
      return true
    }

    // Create new organization user
    await prisma.organizationUser.create({
      data: {
        clerkUserId: clerkUserId,
        organizationId: organizationId,
        role: defaultRole,
        status: 'active',
        permissions: {},
        preferences: {},
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    console.log(`✅ Created organization user: ${clerkUserId} → ${organizationId}`)
    return true

  } catch (error) {
    console.error('❌ Failed to ensure user in organization:', error)
    return false
  }
}

/**
 * Create organization association for first-time users
 * This creates the missing link between Clerk and your database
 */
export async function createInitialOrganizationUser(
  clerkUserId: string,
  email?: string
): Promise<{ success: boolean; organizationId?: string; error?: string }> {
  try {
    // Find the default organization (or create one)
    let organization = await prisma.organization.findFirst({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' }
    })

    if (!organization) {
      // Create default organization if none exists
      organization = await prisma.organization.create({
        data: {
          name: 'Default Organization',
          displayName: 'Default Organization',
          status: 'active',
          subscriptionStatus: 'trial',
          subscriptionPlan: 'basic',
          settings: {},
          timezone: 'UTC',
          locale: 'en-US',
          address: {},
          billingAddress: {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    // Create the organization user association
    const orgUser = await prisma.organizationUser.create({
      data: {
        clerkUserId: clerkUserId,
        organizationId: organization.id,
        role: 'admin', // First user is admin
        status: 'active',
        permissions: {},
        preferences: {},
        lastActivityAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    console.log(`✅ Created initial organization user: ${clerkUserId} → ${organization.name}`)
    
    return {
      success: true,
      organizationId: organization.id
    }

  } catch (error) {
    console.error('❌ Failed to create initial organization user:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Enhanced organization context that auto-creates missing users
 */
export async function getOrCreateOrganizationContext(
  clerkUserId: string
): Promise<OrganizationContext | null> {
  // Try to get existing context
  const { getOrganizationContext } = await import('./organization-context')
  let context = await getOrganizationContext(clerkUserId)
  
  if (context) {
    return context
  }

  // No context found, try to create one
  console.log(`🔄 No organization context found for ${clerkUserId}, creating...`)
  
  const result = await createInitialOrganizationUser(clerkUserId)
  
  if (result.success && result.organizationId) {
    // Try again to get the context
    context = await getOrganizationContext(clerkUserId)
    if (context) {
      console.log(`✅ Successfully created and retrieved organization context`)
      return context
    }
  }

  console.log(`❌ Failed to create organization context for ${clerkUserId}`)
  return null
}

/**
 * Webhook handler for Clerk user events
 * Use this to automatically sync users when they sign up
 */
export async function handleClerkWebhook(
  eventType: string,
  userData: ClerkWebhookUserData
): Promise<void> {
  try {
    switch (eventType) {
      case 'user.created':
      case 'user.updated':
        const clerkUserId = userData.id
        const email = userData.email_addresses?.[0]?.email_address
        
        if (clerkUserId) {
          await createInitialOrganizationUser(clerkUserId, email)
        }
        break
        
      default:
        console.log(`Unhandled Clerk webhook event: ${eventType}`)
    }
  } catch (error) {
    console.error('❌ Clerk webhook handler error:', error)
  }
} 