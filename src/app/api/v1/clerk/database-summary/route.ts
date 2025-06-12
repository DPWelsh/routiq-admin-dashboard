/**
 * Database Summary API Proxy - PRODUCTION READY
 * Proxies requests to the backend API to avoid CORS issues
 */

import { NextRequest } from 'next/server'
import { withClerkAuth } from '@/lib/auth/clerk-request-context'

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://routiq-backend-prod.up.railway.app'

export const GET = withClerkAuth(async (userId, request: NextRequest) => {
  try {
    // Build backend API URL
    const backendUrl = `${BACKEND_API_URL}/api/v1/clerk/database-summary`

    console.log(`[DEBUG] Proxying database summary to: ${backendUrl}`)

    // Proxy request to backend API
    const backendResponse = await fetch(backendUrl, {
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

    const data = await backendResponse.json()

    console.log(`[DEBUG] Database summary proxy successful: ${backendResponse.status}`)

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
    console.error(`[ERROR] Database summary proxy failed:`, error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch database summary',
        code: 'DATABASE_SUMMARY_PROXY_ERROR'
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