/**
 * Test Backend Connection - NO AUTH REQUIRED
 * For testing backend connectivity during development
 */

import { NextRequest } from 'next/server'

const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://routiq-backend-prod.up.railway.app'

export const GET = async (request: NextRequest) => {
  try {
    console.log(`[TEST] Testing backend connection to: ${BACKEND_API_URL}`)
    
    // Test the active patients endpoint that was working in your curl
    const testUrl = `${BACKEND_API_URL}/api/v1/cliniko/active-patients/org_2xwHiNrj68eaRUlX10anlXGvzX7`
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    })

    const data = await response.json()

    return new Response(
      JSON.stringify({
        success: true,
        backend_url: testUrl,
        backend_status: response.status,
        backend_response: data,
        message: 'Backend connection test successful',
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
    console.error(`[TEST] Backend connection failed:`, error)

    return new Response(
      JSON.stringify({
        success: false,
        backend_url: BACKEND_API_URL,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Backend connection test failed',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' }
      }
    )
  }
}

// Force dynamic rendering
export const dynamic = 'force-dynamic' 