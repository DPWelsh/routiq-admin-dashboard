import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const headers = Object.fromEntries(request.headers.entries())
    
    // Extract relevant headers
    const relevantHeaders = {
      'x-organization-id': headers['x-organization-id'],
      'x-organization-name': headers['x-organization-name'],
      'x-user-role': headers['x-user-role'],
      'x-user-status': headers['x-user-status'],
      'x-clerk-user-id': headers['x-clerk-user-id'],
      'x-organization-status': headers['x-organization-status']
    }

    return NextResponse.json({
      message: 'Debug headers from middleware',
      relevantHeaders,
      allHeaders: headers
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 