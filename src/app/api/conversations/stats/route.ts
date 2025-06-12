/**
 * Conversation Stats API - SECURED WITH RBAC
 * Task #8: Phase 5 - Conversation Statistics Security
 * 
 * SECURITY LEVEL: HIGH
 * - Organization-scoped conversation statistics only
 * - RBAC permission validation (CONVERSATIONS_VIEW + ANALYTICS_VIEW)
 * - Comprehensive audit logging
 * - Cross-organization data leak prevention
 */

import { NextRequest } from 'next/server'
import { requirePermissions } from '@/lib/rbac/rbac-middleware'
import { Permission } from '@/lib/rbac/permissions'
import { RequestOrganizationContext } from '@/lib/auth/request-context'
import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logging/logger'

const prisma = new PrismaClient()

// Generate request ID for tracing
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Require both CONVERSATIONS_VIEW and ANALYTICS_VIEW permissions
export const GET = requirePermissions([
  Permission.CONVERSATIONS_VIEW, 
  Permission.ANALYTICS_VIEW
], {
  requireAll: true,
  message: 'Conversation analytics access requires both conversation view and analytics permissions'
})(async (context: RequestOrganizationContext, request: NextRequest) => {
  const requestId = generateRequestId()
  const { pathname } = new URL(request.url)
  
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const source = searchParams.get('source') || 'all'
    
    // Audit log this sensitive conversation analytics access
    console.log(`[AUDIT] Conversation stats access`, {
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      userRole: context.userRole,
      timestamp: new Date().toISOString(),
      requestId,
      params: { days, source }
    })

    // Log incoming request
    logger.api.request('GET', pathname, {
      requestId,
      organizationId: context.organizationId,
      userRole: context.userRole,
      params: { days, source }
    })
    
    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get organization-scoped conversation statistics
    const conversationStats = await prisma.conversation.findMany({
      where: {
        organizationId: context.organizationId,
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...(source !== 'all' && { source })
      },
      include: {
        messages: {
          select: {
            id: true,
            sentimentScore: true,
            sentimentLabel: true
          }
        },
        patient: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      }
    })

    // Calculate statistics
    const totalConversations = conversationStats.length
    const totalMessages = conversationStats.reduce((sum, conv) => sum + conv.messages.length, 0)
    
    // Sentiment analysis
    const sentimentCounts = {
      positive: 0,
      negative: 0,
      neutral: 0,
      unanalyzed: 0
    }
    
    let totalSentimentScore = 0
    let sentimentScoreCount = 0
    
    conversationStats.forEach(conv => {
      conv.messages.forEach(msg => {
        if (msg.sentimentScore) {
          totalSentimentScore += Number(msg.sentimentScore)
          sentimentScoreCount++
        }
        
        if (msg.sentimentLabel) {
          const label = msg.sentimentLabel.toLowerCase()
          if (label in sentimentCounts) {
            sentimentCounts[label as keyof typeof sentimentCounts]++
          } else {
            sentimentCounts.unanalyzed++
          }
        } else {
          sentimentCounts.unanalyzed++
        }
      })
    })

    // Escalation analysis
    const escalatedConversations = conversationStats.filter(conv => conv.escalationFlag).length
    const escalationRate = totalConversations > 0 ? 
      Number(((escalatedConversations / totalConversations) * 100).toFixed(2)) : 0

    // Quality ratings
    const qualityRatings = conversationStats
      .filter(conv => conv.qualityRating !== null)
      .map(conv => conv.qualityRating as number)
    
    const averageQuality = qualityRatings.length > 0 ? 
      Number((qualityRatings.reduce((sum, rating) => sum + rating, 0) / qualityRatings.length).toFixed(2)) : null

    // Source distribution
    const sourceDistribution = conversationStats.reduce((acc, conv) => {
      acc[conv.source] = (acc[conv.source] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Time-based analysis (conversations per day)
    const dailyStats: Record<string, number> = {}
    conversationStats.forEach(conv => {
      const date = conv.createdAt.toISOString().split('T')[0]
      dailyStats[date] = (dailyStats[date] || 0) + 1
    })

    const stats = {
      overview: {
        totalConversations,
        totalMessages,
        averageMessagesPerConversation: totalConversations > 0 ? 
          Number((totalMessages / totalConversations).toFixed(1)) : 0,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days
        }
      },
      sentiment: {
        distribution: sentimentCounts,
        averageScore: sentimentScoreCount > 0 ? 
          Number((totalSentimentScore / sentimentScoreCount).toFixed(3)) : null,
        percentages: {
          positive: totalMessages > 0 ? Number(((sentimentCounts.positive / totalMessages) * 100).toFixed(1)) : 0,
          negative: totalMessages > 0 ? Number(((sentimentCounts.negative / totalMessages) * 100).toFixed(1)) : 0,
          neutral: totalMessages > 0 ? Number(((sentimentCounts.neutral / totalMessages) * 100).toFixed(1)) : 0,
          unanalyzed: totalMessages > 0 ? Number(((sentimentCounts.unanalyzed / totalMessages) * 100).toFixed(1)) : 0
        }
      },
      escalations: {
        total: escalatedConversations,
        rate: escalationRate,
        percentage: escalationRate
      },
      quality: {
        averageRating: averageQuality,
        totalRated: qualityRatings.length,
        distribution: qualityRatings.reduce((acc, rating) => {
          acc[rating] = (acc[rating] || 0) + 1
          return acc
        }, {} as Record<number, number>)
      },
      sources: sourceDistribution,
      timeline: dailyStats,
      organizationContext: {
        organizationId: context.organizationId,
        organizationName: context.organizationName,
        userRole: context.userRole
      },
      lastUpdated: new Date().toISOString()
    }

    // Audit log successful access
    console.log(`[AUDIT] Conversation stats access successful`, {
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      totalConversations,
      totalMessages,
      escalatedConversations,
      requestId,
      timestamp: new Date().toISOString()
    })

    logger.api.response('GET', pathname, 200, {
      requestId,
      organizationId: context.organizationId,
      totalConversations,
      totalMessages
    })

    return new Response(
      JSON.stringify({
        success: true,
        data: stats,
        requestId,
        metadata: {
          accessedAt: new Date().toISOString(),
          accessedBy: context.clerkUserId,
          securityLevel: 'ORGANIZATION_SCOPED',
          auditLogged: true,
          permissions: [Permission.CONVERSATIONS_VIEW, Permission.ANALYTICS_VIEW]
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
    console.error(`[AUDIT] Conversation stats access error`, {
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })

    logger.error('Conversation Stats API Error', {
      requestId,
      organizationId: context.organizationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to retrieve conversation statistics',
        code: 'CONVERSATION_STATS_ERROR',
        requestId,
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