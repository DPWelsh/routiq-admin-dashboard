/**
 * Upcoming Appointments API - SECURED WITH CLERK AUTH
 * Fetches patients with upcoming appointments from Cliniko backend
 * 
 * SECURITY LEVEL: HIGH
 * - Organization-scoped patient data access
 * - Clerk organization-based authentication
 * - Backend integration with our Cliniko sync service
 */

import { NextRequest } from 'next/server'
import { withClerkOrganization } from '@/lib/auth/clerk-request-context'

export const GET = withClerkOrganization(async (context, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    // Audit log this upcoming appointments access
    console.log(`[AUDIT] Upcoming appointments access`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      userRole: context.organizationRole,
      params: { limit },
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Call our backend API to get upcoming appointments
    const backendUrl = process.env.BACKEND_API_URL || 'https://routiq-backend-v10-production.up.railway.app'
    const apiUrl = `${backendUrl}/api/v1/admin/cliniko/patients/${context.organizationId}/upcoming`

    console.log(`[DEBUG] Fetching upcoming appointments from: ${apiUrl}`)

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      console.error(`[ERROR] Backend API error: ${response.status} ${response.statusText}`)
      
      // If backend is not available, return empty result instead of failing
      if (response.status === 500 || response.status === 404) {
        console.log(`[DEBUG] Backend not available, returning empty result`)
        return new Response(
          JSON.stringify({
            patients: [],
            total_count: 0,
            message: 'Upcoming appointments service temporarily unavailable'
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      }
      
      throw new Error(`Backend API error: ${response.status}`)
    }

    const backendData = await response.json()
    console.log(`[SUCCESS] Retrieved ${backendData.patients?.length || 0} patients with upcoming appointments`)

    // Transform backend data to match frontend expectations
    const transformedPatients = (backendData.patients || []).map((patient: Record<string, unknown>) => ({
      id: patient.id,
      contact_id: patient.contact_id,
      contact_name: patient.contact_name,
      contact_phone: patient.contact_phone,
      upcoming_appointment_count: patient.upcoming_appointment_count,
      upcoming_appointments: patient.upcoming_appointments,
      recent_appointment_count: patient.recent_appointment_count || 0,
      total_appointment_count: patient.total_appointment_count || 0,
      last_appointment_date: patient.last_appointment_date,
      created_at: patient.created_at,
      updated_at: patient.updated_at
    }));

    // Audit log successful access
    console.log(`[AUDIT] Upcoming appointments access successful`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      patientsReturned: transformedPatients.length
    })

    return new Response(
      JSON.stringify({
        patients: transformedPatients,
        total_count: backendData.total_count || transformedPatients.length,
        organization_id: context.organizationId,
        timestamp: new Date().toISOString()
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
    console.error(`[AUDIT] Upcoming appointments access error`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      userRole: context.organizationRole,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch upcoming appointments',
        code: 'UPCOMING_APPOINTMENTS_FETCH_ERROR',
        patients: [],
        total_count: 0
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