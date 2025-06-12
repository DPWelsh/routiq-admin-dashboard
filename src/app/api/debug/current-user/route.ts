import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId, orgRole, orgSlug } = await auth()
    
    return NextResponse.json({
      success: true,
      data: {
        clerkUserId: userId,
        clerkOrgId: orgId,
        clerkOrgRole: orgRole,
        clerkOrgSlug: orgSlug,
        hasClerkAuth: !!userId,
        hasClerkOrg: !!orgId
      },
      debug: {
        message: 'Current Clerk authentication state',
        timestamp: new Date().toISOString(),
        explanation: 'Use clerkUserId to link this user to organization_users table'
      }
    })
    
  } catch (error) {
    console.error('Current user debug error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to get current user', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 