import { NextResponse } from 'next/server'

// Try different import approaches for Clerk v6
export async function GET() {
  console.log('🔍 SIMPLE AUTH TEST: Starting minimal test')
  
  try {
    // Test 1: Try dynamic import to avoid server-only issues
    const { auth } = await import('@clerk/nextjs/server')
    console.log('🔍 SIMPLE AUTH TEST: Dynamic import successful')
    
    const authResult = await auth()
    console.log('🔍 SIMPLE AUTH TEST: Auth call successful:', {
      hasUserId: !!authResult?.userId,
      hasSessionId: !!authResult?.sessionId
    })
    
    return NextResponse.json({
      success: true,
      message: 'Simple auth test completed',
      authResult: {
        userId: authResult?.userId || 'NOT_SET',
        sessionId: authResult?.sessionId || 'NOT_SET',
        hasSession: !!authResult?.sessionId,
        hasUser: !!authResult?.userId
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('🔍 SIMPLE AUTH TEST ERROR:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Simple auth test failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 