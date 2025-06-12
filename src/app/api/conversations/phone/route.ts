/**
 * Phone Conversations API - SECURED WITH CLERK AUTH
 * Task #8: Basic RBAC Implementation - Conversation Security
 * 
 * SECURITY LEVEL: HIGH
 * - Organization validation for phone-based conversation access
 * - Clerk organization-based filtering
 * - Cross-organization access prevention
 * - Comprehensive audit logging
 */

import { NextRequest } from 'next/server'
import { withClerkOrganization } from '@/lib/auth/clerk-request-context'
import { prisma } from '@/lib/prisma'

export const GET = withClerkOrganization(async (context, request: NextRequest) => {
  const startTime = Date.now()
  
  try {
    console.log('📞 PHONE CONVERSATIONS: Starting request processing...')
    console.log('📞 PHONE CONVERSATIONS: Context:', {
      userId: context.userId,
      organizationId: context.organizationId,
      userRole: context.organizationRole
    })

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    // Audit log this sensitive phone-based access
    console.log(`[AUDIT] Phone conversations access`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      userRole: context.organizationRole,
      requestType: phone ? 'specific_phone' : 'phone_list',
      phoneRequested: phone || 'N/A',
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Create organization filter using Clerk organization ID
    const orgFilter = { organizationId: context.organizationId }
    console.log('📞 PHONE CONVERSATIONS: Using org filter:', orgFilter)

    if (phone) {
      // ============================================
      // SPECIFIC PHONE CONVERSATION REQUEST - SECURED
      // ============================================
      console.log(`[AUDIT] Specific phone conversation access`, {
        timestamp: new Date().toISOString(),
        userId: context.userId,
        organizationId: context.organizationId,
        phone
      })

      try {
        // Find patient with this phone number in the organization
        console.log('📞 PHONE CONVERSATIONS: Searching for patient with phone:', phone)
        const patient = await prisma.patient.findFirst({
          where: {
            phone: phone,
            ...orgFilter
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        })
        console.log('📞 PHONE CONVERSATIONS: Patient found:', patient ? 'Yes' : 'No')

        if (!patient) {
          console.warn(`[AUDIT] Phone conversation access denied - patient not found`, {
            timestamp: new Date().toISOString(),
            userId: context.userId,
            organizationId: context.organizationId,
            requestedPhone: phone,
            reason: 'PATIENT_NOT_FOUND_OR_UNAUTHORIZED'
          })

          return new Response(
            JSON.stringify({
              success: false,
              error: 'No conversation found for this phone number',
              code: 'CONVERSATION_NOT_FOUND'
            }),
            { 
              status: 404,
              headers: { 'content-type': 'application/json' }
            }
          )
        }

        // Get the most recent conversation for this patient
        console.log('📞 PHONE CONVERSATIONS: Searching for conversations for patient:', patient.id)
        const conversation = await prisma.conversation.findFirst({
          where: {
            patientId: patient.id,
            ...orgFilter
          },
          orderBy: { createdAt: 'desc' },
          include: {
            messages: {
              orderBy: { timestamp: 'asc' },
              select: {
                id: true,
                content: true,
                senderType: true,
                timestamp: true,
                sentimentScore: true,
                sentimentLabel: true,
                createdAt: true
              }
            }
          }
        })
        console.log('📞 PHONE CONVERSATIONS: Conversation found:', conversation ? 'Yes' : 'No')

        if (!conversation) {
          console.warn(`[AUDIT] Phone conversation access denied - no conversations found`, {
            timestamp: new Date().toISOString(),
            userId: context.userId,
            organizationId: context.organizationId,
            patientId: patient.id,
            phone: phone,
            reason: 'NO_CONVERSATIONS_FOUND'
          })

          return new Response(
            JSON.stringify({
              success: false,
              error: 'No conversation found for this phone number',
              code: 'CONVERSATION_NOT_FOUND'
            }),
            { 
              status: 404,
              headers: { 'content-type': 'application/json' }
            }
          )
        }

        const responseTime = Date.now() - startTime

        // Audit log successful access
        console.log(`[AUDIT] Phone conversation access successful`, {
          timestamp: new Date().toISOString(),
          userId: context.userId,
          organizationId: context.organizationId,
          conversationId: conversation.id,
          patientId: patient.id,
          phone: phone,
          messageCount: conversation.messages.length,
          responseTime
        })

        return new Response(
          JSON.stringify({
            success: true,
            conversation: {
              phone: patient.phone,
              patient_name: patient.name || 'Unknown',
              email: patient.email || '',
              patient_id: patient.id,
              conversation_id: conversation.id,
              conversation_source: conversation.source,
              conversation_updated_at: conversation.updatedAt,
              total_messages: conversation.messages.length,
              last_message_time: conversation.messages.length > 0 ? conversation.messages[conversation.messages.length - 1].timestamp || conversation.messages[conversation.messages.length - 1].createdAt : conversation.updatedAt,
              last_message_content: conversation.messages.length > 0 ? conversation.messages[conversation.messages.length - 1].content : '',
              last_message_sender: conversation.messages.length > 0 ? conversation.messages[conversation.messages.length - 1].senderType : 'system',
              latest_conversation_date: conversation.updatedAt,
              bot_messages: conversation.messages.filter((m: { senderType: string }) => m.senderType === 'agent').length,
              user_messages: conversation.messages.filter((m: { senderType: string }) => m.senderType === 'user').length,
              system_messages: conversation.messages.filter((m: { senderType: string }) => m.senderType === 'system').length
            },
            messages: conversation.messages.map((msg: { id: string; content: string; senderType: string; timestamp?: Date; createdAt: Date }) => ({
              id: msg.id,
              content: msg.content,
              sender_type: msg.senderType,
              timestamp: msg.timestamp || msg.createdAt,
              metadata: null,
              external_id: `msg_${msg.id}`
            })),
            organizationContext: {
              organizationId: context.organizationId,
              userRole: context.organizationRole
            },
            metadata: {
              accessedAt: new Date().toISOString(),
              accessedBy: context.userId,
              responseTime,
              securityLevel: 'ORGANIZATION_VALIDATED'
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
      } catch (dbError) {
        console.error('📞 PHONE CONVERSATIONS: Database error for specific phone:', dbError)
        throw dbError
      }

    } else {
      // ============================================
      // PHONE CONVERSATION LIST REQUEST - SECURED
      // ============================================
      console.log(`[AUDIT] Phone conversation list access`, {
        timestamp: new Date().toISOString(),
        userId: context.userId,
        organizationId: context.organizationId
      })

      try {
        // Get all conversations with phone numbers for this organization
        console.log('📞 PHONE CONVERSATIONS: Searching for all conversations in org:', context.organizationId)
        const conversations = await prisma.conversation.findMany({
          where: orgFilter,
          include: {
            patient: true,
            messages: {
              orderBy: { timestamp: 'desc' },
              take: 1
            },
            _count: {
              select: {
                messages: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        })
        console.log('📞 PHONE CONVERSATIONS: Total conversations found:', conversations.length)

        // Filter to only conversations with phone numbers and transform to expected format
        const phoneConversations = conversations
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((conv: any) => conv.patient?.phone)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((conv: any) => {
            const latestMessage = conv.messages[0] // First message due to desc order by timestamp
            
            // Log for debugging timestamp issues
            if (latestMessage) {
              console.log(`📞 DEBUG: ${conv.patient!.name} - Latest message timestamp: ${latestMessage.timestamp}, createdAt: ${latestMessage.createdAt}`)
            }
            
            return {
              patient_id: conv.patient!.id,
              phone: conv.patient!.phone,
              patient_name: conv.patient!.name || 'Unknown',
              email: conv.patient!.email || '',
              total_messages: conv._count.messages,
              conversation_source: conv.source,
              conversation_id: conv.id,
              latest_conversation_date: conv.updatedAt,
              escalation_flag: conv.escalationFlag,
              overall_sentiment: conv.overallSentiment,
              quality_rating: conv.qualityRating,
              last_message_content: latestMessage?.content || 'No messages',
              last_message_sender: latestMessage?.senderType || 'unknown',
              last_message_time: latestMessage?.timestamp || latestMessage?.createdAt || conv.updatedAt,
              bot_messages: 0, // Will be calculated separately if needed
              user_messages: 0, // Will be calculated separately if needed  
              system_messages: 0 // Will be calculated separately if needed
            }
          })

        console.log('📞 PHONE CONVERSATIONS: Phone conversations filtered:', phoneConversations.length)

        const totalResponseTime = Date.now() - startTime

        // Audit log successful access
        console.log(`[AUDIT] Phone conversation list successful`, {
          timestamp: new Date().toISOString(),
          userId: context.userId,
          organizationId: context.organizationId,
          conversationCount: phoneConversations.length,
          totalResponseTime
        })

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              conversations: phoneConversations
            },
            organizationContext: {
              organizationId: context.organizationId,
              userRole: context.organizationRole
            },
            meta: {
              count: phoneConversations.length,
              responseTime: totalResponseTime,
              accessedAt: new Date().toISOString(),
              accessedBy: context.userId,
              securityLevel: 'ORGANIZATION_VALIDATED'
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
      } catch (dbError) {
        console.error('📞 PHONE CONVERSATIONS: Database error for list:', dbError)
        throw dbError
      }
    }

  } catch (error) {
    const errorTime = Date.now() - startTime
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    // Audit log the error
    console.error(`[AUDIT] Phone conversations access error`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      phone: phone || 'N/A',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      errorTime
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch phone conversations',
        code: 'FETCH_PHONE_CONVERSATIONS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        meta: {
          errorTime,
          securityLevel: 'ORGANIZATION_VALIDATED'
        }
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

/**
 * ✅ RESOLVED - PRISMA WORKING CORRECTLY
 * 
 * 1. Phone Parameter Handling:
 *    - Phone numbers must be URL-encoded (e.g., "%2B61439818201")
 *    - Use encodeURIComponent(phone) in frontend
 *    - Use decodeURIComponent(phone) when needed
 * 
 * 2. Prisma Field Mapping:
 *    - Prisma camelCase fields map correctly to snake_case DB columns
 *    - senderType -> sender_type ✅
 *    - organizationId -> organization_id ✅
 *    - Frontend receives senderType from msg.senderType ✅
 * 
 * 3. Response Structure:
 *    - List: { success: true, data: { conversations: [] } }
 *    - Detail: { success: true, conversation: {}, messages: [] }
 *    - Error: { success: false, error: string, details?: string }
 * 
 * 4. Organization Filtering:
 *    - All queries include organizationId filter ✅
 *    - Multi-tenant isolation working ✅
 *    - Prisma handles organization_id mapping ✅
 */ 