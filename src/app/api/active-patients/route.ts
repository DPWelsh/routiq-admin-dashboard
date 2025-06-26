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
import { logger, logApiRequest, logApiResponse } from '@/lib/utils/logger'

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://routiq-backend-prod.up.railway.app'

// Proxy to backend API with Clerk organization context
export const GET = withClerkOrganization(async (context, request: NextRequest) => {
  const startTime = logApiRequest(request, 'active-patients-proxy')
  
  try {
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all'
    const limit = searchParams.get('limit')
    const page = searchParams.get('page')

    logger.info('Active patients proxy request', {
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

    logger.cliniko('Proxying to backend', {
      backendUrl: backendUrl.toString(),
      organizationId: context.organizationId
    })

    const backendStartTime = Date.now()
    
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

    const backendDuration = Date.now() - backendStartTime
    
    logger.cliniko('Backend response', {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      duration_ms: backendDuration,
      organizationId: context.organizationId
    })

    if (!backendResponse.ok) {
      throw new Error(`Backend API error: ${backendResponse.status} ${backendResponse.statusText}`)
    }

    const data = await backendResponse.json()

    logger.info('Active patients proxy successful', {
      userId: context.userId,
      organizationId: context.organizationId,
      backendStatus: backendResponse.status,
      dataLength: Array.isArray(data?.active_patients) ? data.active_patients.length : 0,
      totalDuration_ms: Date.now() - startTime
    })

    const response = new Response(
      JSON.stringify(data),
      {
        status: backendResponse.status,
        headers: { 
          'content-type': 'application/json',
          'x-content-type-options': 'nosniff'
        }
      }
    )
    
    logApiResponse(request, response, startTime, 'active-patients-proxy')
    return response

  } catch (error) {
    logger.error('Active patients access error', error, {
      userId: context.userId,
      organizationId: context.organizationId,
      userRole: context.organizationRole,
      duration_ms: Date.now() - startTime
    })

    const response = new Response(
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
    
    logApiResponse(request, response, startTime, 'active-patients-proxy')
    return response
  }
})

// Force dynamic rendering for real-time data
export const dynamic = 'force-dynamic' 