import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test backend health
    const response = await fetch('https://routiq-backend-prod.up.railway.app/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const backendStatus = response.ok ? 'healthy' : 'unhealthy';
    const data = response.ok ? await response.json() : null;

    return NextResponse.json({
      proxy_status: 'working',
      backend_status: backendStatus,
      backend_response: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Backend test error:', error);
    return NextResponse.json({
      proxy_status: 'working',
      backend_status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 200 }); // Return 200 to show proxy is working
  }
} 