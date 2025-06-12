/**
 * Individual Conversation API - SECURED WITH RBAC
 * Task #8: Emergency Security Fix - Individual Record Protection
 * 
 * SECURITY LEVEL: HIGH
 * - Organization validation for individual conversations
 * - RBAC permission validation
 * - Cross-organization access prevention
 * - Comprehensive audit logging
 */

import { NextRequest } from 'next/server'
import { requireConversationAccess } from '@/lib/rbac/rbac-middleware'
import { createOrganizationFilter, RequestOrganizationContext } from '@/lib/auth/request-context'
import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logging/logger'

const prisma = new PrismaClient()

// Require CONVERSATIONS_VIEW permission
export const GET = requireConversationAccess('view')(async (
  context: RequestOrganizationContext,
  request: NextRequest
) => {
  try {
    // Extract sessionId from URL path
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const sessionId = pathSegments[pathSegments.length - 1]

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          error: 'Session ID is required',
          code: 'MISSING_SESSION_ID'
        }),
        { 
          status: 400,
          headers: { 'content-type': 'application/json' }
        }
      )
    }
    
    // Audit log this specific conversation access
    console.log(`[AUDIT] Individual conversation access`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      userRole: context.userRole,
      conversationId: sessionId,
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })

    logger.api.request('GET', `/api/conversations/${sessionId}`)

    // Create organization filter
    const orgFilter = createOrganizationFilter(context)

    // First, verify the conversation exists and belongs to the organization
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: sessionId,
        ...orgFilter
      },
      select: {
        id: true,
        patientId: true,
        source: true,
        status: true,
        externalId: true,
        overallSentiment: true,
        sentimentScore: true,
        qualityRating: true,
        escalationFlag: true,
        createdAt: true,
        updatedAt: true,
        patient: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        }
      }
    })

    if (!conversation) {
      // Audit log the failed access attempt
      console.warn(`[AUDIT] Conversation access denied - not found or unauthorized`, {
        timestamp: new Date().toISOString(),
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        requestedConversationId: sessionId,
        reason: 'CONVERSATION_NOT_FOUND_OR_UNAUTHORIZED'
      })

      return new Response(
        JSON.stringify({
          error: 'Conversation not found or access denied',
          code: 'CONVERSATION_NOT_FOUND'
        }),
        { 
          status: 404,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    // Fetch messages for this conversation
    const messages = await prisma.message.findMany({
      where: {
        conversationId: sessionId,
        ...orgFilter // Organization filtering
      },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        content: true,
        senderType: true,
        timestamp: true,
        sentimentScore: true,
        sentimentLabel: true,
        confidenceScore: true,
        createdAt: true
      }
    })

    const response = {
      success: true,
      conversation: {
        ...conversation,
        messageCount: messages.length,
        organizationId: context.organizationId // Add from context
      },
      messages,
      organizationContext: {
        organizationId: context.organizationId,
        organizationName: context.organizationName,
        userRole: context.userRole
      },
      metadata: {
        accessedAt: new Date().toISOString(),
        accessedBy: context.clerkUserId,
        securityLevel: 'ORGANIZATION_VALIDATED'
      }
    }

    // Audit log successful access
    console.log(`[AUDIT] Individual conversation access successful`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      conversationId: sessionId,
      messageCount: messages.length,
      patientId: conversation.patientId
    })

    logger.api.response('GET', `/api/conversations/${sessionId}`, 200, { 
      count: messages.length,
      organizationId: context.organizationId 
    })

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { 
          'content-type': 'application/json',
          'x-content-type-options': 'nosniff'
        }
      }
    )

  } catch (error) {
    // Extract sessionId for error logging
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const sessionId = pathSegments[pathSegments.length - 1]
    
    // Audit log the error
    console.error(`[AUDIT] Individual conversation access error`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      conversationId: sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    logger.api.error('GET', `/api/conversations/${sessionId}`, error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch conversation messages',
        code: 'FETCH_CONVERSATION_ERROR',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
}) 