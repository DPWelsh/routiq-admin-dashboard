import { NextRequest } from 'next/server'
import { withClerkOrganization } from '@/lib/auth/clerk-request-context'

/**
 * GET /api/organization/context
 * Returns organization context for the authenticated user
 * This endpoint is used by frontend components to access organization data
 */
export const GET = withClerkOrganization(async (context) => {
  try {
    // Return the Clerk organization context
    const organizationContext = {
      organizationId: context.organizationId,
      organizationSlug: null, // Not available in current Clerk context
      userRole: context.organizationRole,
      userStatus: 'active', // Assume active if they have access
      organizationStatus: 'active', // Assume active if they have access
      clerkUserId: context.userId,
      permissions: {}, // Could be expanded based on role
    }

    // Audit log for security monitoring
    console.log(`[AUDIT] Organization context accessed`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      userRole: context.organizationRole,
      securityLevel: 'ORGANIZATION_SCOPED'
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: organizationContext,
        metadata: {
          accessedAt: new Date().toISOString(),
          securityLevel: 'ORGANIZATION_SCOPED'
        }
      }),
      {
        status: 200,
        headers: { 
          'content-type': 'application/json',
          'x-content-type-options': 'nosniff',
          'cache-control': 'private, no-cache, no-store, must-revalidate'
        }
      }
    )

  } catch (error) {
    console.error(`[ERROR] Organization context fetch failed`, {
      userId: context.userId,
      organizationId: context.organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch organization context',
        code: 'ORGANIZATION_CONTEXT_ERROR',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
}) 