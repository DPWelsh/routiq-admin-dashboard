import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  try {
    // Get Clerk auth data
    const authData = await auth()
    
    // Get headers set by middleware
    const headers = {
      'x-clerk-user-id': request.headers.get('x-clerk-user-id'),
      'x-clerk-org-id': request.headers.get('x-clerk-org-id'),
      'x-clerk-org-role': request.headers.get('x-clerk-org-role'),
      'x-clerk-org-slug': request.headers.get('x-clerk-org-slug'),
    }

    console.log('🔍 DEBUG AUTH:', {
      authData,
      headers,
      url: request.url
    })

    return new Response(
      JSON.stringify({
        success: true,
        authData,
        headers,
        url: request.url,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('🔍 DEBUG AUTH ERROR:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
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

export const dynamic = 'force-dynamic' 