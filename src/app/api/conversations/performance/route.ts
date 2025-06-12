/**
 * Conversation Performance API
 * Provides analytics and performance metrics for conversations
 */

import { NextRequest } from 'next/server'
import { withClerkOrganization } from '@/lib/auth/clerk-request-context'
import { prisma } from '@/lib/prisma'

// Updated types for flexible conversation performance
interface ConversationPerformanceData {
  id: string
  routiqConversationId?: string
  chatwootConversationId?: number
  conversationSource: string
  patientName?: string
  patientPhone?: string
  assignedAgentId?: string
  agentName?: string
  botHandled: boolean
  status: string
  firstResponseTimeSeconds?: number
  avgResponseTimeSeconds?: number
  resolutionTimeSeconds?: number
  satisfactionScore?: number
  satisfactionFeedback?: string
  slaTarget: number
  slaMet?: boolean
  issueCategory?: string
  businessOutcome?: string
  revenueImpact?: number
  overallPerformanceScore?: number
  createdAt: Date
  updatedAt: Date
}

interface PerformanceAnalytics {
  totalConversations: number
  avgFirstResponseTime: number
  avgResolutionTime: number
  slaComplianceRate: number
  avgSatisfactionScore: number
  avgPerformanceScore: number
  conversationsByStatus: Record<string, number>
  conversationsByCategory: Record<string, number>
  totalRevenueImpact: number
}

interface AgentPerformance {
  agentId: string
  agentName?: string
  totalConversations: number
  avgFirstResponseTime: number
  avgResolutionTime: number
  slaComplianceRate: number
  avgSatisfactionScore: number
  avgPerformanceScore: number
  resolvedConversations: number
}

interface PerformanceResponse {
  success: boolean
  analytics: PerformanceAnalytics
  agentPerformance: AgentPerformance[]
  conversations: ConversationPerformanceData[]
  pagination: {
    page: number
    limit: number
    total: number
    hasNext: boolean
  }
}

export const GET = withClerkOrganization(async (context, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    
    // Query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const agentId = searchParams.get('agentId')
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const includeAnalytics = searchParams.get('analytics') !== 'false'
    const includeAgentStats = searchParams.get('agentStats') !== 'false'
    // NEW: Support filtering by specific conversation
    const routiqConversationId = searchParams.get('routiqConversationId')
    const chatwootConversationId = searchParams.get('chatwootConversationId')

    console.log(`[AUDIT] Performance query`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      params: { page, limit, agentId, status, category, dateFrom, dateTo, routiqConversationId, chatwootConversationId }
    })

    // Build where clause
    const whereConditions: string[] = ['organization_id = $1']
    const queryParams: unknown[] = [context.organizationId]
    let paramIndex = 2

    if (agentId) {
      whereConditions.push(`assigned_agent_id = $${paramIndex}`)
      queryParams.push(agentId)
      paramIndex++
    }

    if (status) {
      whereConditions.push(`status = $${paramIndex}`)
      queryParams.push(status)
      paramIndex++
    }

    if (category) {
      whereConditions.push(`issue_category = $${paramIndex}`)
      queryParams.push(category)
      paramIndex++
    }

    if (dateFrom) {
      whereConditions.push(`created_at >= $${paramIndex}`)
      queryParams.push(new Date(dateFrom))
      paramIndex++
    }

    if (dateTo) {
      whereConditions.push(`created_at <= $${paramIndex}`)
      queryParams.push(new Date(dateTo))
      paramIndex++
    }

    // NEW: Filter by specific conversation
    if (routiqConversationId) {
      whereConditions.push(`routiq_conversation_id = $${paramIndex}::uuid`)
      queryParams.push(routiqConversationId)
      paramIndex++
    }

    if (chatwootConversationId) {
      whereConditions.push(`chatwoot_conversation_id = $${paramIndex}`)
      queryParams.push(parseInt(chatwootConversationId.toString()))
      paramIndex++
    }

    const whereClause = whereConditions.join(' AND ')

    // Get analytics summary (updated field names)
    let analytics: PerformanceAnalytics = {
      totalConversations: 0,
      avgFirstResponseTime: 0,
      avgResolutionTime: 0,
      slaComplianceRate: 0,
      avgSatisfactionScore: 0,
      avgPerformanceScore: 0,
      conversationsByStatus: {},
      conversationsByCategory: {},
      totalRevenueImpact: 0
    }

    if (includeAnalytics) {
      const analyticsQuery = `
        SELECT 
          COUNT(*)::int as total_conversations,
          AVG(first_response_time_seconds)::int as avg_first_response_time,
          AVG(resolution_time_seconds)::int as avg_resolution_time,
          (COUNT(CASE WHEN sla_met THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) * 100)::int as sla_compliance_rate,
          AVG(satisfaction_score) as avg_satisfaction_score,
          AVG(overall_performance_score)::int as avg_performance_score,
          SUM(COALESCE(revenue_impact, 0)) as total_revenue_impact
        FROM conversation_performance 
        WHERE ${whereClause}
      `

      const analyticsResult = await prisma.$queryRawUnsafe(analyticsQuery, ...queryParams) as {
        total_conversations: number
        avg_first_response_time: number
        avg_resolution_time: number
        sla_compliance_rate: number
        avg_satisfaction_score: number
        avg_performance_score: number
        total_revenue_impact: string
      }[]
      
      if (analyticsResult.length > 0) {
        const result = analyticsResult[0]
        analytics = {
          totalConversations: result.total_conversations || 0,
          avgFirstResponseTime: result.avg_first_response_time || 0,
          avgResolutionTime: result.avg_resolution_time || 0,
          slaComplianceRate: result.sla_compliance_rate || 0,
          avgSatisfactionScore: result.avg_satisfaction_score || 0,
          avgPerformanceScore: result.avg_performance_score || 0,
          conversationsByStatus: {},
          conversationsByCategory: {},
          totalRevenueImpact: parseFloat(result.total_revenue_impact || '0')
        }
      }

      // Get status breakdown
      const statusQuery = `
        SELECT status, COUNT(*)::int as count
        FROM conversation_performance 
        WHERE ${whereClause}
        GROUP BY status
      `
      const statusResult = await prisma.$queryRawUnsafe(statusQuery, ...queryParams) as { status: string, count: number }[]
      analytics.conversationsByStatus = statusResult.reduce((acc, row) => {
        acc[row.status] = row.count
        return acc
      }, {} as Record<string, number>)

      // Get category breakdown
      const categoryQuery = `
        SELECT issue_category, COUNT(*)::int as count
        FROM conversation_performance 
        WHERE ${whereClause} AND issue_category IS NOT NULL
        GROUP BY issue_category
      `
      const categoryResult = await prisma.$queryRawUnsafe(categoryQuery, ...queryParams) as { issue_category: string, count: number }[]
      analytics.conversationsByCategory = categoryResult.reduce((acc, row) => {
        acc[row.issue_category] = row.count
        return acc
      }, {} as Record<string, number>)
    }

    // Get agent performance (updated field names)
    let agentPerformance: AgentPerformance[] = []
    if (includeAgentStats) {
      const agentQuery = `
        SELECT 
          assigned_agent_id,
          agent_name,
          COUNT(*)::int as total_conversations,
          AVG(first_response_time_seconds)::int as avg_first_response_time,
          AVG(resolution_time_seconds)::int as avg_resolution_time,
          (COUNT(CASE WHEN sla_met THEN 1 END)::FLOAT / NULLIF(COUNT(*), 0) * 100)::int as sla_compliance_rate,
          AVG(satisfaction_score) as avg_satisfaction_score,
          AVG(overall_performance_score)::int as avg_performance_score,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END)::int as resolved_conversations
        FROM conversation_performance 
        WHERE ${whereClause} AND assigned_agent_id IS NOT NULL
        GROUP BY assigned_agent_id, agent_name
        ORDER BY avg_performance_score DESC NULLS LAST
      `

      const agentResult = await prisma.$queryRawUnsafe(agentQuery, ...queryParams) as {
        assigned_agent_id: string
        agent_name: string
        total_conversations: number
        avg_first_response_time: number
        avg_resolution_time: number
        sla_compliance_rate: number
        avg_satisfaction_score: number
        avg_performance_score: number
        resolved_conversations: number
      }[]
      
      agentPerformance = agentResult.map(row => ({
        agentId: row.assigned_agent_id,
        agentName: row.agent_name,
        totalConversations: row.total_conversations || 0,
        avgFirstResponseTime: row.avg_first_response_time || 0,
        avgResolutionTime: row.avg_resolution_time || 0,
        slaComplianceRate: row.sla_compliance_rate || 0,
        avgSatisfactionScore: row.avg_satisfaction_score || 0,
        avgPerformanceScore: row.avg_performance_score || 0,
        resolvedConversations: row.resolved_conversations || 0
      }))
    }

    // Get paginated conversation details (updated field names and joins)
    const offset = (page - 1) * limit
    const conversationsQuery = `
      SELECT 
        cp.*,
        COALESCE(
          (SELECT p.name FROM conversations c JOIN patients p ON c.patient_id::uuid = p.id WHERE c.id::uuid = cp.routiq_conversation_id),
          'Unknown'
        ) as patient_name,
        COALESCE(
          (SELECT p.phone FROM conversations c JOIN patients p ON c.patient_id::uuid = p.id WHERE c.id::uuid = cp.routiq_conversation_id),
          'Unknown'
        ) as patient_phone
      FROM conversation_performance cp
      WHERE ${whereClause}
      ORDER BY cp.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    const conversationsParams = [...queryParams, limit, offset]
    const conversationsResult = await prisma.$queryRawUnsafe(conversationsQuery, ...conversationsParams) as Record<string, unknown>[]

    const conversations: ConversationPerformanceData[] = conversationsResult.map(row => ({
      id: row.id as string,
      routiqConversationId: row.routiq_conversation_id as string,
      chatwootConversationId: row.chatwoot_conversation_id as number,
      conversationSource: row.conversation_source as string,
      patientName: row.patient_name as string,
      patientPhone: row.patient_phone as string,
      assignedAgentId: row.assigned_agent_id as string,
      agentName: row.agent_name as string,
      botHandled: row.bot_handled as boolean,
      status: row.status as string,
      firstResponseTimeSeconds: row.first_response_time_seconds as number,
      avgResponseTimeSeconds: row.avg_response_time_seconds as number,
      resolutionTimeSeconds: row.resolution_time_seconds as number,
      satisfactionScore: row.satisfaction_score as number,
      satisfactionFeedback: row.satisfaction_feedback as string,
      slaTarget: row.sla_target_seconds as number,
      slaMet: row.sla_met as boolean,
      issueCategory: row.issue_category as string,
      businessOutcome: row.business_outcome as string,
      revenueImpact: row.revenue_impact ? parseFloat(row.revenue_impact as string) : undefined,
      overallPerformanceScore: row.overall_performance_score as number,
      createdAt: row.created_at as Date,
      updatedAt: row.updated_at as Date
    }))

    const response: PerformanceResponse = {
      success: true,
      analytics,
      agentPerformance,
      conversations,
      pagination: {
        page,
        limit,
        total: analytics.totalConversations,
        hasNext: (page * limit) < analytics.totalConversations
      }
    }

    console.log(`[AUDIT] Performance query successful`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      conversationsReturned: conversations.length,
      totalConversations: analytics.totalConversations
    })

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })

  } catch (error) {
    console.error(`[ERROR] Performance query failed`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch performance data',
        code: 'PERFORMANCE_FETCH_ERROR'
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
})

// POST endpoint to update performance metrics
export const POST = withClerkOrganization(async (context, request: NextRequest) => {
  let routiqConversationId: string | undefined
  let chatwootConversationId: number | undefined  
  let updateData: Record<string, unknown> = {}
  
  try {
    const body = await request.json()
    const { 
      routiqConversationId: reqRoutiqId, 
      chatwootConversationId: reqChatwootId, 
      conversationSource = 'routiq',
      ...reqUpdateData 
    } = body

    routiqConversationId = reqRoutiqId
    chatwootConversationId = reqChatwootId
    updateData = reqUpdateData

    console.log(`[AUDIT] Performance update`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      routiqConversationId,
      chatwootConversationId,
      fields: Object.keys(updateData)
    })

    // Build dynamic update query based on available conversation identifiers
    let whereClause = 'organization_id = $1'
    const whereParams: (string | number)[] = [context.organizationId]
    let paramIndex = 2

    if (routiqConversationId) {
      whereClause += ` AND routiq_conversation_id = $${paramIndex}::uuid`
      whereParams.push(routiqConversationId)
      paramIndex++
    } else if (chatwootConversationId) {
      whereClause += ` AND chatwoot_conversation_id = $${paramIndex}`
      whereParams.push(chatwootConversationId)
      paramIndex++
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Either routiqConversationId or chatwootConversationId is required',
          code: 'MISSING_CONVERSATION_ID'
        }),
        { status: 400, headers: { 'content-type': 'application/json' } }
      )
    }

    // Check if performance record exists, create if not
    const existingQuery = `SELECT id FROM conversation_performance WHERE ${whereClause}`
    const existingResult = await prisma.$queryRawUnsafe(existingQuery, ...whereParams) as { id: string }[]

    if (existingResult.length === 0) {
      // Create new performance record
      const insertQuery = `
        INSERT INTO conversation_performance (
          routiq_conversation_id,
          chatwoot_conversation_id,
          organization_id,
          conversation_source,
          ${Object.keys(updateData).join(', ')},
          created_at,
          updated_at
        ) VALUES (
          $1::uuid, $2, $3, $4,
          ${Object.keys(updateData).map((_, i) => `$${i + 5}`).join(', ')},
          NOW(), NOW()
        ) RETURNING *
      `

      const insertParams = [
        routiqConversationId || null,
        chatwootConversationId || null,
        context.organizationId,
        conversationSource,
        ...Object.values(updateData)
      ]

      const result = await prisma.$queryRawUnsafe(insertQuery, ...insertParams) as Record<string, unknown>[]
      
      return new Response(
        JSON.stringify({
          success: true,
          data: result[0],
          created: true
        }),
        { status: 201, headers: { 'content-type': 'application/json' } }
      )
    } else {
      // Update existing record
      const updateQuery = `
        UPDATE conversation_performance 
        SET ${Object.keys(updateData).map((key, i) => `${key} = $${i + paramIndex}`).join(', ')}, 
            updated_at = NOW()
        WHERE ${whereClause}
        RETURNING *
      `

      const updateParams = [...whereParams, ...Object.values(updateData)]
      const result = await prisma.$queryRawUnsafe(updateQuery, ...updateParams) as Record<string, unknown>[]

      return new Response(
        JSON.stringify({
          success: true,
          data: result[0],
          updated: true
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error(`[ERROR] Performance update failed`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      routiqConversationId,
      chatwootConversationId,
      updateData
    })

    // Return more detailed error in development
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to update performance data',
        code: 'PERFORMANCE_UPDATE_ERROR',
        ...(isDevelopment && { 
          details: error instanceof Error ? error.message : 'Unknown error',
          updateData 
        })
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }
})

export const dynamic = 'force-dynamic' 