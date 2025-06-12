import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Log all headers received to see if middleware set them
  const headers = Object.fromEntries(request.headers.entries())
  
  console.log('🔍 API ROUTE DEBUG: Middleware Test Endpoint')
  console.log('🔍 Headers received:', {
    'x-organization-id': headers['x-organization-id'],
    'x-organization-name': headers['x-organization-name'],
    'x-user-role': headers['x-user-role'],
    'x-clerk-user-id': headers['x-clerk-user-id'],
    allHeaders: Object.keys(headers)
  })
    
    return NextResponse.json({
    success: true,
    message: 'Middleware test endpoint',
    headers: {
      'x-organization-id': headers['x-organization-id'] || 'NOT_SET',
      'x-organization-name': headers['x-organization-name'] || 'NOT_SET',
      'x-user-role': headers['x-user-role'] || 'NOT_SET',
      'x-clerk-user-id': headers['x-clerk-user-id'] || 'NOT_SET'
    },
    timestamp: new Date().toISOString()
  })
} 