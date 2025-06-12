/**
 * Individual Active Patient API - SECURED WITH RBAC
 * Task #8: Individual Record Protection - Patient Data Security
 * 
 * SECURITY LEVEL: HIGH
 * - Organization validation for individual patient records
 * - RBAC permission validation for view/edit operations
 * - Cross-organization access prevention
 * - PII protection and comprehensive audit logging
 */

import { NextRequest } from 'next/server'
import { requirePatientAccess } from '@/lib/rbac/rbac-middleware'
import { createOrganizationFilter, RequestOrganizationContext } from '@/lib/auth/request-context'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Type definitions for patient conversations
interface PatientConversation {
  id: string
  source: string | null
  status: string | null
  overallSentiment: string | null
  sentimentScore: number | null
  escalationFlag: boolean | null
  qualityRating: number | null
  createdAt: Date
  updatedAt: Date
  _count: {
    messages: number
  }
}

// GET /api/active-patients/[id] - Require PATIENTS_VIEW permission
export const GET = requirePatientAccess('view')(async (
  context: RequestOrganizationContext,
  request: NextRequest
) => {
  try {
    // Extract patient ID from URL path
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const patientId = pathSegments[pathSegments.length - 1]

    if (!patientId || patientId === 'undefined') {
      return new Response(
        JSON.stringify({
          error: 'Patient ID is required',
          code: 'MISSING_PATIENT_ID'
        }),
        { 
          status: 400,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    // Audit log this sensitive patient data access
    console.log(`[AUDIT] Individual patient access`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      userRole: context.userRole,
      patientId,
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Create organization filter
    const orgFilter = createOrganizationFilter(context)

    // First, verify the patient exists and belongs to the organization
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        ...orgFilter
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        cliniqId: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        // Include recent conversations for activity analysis
        conversations: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            source: true,
            status: true,
            overallSentiment: true,
            sentimentScore: true,
            escalationFlag: true,
            qualityRating: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                messages: true
              }
            }
          }
        },
        _count: {
          select: {
            conversations: {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
              }
            }
          }
        }
      }
    })

    if (!patient) {
      // Audit log the failed access attempt
      console.warn(`[AUDIT] Patient access denied - not found or unauthorized`, {
        timestamp: new Date().toISOString(),
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        requestedPatientId: patientId,
        reason: 'PATIENT_NOT_FOUND_OR_UNAUTHORIZED'
      })

      return new Response(
        JSON.stringify({
          error: 'Patient not found or access denied',
          code: 'PATIENT_NOT_FOUND'
        }),
        { 
          status: 404,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    // Calculate activity metrics
    const recentConversationCount = patient._count.conversations
    const totalMessageCount = patient.conversations.reduce((sum: number, conv: PatientConversation) => sum + conv._count.messages, 0)
    const hasEscalations = patient.conversations.some((conv: PatientConversation) => conv.escalationFlag)
    const lastActivityAt = patient.conversations[0]?.createdAt || patient.updatedAt
    const averageSentiment = patient.conversations.length > 0 
      ? patient.conversations
          .filter((conv: PatientConversation) => conv.sentimentScore)
          .reduce((sum: number, conv: PatientConversation) => sum + Number(conv.sentimentScore), 0) / 
        patient.conversations.filter((conv: PatientConversation) => conv.sentimentScore).length
      : null

    const response = {
      success: true,
      patient: {
        id: patient.id,
        name: patient.name,
        phone: patient.phone,
        email: patient.email,
        status: patient.status,
        cliniqId: patient.cliniqId,
        metadata: patient.metadata,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
        // Activity metrics
        activityMetrics: {
          recentConversationCount,
          totalMessageCount,
          hasEscalations,
          lastActivityAt,
          averageSentiment: averageSentiment ? Number(averageSentiment.toFixed(2)) : null,
          activityScore: Math.min(100, (recentConversationCount * 10) + (totalMessageCount * 2))
        },
        recentConversations: patient.conversations
      },
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
    console.log(`[AUDIT] Individual patient access successful`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      patientId,
      conversationCount: recentConversationCount,
      messageCount: totalMessageCount
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
    // Extract patientId for error logging
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const patientId = pathSegments[pathSegments.length - 1]
    
    // Audit log the error
    console.error(`[AUDIT] Individual patient access error`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      patientId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch patient data',
        code: 'FETCH_PATIENT_ERROR',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
})

// PATCH /api/active-patients/[id] - Require PATIENTS_EDIT permission
export const PATCH = requirePatientAccess('edit')(async (
  context: RequestOrganizationContext,
  request: NextRequest
) => {
  try {
    // Extract patient ID from URL path
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const patientId = pathSegments[pathSegments.length - 1]

    if (!patientId || patientId === 'undefined') {
      return new Response(
        JSON.stringify({
          error: 'Patient ID is required',
          code: 'MISSING_PATIENT_ID'
        }),
        { 
          status: 400,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    const body = await request.json()
    const { name, email, phone, status, metadata } = body

    // Audit log this patient update attempt
    console.log(`[AUDIT] Patient update attempt`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      userRole: context.userRole,
      patientId,
      updateFields: Object.keys(body),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Create organization filter
    const orgFilter = createOrganizationFilter(context)

    // First, verify the patient exists and belongs to the organization
    const existingPatient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        ...orgFilter
      },
      select: { id: true }
    })

    if (!existingPatient) {
      console.warn(`[AUDIT] Patient update denied - not found or unauthorized`, {
        timestamp: new Date().toISOString(),
        userId: context.clerkUserId,
        organizationId: context.organizationId,
        requestedPatientId: patientId,
        reason: 'PATIENT_NOT_FOUND_OR_UNAUTHORIZED'
      })

      return new Response(
        JSON.stringify({
          error: 'Patient not found or access denied',
          code: 'PATIENT_NOT_FOUND'
        }),
        { 
          status: 404,
          headers: { 'content-type': 'application/json' }
        }
      )
    }

    // Update the patient with organization validation
    const updatedPatient = await prisma.patient.update({
      where: {
        id: patientId,
        ...orgFilter // Ensure organization ownership
      },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(status && { status }),
        ...(metadata && { metadata }),
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Audit log successful update
    console.log(`[AUDIT] Patient update successful`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      patientId,
      updatedFields: Object.keys(body)
    })

    return new Response(
      JSON.stringify({
        success: true,
        patient: updatedPatient,
        organizationContext: {
          organizationId: context.organizationId,
          organizationName: context.organizationName,
          userRole: context.userRole
        },
        metadata: {
          updatedAt: new Date().toISOString(),
          updatedBy: context.clerkUserId,
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

  } catch (error) {
    // Extract patientId for error logging
    const url = new URL(request.url)
    const pathSegments = url.pathname.split('/')
    const patientId = pathSegments[pathSegments.length - 1]
    
    // Audit log the error
    console.error(`[AUDIT] Patient update error`, {
      timestamp: new Date().toISOString(),
      userId: context.clerkUserId,
      organizationId: context.organizationId,
      patientId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to update patient data',
        code: 'UPDATE_PATIENT_ERROR',
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