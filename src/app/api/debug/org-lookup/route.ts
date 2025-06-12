import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const testUserId = 'user_2xcZomhdkwYULlRWSfwpK8OOe1K' // Your actual Clerk ID
    
    // Test the exact query that getOrganizationContext uses
    const orgUser = await prisma.organizationUser.findFirst({
      where: {
        clerkUserId: testUserId,
        status: 'active',
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          }
        }
      },
      orderBy: {
        lastActivityAt: 'desc'
      }
    })

    // Also check all records for this user
    const allRecords = await prisma.organizationUser.findMany({
      where: {
        clerkUserId: testUserId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          }
        }
      }
    })

    return NextResponse.json({
      message: 'Organization lookup test',
      testUserId,
      foundOrgUser: orgUser,
      allRecordsForUser: allRecords,
      debug: {
        orgUserExists: !!orgUser,
        organizationExists: !!orgUser?.organization,
        organizationStatus: orgUser?.organization?.status,
        userStatus: orgUser?.status,
      }
    })
    
  } catch (error) {
    console.error('Debug org lookup error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 