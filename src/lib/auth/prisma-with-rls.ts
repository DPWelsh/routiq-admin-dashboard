import { PrismaClient } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';

/**
 * Prisma client with Row Level Security (RLS) integration
 * Automatically sets user context for organization-scoped queries
 * 
 * Features:
 * - Automatic user context setting based on Clerk authentication
 * - Service role bypass for system operations
 * - Organization-scoped query helpers
 * - Connection pooling and cleanup
 * - Error handling for RLS violations
 */

export class PrismaWithRLS extends PrismaClient {
  private clerkUserId: string | null;
  private isServiceRole: boolean;
  private contextSet: boolean = false;

  constructor(options?: {
    clerkUserId?: string;
    isServiceRole?: boolean;
    datasourceUrl?: string;
  }) {
    super({
      datasourceUrl: options?.datasourceUrl,
      log: ['error', 'warn'],
    });

    this.clerkUserId = options?.clerkUserId || null;
    this.isServiceRole = options?.isServiceRole || false;
  }

  /**
   * Connect to database and set user context
   */
  async $connect(): Promise<void> {
    await super.$connect();
    
    if (this.clerkUserId && !this.isServiceRole) {
      await this.setUserContext(this.clerkUserId);
    } else if (this.isServiceRole) {
      await this.enableServiceRoleBypass();
    }
  }

  /**
   * Disconnect and clean up context
   */
  async $disconnect(): Promise<void> {
    if (this.contextSet) {
      await this.clearUserContext();
    }
    await super.$disconnect();
  }

  /**
   * Set user context for RLS policies
   */
  private async setUserContext(clerkUserId: string): Promise<void> {
    try {
      await this.$executeRaw`
        SELECT set_config('app.current_clerk_user_id', ${clerkUserId}, true)
      `;
      this.contextSet = true;
    } catch (error) {
      console.error('Failed to set user context for RLS:', error);
      throw new Error('Failed to set user context for database security');
    }
  }

  /**
   * Clear user context
   */
  private async clearUserContext(): Promise<void> {
    try {
      await this.$executeRaw`
        SELECT set_config('app.current_clerk_user_id', '', true)
      `;
      this.contextSet = false;
    } catch (error) {
      console.error('Failed to clear user context:', error);
      // Don't throw here as this is cleanup
    }
  }

  /**
   * Enable service role bypass for system operations
   */
  private async enableServiceRoleBypass(): Promise<void> {
    try {
      await this.$executeRaw`SELECT set_bypass_rls(true)`;
      this.contextSet = true;
    } catch (error) {
      console.error('Failed to enable service role bypass:', error);
      throw new Error('Failed to enable service role bypass');
    }
  }

  /**
   * Get current user's organization IDs
   */
  async getCurrentUserOrganizations(): Promise<string[]> {
    if (this.isServiceRole) {
      throw new Error('Service role cannot get user organizations');
    }

    try {
      const result = await this.$queryRaw<Array<{ organization_ids: string[] }>>`
        SELECT get_user_organization_ids() as organization_ids
      `;
      return result[0]?.organization_ids || [];
    } catch (error) {
      console.error('Failed to get user organizations:', error);
      return [];
    }
  }

  /**
   * Check if current user has access to organization
   */
  async hasOrganizationAccess(organizationId: string): Promise<boolean> {
    if (this.isServiceRole) {
      return true;
    }

    try {
      const result = await this.$queryRaw<Array<{ has_access: boolean }>>`
        SELECT user_has_org_access(${organizationId}) as has_access
      `;
      return result[0]?.has_access || false;
    } catch (error) {
      console.error('Failed to check organization access:', error);
      return false;
    }
  }

  /**
   * Check if current user is admin in organization
   */
  async isAdminInOrganization(organizationId: string): Promise<boolean> {
    if (this.isServiceRole) {
      return true;
    }

    try {
      const result = await this.$queryRaw<Array<{ is_admin: boolean }>>`
        SELECT user_is_admin_in_org(${organizationId}) as is_admin
      `;
      return result[0]?.is_admin || false;
    } catch (error) {
      console.error('Failed to check admin status:', error);
      return false;
    }
  }

  /**
   * Test RLS policies for current user
   */
  async testRLSPolicies(): Promise<Array<{
    table_name: string;
    operation: string;
    accessible_rows: number;
    test_status: string;
  }>> {
    if (!this.clerkUserId) {
      throw new Error('No user context set for testing');
    }

    try {
      const result = await this.$queryRaw<Array<{
        table_name: string;
        operation: string;
        accessible_rows: number;
        test_status: string;
      }>>`
        SELECT * FROM test_rls_policies(${this.clerkUserId})
      `;
      return result;
    } catch (error) {
      console.error('Failed to test RLS policies:', error);
      throw error;
    }
  }
}

/**
 * Factory function to create Prisma client with current user context
 */
export async function createPrismaWithCurrentUser(): Promise<PrismaWithRLS> {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const prisma = new PrismaWithRLS({ clerkUserId: userId });
  await prisma.$connect();
  return prisma;
}

/**
 * Factory function to create service role Prisma client
 */
export async function createServiceRolePrisma(): Promise<PrismaWithRLS> {
  const prisma = new PrismaWithRLS({ isServiceRole: true });
  await prisma.$connect();
  return prisma;
}

/**
 * Utility function to execute operation with user context
 */
export async function withUserContext<T>(
  operation: (prisma: PrismaWithRLS) => Promise<T>,
  clerkUserId?: string
): Promise<T> {
  let userId = clerkUserId;
  
  if (!userId) {
    const authResult = await auth();
    userId = authResult.userId || undefined;
  }
  
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const prisma = new PrismaWithRLS({ clerkUserId: userId });
  
  try {
    await prisma.$connect();
    return await operation(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Utility function to execute service role operations
 */
export async function withServiceRole<T>(
  operation: (prisma: PrismaWithRLS) => Promise<T>
): Promise<T> {
  const prisma = new PrismaWithRLS({ isServiceRole: true });
  
  try {
    await prisma.$connect();
    return await operation(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Middleware for Next.js API routes
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRLSContext<T extends Record<string, any>>(
  handler: (req: T, prisma: PrismaWithRLS) => Promise<Response>
) {
  return async (req: T): Promise<Response> => {
    const { userId } = await auth();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const prisma = new PrismaWithRLS({ clerkUserId: userId });
    
    try {
      await prisma.$connect();
      return await handler(req, prisma);
    } catch (error) {
      console.error('RLS middleware error:', error);
      
      // Check if it's an RLS violation
      if (error instanceof Error && error.message.includes('policy')) {
        return new Response(
          JSON.stringify({ 
            error: 'Access denied',
            message: 'You do not have permission to access this resource'
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      await prisma.$disconnect();
    }
  };
}

/**
 * Hook for React components (use with caution in client components)
 */
export function usePrismaWithRLS() {
  const createClient = async () => {
    const { userId } = await auth();
    
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    const prisma = new PrismaWithRLS({ clerkUserId: userId });
    await prisma.$connect();
    return prisma;
  };
  
  return { createClient };
}

/**
 * Error types for RLS operations
 */
export class RLSError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'RLSError';
  }
}

export class UnauthorizedError extends RLSError {
  constructor(message: string = 'User not authenticated') {
    super(message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends RLSError {
  constructor(message: string = 'Access denied by security policy') {
    super(message, 'FORBIDDEN');
  }
}

/**
 * Example usage patterns for common scenarios
 */
export const examples = {
  // Basic user operation
  async getUserPatients() {
    return withUserContext(async (prisma) => {
      return await prisma.patient.findMany({
        include: {
          conversations: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          }
        }
      });
    });
  },

  // Admin operation with permission check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateOrganizationSettings(orgId: string, settings: any) {
    return withUserContext(async (prisma) => {
      // Check admin permissions
      const isAdmin = await prisma.isAdminInOrganization(orgId);
      if (!isAdmin) {
        throw new ForbiddenError('Admin access required');
      }

      return await prisma.organization.update({
        where: { id: orgId },
        data: { settings }
      });
    });
  },

  // Service role operation (webhook handlers, etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async syncExternalData(data: any) {
    return withServiceRole(async (prisma) => {
      // Service role can access all data
      return await prisma.patient.createMany({
        data: data.patients
      });
    });
  },

  // API route with RLS
  apiHandler: withRLSContext(async (req, prisma) => {
    const patients = await prisma.patient.findMany();
    return new Response(JSON.stringify(patients));
  })
}; 