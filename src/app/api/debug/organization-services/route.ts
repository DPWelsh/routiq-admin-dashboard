import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 });
    }

    // Check organization services configuration
    const response = await fetch(
      `https://routiq-backend-prod.up.railway.app/api/v1/admin/organization-services/${orgId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        error: 'Backend API error',
        details: errorText,
        status: response.status,
        organization_id: orgId
      }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json({
      organization_id: orgId,
      services: data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Organization services check error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 