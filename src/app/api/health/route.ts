/**
 * Health Check API - PRODUCTION READY
 * Basic health status for monitoring
 */

import { NextRequest } from 'next/server'

export const GET = async (request: NextRequest) => {
  try {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
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
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
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