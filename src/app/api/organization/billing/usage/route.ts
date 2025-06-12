import { NextRequest } from 'next/server'
import { requirePermissions } from '@/lib/rbac/rbac-middleware'
import { Permission } from '@/lib/rbac/permissions'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * GET /api/organization/billing/usage
 * Returns basic usage metrics for the organization
 * Requires ORGANIZATION_BILLING permission (admin/owner only)
 */
export const GET = requirePermissions([Permission.ORGANIZATION_BILLING])(
  async (context, request: NextRequest) => {
    try {
      const url = new URL(request.url)
      const period = url.searchParams.get('period') || '30' // days
      const periodDays = Math.min(parseInt(period), 365)

      // Audit log for usage access
      console.log(`[AUDIT] Organization usage metrics accessed`, {
        timestamp: new Date().toISOString(),
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        userRole: context.userRole,
        period: periodDays
      })

      // Get organization from database
      const organization = await prisma.organization.findUnique({
        where: { id: context.organizationId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          subscriptionPlan: true,
          subscriptionStatus: true
        }
      })

      if (!organization) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Organization not found',
            code: 'ORGANIZATION_NOT_FOUND'
          }),
          { 
            status: 404,
            headers: { 'content-type': 'application/json' }
          }
        )
      }

      // Calculate basic usage metrics
      const [totalUsers, totalPatients, totalConversations, totalMessages] = await Promise.all([
        // Total users in organization
        prisma.organizationUser.count({
          where: { organizationId: context.organizationId }
        }),

        // Total patients
        prisma.patient.count({
          where: { organizationId: context.organizationId }
        }),

        // Total conversations
        prisma.conversation.count({
          where: { organizationId: context.organizationId }
        }),

        // Total messages
        prisma.message.count({
          where: { organizationId: context.organizationId }
        })
      ])

      // Calculate usage limits and warnings based on plan
      const planLimits = getPlanLimits(organization.subscriptionPlan)
      const usageWarnings = []

      // Check for usage warnings
      if (totalMessages > planLimits.messages * 0.8) {
        usageWarnings.push({
          type: 'messages',
          level: totalMessages > planLimits.messages * 0.95 ? 'critical' : 'warning',
          current: totalMessages,
          limit: planLimits.messages,
          percentage: Math.round((totalMessages / planLimits.messages) * 100)
        })
      }

      if (totalUsers > planLimits.users * 0.8) {
        usageWarnings.push({
          type: 'users',
          level: totalUsers > planLimits.users * 0.95 ? 'critical' : 'warning',
          current: totalUsers,
          limit: planLimits.users,
          percentage: Math.round((totalUsers / planLimits.users) * 100)
        })
      }

      const usageData = {
        period: {
          days: periodDays,
          organizationAge: Math.floor((Date.now() - organization.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        },
        metrics: {
          users: {
            total: totalUsers,
            limit: planLimits.users,
            percentage: Math.round((totalUsers / planLimits.users) * 100)
          },
          patients: {
            total: totalPatients,
            limit: planLimits.patients,
            percentage: Math.round((totalPatients / planLimits.patients) * 100)
          },
          conversations: {
            total: totalConversations,
            limit: planLimits.conversations,
            percentage: Math.round((totalConversations / planLimits.conversations) * 100)
          },
          messages: {
            total: totalMessages,
            limit: planLimits.messages,
            percentage: Math.round((totalMessages / planLimits.messages) * 100)
          }
        },
        warnings: usageWarnings,
        plan: {
          name: organization.subscriptionPlan || 'free',
          status: organization.subscriptionStatus,
          limits: planLimits
        },
        metadata: {
          accessedAt: new Date().toISOString(),
          accessedBy: context.clerkUserId,
          organizationId: context.organizationId
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: usageData
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
      console.error(`[ERROR] Organization usage fetch failed`, {
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch usage metrics',
          code: 'USAGE_FETCH_ERROR',
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' }
        }
      )
    } finally {
      await prisma.$disconnect()
    }
  }
)

/**
 * Get plan limits based on subscription plan
 */
function getPlanLimits(plan: string | null | undefined) {
  const planLimits = {
    free: {
      users: 3,
      patients: 100,
      conversations: 500,
      messages: 2000
    },
    starter: {
      users: 10,
      patients: 1000,
      conversations: 5000,
      messages: 20000
    },
    professional: {
      users: 50,
      patients: 10000,
      conversations: 50000,
      messages: 200000
    },
    enterprise: {
      users: 1000,
      patients: 100000,
      conversations: 1000000,
      messages: 5000000
    }
  }

  return planLimits[plan as keyof typeof planLimits] || planLimits.free
} 