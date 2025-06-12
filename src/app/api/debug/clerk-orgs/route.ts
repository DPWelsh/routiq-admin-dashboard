import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET() {
  try {
    const { userId, orgId, orgRole, orgSlug } = await auth()
    
    return NextResponse.json({
      message: 'Clerk organization debug',
      clerkAuth: {
        userId,
        orgId,
        orgRole, 
        orgSlug
      },
      hasClerkOrg: !!orgId,
      debug: {
        explanation: 'This shows what Clerk organization context is available'
      }
    })
    
  } catch (error) {
    console.error('Clerk org debug error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 