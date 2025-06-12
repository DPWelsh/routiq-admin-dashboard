import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log('🔍 AUTH TEST: Starting auth() function test', { requestId })
  
  try {
    // Test basic auth() function execution
    const authResult = await auth()
    
    console.log('🔍 AUTH TEST: Auth result:', {
      requestId,
      userId: authResult?.userId,
      sessionId: authResult?.sessionId,
      orgId: authResult?.orgId,
      hasSession: !!authResult?.sessionId,
      hasUser: !!authResult?.userId
    })
    
    return NextResponse.json({
      success: true,
      message: 'Auth function test completed',
      requestId,
      authResult: {
        userId: authResult?.userId || 'NOT_SET',
        sessionId: authResult?.sessionId || 'NOT_SET',
        orgId: authResult?.orgId || 'NOT_SET',
        hasSession: !!authResult?.sessionId,
        hasUser: !!authResult?.userId
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('🔍 AUTH TEST ERROR:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Auth function failed',
      requestId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 