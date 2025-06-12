import { withServiceRole, withUserContext } from '@/lib/auth/prisma-with-rls';
import {
  UserRole,
  UserStatus,
  EnhancedUser,
  UserSearchFilters,
  UserSortOptions,
  UserQueryOptions,
  PaginatedUserResponse,
  BulkUserOperation,
  BulkOperationResult,
  UserActivity,
  UserActivityStats,
  UserPermissions,
  UserPreferences,
  ROLE_PERMISSIONS,
  DEFAULT_USER_PREFERENCES,
  UserManagementResponse
} from '@/types/user-management';

/**
 * Enhanced User Management System
 * Comprehensive user management with role-based permissions, activity tracking,
 * and advanced search/filtering capabilities.
 * 
 * Features:
 * - Role-based permission system (owner/admin/staff/viewer)
 * - Advanced user search and filtering
 * - Activity tracking and analytics
 * - Bulk operations for user management
 * - RLS-aware database operations
 */

// =====================================================
// USER QUERY AND RETRIEVAL
// =====================================================

/**
 * Get users with advanced filtering and pagination
 */
export async function getUsers(
  organizationId: string,
  options: UserQueryOptions = {}
): Promise<PaginatedUserResponse> {
  return withUserContext(async (prisma) => {
    const {
      filters = {},
      sort = { field: 'createdAt', direction: 'desc' },
      pagination = { page: 1, limit: 25 },
      include = {}
    } = options;

    // Build WHERE clause from filters
    const whereClause = buildUserWhereClause(organizationId, filters);
    
    // Build ORDER BY clause
    const orderByClause = buildUserOrderClause(sort);

    // Calculate pagination
    const skip = (pagination.page - 1) * pagination.limit;

    // Execute queries
    const [users, totalCount] = await Promise.all([
      prisma.organizationUser.findMany({
        where: whereClause,
        orderBy: orderByClause,
        skip,
        take: pagination.limit,
        include: {
          organization: include.organization ? {
            select: { id: true, name: true, slug: true }
          } : false
        }
      }),
      prisma.organizationUser.count({ where: whereClause })
    ]);

    // Transform to EnhancedUser format
    const enhancedUsers: EnhancedUser[] = await Promise.all(
      users.map(user => transformToEnhancedUser(user, include))
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pagination.limit);

    return {
      users: enhancedUsers,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: totalCount,
        totalPages,
        hasNextPage: pagination.page < totalPages,
        hasPreviousPage: pagination.page > 1
      },
      filters,
      sort
    };
  });
}

/**
 * Get a single user by ID with full details
 */
export async function getUserById(
  userId: string,
  includeActivityStats = false
): Promise<EnhancedUser | null> {
  return withUserContext(async (prisma) => {
    const user = await prisma.organizationUser.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    if (!user) return null;

    return transformToEnhancedUser(user, {
      organization: true,
      activityStats: includeActivityStats
    });
  });
}

/**
 * Get user by Clerk ID
 */
export async function getUserByClerkId(
  clerkUserId: string,
  organizationId: string
): Promise<EnhancedUser | null> {
  return withUserContext(async (prisma) => {
    const user = await prisma.organizationUser.findFirst({
      where: {
        clerkUserId,
        organizationId
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true }
        }
      }
    });

    if (!user) return null;

    return transformToEnhancedUser(user, { organization: true });
  });
}

// =====================================================
// USER CREATION AND UPDATES
// =====================================================

/**
 * Create a new user in the organization
 */
export async function createUser(
  userData: {
    clerkUserId: string;
    organizationId: string;
    role: UserRole;
    email?: string;
    firstName?: string;
    lastName?: string;
    permissions?: Partial<UserPermissions>;
    preferences?: Partial<UserPreferences>;
  },
  createdBy: string
): Promise<UserManagementResponse<EnhancedUser>> {
  try {
    return await withServiceRole(async (prisma) => {
      // Check if user already exists
      const existingUser = await prisma.organizationUser.findFirst({
        where: {
          clerkUserId: userData.clerkUserId,
          organizationId: userData.organizationId
        }
      });

      if (existingUser) {
        return {
          success: false,
          error: 'User already exists in this organization',
          timestamp: new Date()
        };
      }

      // Get role permissions
      const permissions = userData.permissions || ROLE_PERMISSIONS[userData.role];
      const preferences = { ...DEFAULT_USER_PREFERENCES, ...userData.preferences };

      // Create user
      const user = await prisma.organizationUser.create({
        data: {
          organizationId: userData.organizationId,
          clerkUserId: userData.clerkUserId,
          role: userData.role,
          status: 'active',
          permissions: JSON.stringify(permissions),
          preferences: JSON.stringify(preferences),
          lastActivityAt: new Date(),
          // TODO: Add these fields to organization_users schema:
          // loginCount: 0,
          // sessionCount: 0,  
          // createdBy
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true }
          }
        }
      });

      // Log activity
      await logUserActivity({
        userId: user.id,
        organizationId: userData.organizationId,
        action: 'user_created',
        category: 'user_management',
        description: `User created with role: ${userData.role}`,
        metadata: { createdBy, role: userData.role }
      });

      const enhancedUser = await transformToEnhancedUser(user, { organization: true });

      return {
        success: true,
        data: enhancedUser,
        message: 'User created successfully',
        timestamp: new Date()
      };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create user',
      timestamp: new Date()
    };
  }
}

/**
 * Update user role and permissions
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole,
  updatedBy: string,
  customPermissions?: Partial<UserPermissions>
): Promise<UserManagementResponse<EnhancedUser>> {
  try {
    return await withUserContext(async (prisma) => {
      // Get current user to check permissions
      const currentUser = await prisma.organizationUser.findUnique({
        where: { id: userId }
      });

      if (!currentUser) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date()
        };
      }

      // Calculate new permissions
      const permissions = customPermissions 
        ? { ...ROLE_PERMISSIONS[newRole], ...customPermissions }
        : ROLE_PERMISSIONS[newRole];

      // Update user
      const updatedUser = await prisma.organizationUser.update({
        where: { id: userId },
        data: {
          role: newRole,
          permissions: JSON.stringify(permissions),
          updatedAt: new Date()
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true }
          }
        }
      });

      // Log activity
      await logUserActivity({
        userId,
        organizationId: currentUser.organizationId,
        action: 'role_updated',
        category: 'user_management',
        description: `Role updated from ${currentUser.role} to ${newRole}`,
        metadata: { 
          updatedBy, 
          previousRole: currentUser.role, 
          newRole,
          hasCustomPermissions: !!customPermissions
        }
      });

      const enhancedUser = await transformToEnhancedUser(updatedUser, { organization: true });

      return {
        success: true,
        data: enhancedUser,
        message: `User role updated to ${newRole}`,
        timestamp: new Date()
      };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user role',
      timestamp: new Date()
    };
  }
}

/**
 * Update user status (activate, deactivate, suspend)
 */
export async function updateUserStatus(
  userId: string,
  newStatus: UserStatus,
  updatedBy: string,
  reason?: string
): Promise<UserManagementResponse<EnhancedUser>> {
  try {
    return await withUserContext(async (prisma) => {
      const user = await prisma.organizationUser.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date()
        };
      }

      const updatedUser = await prisma.organizationUser.update({
        where: { id: userId },
        data: {
          status: newStatus,
          updatedAt: new Date()
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true }
          }
        }
      });

      // Log activity
      await logUserActivity({
        userId,
        organizationId: user.organizationId,
        action: 'status_updated',
        category: 'user_management',
        description: `Status updated from ${user.status} to ${newStatus}${reason ? `: ${reason}` : ''}`,
        metadata: { 
          updatedBy, 
          previousStatus: user.status, 
          newStatus,
          reason
        }
      });

      const enhancedUser = await transformToEnhancedUser(updatedUser, { organization: true });

      return {
        success: true,
        data: enhancedUser,
        message: `User status updated to ${newStatus}`,
        timestamp: new Date()
      };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user status',
      timestamp: new Date()
    };
  }
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<UserManagementResponse<EnhancedUser>> {
  try {
    return await withUserContext(async (prisma) => {
      const user = await prisma.organizationUser.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date()
        };
      }

      // Merge with existing preferences
      const currentPreferences = user.preferences 
        ? JSON.parse(user.preferences as string) as UserPreferences
        : DEFAULT_USER_PREFERENCES;

      const updatedPreferences = {
        ...currentPreferences,
        ...preferences,
        // Deep merge nested objects
        notifications: {
          ...currentPreferences.notifications,
          ...preferences.notifications,
          email: {
            ...currentPreferences.notifications.email,
            ...preferences.notifications?.email
          },
          in_app: {
            ...currentPreferences.notifications.in_app,
            ...preferences.notifications?.in_app
          }
        },
        interface: {
          ...currentPreferences.interface,
          ...preferences.interface
        },
        workflow: {
          ...currentPreferences.workflow,
          ...preferences.workflow
        }
      };

      const updatedUser = await prisma.organizationUser.update({
        where: { id: userId },
        data: {
          preferences: JSON.stringify(updatedPreferences),
          updatedAt: new Date()
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true }
          }
        }
      });

      const enhancedUser = await transformToEnhancedUser(updatedUser, { organization: true });

      return {
        success: true,
        data: enhancedUser,
        message: 'User preferences updated successfully',
        timestamp: new Date()
      };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user preferences',
      timestamp: new Date()
    };
  }
}

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * Perform bulk operations on multiple users
 */
export async function performBulkUserOperation(
  operation: BulkUserOperation
): Promise<UserManagementResponse<BulkOperationResult>> {
  try {
    return await withUserContext(async (prisma) => {
      const results: BulkOperationResult = {
        success: [],
        failed: [],
        total: operation.userIds.length,
        successCount: 0,
        failureCount: 0
      };

      for (const userId of operation.userIds) {
        try {
          switch (operation.operation) {
            case 'activate':
              await prisma.organizationUser.update({
                where: { id: userId },
                data: { 
                  status: 'active',
                  updatedAt: new Date()
                }
              });
              break;

            case 'deactivate':
              await prisma.organizationUser.update({
                where: { id: userId },
                data: { 
                  status: 'suspended',
                  updatedAt: new Date()
                }
              });
              break;

            case 'update_role':
              if (operation.data?.role) {
                const permissions = ROLE_PERMISSIONS[operation.data.role];
                await prisma.organizationUser.update({
                  where: { id: userId },
                  data: { 
                    role: operation.data.role,
                    permissions: JSON.stringify(permissions),
                    updatedAt: new Date()
                  }
                });
              }
              break;

            case 'delete':
              await prisma.organizationUser.update({
                where: { id: userId },
                data: { 
                  status: 'deleted',
                  updatedAt: new Date()
                }
              });
              break;
          }

          results.success.push(userId);
          results.successCount++;

        } catch (error) {
          results.failed.push({
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          results.failureCount++;
        }
      }

      // Log bulk operation
      await logUserActivity({
        userId: 'system',
        organizationId: 'bulk_operation',
        action: 'bulk_operation',
        category: 'user_management',
        description: `Bulk ${operation.operation} performed on ${operation.userIds.length} users`,
        metadata: {
          operation: operation.operation,
          performedBy: operation.performedBy,
          results: {
            success: results.successCount,
            failed: results.failureCount
          },
          reason: operation.data?.reason
        }
      });

      return {
        success: true,
        data: results,
        message: `Bulk operation completed: ${results.successCount} succeeded, ${results.failureCount} failed`,
        timestamp: new Date()
      };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Bulk operation failed',
      timestamp: new Date()
    };
  }
}

// =====================================================
// ACTIVITY TRACKING
// =====================================================

/**
 * Record user activity
 */
export async function logUserActivity(activity: Omit<UserActivity, 'id' | 'timestamp'>): Promise<void> {
  try {
    await withServiceRole(async (prisma) => {
      // Note: This would require a user_activities table in your schema
      // For now, we'll log to console and could store in a separate logging system
      console.log('[USER_ACTIVITY]', {
        ...activity,
        timestamp: new Date()
      });

      // Update user's last activity
      if (activity.userId !== 'system') {
        await prisma.organizationUser.update({
          where: { id: activity.userId },
          data: { lastActivityAt: new Date() }
        }).catch(() => {
          // Ignore errors for activity updates
        });
      }
    });
  } catch (error) {
    console.error('Failed to log user activity:', error);
  }
}

/**
 * Track user login
 */
export async function trackUserLogin(
  userId: string,
  sessionInfo?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  }
): Promise<void> {
  try {
    await withUserContext(async (prisma) => {
      await prisma.organizationUser.update({
        where: { id: userId },
        data: {
          lastLoginAt: new Date(),
          lastActivityAt: new Date()
        }
      });

      // Log login activity
      await logUserActivity({
        userId,
        organizationId: 'system',
        action: 'login',
        category: 'login',
        description: 'User logged in',
        metadata: sessionInfo,
        ipAddress: sessionInfo?.ipAddress,
        userAgent: sessionInfo?.userAgent,
        sessionId: sessionInfo?.sessionId
      });
    });
  } catch (error) {
    console.error('Failed to track user login:', error);
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Build WHERE clause for user queries
 */
function buildUserWhereClause(organizationId: string, filters: UserSearchFilters) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    organizationId,
    status: { not: 'deleted' } // Exclude deleted users by default
  };

  if (filters.search) {
    where.OR = [
      { invitationEmail: { contains: filters.search, mode: 'insensitive' } },
      // Note: You might need to add name fields to your schema
    ];
  }

  if (filters.roles?.length) {
    where.role = { in: filters.roles };
  }

  if (filters.statuses?.length) {
    where.status = { in: filters.statuses };
  }

  if (filters.createdAfter) {
    where.createdAt = { ...where.createdAt, gte: filters.createdAfter };
  }

  if (filters.createdBefore) {
    where.createdAt = { ...where.createdAt, lte: filters.createdBefore };
  }

  if (filters.lastActiveAfter) {
    where.lastActivityAt = { ...where.lastActivityAt, gte: filters.lastActiveAfter };
  }

  if (filters.lastActiveBefore) {
    where.lastActivityAt = { ...where.lastActivityAt, lte: filters.lastActiveBefore };
  }

  if (filters.hasLoggedIn !== undefined) {
    if (filters.hasLoggedIn) {
      where.lastLoginAt = { not: null };
    } else {
      where.lastLoginAt = null;
    }
  }

  if (filters.isOnline) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    where.lastActivityAt = { gte: fiveMinutesAgo };
  }

  if (filters.isRecentlyActive) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    where.lastActivityAt = { gte: oneDayAgo };
  }

  return where;
}

/**
 * Build ORDER BY clause for user queries
 */
function buildUserOrderClause(sort: UserSortOptions) {
  const fieldMap: Record<typeof sort.field, string> = {
    name: 'invitationEmail', // Placeholder - you might want actual name fields
    email: 'invitationEmail',
    role: 'role',
    status: 'status',
    lastActivityAt: 'lastActivityAt',
    createdAt: 'createdAt',
    loginCount: 'loginCount'
  };

  return {
    [fieldMap[sort.field]]: sort.direction
  };
}

/**
 * Transform database user to EnhancedUser format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function transformToEnhancedUser(user: any, include: any = {}): Promise<EnhancedUser> {
  // Parse JSON fields
  const permissions = user.permissions 
    ? JSON.parse(user.permissions) as UserPermissions
    : ROLE_PERMISSIONS[user.role as UserRole];

  const preferences = user.preferences 
    ? JSON.parse(user.preferences) as UserPreferences
    : DEFAULT_USER_PREFERENCES;

  const enhancedUser: EnhancedUser = {
    id: user.id,
    clerkUserId: user.clerkUserId,
    organizationId: user.organizationId,
    
    // Profile information (you may need to add these fields to your schema)
    email: user.invitationEmail,
    displayName: user.invitationEmail, // Placeholder
    
    // Role & Status
    role: user.role,
    status: user.status,
    permissions,
    preferences,
    
    // Activity tracking
    lastLoginAt: user.lastLoginAt,
    lastActivityAt: user.lastActivityAt,
    loginCount: user.loginCount || 0,
    sessionCount: user.sessionCount || 0,
    
    // Invitation information
    invitationEmail: user.invitationEmail,
    invitationToken: user.invitationToken,
    invitationExpiresAt: user.invitationExpiresAt,
    invitedBy: user.invitedBy,
    invitedAt: user.invitedAt,
    acceptedAt: user.acceptedAt,
    
    // Audit fields
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdBy: user.createdBy,
    updatedBy: user.updatedBy,
    
    // Related data
    organization: include.organization ? user.organization : undefined
  };

  return enhancedUser;
} 