/**
 * Patient Messages API - Get all messages for a specific patient
 * Uses the patient_messages_view for efficient querying
 * SECURED WITH CLERK AUTH & ORGANIZATION FILTERING
 */

import { NextRequest } from 'next/server'
import { withClerkOrganization } from '@/lib/auth/clerk-request-context'
import { prisma } from '@/lib/prisma'

// Types for the patient messages response
interface PatientMessage {
  messageId: string
  content: string
  senderType: string
  timestamp: Date
  sentimentLabel?: string
  sentimentScore?: number
  confidenceScore?: number
  analyzedAt?: Date
  conversationId: string
  conversationSource: string
  messageSequence: number
}

interface PatientMessagesSummary {
  patientId: string
  patientName: string
  patientPhone: string
  patientEmail?: string
  totalConversations: number
  totalMessages: number
  patientMessages: number
  staffMessages: number
  systemMessages: number
  firstMessage: Date
  lastMessage: Date
  avgSentimentScore?: number
  conversationSources: string[]
}

interface PatientMessagesResponse {
  success: boolean
  summary: PatientMessagesSummary
  messages: PatientMessage[]
  pagination: {
    page: number
    limit: number
    total: number
    hasNext: boolean
  }
}

// Database query result types
interface SummaryQueryResult {
  patient_id: string
  patient_name: string
  patient_phone: string
  patient_email?: string
  total_conversations: number
  total_messages: number
  patient_messages: number
  staff_messages: number
  system_messages: number
  first_message: Date
  last_message: Date
  avg_sentiment_score?: string
  conversation_sources: string[]
}

interface MessageQueryResult {
  message_id: string
  message_content: string
  message_sender_type: string
  message_timestamp: Date
  message_sentiment_label?: string
  message_sentiment_score?: string
  message_confidence_score?: string
  message_analyzed_at?: Date
  conversation_id: string
  conversation_source: string
  message_sequence_in_conversation: number
}

export const GET = withClerkOrganization(async (context, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    
    // Query parameters
    const phone = searchParams.get('phone')
    const name = searchParams.get('name')
    const patientId = searchParams.get('patientId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200) // Max 200 messages
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const senderType = searchParams.get('senderType') // 'user', 'agent', 'system'
    const conversationSource = searchParams.get('source') // 'chatwoot', 'n8n', etc.

    // Normalize phone number - handle URL encoding and ensure + prefix
    const normalizedPhone = phone ? (phone.startsWith('+') ? phone : `+${phone}`) : null

    // Must provide at least one identifier
    if (!phone && !name && !patientId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Must provide phone, name, or patientId parameter',
          code: 'MISSING_IDENTIFIER'
        }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      )
    }

    console.log(`[AUDIT] Patient messages query`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      params: { phone: normalizedPhone, name, patientId, page, limit, dateFrom, dateTo, senderType, conversationSource }
    })

    // Build where clause for the query
    const whereConditions: string[] = []
    const queryParams: unknown[] = []
    let paramIndex = 1

    // Organization filtering - ensure patient belongs to current organization
    // We need to join with patients table to get organization_id
    whereConditions.push(`patient_id IN (
      SELECT id FROM patients WHERE organization_id = $${paramIndex}
    )`)
    queryParams.push(context.organizationId)
    paramIndex++
    
    if (normalizedPhone) {
      whereConditions.push(`patient_phone = $${paramIndex}`)
      queryParams.push(normalizedPhone)
      paramIndex++
    }
    
    if (name) {
      whereConditions.push(`patient_name ILIKE $${paramIndex}`)
      queryParams.push(`%${name}%`)
      paramIndex++
    }
    
    if (patientId) {
      whereConditions.push(`patient_id = $${paramIndex}`)
      queryParams.push(patientId)
      paramIndex++
    }
    
    if (dateFrom) {
      whereConditions.push(`message_timestamp >= $${paramIndex}`)
      queryParams.push(new Date(dateFrom))
      paramIndex++
    }
    
    if (dateTo) {
      whereConditions.push(`message_timestamp <= $${paramIndex}`)
      queryParams.push(new Date(dateTo))
      paramIndex++
    }
    
    if (senderType) {
      whereConditions.push(`message_sender_type = $${paramIndex}`)
      queryParams.push(senderType)
      paramIndex++
    }
    
    if (conversationSource) {
      whereConditions.push(`conversation_source = $${paramIndex}`)
      queryParams.push(conversationSource)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // First, get the summary data
    const summaryQuery = `
      SELECT 
        patient_id,
        patient_name,
        patient_phone,
        patient_email,
        COUNT(DISTINCT conversation_id)::int as total_conversations,
        COUNT(message_id)::int as total_messages,
        COUNT(CASE WHEN message_sender_type = 'user' THEN 1 END)::int as patient_messages,
        COUNT(CASE WHEN message_sender_type = 'agent' THEN 1 END)::int as staff_messages,
        COUNT(CASE WHEN message_sender_type = 'system' THEN 1 END)::int as system_messages,
        MIN(message_timestamp) as first_message,
        MAX(message_timestamp) as last_message,
        AVG(CASE WHEN conversation_sentiment_score IS NOT NULL 
            THEN conversation_sentiment_score END) as avg_sentiment_score,
        ARRAY_AGG(DISTINCT conversation_source) as conversation_sources
      FROM patient_messages_view 
      ${whereClause}
      GROUP BY patient_id, patient_name, patient_phone, patient_email
    `

    console.log(`[DEBUG] Summary query:`, summaryQuery)
    console.log(`[DEBUG] Query params:`, queryParams)

    const summaryResult = await prisma.$queryRawUnsafe(summaryQuery, ...queryParams) as SummaryQueryResult[]
    
    if (!Array.isArray(summaryResult) || summaryResult.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Patient not found or no messages available',
          code: 'PATIENT_NOT_FOUND'
        }),
        { status: 404, headers: { 'content-type': 'application/json' } }
      )
    }

    const summary = summaryResult[0]
    
    // Convert BigInt values to numbers to avoid JSON serialization issues
    const convertBigInt = (value: string | number | bigint): number => {
      if (typeof value === 'bigint') {
        return Number(value)
      }
      if (typeof value === 'string' && !isNaN(Number(value))) {
        return parseInt(value, 10)
      }
      if (typeof value === 'number') {
        return value
      }
      return 0 // fallback for any unexpected cases
    }

    // Helper function to recursively convert all BigInt values in an object
    const convertBigIntsInObject = (obj: unknown): unknown => {
      if (obj === null || obj === undefined) {
        return obj
      }
      
      if (typeof obj === 'bigint') {
        return Number(obj)
      }
      
      // Preserve Date objects
      if (obj instanceof Date) {
        return obj
      }
      
      if (Array.isArray(obj)) {
        return obj.map(convertBigIntsInObject)
      }
      
      if (typeof obj === 'object') {
        const converted: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(obj)) {
          converted[key] = convertBigIntsInObject(value)
        }
        return converted
      }
      
      return obj
    }

    // Now get the paginated messages
    const offset = (page - 1) * limit
    const messagesQuery = `
      SELECT 
        message_id,
        message_content,
        message_sender_type,
        message_timestamp,
        message_sentiment_label,
        message_sentiment_score,
        message_confidence_score,
        message_analyzed_at,
        conversation_id,
        conversation_source,
        message_sequence_in_conversation
      FROM patient_messages_view 
      ${whereClause}
      ORDER BY message_timestamp ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    const messagesParams = [...queryParams, limit, offset]
    console.log(`[DEBUG] Messages query:`, messagesQuery)
    console.log(`[DEBUG] Messages params:`, messagesParams)

    const messagesResult = await prisma.$queryRawUnsafe(messagesQuery, ...messagesParams) as MessageQueryResult[]
    
    const messages = Array.isArray(messagesResult) ? messagesResult.map((row: MessageQueryResult) => ({
      messageId: row.message_id,
      content: row.message_content,
      senderType: row.message_sender_type,
      timestamp: row.message_timestamp,
      sentimentLabel: row.message_sentiment_label,
      sentimentScore: row.message_sentiment_score ? parseFloat(row.message_sentiment_score) : undefined,
      confidenceScore: row.message_confidence_score ? parseFloat(row.message_confidence_score) : undefined,
      analyzedAt: row.message_analyzed_at,
      conversationId: row.conversation_id,
      conversationSource: row.conversation_source,
      messageSequence: row.message_sequence_in_conversation
    })) : []

    const response: PatientMessagesResponse = {
      success: true,
      summary: {
        patientId: summary.patient_id,
        patientName: summary.patient_name,
        patientPhone: summary.patient_phone,
        patientEmail: summary.patient_email,
        totalConversations: summary.total_conversations,
        totalMessages: summary.total_messages,
        patientMessages: summary.patient_messages,
        staffMessages: summary.staff_messages,
        systemMessages: summary.system_messages,
        firstMessage: summary.first_message,
        lastMessage: summary.last_message,
        avgSentimentScore: summary.avg_sentiment_score ? parseFloat(summary.avg_sentiment_score) : undefined,
        conversationSources: summary.conversation_sources || []
      },
      messages,
      pagination: {
        page,
        limit,
        total: summary.total_messages,
        hasNext: (page * limit) < summary.total_messages
      }
    }

    // Convert any remaining BigInt values before JSON serialization
    const cleanResponse = convertBigIntsInObject(response)

    console.log(`[AUDIT] Patient messages query successful`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      patientId: summary.patient_id,
      messagesReturned: messages.length,
      totalMessages: summary.total_messages
    })

    return new Response(
      JSON.stringify(cleanResponse),
      {
        status: 200,
        headers: { 
          'content-type': 'application/json',
          'x-content-type-options': 'nosniff'
        }
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error(`[ERROR] Patient messages query failed`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      error: errorMessage,
      stack: errorStack,
      // Add more details for debugging
      url: request.url,
      searchParams: new URL(request.url).searchParams.toString()
    })

    // For development, include the actual error message
    const isDevelopment = process.env.NODE_ENV === 'development'

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch patient messages',
        code: 'MESSAGES_FETCH_ERROR',
        ...(isDevelopment && { details: errorMessage, stack: errorStack })
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
})

// Force dynamic rendering
export const dynamic = 'force-dynamic' 