import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Simple health check endpoint
    return NextResponse.json({ 
      success: true, 
      message: 'Database endpoint is accessible',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 