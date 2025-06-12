import { NextResponse } from 'next/server'
import { getChatwootStats } from '@/lib/database/clients/chatwoot'
import { logger } from '@/lib/logging/logger'

export async function GET() {
  try {
    logger.api.request('GET', '/api/conversations/chatwoot/stats')
    const stats = await getChatwootStats()
    
    const response = {
      success: true,
      data: stats
    }
    
    logger.api.response('GET', '/api/conversations/chatwoot/stats', 200)
    return NextResponse.json(response)
  } catch (error) {
    logger.api.error('GET', '/api/conversations/chatwoot/stats', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to fetch Chatwoot conversation statistics'
    let details = error instanceof Error ? error.message : 'Unknown error'
    
    if (details.includes('CHATWOOT_DATABASE_URL') || details.includes('DATABASE_URL')) {
      errorMessage = 'Database configuration error'
      details = 'Missing database connection. Please ensure CHATWOOT_DATABASE_URL is set in your production environment.'
    } else if (details.includes('connect') || details.includes('ECONNREFUSED')) {
      errorMessage = 'Database connection failed'
      details = 'Unable to connect to the Chatwoot database. Please check your database URL and network connectivity.'
    } else if (details.includes('relation') || details.includes('does not exist')) {
      errorMessage = 'Database schema error'
      details = 'Chatwoot tables not found. Please ensure the database contains the required Chatwoot tables.'
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details,
        environment: process.env.NODE_ENV
      },
      { status: 500 }
    )
  }
} 