import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId } = params;
    
    // Optional: Check if user has access to this organization
    if (orgId && orgId !== organizationId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Extract sync_mode from query parameters
    const { searchParams } = new URL(request.url);
    const syncMode = searchParams.get('sync_mode') || 'full';
    
    // Validate sync_mode parameter
    const validSyncModes = ['full', 'incremental', 'quick'];
    if (!validSyncModes.includes(syncMode)) {
      return NextResponse.json(
        { error: 'Invalid sync_mode. Must be one of: full, incremental, quick' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://routiq-backend-prod.up.railway.app/api/v1/sync/start/${organizationId}?sync_mode=${syncMode}`,
      {
        method: 'POST',
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
    console.error('Sync start API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 