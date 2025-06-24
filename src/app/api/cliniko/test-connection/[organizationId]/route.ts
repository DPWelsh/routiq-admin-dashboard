/**
 * Cliniko Connection Test Proxy - PRODUCTION READY
 * Proxies connection test requests to the backend API to avoid CORS issues
 */

import { NextRequest } from 'next/server'
import { withClerkAuth } from '@/lib/auth/clerk-request-context'

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://routiq-backend-prod.up.railway.app'

export const GET = withClerkAuth(async (userId, request: NextRequest) => {
  try {
    const pathSegments = request.url.split('/')
    const organizationId = pathSegments[pathSegments.length - 1]

    // Build backend API URL
    const backendUrl = `${BACKEND_API_URL}/api/v1/cliniko/test-connection/${organizationId}`

    console.log(`[DEBUG] Proxying cliniko connection test to: ${backendUrl}`)

    // Proxy request to backend API
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    })

    const data = await backendResponse.json()

    console.log(`[DEBUG] Cliniko connection test proxy successful: ${backendResponse.status}`)

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
    console.error(`[ERROR] Cliniko connection test proxy failed:`, error)

    return new Response(
      JSON.stringify({
        success: false,
        connected: false,
        error: 'Failed to test cliniko connection',
        code: 'CLINIKO_CONNECTION_TEST_PROXY_ERROR'
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
}) 