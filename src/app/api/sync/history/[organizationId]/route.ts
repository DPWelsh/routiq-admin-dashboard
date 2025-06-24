import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '10';
    
    // Optional: Check if user has access to this organization
    if (orgId && orgId !== organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const response = await fetch(
      `https://routiq-backend-prod.up.railway.app/api/v1/sync/history/${organizationId}?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Backend API error:', errorText);
      return NextResponse.json(
        { error: 'Backend API error', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Sync history API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 