/**
 * Active Patients Statistics API - SECURED WITH CLERK AUTH
 * Task #8: Phase 4 - Dashboard Statistics Security
 * 
 * SECURITY LEVEL: HIGH
 * - Organization-scoped statistics only
 * - Clerk organization-based filtering
 * - Comprehensive audit logging
 * - Cross-organization data leak prevention
 */

import { NextRequest } from 'next/server'
import { withClerkOrganization } from '@/lib/auth/clerk-request-context'
import { prisma } from '@/lib/prisma'

export const GET = withClerkOrganization(async (context, request: NextRequest) => {
  try {
    console.log('👥 ACTIVE PATIENTS STATS: Starting request processing...')
    console.log('✅ ACTIVE PATIENTS STATS: Auth successful', {
      userId: context.userId,
      organizationId: context.organizationId,
      userRole: context.organizationRole
    })

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    // Audit log this sensitive patient analytics access
    console.log(`[AUDIT] Active patients stats access`, {
      userId: context.userId,
      organizationId: context.organizationId,
      timestamp: new Date().toISOString(),
      requestId: request.headers.get('x-request-id')
    })

    // Calculate date threshold for activity
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - days)

    // Get organization-scoped patient statistics using Clerk organization ID
    const [
      totalPatients,
      activePatients,
      patientsWithRecentActivity,
      patientsWithEscalations,
      averageConversations,
      sentimentStats
    ] = await Promise.all([
      // Total patients in organization
      prisma.patient.count({
        where: {
          organizationId: context.organizationId
        }
      }),

      // Active patients in organization
      prisma.patient.count({
        where: {
          organizationId: context.organizationId,
          status: 'active'
        }
      }),

      // Patients with recent activity
      prisma.patient.count({
        where: {
          organizationId: context.organizationId,
          ...(includeInactive ? {} : { status: 'active' }),
          conversations: {
            some: {
              createdAt: {
                gte: dateThreshold
              }
            }
          }
        }
      }),

      // Patients with escalated conversations
      prisma.patient.count({
        where: {
          organizationId: context.organizationId,
          conversations: {
            some: {
              escalationFlag: true,
              createdAt: {
                gte: dateThreshold
              }
            }
          }
        }
      }),

      // Average conversations per patient
      prisma.patient.findMany({
        where: {
          organizationId: context.organizationId,
          ...(includeInactive ? {} : { status: 'active' })
        },
        include: {
          _count: {
            select: {
              conversations: {
                where: {
                  createdAt: {
                    gte: dateThreshold
                  }
                }
              }
            }
          }
        }
      }),

      // Sentiment analysis for patients
      prisma.conversation.aggregate({
        where: {
          organizationId: context.organizationId,
          sentimentScore: {
            not: null
          },
          createdAt: {
            gte: dateThreshold
          }
        },
        _avg: {
          sentimentScore: true
        },
        _count: {
          sentimentScore: true
        }
      })
    ])

    // Calculate average conversations per patient
    const totalConversations = averageConversations.reduce((sum: number, patient: any) => 
      sum + patient._count.conversations, 0
    )
    const avgConversationsPerPatient = activePatients > 0 ? 
      Number((totalConversations / activePatients).toFixed(2)) : 0

    // Calculate activity metrics
    const activityRate = totalPatients > 0 ? 
      Number(((patientsWithRecentActivity / totalPatients) * 100).toFixed(1)) : 0
    
    const escalationRate = patientsWithRecentActivity > 0 ? 
      Number(((patientsWithEscalations / patientsWithRecentActivity) * 100).toFixed(1)) : 0

    const stats = {
      overview: {
        totalPatients,
        activePatients,
        inactivePatients: totalPatients - activePatients,
        patientsWithRecentActivity,
        activityRate
      },
      engagement: {
        totalConversations,
        averageConversationsPerPatient: avgConversationsPerPatient,
        patientsWithEscalations,
        escalationRate
      },
      sentiment: {
        averageScore: sentimentStats._avg.sentimentScore ? 
          Number(sentimentStats._avg.sentimentScore.toFixed(2)) : null,
        conversationsAnalyzed: sentimentStats._count.sentimentScore
      },
      timeframe: {
        days,
        includeInactive,
        dateThreshold: dateThreshold.toISOString()
      },
      organizationContext: {
        organizationId: context.organizationId,
        userRole: context.organizationRole
      },
      lastUpdated: new Date().toISOString()
    }

    // Audit log successful access
    console.log(`[AUDIT] Active patients stats access successful`, {
      userId: context.userId,
      organizationId: context.organizationId,
      totalPatients,
      activePatients,
      patientsWithRecentActivity,
      days
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: stats,
        metadata: {
          accessedAt: new Date().toISOString(),
          accessedBy: context.userId,
          securityLevel: 'ORGANIZATION_SCOPED',
          auditLogged: true
        }
      }),
      {
        status: 200,
        headers: { 
          'content-type': 'application/json',
          'x-content-type-options': 'nosniff'
        }
      }
    )

  } catch (error) {
    // Audit log the error
    console.error(`[AUDIT] Active patients stats access error`, {
      userId: context.userId || 'unknown',
      organizationId: context.organizationId || 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch active patients statistics',
        code: 'ACTIVE_PATIENTS_STATS_ERROR',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
})

// Force dynamic rendering for real-time data
export const dynamic = 'force-dynamic' 