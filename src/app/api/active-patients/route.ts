/**
 * Active Patients API Proxy - PRODUCTION READY
 * Proxies requests to the backend API to avoid CORS issues
 * 
 * SECURITY LEVEL: HIGH
 * - Organization-scoped patient data access
 * - Clerk organization-based filtering
 * - Backend API proxy with proper error handling
 * - Comprehensive audit logging
 */

import { NextRequest } from 'next/server'
import { withClerkOrganization } from '@/lib/auth/clerk-request-context'

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://routiq-backend-v10-production.up.railway.app'

// Proxy to backend API with Clerk organization context
export const GET = withClerkOrganization(async (context, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const limit = searchParams.get('limit')
    const page = searchParams.get('page')

    // Audit log this patient data access
    console.log(`[AUDIT] Active patients proxy request`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      userRole: context.organizationRole,
      params: { page, limit, filter },
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Build backend API URL
    const backendUrl = new URL(`${BACKEND_API_URL}/api/v1/cliniko/active-patients/${context.organizationId}`)
    if (filter && filter !== 'all') backendUrl.searchParams.set('filter', filter)
    if (limit) backendUrl.searchParams.set('limit', limit)
    if (page) backendUrl.searchParams.set('page', page)

    console.log(`[DEBUG] Proxying to backend: ${backendUrl.toString()}`)

    // Proxy request to backend API
    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        // Forward any auth headers if needed
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        })
      }
    })

    if (!backendResponse.ok) {
      throw new Error(`Backend API error: ${backendResponse.status} ${backendResponse.statusText}`)
    }

    const data = await backendResponse.json()

    // Audit log successful access
    console.log(`[AUDIT] Active patients proxy successful`, {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      backendStatus: backendResponse.status,
      dataLength: Array.isArray(data?.active_patients) ? data.active_patients.length : 0
    })

    return new Response(
      JSON.stringify(data),
      {
        status: backendResponse.status,
        headers: { 
          'content-type': 'application/json',
          'x-content-type-options': 'nosniff'
        }
      }
    )

  } catch (error) {
    // Audit log the error
    console.error(`[AUDIT] Active patients access error`, {
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
        error: 'Failed to fetch active patients',
        code: 'PATIENTS_FETCH_ERROR'
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