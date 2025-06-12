/**
 * Conversations API - SECURED WITH RBAC
 * Task #8: Emergency Security Fix - Organization Filtering
 * 
 * SECURITY LEVEL: HIGH
 * - Organization-scoped data access
 * - RBAC permission validation
 * - Comprehensive audit logging
 * - Pagination and filtering
 */

import { NextRequest } from 'next/server'
import { requireConversationAccess } from '@/lib/rbac/rbac-middleware'
import { createOrganizationFilter } from '@/lib/auth/request-context'
import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logging/logger'

const prisma = new PrismaClient()

// Require CONVERSATIONS_VIEW permission
export const GET = requireConversationAccess('view')(async (context, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50) // Max 50 records
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const source = searchParams.get('source') || ''

    logger.api.request('GET', '/api/conversations', {
      organizationId: context.organizationId,
      userRole: context.userRole,
      params: { page, limit, search, status, source }
    })

    // Create organization filter to ensure data isolation
    const orgFilter = createOrganizationFilter(context)

    // Build where clause with organization scoping
    const whereClause = {
      ...orgFilter,
      ...(status && { status }),
      ...(source && { source }),
      ...(search && {
        OR: [
          { externalId: { contains: search, mode: 'insensitive' as const } },
          { patient: { name: { contains: search, mode: 'insensitive' as const } } },
          { patient: { phone: { contains: search, mode: 'insensitive' as const } } },
          { messages: { some: { content: { contains: search, mode: 'insensitive' as const } } } }
        ]
      })
    }

    // Fetch conversations with pagination and organization scoping
    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: whereClause,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true
            }
          },
          messages: {
            take: 3, // Include last 3 messages for preview
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              senderType: true,
              timestamp: true,
              sentimentLabel: true,
              sentimentScore: true
            }
          },
          _count: {
            select: {
              messages: true
            }
          }
        }
      }),
      prisma.conversation.count({ where: whereClause })
    ])

    const response = {
      success: true,
      data: conversations.map(conv => ({
        id: conv.id,
        externalId: conv.externalId,
        source: conv.source,
        status: conv.status,
        patient: conv.patient,
        messageCount: conv._count.messages,
        recentMessages: conv.messages,
        overallSentiment: conv.overallSentiment,
        sentimentScore: conv.sentimentScore,
        qualityRating: conv.qualityRating,
        escalationFlag: conv.escalationFlag,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      organizationContext: {
        organizationId: context.organizationId,
        organizationName: context.organizationName,
        userRole: context.userRole
      },
      filters: {
        search,
        status,
        source
      }
    }

    logger.api.response('GET', '/api/conversations', 200, { 
      count: conversations.length,
      total,
      organizationId: context.organizationId 
    })

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )

  } catch (error) {
    logger.api.error('GET', '/api/conversations', error)

    // Audit log the error with additional context
    console.error(`[AUDIT] Conversations access error`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      userRole: context.userRole,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch conversations',
        code: 'FETCH_CONVERSATIONS_ERROR',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
}) 