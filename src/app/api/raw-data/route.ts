/**
 * Raw Data API - ADMIN ONLY ACCESS
 * Task #8: Emergency Security Fix - Critical Vulnerability Remediation
 * 
 * SECURITY LEVEL: CRITICAL
 * - Admin-only access (OWNER or ADMIN role required)
 * - Organization-scoped data access
 * - Comprehensive audit logging
 * - Rate limiting and monitoring
 */

import { NextRequest } from 'next/server'
import { requirePermissions } from '@/lib/rbac/rbac-middleware'
import { Permission } from '@/lib/rbac/permissions'
import { createOrganizationFilter } from '@/lib/auth/request-context'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface RawDataRecord {
  id: string
  [key: string]: unknown
}

// Require both DATA_EXPORT and SYSTEM_LOGS permissions (Admin+ only)
export const GET = requirePermissions([
  Permission.DATA_EXPORT,
  Permission.SYSTEM_LOGS
], {
  requireAll: true,
  message: 'Admin access required for raw data export'
})(async (context, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 records
    const table = searchParams.get('table') || 'chat_histories'
    const search = searchParams.get('search') || ''

    // Audit log this sensitive access
    console.log(`[AUDIT] Raw data access by user ${context.clerkUserId} from org ${context.organizationId}`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      userRole: context.userRole,
      requestedTable: table,
      limit,
      search: search ? '[REDACTED]' : 'none',
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Create organization filter
    const orgFilter = createOrganizationFilter(context)

    let data: RawDataRecord[] = []
    let totalCount = 0

    // Only allow specific tables with organization filtering
    switch (table) {
      case 'chat_histories':
        // Get conversation messages scoped to organization
        const conversations = await prisma.conversation.findMany({
          where: {
            ...orgFilter,
            ...(search && {
              OR: [
                { externalId: { contains: search, mode: 'insensitive' as const } },
                { messages: { some: { content: { contains: search, mode: 'insensitive' as const } } } }
              ]
            })
          },
          include: {
            messages: {
              take: 5, // Limit messages per conversation
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                content: true,
                createdAt: true,
                senderType: true,
                timestamp: true
              }
            },
            patient: {
              select: {
                id: true,
                name: true,
                phone: true
              }
            }
          },
          take: limit,
          orderBy: { createdAt: 'desc' }
        })

        data = conversations.map(conv => ({
          id: conv.id,
          external_id: conv.externalId,
          patient_id: conv.patientId,
          patient_name: conv.patient.name,
          patient_phone: conv.patient.phone,
          organization_id: context.organizationId, // Manually add from context
          messages: conv.messages,
          created_at: conv.createdAt
        }))

        totalCount = await prisma.conversation.count({
          where: {
            ...orgFilter,
            ...(search && {
              OR: [
                { externalId: { contains: search, mode: 'insensitive' as const } },
                { messages: { some: { content: { contains: search, mode: 'insensitive' as const } } } }
              ]
            })
          }
        })
        break

      case 'patients':
        // Get patient data scoped to organization
        const patients = await prisma.patient.findMany({
          where: {
            ...orgFilter,
            ...(search && {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search, mode: 'insensitive' as const } }
              ]
            })
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
            updatedAt: true,
            cliniqId: true,
            status: true
          }
        })

        data = patients.map(patient => ({
          ...patient,
          organization_id: context.organizationId // Add it manually since it's not in select
        }))
        
        totalCount = await prisma.patient.count({
          where: {
            ...orgFilter,
            ...(search && {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { email: { contains: search, mode: 'insensitive' as const } },
                { phone: { contains: search, mode: 'insensitive' as const } }
              ]
            })
          }
        })
        break

      case 'messages':
        // Get message data scoped to organization
        const messages = await prisma.message.findMany({
          where: {
            ...orgFilter,
            ...(search && {
              content: { contains: search, mode: 'insensitive' as const }
            })
          },
          include: {
            conversation: {
              select: {
                id: true,
                externalId: true,
                patient: {
                  select: {
                    name: true,
                    phone: true
                  }
                }
              }
            }
          },
          take: limit,
          orderBy: { createdAt: 'desc' }
        })

        data = messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          sender_type: msg.senderType,
          timestamp: msg.timestamp,
          conversation_id: msg.conversationId,
          conversation_external_id: msg.conversation.externalId,
          patient_name: msg.conversation.patient.name,
          patient_phone: msg.conversation.patient.phone,
          sentiment_score: msg.sentimentScore,
          sentiment_label: msg.sentimentLabel,
          organization_id: context.organizationId, // Manually add from context
          created_at: msg.createdAt
        }))

        totalCount = await prisma.message.count({
          where: {
            ...orgFilter,
            ...(search && {
              content: { contains: search, mode: 'insensitive' as const }
            })
          }
        })
        break

      default:
        return new Response(
          JSON.stringify({
            error: `Table '${table}' not allowed or not found`,
            code: 'INVALID_TABLE_REQUEST',
            allowedTables: ['chat_histories', 'patients', 'messages']
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' }
          }
        )
    }

    // Additional audit log for successful data export
    console.log(`[AUDIT] Raw data export successful`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      table,
      recordsReturned: data.length,
      totalAvailable: totalCount
    })

    return new Response(
      JSON.stringify({
        success: true,
        table,
        count: data.length,
        totalCount,
        limit,
        data,
        organizationContext: {
          organizationId: context.organizationId,
          organizationName: context.organizationName,
          userRole: context.userRole,
          accessLevel: 'ADMIN_RAW_DATA'
        },
        metadata: {
          exportedAt: new Date().toISOString(),
          exportedBy: context.clerkUserId,
          securityLevel: 'ORGANIZATION_SCOPED',
          auditLogged: true
        }
      }),
      {
        status: 200,
        headers: { 
          'content-type': 'application/json',
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY'
        }
      }
    )

  } catch (error) {
    // Audit log the error
    console.error(`[AUDIT] Raw data access error`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return new Response(
      JSON.stringify({
        error: 'Failed to export raw data',
        code: 'RAW_DATA_EXPORT_ERROR',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
}) 