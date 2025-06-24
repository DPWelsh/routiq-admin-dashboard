import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test backend health without authentication
    const response = await fetch('https://routiq-backend-prod.up.railway.app/health', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const isHealthy = response.ok;
    let backendData = null;
    
    try {
      backendData = await response.json();
    } catch (parseError) {
      // If JSON parsing fails, get text
      backendData = await response.text();
    }

    // Test API endpoints
    const endpointTests = [];
    
    // Test sync endpoints
    try {
      const syncResponse = await fetch('https://routiq-backend-prod.up.railway.app/api/v1/sync/active');
      endpointTests.push({
        endpoint: 'sync/active',
        status: syncResponse.status,
        ok: syncResponse.ok
      });
    } catch (error) {
      endpointTests.push({
        endpoint: 'sync/active',
        status: 'error',
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return NextResponse.json({
      proxy_working: true,
      backend_healthy: isHealthy,
      backend_status: response.status,
      backend_response: backendData,
      endpoint_tests: endpointTests,
      timestamp: new Date().toISOString(),
      test_info: 'Public backend health check - no auth required'
    });

  } catch (error) {
    console.error('Backend health check error:', error);
    return NextResponse.json({
      proxy_working: true,
      backend_healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
} 