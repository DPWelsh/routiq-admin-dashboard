/**
 * Active Patients Proxy - PRODUCTION READY
 * Proxies requests to the backend API to avoid CORS issues
 */

import { NextRequest } from 'next/server'
import { withClerkOrganization } from '@/lib/auth/clerk-request-context'

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://routiq-backend-prod.up.railway.app'

export const GET = withClerkOrganization(async (context, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const pathSegments = request.url.split('/')
    const organizationId = pathSegments[pathSegments.indexOf('patients') + 1]

    // Build backend API URL
    const backendUrl = new URL(`${BACKEND_API_URL}/api/v1/patients/${organizationId}/active`)
    
    // Forward query parameters
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.set(key, value)
    })

    console.log(`[DEBUG] Proxying patients active to: ${backendUrl.toString()}`)

    // Proxy request to backend API
    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    })

    const data = await backendResponse.json()

    console.log(`[DEBUG] Patients active proxy successful: ${backendResponse.status}`)

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
    console.error(`[ERROR] Patients active proxy failed:`, error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch active patients',
        code: 'PATIENTS_ACTIVE_PROXY_ERROR'
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