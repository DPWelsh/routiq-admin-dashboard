import { WebhookEvent } from '@clerk/nextjs/server';
import { withServiceRole } from '@/lib/auth/prisma-with-rls';

/**
 * Clerk Webhook Event Handlers
 * Implements specific database operations for each type of Clerk webhook event
 * 
 * Features:
 * - User lifecycle management (create, update, delete)
 * - Organization synchronization 
 * - Organization membership management
 * - Comprehensive error handling and retry logic
 * - Audit logging for all operations
 * - RLS-aware database operations using service role
 */

// Default organization ID for new users (from PRD context)
const DEFAULT_ORGANIZATION_ID = 'org_2xwHiNrj68eaRUlX10anlXGvzX7'; // Surf Rehab

/**
 * Audit logging utility
 */
async function logAuditEvent(
  eventType: string,
  entityType: string,
  entityId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: Record<string, any>,
  success: boolean,
  error?: string
) {
  const auditLog = {
    event_type: eventType,
    entity_type: entityType,
    entity_id: entityId,
    details,
    success,
    error_message: error,
    timestamp: new Date(),
  };

  console.log('[WEBHOOK_AUDIT]', auditLog);
  
  // TODO: Store audit logs in database if needed
  // Could create an audit_logs table for compliance
}

/**
 * Error wrapper for webhook operations with retry logic
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`[WEBHOOK_RETRY] ${operationName} failed (attempt ${attempt}/${maxRetries}):`, error);
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  
  throw lastError!;
}

// =====================================================
// USER EVENT HANDLERS
// =====================================================

/**
 * Handle user.created event
 * Auto-associates new users with the default organization
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleUserCreated(event: WebhookEvent): Promise<{ handled: boolean; action: string; result?: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userData = event.data as any;
  const userId = userData.id;
  const email = userData.email_addresses?.[0]?.email_address;
  const firstName = userData.first_name;
  const lastName = userData.last_name;
  const name = [firstName, lastName].filter(Boolean).join(' ') || null;

  console.log('[WEBHOOK_HANDLER] Processing user.created', {
    userId,
    email,
    name,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await withRetry(async () => {
      return await withServiceRole(async (prisma) => {
        return await prisma.$transaction(async (tx) => {
          // Check if user already exists (prevent duplicates)
          const existingUser = await tx.organizationUser.findFirst({
            where: { clerkUserId: userId }
          });

          if (existingUser) {
            console.log('[WEBHOOK_HANDLER] User already exists, skipping creation', { userId });
            return { action: 'user_already_exists', userId };
          }

          // Check if default organization exists
          const defaultOrg = await tx.organization.findUnique({
            where: { id: DEFAULT_ORGANIZATION_ID }
          });

          if (!defaultOrg) {
            throw new Error(`Default organization ${DEFAULT_ORGANIZATION_ID} not found`);
          }

          // Create organization user with admin role for first user, staff for others
          const existingUsers = await tx.organizationUser.count({
            where: { organizationId: DEFAULT_ORGANIZATION_ID }
          });

          const role = existingUsers === 0 ? 'admin' : 'staff';

          const organizationUser = await tx.organizationUser.create({
            data: {
              organizationId: DEFAULT_ORGANIZATION_ID,
              clerkUserId: userId,
              role,
              status: 'active',
              permissions: {},
              preferences: {},
              lastActivityAt: new Date(),
            },
          });

          return {
            action: 'user_created',
            userId,
            organizationUserId: organizationUser.id,
            organizationId: DEFAULT_ORGANIZATION_ID,
            role,
            email,
            name,
          };
        });
      });
    }, 'handleUserCreated');

    await logAuditEvent(
      'user.created',
      'user',
      userId,
      { email, name, result },
      true
    );

    console.log('[WEBHOOK_HANDLER] User created successfully', result);
    return { handled: true, action: 'user_created', result };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAuditEvent(
      'user.created',
      'user',
      userId,
      { email, name, error: errorMessage },
      false,
      errorMessage
    );

    console.error('[WEBHOOK_HANDLER] Failed to create user', {
      userId,
      email,
      error: errorMessage,
    });

    throw error; // Re-throw to trigger 500 response
  }
}

/**
 * Handle user.updated event
 * Syncs profile changes to the database
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleUserUpdated(event: WebhookEvent): Promise<{ handled: boolean; action: string; result?: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userData = event.data as any;
  const userId = userData.id;
  const email = userData.email_addresses?.[0]?.email_address;
  const firstName = userData.first_name;
  const lastName = userData.last_name;
  const name = [firstName, lastName].filter(Boolean).join(' ') || null;

  console.log('[WEBHOOK_HANDLER] Processing user.updated', {
    userId,
    email,
    name,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await withRetry(async () => {
      return await withServiceRole(async (prisma) => {
        return await prisma.$transaction(async (tx) => {
          // Find user's organization memberships
          const orgUsers = await tx.organizationUser.findMany({
            where: { clerkUserId: userId }
          });

          if (orgUsers.length === 0) {
            console.log('[WEBHOOK_HANDLER] User not found in any organization, creating new user');
            // If user doesn't exist, create them (edge case)
            return await handleUserCreated(event);
          }

          // Update last activity for all memberships
          const updatePromises = orgUsers.map(orgUser =>
            tx.organizationUser.update({
              where: { id: orgUser.id },
              data: {
                lastActivityAt: new Date(),
                updatedAt: new Date(),
              },
            })
          );

          await Promise.all(updatePromises);

          return {
            action: 'user_updated',
            userId,
            organizationsUpdated: orgUsers.length,
            email,
            name,
          };
        });
      });
    }, 'handleUserUpdated');

    await logAuditEvent(
      'user.updated',
      'user',
      userId,
      { email, name, result },
      true
    );

    console.log('[WEBHOOK_HANDLER] User updated successfully', result);
    return { handled: true, action: 'user_updated', result };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAuditEvent(
      'user.updated',
      'user',
      userId,
      { email, name, error: errorMessage },
      false,
      errorMessage
    );

    console.error('[WEBHOOK_HANDLER] Failed to update user', {
      userId,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Handle user.deleted event
 * Cleans up user data while preserving audit trail
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleUserDeleted(event: WebhookEvent): Promise<{ handled: boolean; action: string; result?: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userData = event.data as any;
  const userId = userData.id;

  console.log('[WEBHOOK_HANDLER] Processing user.deleted', {
    userId,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await withRetry(async () => {
      return await withServiceRole(async (prisma) => {
        return await prisma.$transaction(async (tx) => {
          // Find all organization memberships for this user
          const orgUsers = await tx.organizationUser.findMany({
            where: { clerkUserId: userId },
            include: { organization: true }
          });

          if (orgUsers.length === 0) {
            console.log('[WEBHOOK_HANDLER] User not found in any organization');
            return { action: 'user_not_found', userId };
          }

          // Instead of deleting, mark as deleted to preserve audit trail
          const updatePromises = orgUsers.map(orgUser =>
            tx.organizationUser.update({
              where: { id: orgUser.id },
              data: {
                status: 'deleted',
                updatedAt: new Date(),
                // Clear sensitive data but keep audit trail
                invitationEmail: null,
                invitationToken: null,
                preferences: {},
              },
            })
          );

          await Promise.all(updatePromises);

          return {
            action: 'user_deleted',
            userId,
            organizationsAffected: orgUsers.map(ou => ou.organization.name),
            membershipsDeactivated: orgUsers.length,
          };
        });
      });
    }, 'handleUserDeleted');

    await logAuditEvent(
      'user.deleted',
      'user',
      userId,
      { result },
      true
    );

    console.log('[WEBHOOK_HANDLER] User deleted successfully', result);
    return { handled: true, action: 'user_deleted', result };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAuditEvent(
      'user.deleted',
      'user',
      userId,
      { error: errorMessage },
      false,
      errorMessage
    );

    console.error('[WEBHOOK_HANDLER] Failed to delete user', {
      userId,
      error: errorMessage,
    });

    throw error;
  }
}

// =====================================================
// ORGANIZATION EVENT HANDLERS
// =====================================================

/**
 * Handle organization.created event
 * Creates organization in the database
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleOrganizationCreated(event: WebhookEvent): Promise<{ handled: boolean; action: string; result?: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgData = event.data as any;
  const orgId = orgData.id;
  const name = orgData.name;
  const slug = orgData.slug;

  console.log('[WEBHOOK_HANDLER] Processing organization.created', {
    orgId,
    name,
    slug,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await withRetry(async () => {
      return await withServiceRole(async (prisma) => {
        return await prisma.$transaction(async (tx) => {
          // Check if organization already exists
          const existingOrg = await tx.organization.findUnique({
            where: { id: orgId }
          });

          if (existingOrg) {
            console.log('[WEBHOOK_HANDLER] Organization already exists', { orgId });
            return { action: 'organization_already_exists', orgId };
          }

          // Create organization
          const organization = await tx.organization.create({
            data: {
              id: orgId,
              name,
              slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              displayName: name,
              status: 'active',
              subscriptionStatus: 'trial',
              subscriptionPlan: 'basic',
              settings: {},
              timezone: 'UTC',
              locale: 'en-US',
              address: {},
              billingAddress: {},
            },
          });

          return {
            action: 'organization_created',
            orgId,
            name,
            slug: organization.slug,
          };
        });
      });
    }, 'handleOrganizationCreated');

    await logAuditEvent(
      'organization.created',
      'organization',
      orgId,
      { name, slug, result },
      true
    );

    console.log('[WEBHOOK_HANDLER] Organization created successfully', result);
    return { handled: true, action: 'organization_created', result };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAuditEvent(
      'organization.created',
      'organization',
      orgId,
      { name, slug, error: errorMessage },
      false,
      errorMessage
    );

    console.error('[WEBHOOK_HANDLER] Failed to create organization', {
      orgId,
      name,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Handle organization.updated event
 * Updates organization metadata
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleOrganizationUpdated(event: WebhookEvent): Promise<{ handled: boolean; action: string; result?: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgData = event.data as any;
  const orgId = orgData.id;
  const name = orgData.name;
  const slug = orgData.slug;

  console.log('[WEBHOOK_HANDLER] Processing organization.updated', {
    orgId,
    name,
    slug,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await withRetry(async () => {
      return await withServiceRole(async (prisma) => {
        return await prisma.$transaction(async (tx) => {
          // Find existing organization
          const existingOrg = await tx.organization.findUnique({
            where: { id: orgId }
          });

          if (!existingOrg) {
            console.log('[WEBHOOK_HANDLER] Organization not found, creating new one');
            return await handleOrganizationCreated(event);
          }

          // Update organization
          const updatedOrg = await tx.organization.update({
            where: { id: orgId },
            data: {
              name,
              slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              displayName: name,
              updatedAt: new Date(),
            },
          });

          return {
            action: 'organization_updated',
            orgId,
            name,
            slug: updatedOrg.slug,
            previousName: existingOrg.name,
          };
        });
      });
    }, 'handleOrganizationUpdated');

    await logAuditEvent(
      'organization.updated',
      'organization',
      orgId,
      { name, slug, result },
      true
    );

    console.log('[WEBHOOK_HANDLER] Organization updated successfully', result);
    return { handled: true, action: 'organization_updated', result };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAuditEvent(
      'organization.updated',
      'organization',
      orgId,
      { name, slug, error: errorMessage },
      false,
      errorMessage
    );

    console.error('[WEBHOOK_HANDLER] Failed to update organization', {
      orgId,
      name,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Handle organization.deleted event
 * Handles organization cleanup (soft delete)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleOrganizationDeleted(event: WebhookEvent): Promise<{ handled: boolean; action: string; result?: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orgData = event.data as any;
  const orgId = orgData.id;

  console.log('[WEBHOOK_HANDLER] Processing organization.deleted', {
    orgId,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await withRetry(async () => {
      return await withServiceRole(async (prisma) => {
        return await prisma.$transaction(async (tx) => {
          // Find organization
          const organization = await tx.organization.findUnique({
            where: { id: orgId },
            include: {
              organizationUsers: true,
              patients: true,
              conversations: true,
            }
          });

          if (!organization) {
            console.log('[WEBHOOK_HANDLER] Organization not found');
            return { action: 'organization_not_found', orgId };
          }

          // Soft delete organization and related data
          await tx.organization.update({
            where: { id: orgId },
            data: {
              status: 'deleted',
              deletedAt: new Date(),
              updatedAt: new Date(),
            },
          });

          // Deactivate all organization users
          await tx.organizationUser.updateMany({
            where: { organizationId: orgId },
            data: {
              status: 'deleted',
              updatedAt: new Date(),
            },
          });

          return {
            action: 'organization_deleted',
            orgId,
            name: organization.name,
            usersAffected: organization.organizationUsers.length,
            patientsAffected: organization.patients.length,
            conversationsAffected: organization.conversations.length,
          };
        });
      });
    }, 'handleOrganizationDeleted');

    await logAuditEvent(
      'organization.deleted',
      'organization',
      orgId,
      { result },
      true
    );

    console.log('[WEBHOOK_HANDLER] Organization deleted successfully', result);
    return { handled: true, action: 'organization_deleted', result };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAuditEvent(
      'organization.deleted',
      'organization',
      orgId,
      { error: errorMessage },
      false,
      errorMessage
    );

    console.error('[WEBHOOK_HANDLER] Failed to delete organization', {
      orgId,
      error: errorMessage,
    });

    throw error;
  }
}

// =====================================================
// ORGANIZATION MEMBERSHIP EVENT HANDLERS
// =====================================================

/**
 * Handle organizationMembership.created event
 * Adds user to organization
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleOrganizationMembershipCreated(event: WebhookEvent): Promise<{ handled: boolean; action: string; result?: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membershipData = event.data as any;
  const membershipId = membershipData.id;
  const userId = membershipData.public_user_data?.user_id;
  const orgId = membershipData.organization?.id;
  const role = membershipData.role || 'staff';

  console.log('[WEBHOOK_HANDLER] Processing organizationMembership.created', {
    membershipId,
    userId,
    orgId,
    role,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await withRetry(async () => {
      return await withServiceRole(async (prisma) => {
        return await prisma.$transaction(async (tx) => {
          // Check if membership already exists
          const existingMembership = await tx.organizationUser.findFirst({
            where: {
              clerkUserId: userId,
              organizationId: orgId,
            }
          });

          if (existingMembership) {
            // Update existing membership
            const updatedMembership = await tx.organizationUser.update({
              where: { id: existingMembership.id },
              data: {
                role,
                status: 'active',
                updatedAt: new Date(),
                lastActivityAt: new Date(),
              },
            });

            return {
              action: 'membership_updated',
              membershipId,
              userId,
              orgId,
              role,
              organizationUserId: updatedMembership.id,
            };
          }

          // Verify organization exists
          const organization = await tx.organization.findUnique({
            where: { id: orgId }
          });

          if (!organization) {
            throw new Error(`Organization ${orgId} not found`);
          }

          // Create new membership
          const organizationUser = await tx.organizationUser.create({
            data: {
              organizationId: orgId,
              clerkUserId: userId,
              role,
              status: 'active',
              permissions: {},
              preferences: {},
              lastActivityAt: new Date(),
            },
          });

          return {
            action: 'membership_created',
            membershipId,
            userId,
            orgId,
            role,
            organizationUserId: organizationUser.id,
          };
        });
      });
    }, 'handleOrganizationMembershipCreated');

    await logAuditEvent(
      'organizationMembership.created',
      'membership',
      membershipId,
      { userId, orgId, role, result },
      true
    );

    console.log('[WEBHOOK_HANDLER] Organization membership created successfully', result);
    return { handled: true, action: 'membership_created', result };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAuditEvent(
      'organizationMembership.created',
      'membership',
      membershipId,
      { userId, orgId, role, error: errorMessage },
      false,
      errorMessage
    );

    console.error('[WEBHOOK_HANDLER] Failed to create organization membership', {
      membershipId,
      userId,
      orgId,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Handle organizationMembership.updated event
 * Updates user role/permissions
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleOrganizationMembershipUpdated(event: WebhookEvent): Promise<{ handled: boolean; action: string; result?: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membershipData = event.data as any;
  const membershipId = membershipData.id;
  const userId = membershipData.public_user_data?.user_id;
  const orgId = membershipData.organization?.id;
  const role = membershipData.role || 'staff';

  console.log('[WEBHOOK_HANDLER] Processing organizationMembership.updated', {
    membershipId,
    userId,
    orgId,
    role,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await withRetry(async () => {
      return await withServiceRole(async (prisma) => {
        return await prisma.$transaction(async (tx) => {
          // Find existing membership
          const existingMembership = await tx.organizationUser.findFirst({
            where: {
              clerkUserId: userId,
              organizationId: orgId,
            }
          });

          if (!existingMembership) {
            console.log('[WEBHOOK_HANDLER] Membership not found, creating new one');
            return await handleOrganizationMembershipCreated(event);
          }

          // Update membership
          const updatedMembership = await tx.organizationUser.update({
            where: { id: existingMembership.id },
            data: {
              role,
              updatedAt: new Date(),
              lastActivityAt: new Date(),
            },
          });

          return {
            action: 'membership_updated',
            membershipId,
            userId,
            orgId,
            role,
            previousRole: existingMembership.role,
            organizationUserId: updatedMembership.id,
          };
        });
      });
    }, 'handleOrganizationMembershipUpdated');

    await logAuditEvent(
      'organizationMembership.updated',
      'membership',
      membershipId,
      { userId, orgId, role, result },
      true
    );

    console.log('[WEBHOOK_HANDLER] Organization membership updated successfully', result);
    return { handled: true, action: 'membership_updated', result };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAuditEvent(
      'organizationMembership.updated',
      'membership',
      membershipId,
      { userId, orgId, role, error: errorMessage },
      false,
      errorMessage
    );

    console.error('[WEBHOOK_HANDLER] Failed to update organization membership', {
      membershipId,
      userId,
      orgId,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Handle organizationMembership.deleted event
 * Removes user from organization
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleOrganizationMembershipDeleted(event: WebhookEvent): Promise<{ handled: boolean; action: string; result?: any }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membershipData = event.data as any;
  const membershipId = membershipData.id;
  const userId = membershipData.public_user_data?.user_id;
  const orgId = membershipData.organization?.id;

  console.log('[WEBHOOK_HANDLER] Processing organizationMembership.deleted', {
    membershipId,
    userId,
    orgId,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await withRetry(async () => {
      return await withServiceRole(async (prisma) => {
        return await prisma.$transaction(async (tx) => {
          // Find existing membership
          const existingMembership = await tx.organizationUser.findFirst({
            where: {
              clerkUserId: userId,
              organizationId: orgId,
            }
          });

          if (!existingMembership) {
            console.log('[WEBHOOK_HANDLER] Membership not found');
            return { action: 'membership_not_found', membershipId, userId, orgId };
          }

          // Soft delete membership (preserve audit trail)
          const updatedMembership = await tx.organizationUser.update({
            where: { id: existingMembership.id },
            data: {
              status: 'deleted',
              updatedAt: new Date(),
              // Clear sensitive data
              invitationEmail: null,
              invitationToken: null,
              preferences: {},
            },
          });

          return {
            action: 'membership_deleted',
            membershipId,
            userId,
            orgId,
            previousRole: existingMembership.role,
            organizationUserId: updatedMembership.id,
          };
        });
      });
    }, 'handleOrganizationMembershipDeleted');

    await logAuditEvent(
      'organizationMembership.deleted',
      'membership',
      membershipId,
      { userId, orgId, result },
      true
    );

    console.log('[WEBHOOK_HANDLER] Organization membership deleted successfully', result);
    return { handled: true, action: 'membership_deleted', result };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logAuditEvent(
      'organizationMembership.deleted',
      'membership',
      membershipId,
      { userId, orgId, error: errorMessage },
      false,
      errorMessage
    );

    console.error('[WEBHOOK_HANDLER] Failed to delete organization membership', {
      membershipId,
      userId,
      orgId,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Cleanup function to close Prisma connection
 * Call this when shutting down the application
 */
export async function cleanup() {
  // Cleanup logic if needed
} 