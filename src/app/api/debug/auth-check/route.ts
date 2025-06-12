import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Auth debug starting...')
    
    // Extract organization-related headers set by middleware
    const orgHeaders = {
      'x-organization-id': request.headers.get('x-organization-id'),
      'x-organization-name': request.headers.get('x-organization-name'),
      'x-user-role': request.headers.get('x-user-role'),
      'x-user-status': request.headers.get('x-user-status'),
      'x-organization-status': request.headers.get('x-organization-status'),
      'x-clerk-user-id': request.headers.get('x-clerk-user-id'),
    }
    
    console.log('🔍 Organization headers:', orgHeaders)
    
    return NextResponse.json({
      message: 'Auth debug test - checking middleware headers',
      organizationHeaders: orgHeaders,
      hasOrgContext: Boolean(orgHeaders['x-organization-id']),
      debug: {
        step1_hasClerkUserId: !!orgHeaders['x-clerk-user-id'],
        step2_hasOrgId: !!orgHeaders['x-organization-id'],
        step3_hasOrgName: !!orgHeaders['x-organization-name'],
        step4_hasUserRole: !!orgHeaders['x-user-role'],
        middlewareWorking: !!orgHeaders['x-organization-id'] && !!orgHeaders['x-clerk-user-id']
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('🔍 Auth debug error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 